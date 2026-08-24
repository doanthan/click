import { promises as fs } from "node:fs";
import path from "node:path";
import { getPostgresPool } from "./postgres";

type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
};

export type EmailDeliveryResult = {
  sent: boolean;
  providerMessageId?: string;
  reason?: string;
};

// Exported for callers that interpolate UNTRUSTED text into a template var.
// renderHtml deliberately does not escape - `suggestedEvents` in
// event-cancelled-attendee is a server-built block of <tr>s and escaping it
// would render the markup as visible text - so escaping is the caller's job
// wherever the value did not come from our own database.
export function escapeHtml(value: string) {
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

// Resend verifies the sending subdomain, not the root: send.letsclick.app is
// verified, letsclick.app is not, and a from address on the root gets a 403.
// The subdomain has no mailbox, so replies are pointed at the real inbox.
function getFromAddress() {
  return process.env.RESEND_FROM_EMAIL || "Click <hello@send.letsclick.app>";
}

function getReplyToAddress() {
  return process.env.RESEND_REPLY_TO_EMAIL || "hello@letsclick.app";
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

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(email.idempotencyKey
          ? { "Idempotency-Key": email.idempotencyKey }
          : {}),
      },
      body: JSON.stringify({
        from: getFromAddress(),
        reply_to: getReplyToAddress(),
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html ?? textToHtml(email.text),
      }),
    });
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "Could not reach Resend.",
    };
  }

  if (!response.ok) {
    const body = await response.text();
    return {
      sent: false,
      reason: body || `Resend returned ${response.status}.`,
    };
  }

  const payload = (await response.json().catch(() => null)) as { id?: string } | null;
  return { sent: true, providerMessageId: payload?.id };
}

// ---------- Templated email logging ----------
//
// Durable transactional email outbox. Callers render a template from /emails,
// persist it to `email_events`, then deliver it through Resend with the row id
// as the provider idempotency key.
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
  | "event-cancelled-merchant"
  | "event-cancelled-attendee"
  | "merchant-application-received"
  | "merchant-waitlisted-merchant"
  | "merchant-verified-merchant"
  | "merchant-rejected-merchant"
  | "password-reset"
  | "signin-link"
  | "signup-link"
  | "signin-no-account"
  | "waitlist-joined-attendee"
  | "waitlist-promoted-attendee"
  | "merchant-suspended-merchant"
  | "payment-receipt-attendee"
  | "report-received-admin"
  | "merchant-monthly-report"
  | "mutual-click-attendee"
  | "guest-invite"
  | "guest-spot-existing-user"
  | "guest-spot-cancelled"
  | "booking-refunded-attendee";

// Where the .html files live. Override with CLICK_EMAILS_DIR if Next moves
// cwd somewhere unexpected in your deploy; otherwise resolves from repo root.
const EMAILS_DIR = process.env.CLICK_EMAILS_DIR
  ? path.resolve(process.env.CLICK_EMAILS_DIR)
  : path.resolve(process.cwd(), "emails");

// Subject lines mirror /emails/README.md. Kept here (not in the .html) so the
// drawer's header column is readable without parsing the body.
const SUBJECTS: Record<EmailTemplate, (vars: Record<string, string>) => string> = {
  "account-welcome": () => "Welcome to Click - let's find your people",
  "rsvp-attendee": (v) =>
    `You're in - ${v.eventTitle ?? "your event"}${v.eventShortDate ? `, ${v.eventShortDate}` : ""}`,
  "rsvp-merchant": (v) =>
    `New RSVP - ${v.attendeeFirstName ?? "Someone"} is going to ${v.eventTitle ?? "your event"}`,
  "rsvp-cancelled-attendee": (v) =>
    `RSVP cancelled - ${v.eventTitle ?? "your event"}`,
  "rsvp-cancelled-merchant": (v) =>
    `${v.attendeeFirstName ?? "An attendee"} can't make ${v.eventTitle ?? "your event"}`,
  "event-reminder-attendee": (v) =>
    `Tomorrow - ${v.eventTitle ?? "your event"}`,
  "event-created-merchant": (v) =>
    `Your event is in review - ${v.eventTitle ?? ""}`.trim(),
  "event-approved-merchant": (v) =>
    `${v.eventTitle ?? "Your event"} is live`,
  "event-rejected-merchant": (v) =>
    `${v.eventTitle ?? "Your event"} needs another pass`,
  "event-cancelled-merchant": (v) =>
    `${v.eventTitle ?? "Your event"} was cancelled by Click`,
  "event-cancelled-attendee": (v) =>
    `${v.eventTitle ?? "Your event"} has been cancelled`,
  "merchant-application-received": (v) =>
    `We've got your application - ${v.businessName ?? "your business"}`,
  "merchant-waitlisted-merchant": (v) =>
    `You're on the Click waitlist - ${v.suburb ?? "your area"} is coming soon`,
  "merchant-verified-merchant": (v) =>
    `${v.businessName ?? "You're"} verified - post your first event`,
  "merchant-rejected-merchant": (v) =>
    `${v.businessName ?? "Your"} application - one small change`,
  "password-reset": () => "Reset your Click password",
  "signin-link": () => "Your Click sign-in link",
  "signup-link": () => "Finish creating your Click account",
  "signin-no-account": () => "No Click account on this address yet",
  "waitlist-joined-attendee": (v) =>
    `You're on the waitlist - ${v.eventTitle ?? "your event"}`,
  "waitlist-promoted-attendee": (v) =>
    `A spot opened - ${v.eventTitle ?? "your event"}`,
  "merchant-suspended-merchant": (v) =>
    `${v.businessName ?? "Your account"} has been suspended on Click`,
  "booking-refunded-attendee": (v) =>
    `Refunded - ${v.eventTitle ?? "your booking"}`,
  "payment-receipt-attendee": (v) =>
    `Receipt - ${v.eventTitle ?? "your event"}${v.totalLabel ? ` (${v.totalLabel})` : ""}`,
  "report-received-admin": (v) =>
    `[Safety] New report - ${v.reason ?? "review needed"}`,
  "merchant-monthly-report": (v) =>
    `Your ${v.monthLabel ?? "monthly"} on Click - ${v.eventsCount ?? "0"} events, ${v.revenueLabel ?? "$0"}`,
  "mutual-click-attendee": (v) =>
    `It's mutual - you clicked with ${v.otherName ?? "someone"}`,
  "guest-invite": (v) =>
    `${v.purchaserFirstName ?? "A friend"} saved you a spot`,
  "guest-spot-existing-user": (v) =>
    `${v.purchaserFirstName ?? "A friend"} saved you a spot at ${v.eventTitle ?? "an event"}`,
  "guest-spot-cancelled": (v) =>
    `Your spot at ${v.eventTitle ?? "an event"} is no longer held`,
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
    const raw = await loadTemplate(input.template);
    const html = renderHtml(raw, input.vars);
    const subject = SUBJECTS[input.template](input.vars);
    const pool = getPostgresPool();

    if (!pool) {
      const delivery = await sendTransactionalEmail({
        to: input.toEmail,
        subject,
        text: subject,
        html,
      });
      if (!delivery.sent) {
        console.warn("logEmailEvent: delivery skipped without database", {
          template: input.template,
          reason: delivery.reason,
        });
      }
      return;
    }

    const inserted = await pool.query<{ id: string }>(
      `
        insert into email_events (template, to_email, to_profile_id, subject, html, vars)
        values ($1, $2, $3::uuid, $4, $5, $6::jsonb)
        returning id::text
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
    const emailEventId = inserted.rows[0].id;
    const delivery = await sendTransactionalEmail({
      to: input.toEmail,
      subject,
      text: subject,
      html,
      idempotencyKey: `click-email-${emailEventId}`,
    });
    const status = delivery.sent
      ? "sent"
      : delivery.reason === "RESEND_API_KEY is not configured."
        ? "skipped"
        : "failed";

    await pool.query(
      `
        update email_events
        set delivery_status = $2,
            provider_message_id = $3,
            delivery_error = $4,
            attempt_count = attempt_count + 1,
            sent_at = case when $2 = 'sent' then now() else sent_at end
        where id = $1::uuid
      `,
      [
        emailEventId,
        status,
        delivery.providerMessageId ?? null,
        delivery.sent ? null : delivery.reason ?? "Unknown delivery error.",
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

export async function retryPendingEmailEvents(limit = 50) {
  const pool = getPostgresPool();
  if (!pool || !process.env.RESEND_API_KEY) return { processed: 0, sent: 0, failed: 0 };

  const pending = await pool.query<{
    id: string;
    to_email: string;
    subject: string;
    html: string;
  }>(
    `
      select id::text, to_email::text, subject, html
      from email_events
      -- 'skipped' means "we never attempted delivery because RESEND_API_KEY was
      -- absent". Once a key exists (guarded above) that is exactly a retryable
      -- state, so it belongs in the sweep - otherwise every mail logged during a
      -- misconfiguration window is stranded forever with no operator-visible queue.
      where delivery_status in ('pending', 'failed', 'skipped')
        and attempt_count < 5
        and created_at > now() - interval '7 days'
      order by created_at asc
      limit $1
    `,
    [Math.max(1, Math.min(limit, 100))],
  );

  let sent = 0;
  let failed = 0;
  for (const row of pending.rows) {
    const delivery = await sendTransactionalEmail({
      to: row.to_email,
      subject: row.subject,
      text: row.subject,
      html: row.html,
      idempotencyKey: `click-email-${row.id}`,
    });
    if (delivery.sent) sent += 1;
    else failed += 1;
    await pool.query(
      `
        update email_events
        set delivery_status = $2,
            provider_message_id = coalesce($3, provider_message_id),
            delivery_error = $4,
            attempt_count = attempt_count + 1,
            sent_at = case when $2 = 'sent' then now() else sent_at end
        where id = $1::uuid
      `,
      [
        row.id,
        delivery.sent ? "sent" : "failed",
        delivery.providerMessageId ?? null,
        delivery.sent ? null : delivery.reason ?? "Unknown delivery error.",
      ],
    );
  }

  return { processed: pending.rows.length, sent, failed };
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
