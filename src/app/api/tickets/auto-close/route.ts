import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

// POST /api/tickets/auto-close
// Closes tickets where the client hasn't interacted in 2 weeks.
// Call via cron with: curl -X POST -H "x-api-key: $AUTO_CLOSE_API_KEY" /api/tickets/auto-close
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.AUTO_CLOSE_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - TWO_WEEKS_MS);

  // Find all open tickets (not CLOSED or RESOLVED)
  const openTickets = await prisma.ticket.findMany({
    where: {
      status: { notIn: ["CLOSED", "RESOLVED"] },
    },
    select: {
      id: true,
      createdById: true,
      updatedAt: true,
      comments: {
        select: { authorId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const ticketsToClose: string[] = [];

  for (const ticket of openTickets) {
    // Find the most recent client activity:
    // 1. Last comment by the ticket creator
    // 2. Fall back to ticket updatedAt
    const lastClientComment = ticket.comments.find(
      (c) => c.authorId === ticket.createdById
    );
    const lastClientActivity = lastClientComment?.createdAt ?? ticket.updatedAt;

    if (lastClientActivity < cutoff) {
      ticketsToClose.push(ticket.id);
    }
  }

  if (ticketsToClose.length > 0) {
    await prisma.ticket.updateMany({
      where: { id: { in: ticketsToClose } },
      data: { status: "CLOSED" },
    });

    // Add a system comment to each closed ticket
    for (const ticketId of ticketsToClose) {
      await prisma.comment.create({
        data: {
          ticketId,
          body: "This ticket was automatically closed due to 2 weeks of inactivity.",
          isSystem: true,
        },
      });
    }
  }

  return NextResponse.json({
    closed: ticketsToClose.length,
    ticketIds: ticketsToClose,
  });
}
