import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createTicketSchema } from "@/lib/validators";

// GET /api/tickets — list tickets filtered by role
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  const userId = session.user.id;

  let where = {};

  switch (role) {
    case "CLIENT":
      // Only their own tickets
      where = { createdById: userId };
      break;
    case "LEVEL_1":
      // All open/in-progress tickets at escalation level 1, plus escalated tickets heading to L2
      where = { escalationLevel: 1 };
      break;
    case "LEVEL_2":
      // Tickets assigned to them OR escalated to level 2
      where = {
        OR: [
          { assignedToId: userId },
          { escalationLevel: 2, status: "ESCALATED" },
        ],
      };
      break;
    case "LEVEL_3":
      // Tickets assigned to them OR escalated to level 3
      where = {
        OR: [
          { assignedToId: userId },
          { escalationLevel: 3, status: "ESCALATED" },
        ],
      };
      break;
    case "ADMIN":
      // All tickets
      where = {};
      break;
  }

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { displayName: true } },
      assignedTo: { select: { displayName: true } },
    },
  });

  return NextResponse.json(tickets);
}

// POST /api/tickets — create a ticket
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { title, description, clientMachine, issueTimeStart, issueTimeEnd } =
    parsed.data;

  if (new Date(issueTimeEnd) <= new Date(issueTimeStart)) {
    return NextResponse.json(
      { error: "End time must be after start time" },
      { status: 400 }
    );
  }

  const ticket = await prisma.ticket.create({
    data: {
      title,
      description,
      clientMachine,
      issueTimeStart: new Date(issueTimeStart),
      issueTimeEnd: new Date(issueTimeEnd),
      createdById: session.user.id,
    },
  });

  return NextResponse.json(ticket, { status: 201 });
}
