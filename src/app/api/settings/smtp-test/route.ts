import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifySmtp, type SmtpConfig } from "@/lib/email";

// POST /api/settings/smtp-test — test SMTP connection (admin only)
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
  const cfg: SmtpConfig = {
    smtpEnabled: true,
    smtpHost: body.smtpHost ?? "",
    smtpPort: parseInt(body.smtpPort ?? "587", 10),
    smtpSecure: body.smtpSecure ?? false,
    smtpUser: body.smtpUser ?? "",
    smtpPass: body.smtpPass ?? "",
    smtpFrom: body.smtpFrom ?? "",
  };

  if (!cfg.smtpHost) {
    return NextResponse.json({ error: "SMTP host is required" }, { status: 400 });
  }

  const err = await verifySmtp(cfg);
  if (err) {
    return NextResponse.json({ error: err }, { status: 422 });
  }

  return NextResponse.json({ ok: true });
}
