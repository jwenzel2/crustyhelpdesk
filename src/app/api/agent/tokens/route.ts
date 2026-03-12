import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAgentTokenSchema } from "@/lib/validators";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

// GET /api/agent/tokens — list tokens (admin only)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tokens = await prisma.agentToken.findMany({
    select: {
      id: true,
      machineName: true,
      description: true,
      lastSeenAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tokens);
}

// POST /api/agent/tokens — create token (admin only, returns plaintext once)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createAgentTokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { machineName, description } = parsed.data;

  // Generate a random token with prefix
  const plaintext = `cht_${randomBytes(32).toString("hex")}`;
  const tokenHash = await bcrypt.hash(plaintext, 10);

  const agentToken = await prisma.agentToken.create({
    data: {
      tokenHash,
      machineName,
      description: description ?? null,
    },
    select: {
      id: true,
      machineName: true,
      description: true,
      createdAt: true,
    },
  });

  // Return plaintext token only on creation
  return NextResponse.json({ ...agentToken, token: plaintext }, { status: 201 });
}

// DELETE /api/agent/tokens?id=xxx — revoke token (admin only)
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tokenId = request.nextUrl.searchParams.get("id");
  if (!tokenId) {
    return NextResponse.json({ error: "Token ID required" }, { status: 400 });
  }

  const existing = await prisma.agentToken.findUnique({ where: { id: tokenId } });
  if (!existing) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  await prisma.agentToken.delete({ where: { id: tokenId } });

  return NextResponse.json({ success: true });
}
