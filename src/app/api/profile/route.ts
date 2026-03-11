import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateProfileSchema } from "@/lib/validators";

// GET /api/profile — returns the current user's full profile
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      phoneNumber: true,
      jobRole: true,
      avatarUrl: true,
      role: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// PATCH /api/profile — update the current user's profile
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { displayName, email, phoneNumber, jobRole } = parsed.data;

  // Check email uniqueness if changing
  if (email) {
    const existing = await prisma.user.findFirst({
      where: { email, id: { not: session.user.id } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Email is already in use by another account" },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      displayName,
      email,
      phoneNumber: phoneNumber || null,
      jobRole: jobRole || null,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      phoneNumber: true,
      jobRole: true,
      avatarUrl: true,
      role: true,
    },
  });

  return NextResponse.json(updated);
}
