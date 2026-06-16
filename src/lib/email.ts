import { promises as fs } from "node:fs";
import path from "node:path";
import { getPostgresPool } from "./postgres";

type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailDeliveryResult = {
  sent: boolean;
  reason?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function getFromAddress() {
  return process.env.RESEND_FROM_EMAIL || "Click <hello@click.local>";
}

export async function sendTransactionalEmail(
  email: TransactionalEmail,
): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.CLICK_EMAIL_DEBUG === "true") {
      console.info("[Click email skipped]", {
        to: email.to,
        subject: email.subject,
        text: email.text,
      });
    }

    return { sent: false, reason: "RESEND_API_KEY is not configured." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html ?? textToHtml(email.text),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      sent: false,
      reason: body || `Resend returned ${response.status}.`,
    };
  }

  return { sent: true };
}

// ---------- Templated email logging ----------
//
// Dev/staging email log. Instead of always going through Resend, callers can
// render a template from /emails and persist the result to `email_events`.
// View a row in Supabase Studio → Table Editor → email_events → click the row
// and the side drawer shows the full rendered `html` and `vars` jsonb. The
// 012_email_events.sql migration creates the table.
//
// `logEmailEvent` is fire-and-forget — failures are warn-logged, never
// thrown — so a busted template never breaks the signup/RSVP flow that
// triggered it. Wire it as `void logEmailEvent(...)` at the end of a handler.

export type EmailTemplate =
  | "account-welcome"
  | "rsvp-attendee"
  | "rsvp-merchant"
  | "rsvp-cancelled-attendee"
  | "rsvp-cancelled-merchant"
  | "event-reminder-attendee"
  | "event-created-merchant"
  | "event-approved-merchant"
  | "event-rejected-merchant"
  | "event-cancelled-attendee"
  | "merchant-application-received"
  | "merchant-waitlisted-merchant"
  | "merchant-verified-merchant"
  | "merchant-rejected-merchant"
  | "password-reset"
  | "payment-receipt-attendee"
  | "report-received-admin"
  | "merchant-monthly-report"
  | "mutual-click-attendee"
  | "guest-invite"
  | "guest-spot-existing-user";

// Where the .html files live. Override with CLICK_EMAILS_DIR if Next moves
// cwd somewhere unexpected in your deploy; otherwise resolves from repo root.
const EMAILS_DIR = process.env.CLICK_EMAILS_DIR
  ? path.resolve(process.env.CLICK_EMAILS_DIR)
  : path.resolve(process.cwd(), "emails");

// Subject lines mirror /emails/README.md. Kept here (not in the .html) so the
// drawer's header column is readable without parsing the body.
const SUBJECTS: Record<EmailTemplate, (vars: Record<string, string>) => string> = {
  "account-welcome": () => "Welcome to Click — let's find your people",
  "rsvp-attendee": (v) =>
    `You're in — ${v.eventTitle ?? "your event"}${v.eventShortDate ? `, ${v.eventShortDate}` : ""}`,
  "rsvp-merchant": (v) =>
    `New RSVP — ${v.attendeeFirstName ?? "Someone"} is going to ${v.eventTitle ?? "your event"}`,
  "rsvp-cancelled-attendee": (v) =>
    `RSVP cancelled — ${v.eventTitle ?? "your event"}`,
  "rsvp-cancelled-merchant": (v) =>
    `${v.attendeeFirstName ?? "An attendee"} can't make ${v.eventTitle ?? "your event"}`,
  "event-reminder-attendee": (v) =>
    `Tomorrow — ${v.eventTitle ?? "your event"}`,
  "event-created-merchant": (v) =>
    `Your event is in review — ${v.eventTitle ?? ""}`.trim(),
  "event-approved-merchant": (v) =>
    `${v.eventTitle ?? "Your event"} is live`,
  "event-rejected-merchant": (v) =>
    `${v.eventTitle ?? "Your event"} needs another pass`,
  "event-cancelled-attendee": (v) =>
    `${v.eventTitle ?? "Your event"} has been cancelled`,
  "merchant-application-received": (v) =>
    `We've got your application — ${v.businessName ?? "your business"}`,
  "merchant-waitlisted-merchant": (v) =>
    `You're on the Click waitlist — ${v.suburb ?? "your area"} is coming soon`,
  "merchant-verified-merchant": (v) =>
    `${v.businessName ?? "You're"} verified — post your first event`,
  "merchant-rejected-merchant": (v) =>
    `${v.businessName ?? "Your"} application — one small change`,
  "password-reset": () => "Reset your Click password",
  "payment-receipt-attendee": (v) =>
    `Receipt — ${v.eventTitle ?? "your event"}${v.totalLabel ? ` (${v.totalLabel})` : ""}`,
  "report-received-admin": (v) =>
    `[Safety] New report — ${v.reason ?? "review needed"}`,
  "merchant-monthly-report": (v) =>
    `Your ${v.monthLabel ?? "monthly"} on Click — ${v.eventsCount ?? "0"} events, ${v.revenueLabel ?? "$0"}`,
  "mutual-click-attendee": (v) =>
    `It's mutual — you and ${v.otherName ?? "someone"} both clicked`,
  "guest-invite": (v) =>
    `${v.purchaserFirstName ?? "A friend"} saved you a spot`,
  "guest-spot-existing-user": (v) =>
    `${v.purchaserFirstName ?? "A friend"} saved you a spot at ${v.eventTitle ?? "an event"}`,
};

// In-process cache. .html files don't change between requests during a single
// Next process — restart the dev server to pick up template edits.
const templateCache = new Map<EmailTemplate, string>();

async function loadTemplate(template: EmailTemplate): Promise<string> {
  const cached = templateCache.get(template);
  if (cached) return cached;
  const file = path.join(EMAILS_DIR, `${template}.html`);
  const html = await fs.readFile(file, "utf8");
  templateCache.set(template, html);
  return html;
}

// Simple `{{var}}` replace. Whitespace inside braces is tolerated. Unknown
// keys are left in the output so a missing var is obvious in the drawer
// rather than silently rendering an empty string.
function renderHtml(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (full, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? "") : full,
  );
}

export type LogEmailInput = {
  template: EmailTemplate;
  toEmail: string;
  toProfileId?: string | null;
  vars: Record<string, string>;
};

export async function logEmailEvent(input: LogEmailInput): Promise<void> {
  try {
    const pool = getPostgresPool();
    if (!pool) {
      console.warn("logEmailEvent: no DB pool, skipping", { template: input.template });
      return;
    }

    const raw = await loadTemplate(input.template);
    const html = renderHtml(raw, input.vars);
    const subject = SUBJECTS[input.template](input.vars);

    await pool.query(
      `
        insert into email_events (template, to_email, to_profile_id, subject, html, vars)
        values ($1, $2, $3::uuid, $4, $5, $6::jsonb)
      `,
      [
        input.template,
        input.toEmail,
        input.toProfileId ?? null,
        subject,
        html,
        JSON.stringify(input.vars),
      ],
    );
  } catch (error) {
    console.warn("logEmailEvent failed", {
      template: input.template,
      toEmail: input.toEmail,
      error,
    });
  }
}

// Exposed for tests / preview pages that want the rendered output without
// inserting a row.
export async function renderTemplate(
  template: EmailTemplate,
  vars: Record<string, string>,
): Promise<{ subject: string; html: string }> {
  const raw = await loadTemplate(template);
  return { subject: SUBJECTS[template](vars), html: renderHtml(raw, vars) };
}
