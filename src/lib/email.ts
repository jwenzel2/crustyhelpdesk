import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";

// SMTP setting keys stored in SiteSettings
const SMTP_KEYS = [
  "smtpEnabled",
  "smtpHost",
  "smtpPort",
  "smtpSecure",
  "smtpUser",
  "smtpPass",
  "smtpFrom",
] as const;

export interface SmtpConfig {
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
}

/** Read SMTP configuration from SiteSettings */
export async function getSmtpConfig(): Promise<SmtpConfig> {
  const rows = await prisma.siteSettings.findMany({
    where: { key: { in: [...SMTP_KEYS] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return {
    smtpEnabled: map.smtpEnabled === "true",
    smtpHost: map.smtpHost ?? "",
    smtpPort: parseInt(map.smtpPort ?? "587", 10),
    smtpSecure: map.smtpSecure === "true",
    smtpUser: map.smtpUser ?? "",
    smtpPass: map.smtpPass ?? "",
    smtpFrom: map.smtpFrom ?? "",
  };
}

/** Save SMTP configuration to SiteSettings */
export async function saveSmtpConfig(
  cfg: Partial<SmtpConfig>
): Promise<SmtpConfig> {
  const entries: { key: string; value: string }[] = [];

  if (cfg.smtpEnabled !== undefined)
    entries.push({ key: "smtpEnabled", value: String(cfg.smtpEnabled) });
  if (cfg.smtpHost !== undefined)
    entries.push({ key: "smtpHost", value: cfg.smtpHost });
  if (cfg.smtpPort !== undefined)
    entries.push({ key: "smtpPort", value: String(cfg.smtpPort) });
  if (cfg.smtpSecure !== undefined)
    entries.push({ key: "smtpSecure", value: String(cfg.smtpSecure) });
  if (cfg.smtpUser !== undefined)
    entries.push({ key: "smtpUser", value: cfg.smtpUser });
  if (cfg.smtpPass !== undefined)
    entries.push({ key: "smtpPass", value: cfg.smtpPass });
  if (cfg.smtpFrom !== undefined)
    entries.push({ key: "smtpFrom", value: cfg.smtpFrom });

  for (const { key, value } of entries) {
    await prisma.siteSettings.upsert({
      where: { key },
      update: { value },
      create: { id: key, key, value },
    });
  }

  return getSmtpConfig();
}

/** Create a nodemailer transporter from saved SMTP config */
function createTransport(cfg: SmtpConfig) {
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpSecure,
    auth:
      cfg.smtpUser || cfg.smtpPass
        ? { user: cfg.smtpUser, pass: cfg.smtpPass }
        : undefined,
  });
}

/** Send an email. Returns true on success, false if SMTP disabled or error. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  try {
    const cfg = await getSmtpConfig();
    if (!cfg.smtpEnabled || !cfg.smtpHost) return false;

    const transport = createTransport(cfg);
    await transport.sendMail({
      from: cfg.smtpFrom || `"CrustyHelpdesk" <noreply@localhost>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return true;
  } catch (err) {
    console.error("[email] Failed to send:", err);
    return false;
  }
}

/** Verify SMTP connection. Returns null on success, error message on failure. */
export async function verifySmtp(cfg: SmtpConfig): Promise<string | null> {
  try {
    const transport = createTransport(cfg);
    await transport.verify();
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Connection failed";
  }
}

// ─── Ticket notification helpers ──────────────────────────────

async function getSiteName(): Promise<string> {
  const row = await prisma.siteSettings.findUnique({
    where: { key: "siteName" },
  });
  return row?.value ?? "CrustyHelpdesk";
}

async function getSiteUrl(): Promise<string> {
  const row = await prisma.siteSettings.findUnique({
    where: { key: "siteUrl" },
  });
  return row?.value ?? "";
}

/** Notify client that their ticket was created */
export async function notifyTicketCreated(ticket: {
  id: string;
  title: string;
  createdById: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: ticket.createdById },
  });
  if (!user?.email) return;

  const siteName = await getSiteName();
  const siteUrl = await getSiteUrl();
  const ticketUrl = siteUrl ? `${siteUrl}/tickets/${ticket.id}` : "";

  const text = [
    `Your ticket "${ticket.title}" has been created successfully.`,
    "",
    ticketUrl ? `View your ticket: ${ticketUrl}` : "",
    "",
    `— ${siteName}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = [
    `<p>Your ticket <strong>${escapeHtml(ticket.title)}</strong> has been created successfully.</p>`,
    ticketUrl
      ? `<p><a href="${escapeHtml(ticketUrl)}">View your ticket</a></p>`
      : "",
    `<p style="color:#666">&mdash; ${escapeHtml(siteName)}</p>`,
  ].join("");

  await sendEmail({
    to: user.email,
    subject: `[${siteName}] Ticket Created: ${ticket.title}`,
    text,
    html,
  });
}

/** Notify client that their ticket was updated (status change, comment, etc.) */
export async function notifyTicketUpdated(ticket: {
  id: string;
  title: string;
  createdById: string;
  updateDescription: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: ticket.createdById },
  });
  if (!user?.email) return;

  const siteName = await getSiteName();
  const siteUrl = await getSiteUrl();
  const ticketUrl = siteUrl ? `${siteUrl}/tickets/${ticket.id}` : "";

  const text = [
    `Your ticket "${ticket.title}" has been updated.`,
    "",
    ticket.updateDescription,
    "",
    ticketUrl ? `View your ticket: ${ticketUrl}` : "",
    "",
    `— ${siteName}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = [
    `<p>Your ticket <strong>${escapeHtml(ticket.title)}</strong> has been updated.</p>`,
    `<p>${escapeHtml(ticket.updateDescription)}</p>`,
    ticketUrl
      ? `<p><a href="${escapeHtml(ticketUrl)}">View your ticket</a></p>`
      : "",
    `<p style="color:#666">&mdash; ${escapeHtml(siteName)}</p>`,
  ].join("");

  await sendEmail({
    to: user.email,
    subject: `[${siteName}] Ticket Updated: ${ticket.title}`,
    text,
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
