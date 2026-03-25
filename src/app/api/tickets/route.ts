import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createTicketSchema } from "@/lib/validators";
import { notifyTicketCreated } from "@/lib/email";

// GET /api/tickets — list tickets filtered by role, tab, and search
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  const userId = session.user.id;
  const tab = request.nextUrl.searchParams.get("status") || "open";
  const search = request.nextUrl.searchParams.get("search")?.trim() || "";

  const isClosed = tab === "closed";
  const statusFilter = isClosed ? { status: "CLOSED" as const } : { status: { not: "CLOSED" as const } };

  // Build role-based filter
  let roleFilter = {};
  if (isClosed) {
    // Closed tab: clients see only their own, staff/admin see all closed tickets
    if (role === "CLIENT") {
      roleFilter = { createdById: userId };
    }
    // Techs and admins see all closed tickets for knowledge sharing
  } else {
    // Open tab: existing role-based filtering
    switch (role) {
      case "CLIENT":
        roleFilter = { createdById: userId };
        break;
      case "LEVEL_1":
        roleFilter = { escalationLevel: 1 };
        break;
      case "LEVEL_2":
        roleFilter = {
          OR: [
            { assignedToId: userId },
            { escalationLevel: 2, status: "ESCALATED" },
          ],
        };
        break;
      case "LEVEL_3":
        roleFilter = {
          OR: [
            { assignedToId: userId },
            { escalationLevel: 3, status: "ESCALATED" },
          ],
        };
        break;
      case "ADMIN":
        roleFilter = {};
        break;
    }
  }

  // Build search filter (staff/admin only)
  let searchFilter = {};
  if (search && role !== "CLIENT") {
    searchFilter = {
      OR: [
        { title: { contains: search } },
        { description: { contains: search } },
      ],
    };
  }

  const where = {
    AND: [statusFilter, roleFilter, searchFilter].filter(
      (f) => Object.keys(f).length > 0
    ),
  };

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { displayName: true } },
      assignedTo: { select: { displayName: true } },
      category: { select: { id: true, name: true } },
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

  const { title, description, clientMachine, issueTimeStart, issueTimeEnd, categoryId, priority } =
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
      categoryId,
      priority,
    },
  });

  // Fire-and-forget email notification
  notifyTicketCreated({
    id: ticket.id,
    title: ticket.title,
    createdById: ticket.createdById,
  }).catch(() => {});

  return NextResponse.json(ticket, { status: 201 });
}
