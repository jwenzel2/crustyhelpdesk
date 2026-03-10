import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateTicketSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/tickets/[id]
export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const role = (session.user as { role?: string }).role;
  const userId = session.user.id;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      createdBy: { select: { displayName: true } },
      assignedTo: { select: { id: true, displayName: true } },
      logRequests: {
        include: { logEntries: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Enforce visibility per role
  if (role === "CLIENT" && ticket.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (role === "LEVEL_2" && ticket.assignedToId !== userId && !(ticket.escalationLevel === 2 && ticket.status === "ESCALATED")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (role === "LEVEL_3" && ticket.assignedToId !== userId && !(ticket.escalationLevel === 3 && ticket.status === "ESCALATED")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(ticket);
}

// PATCH /api/tickets/[id]
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const role = (session.user as { role?: string }).role;
  const userId = session.user.id;

  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // CLIENT can only update their own tickets (title/description + close)
  if (role === "CLIENT") {
    if (existing.createdById !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await request.json();
    const parsed = updateTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    // CLIENT can change title, description, and close the ticket
    const data: Record<string, unknown> = {};
    if (parsed.data.title) data.title = parsed.data.title;
    if (parsed.data.description) data.description = parsed.data.description;
    if (parsed.data.status === "CLOSED") data.status = "CLOSED";

    const ticket = await prisma.ticket.update({
      where: { id },
      data,
    });
    return NextResponse.json(ticket);
  }

  const body = await request.json();
  const parsed = updateTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};

  // L1 can escalate to L2
  if (role === "LEVEL_1") {
    if (parsed.data.status) data.status = parsed.data.status;
    if (parsed.data.title) data.title = parsed.data.title;
    if (parsed.data.description) data.description = parsed.data.description;
    if (parsed.data.assignedToId !== undefined) data.assignedToId = parsed.data.assignedToId;
    // Allow escalation to level 2 only
    if (parsed.data.escalationLevel === 2) {
      data.escalationLevel = 2;
      data.status = "ESCALATED";
      data.assignedToId = null; // Unassign so L2 pool can pick it up
    }
  }

  // L2 can work tickets or escalate to L3
  if (role === "LEVEL_2") {
    if (existing.assignedToId !== userId && !(existing.escalationLevel === 2 && existing.status === "ESCALATED")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (parsed.data.status) data.status = parsed.data.status;
    if (parsed.data.title) data.title = parsed.data.title;
    if (parsed.data.description) data.description = parsed.data.description;
    if (parsed.data.assignedToId !== undefined) data.assignedToId = parsed.data.assignedToId;
    // Allow escalation to level 3 only
    if (parsed.data.escalationLevel === 3) {
      data.escalationLevel = 3;
      data.status = "ESCALATED";
      data.assignedToId = null;
    }
  }

  // L3 can work tickets assigned/escalated to them
  if (role === "LEVEL_3") {
    if (existing.assignedToId !== userId && !(existing.escalationLevel === 3 && existing.status === "ESCALATED")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (parsed.data.status) data.status = parsed.data.status;
    if (parsed.data.title) data.title = parsed.data.title;
    if (parsed.data.description) data.description = parsed.data.description;
    if (parsed.data.assignedToId !== undefined) data.assignedToId = parsed.data.assignedToId;
  }

  // ADMIN can do everything
  if (role === "ADMIN") {
    if (parsed.data.status) data.status = parsed.data.status;
    if (parsed.data.title) data.title = parsed.data.title;
    if (parsed.data.description) data.description = parsed.data.description;
    if (parsed.data.escalationLevel) data.escalationLevel = parsed.data.escalationLevel;
    if (parsed.data.assignedToId !== undefined) data.assignedToId = parsed.data.assignedToId;
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data,
    include: {
      assignedTo: { select: { id: true, displayName: true } },
    },
  });

  return NextResponse.json(ticket);
}
