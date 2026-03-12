import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAgentToken } from "@/lib/agent-auth";

// GET /api/agent/tasks?machine=HOSTNAME
export async function GET(request: NextRequest) {
  const agentToken = await validateAgentToken(request);
  if (!agentToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const machine = request.nextUrl.searchParams.get("machine");
  if (!machine || machine !== agentToken.machineName) {
    return NextResponse.json(
      { error: "Machine name mismatch" },
      { status: 403 }
    );
  }

  // Find pending tasks and atomically set to IN_PROGRESS
  const tasks = await prisma.$transaction(async (tx) => {
    const pending = await tx.logRequest.findMany({
      where: {
        machineName: machine,
        status: "PENDING",
      },
      include: {
        ticket: {
          select: { id: true, title: true },
        },
      },
    });

    if (pending.length > 0) {
      await tx.logRequest.updateMany({
        where: {
          id: { in: pending.map((t) => t.id) },
        },
        data: { status: "IN_PROGRESS" },
      });
    }

    return pending;
  });

  // Update lastSeenAt
  await prisma.agentToken.update({
    where: { id: agentToken.id },
    data: { lastSeenAt: new Date() },
  });

  return NextResponse.json(tasks);
}
