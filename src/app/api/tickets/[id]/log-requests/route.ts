import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLogRequestSchema } from "@/lib/validators";
import { isStaff } from "@/lib/roles";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/tickets/[id]/log-requests
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  if (!role || !isStaff(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = createLogRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { logTypes } = parsed.data;

  // Compute time range with 30-minute buffer
  const bufferMs = 30 * 60 * 1000;
  const timeRangeStart = new Date(new Date(ticket.issueTimeStart).getTime() - bufferMs);
  const timeRangeEnd = new Date(new Date(ticket.issueTimeEnd).getTime() + bufferMs);

  // Create log requests and update ticket status in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const logRequests = await Promise.all(
      logTypes.map((logType) =>
        tx.logRequest.create({
          data: {
            logType,
            machineName: ticket.clientMachine,
            timeRangeStart,
            timeRangeEnd,
            ticketId: id,
          },
        })
      )
    );

    await tx.ticket.update({
      where: { id },
      data: { status: "AWAITING_LOGS" },
    });

    // Add system comment
    await tx.comment.create({
      data: {
        body: `Log collection requested for: ${logTypes.join(", ")}. Time range: ${timeRangeStart.toISOString()} to ${timeRangeEnd.toISOString()}.`,
        isSystem: true,
        ticketId: id,
      },
    });

    return logRequests;
  });

  return NextResponse.json(result, { status: 201 });
}
