import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createCommentSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/tickets/[id]/comments
export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const role = (session.user as { role?: string }).role;
  const userId = session.user.id;

  // Verify the user can access this ticket
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  if (role === "CLIENT" && ticket.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (role === "LEVEL_2" && ticket.assignedToId !== userId && !(ticket.escalationLevel === 2 && ticket.status === "ESCALATED")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (role === "LEVEL_3" && ticket.assignedToId !== userId && !(ticket.escalationLevel === 3 && ticket.status === "ESCALATED")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const comments = await prisma.comment.findMany({
    where: { ticketId: id },
    include: {
      author: { select: { displayName: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(comments);
}

// POST /api/tickets/[id]/comments
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const role = (session.user as { role?: string }).role;
  const userId = session.user.id;

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // CLIENT can only comment on their own tickets
  if (role === "CLIENT" && ticket.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Techs can only comment if assigned to the ticket or it's escalated to their level
  if (role === "LEVEL_2" && ticket.assignedToId !== userId && !(ticket.escalationLevel === 2 && ticket.status === "ESCALATED")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (role === "LEVEL_3" && ticket.assignedToId !== userId && !(ticket.escalationLevel === 3 && ticket.status === "ESCALATED")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const comment = await prisma.comment.create({
    data: {
      body: parsed.data.body,
      ticketId: id,
      authorId: userId,
    },
    include: {
      author: { select: { displayName: true, role: true } },
    },
  });

  return NextResponse.json(comment, { status: 201 });
}
