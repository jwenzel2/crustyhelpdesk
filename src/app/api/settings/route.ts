import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSmtpConfig, saveSmtpConfig, verifySmtp } from "@/lib/email";

const DEFAULT_SITE_NAME = "CrustyHelpdesk";

// GET /api/settings — public (any authenticated user can read site settings)
// Admin-only fields (smtp) are included only for ADMIN users
export async function GET() {
  const session = await auth();
  const settings = await prisma.siteSettings.findMany({
    where: { key: { in: ["siteName", "siteUrl"] } },
  });

  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  const result: Record<string, unknown> = {
    siteName: map.siteName ?? DEFAULT_SITE_NAME,
    siteUrl: map.siteUrl ?? "",
  };

  // Include SMTP config for admins
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (user?.role === "ADMIN") {
      const smtp = await getSmtpConfig();
      result.smtp = smtp;
    }
  }

  return NextResponse.json(result);
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

  // Update site name
  if (body.siteName !== undefined) {
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
      create: { id: "siteName", key: "siteName", value: siteName },
    });
  }

  // Update site URL
  if (body.siteUrl !== undefined) {
    const siteUrl = typeof body.siteUrl === "string" ? body.siteUrl.trim() : "";
    if (siteUrl && siteUrl.length > 255) {
      return NextResponse.json(
        { error: "Site URL must be under 255 characters" },
        { status: 400 }
      );
    }
    if (siteUrl) {
      await prisma.siteSettings.upsert({
        where: { key: "siteUrl" },
        update: { value: siteUrl },
        create: { id: "siteUrl", key: "siteUrl", value: siteUrl },
      });
    } else {
      await prisma.siteSettings.deleteMany({ where: { key: "siteUrl" } });
    }
  }

  // Update SMTP settings
  if (body.smtp !== undefined && typeof body.smtp === "object") {
    const s = body.smtp;
    await saveSmtpConfig({
      smtpEnabled: s.smtpEnabled,
      smtpHost: s.smtpHost,
      smtpPort: s.smtpPort,
      smtpSecure: s.smtpSecure,
      smtpUser: s.smtpUser,
      smtpPass: s.smtpPass,
      smtpFrom: s.smtpFrom,
    });
  }

  // Return current state
  const settings = await prisma.siteSettings.findMany({
    where: { key: { in: ["siteName", "siteUrl"] } },
  });
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const smtp = await getSmtpConfig();

  return NextResponse.json({
    siteName: map.siteName ?? DEFAULT_SITE_NAME,
    siteUrl: map.siteUrl ?? "",
    smtp,
  });
}
