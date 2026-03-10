import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isStaff } from "@/lib/roles";

// GET /api/users/techs?level=2 — list techs by level (for assignment dropdowns)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role ?? "";
  if (!isStaff(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const level = request.nextUrl.searchParams.get("level");
  const roleFilter = level ? `LEVEL_${level}` : undefined;

  const users = await prisma.user.findMany({
    where: roleFilter ? { role: roleFilter } : {
      role: { in: ["LEVEL_1", "LEVEL_2", "LEVEL_3"] },
    },
    select: { id: true, displayName: true, role: true },
    orderBy: { displayName: "asc" },
  });

  return NextResponse.json(users);
}
