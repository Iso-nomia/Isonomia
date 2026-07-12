/**
 * POST /api/contact
 *
 * Public contact form endpoint for the marketing landing page. Sends the
 * submission to the team via AWS SES.
 *
 * Env (all optional — sensible defaults):
 *   - CONTACT_EMAIL_TO    recipient (default: rohan@isonomia.app)
 *   - CONTACT_EMAIL_FROM  SES-verified sender (default: no-reply@isonomia.app)
 *   - AWS_SES_REGION / AWS_REGION  SES region (default: us-east-1)
 *
 * Spam controls: a hidden honeypot field ("company") and basic length /
 * format validation. No auth — declared public in middleware.
 */
import { NextResponse } from "next/server";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TO = process.env.CONTACT_EMAIL_TO || "rohan@isonomia.app";
const FROM = process.env.CONTACT_EMAIL_FROM || "no-reply@isonomia.app";
const REGION =
  process.env.AWS_SES_REGION || process.env.AWS_REGION || "us-east-1";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function clean(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;

  // Honeypot: a real user never fills this. Pretend success so bots don't
  // learn they were caught.
  if (clean(b.company, 200)) {
    return NextResponse.json({ ok: true });
  }

  const name = clean(b.name, 200);
  const email = clean(b.email, 320);
  const message = clean(b.message, 5000);

  if (!name || !message || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "invalid_input" },
      { status: 400 },
    );
  }

  const text = [
    `New contact-form submission from ${BASE_LABEL()}`,
    "",
    `Name:  ${name}`,
    `Email: ${email}`,
    "",
    "Message:",
    message,
  ].join("\n");

  try {
    const ses = new SESClient({ region: REGION });
    await ses.send(
      new SendEmailCommand({
        Source: FROM,
        Destination: { ToAddresses: [TO] },
        ReplyToAddresses: [email],
        Message: {
          Subject: { Data: `Isonomia contact — ${name}` },
          Body: { Text: { Data: text } },
        },
      }),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/contact] SES send failed:", err);
    return NextResponse.json(
      { ok: false, error: "send_failed" },
      { status: 502 },
    );
  }
}

function BASE_LABEL(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "isonomia.app";
}
