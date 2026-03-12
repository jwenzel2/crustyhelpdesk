import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEFAULT_SITE_NAME = "CrustyHelpdesk";

// GET /api/settings — public (any authenticated user can read site name)
export async function GET() {
  const siteName = await prisma.siteSettings.findUnique({
    where: { key: "siteName" },
  });

  return NextResponse.json({
    siteName: siteName?.value ?? DEFAULT_SITE_NAME,
  });
}

// PUT /api/settings — admin only
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const siteName = typeof body.siteName === "string" ? body.siteName.trim() : "";

  if (!siteName || siteName.length > 100) {
    return NextResponse.json(
      { error: "Site name must be 1-100 characters" },
      { status: 400 }
    );
  }

  await prisma.siteSettings.upsert({
    where: { key: "siteName" },
    update: { value: siteName },
    create: { key: "siteName", value: siteName },
  });

  return NextResponse.json({ siteName });
}
