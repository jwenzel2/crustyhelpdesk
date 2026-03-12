import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAgentToken } from "@/lib/agent-auth";
import { agentResultSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/agent/tasks/[id]/results
export async function POST(request: NextRequest, context: RouteContext) {
  const agentToken = await validateAgentToken(request);
  if (!agentToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const logRequest = await prisma.logRequest.findUnique({
    where: { id },
    include: { ticket: { select: { id: true } } },
  });

  if (!logRequest) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Verify the task belongs to this agent's machine
  if (logRequest.machineName !== agentToken.machineName) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = agentResultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { status, errorMessage, entries } = parsed.data;

  await prisma.$transaction(async (tx) => {
    // Update log request status
    await tx.logRequest.update({
      where: { id },
      data: {
        status,
        errorMessage: errorMessage ?? null,
      },
    });

    // Bulk insert log entries
    if (entries.length > 0) {
      await tx.logEntry.createMany({
        data: entries.map((entry) => ({
          eventId: entry.eventId,
          level: entry.level,
          source: entry.source,
          message: entry.message,
          timestamp: new Date(entry.timestamp),
          rawXml: entry.rawXml ?? null,
          logRequestId: id,
        })),
      });
    }

    // Check if all log requests for this ticket are done
    const remaining = await tx.logRequest.count({
      where: {
        ticketId: logRequest.ticket.id,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    });

    if (remaining === 0) {
      await tx.ticket.update({
        where: { id: logRequest.ticket.id },
        data: { status: "IN_PROGRESS" },
      });

      await tx.comment.create({
        data: {
          body: "All log collection tasks have completed.",
          isSystem: true,
          ticketId: logRequest.ticket.id,
        },
      });
    }
  });

  return NextResponse.json({ success: true });
}
