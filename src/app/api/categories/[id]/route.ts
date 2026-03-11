import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateCategorySchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/categories/[id] — update category (admin only)
export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (currentUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Check uniqueness if name is changing
  if (parsed.data.name !== existing.name) {
    const duplicate = await prisma.category.findUnique({
      where: { name: parsed.data.name },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "A category with that name already exists" },
        { status: 409 }
      );
    }
  }

  const category = await prisma.category.update({
    where: { id },
    data: { name: parsed.data.name },
    select: { id: true, name: true },
  });

  return NextResponse.json(category);
}

// DELETE /api/categories/[id] — delete category (admin only)
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (currentUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const ticketCount = await prisma.ticket.count({ where: { categoryId: id } });
  if (ticketCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete category — ${ticketCount} ticket(s) are using it` },
      { status: 409 }
    );
  }

  await prisma.category.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
