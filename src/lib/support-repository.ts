/**
 * Support-ticket persistence: the source of truth for the bug reporter.
 *
 * Flow on create:
 *   1. insert the row into support_tickets (Postgres),
 *   2. best-effort upload the screenshot to Supabase Storage,
 *   3. best-effort append a RED row to the synced Google Sheet,
 *   4. backfill screenshot_url + sheet_row.
 *
 * Steps 2–3 never throw into the request — a bug always saves even if storage or
 * Sheets is down/unconfigured.
 */

import type { Session } from "next-auth";

import { getPostgresPool } from "./postgres";
import { uploadScreenshot } from "./support-storage";
import { appendBugRow, markBugRowUserFixed, markBugRowNotFixed, updateBugRowContent } from "./support-sheets";

export type OpenBug = {
  ticketRef: string;
  subject: string;
  message: string;
  expected: string | null;
  createdAt: string;
  reporterName: string | null;
  screenshotUrl: string | null;
  aiFixed: boolean;
};

// The four reporter-facing states a bug can be moved to from the edit form. Each
// maps to a fixed combination of the underlying status / ai_fixed / is_issue
// columns (and the Sheet's colour rules): open=red, ai_fixed=amber, fixed=green,
// not_issue=gray.
export type BugStatus = "open" | "ai_fixed" | "fixed" | "not_issue";

const BUG_STATE: Record<BugStatus, { status: string; aiFixed: boolean; isIssue: boolean }> = {
  open: { status: "open", aiFixed: false, isIssue: true },
  ai_fixed: { status: "open", aiFixed: true, isIssue: true },
  fixed: { status: "fixed", aiFixed: false, isIssue: true },
  not_issue: { status: "open", aiFixed: false, isIssue: false },
};

export type ConsoleEntry = { level: string; message: string; timestamp: string };
export type NetworkEntry = {
  method: string;
  url: string;
  status: number;
  duration: number;
  timestamp: string;
  body: string;
};
export type Annotation = { id?: string; x: number; y: number; w: number; h: number; label?: string };

export type CreateTicketInput = {
  message: string; // "what is wrong"
  expected: string | null; // "what it should be"
  url: string | null; // pathname+search (for per-page matching)
  fullUrl: string | null; // absolute URL incl. origin (for the clickable Sheet link)
  screenshot: Buffer | null;
  consoleLogs: ConsoleEntry[];
  networkErrors: NetworkEntry[];
  annotations: Annotation[];
  clientMetadata: Record<string, unknown>;
  ipAddress: string | null;
};

function dbUnavailable(): Error {
  return new Error("Database is not available.");
}

async function resolveReporter(session: Session | null): Promise<{
  profileId: string | null;
  email: string | null;
  name: string | null;
  role: string;
}> {
  const email = session?.user?.email?.trim().toLowerCase() || null;
  const name = session?.user?.name?.trim() || email;
  if (!email) return { profileId: null, email: null, name: null, role: "guest" };

  const pool = getPostgresPool();
  if (!pool) return { profileId: null, email, name, role: "unknown" };

  const result = await pool.query<{ id: string; role: string | null }>(
    `select id::text, role from profiles where lower(email) = $1 limit 1`,
    [email],
  );
  return {
    profileId: result.rows[0]?.id ?? null,
    email,
    name,
    role: result.rows[0]?.role ?? "unknown",
  };
}

function makeTicketRef(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TICKET-${ts}-${rand}`;
}

/** "YYYY-MM-DD HH:MM" — a value Google Sheets parses as a sortable datetime. */
function formatDateAdded(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function createSupportTicket(
  input: CreateTicketInput,
  session: Session | null,
): Promise<{ ticketRef: string; screenshotUrl: string | null }> {
  const pool = getPostgresPool();
  if (!pool) throw dbUnavailable();

  const reporter = await resolveReporter(session);
  const ticketRef = makeTicketRef();
  const subject = `Bug: ${input.message.slice(0, 120)}`;

  // 1. insert the source-of-truth row first (without the screenshot URL).
  await pool.query(
    `
      insert into support_tickets
        (ticket_ref, type, status, priority, subject, message, expected_behavior, url,
         is_issue, ai_fixed,
         console_logs, network_errors, annotations, client_metadata,
         reporter_profile_id, reporter_email, reporter_name, ip_address)
      values
        ($1, 'bug', 'open', 'high', $2, $3, $4, $5,
         true, false,
         $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb,
         $10::uuid, $11, $12, $13)
    `,
    [
      ticketRef,
      subject,
      input.message,
      input.expected,
      input.url,
      JSON.stringify(input.consoleLogs ?? []),
      JSON.stringify(input.networkErrors ?? []),
      JSON.stringify(input.annotations ?? []),
      JSON.stringify(input.clientMetadata ?? {}),
      reporter.profileId,
      reporter.email,
      reporter.name,
      input.ipAddress,
    ],
  );

  // 2. best-effort screenshot upload.
  let screenshotUrl: string | null = null;
  if (input.screenshot) {
    screenshotUrl = await uploadScreenshot(ticketRef, input.screenshot);
  }

  // 3. best-effort Google Sheet append (red row). The screenshot column links
  //    back through the app (letsclick.app/api/...) rather than to raw storage.
  const sheetRow = await appendBugRow({
    ticketRef,
    url: input.url ?? "",
    fullUrl: input.fullUrl ?? input.url ?? "",
    role: reporter.role,
    dateAdded: formatDateAdded(new Date()),
    whatIsWrong: input.message,
    expected: input.expected ?? "",
    hasScreenshot: Boolean(screenshotUrl),
  });

  // 4. backfill what we learned.
  if (screenshotUrl || sheetRow) {
    await pool.query(
      `update support_tickets
         set screenshot_url = coalesce($2, screenshot_url),
             sheet_row = coalesce($3, sheet_row),
             updated_at = now()
       where ticket_ref = $1`,
      [ticketRef, screenshotUrl, sheetRow],
    );
  }

  return { ticketRef, screenshotUrl };
}

/** Open bugs filed against a given page URL — powers the per-page checklist. */
export async function listOpenBugsForUrl(url: string): Promise<OpenBug[]> {
  const pool = getPostgresPool();
  if (!pool) return [];

  const result = await pool.query<{
    ticket_ref: string;
    subject: string;
    message: string;
    expected_behavior: string | null;
    created_at: string;
    reporter_name: string | null;
    screenshot_url: string | null;
    ai_fixed: boolean;
  }>(
    `
      select ticket_ref, subject, message, expected_behavior,
             to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') as created_at,
             reporter_name, screenshot_url, ai_fixed
        from support_tickets
       where url = $1 and status = 'open' and is_issue = true
       order by created_at desc
       limit 100
    `,
    [url],
  );

  return result.rows.map((r) => ({
    ticketRef: r.ticket_ref,
    subject: r.subject,
    message: r.message,
    expected: r.expected_behavior,
    createdAt: r.created_at,
    reporterName: r.reporter_name,
    screenshotUrl: r.screenshot_url,
    aiFixed: r.ai_fixed,
  }));
}

/**
 * Marks a bug fixed (idempotent) and recolours its Sheet row green. Returns true
 * if a row was newly flipped from open → fixed.
 */
export async function markTicketFixed(
  ticketRef: string,
  session: Session | null,
): Promise<boolean> {
  const pool = getPostgresPool();
  if (!pool) throw dbUnavailable();

  const reporter = await resolveReporter(session);

  const result = await pool.query<{ sheet_row: number | null }>(
    `
      update support_tickets
         set status = 'fixed',
             fixed_at = now(),
             fixed_by_profile_id = $2::uuid,
             updated_at = now()
       where ticket_ref = $1 and status <> 'fixed'
      returning sheet_row
    `,
    [ticketRef, reporter.profileId],
  );

  if (result.rowCount === 0) return false; // already fixed or unknown ref

  await markBugRowUserFixed(result.rows[0]?.sheet_row ?? null);
  return true;
}

/** "YYYY-MM-DD HH:MM" stamp for a reopen note appended to the bug's description. */
function reopenStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Reopen a bug the user reports is still broken: clear `ai_fixed`, append the
 * tester's note to the description, and recolour the Sheet row red so the AI
 * fixer picks it up again. Idempotent-ish — always appends a fresh note. Returns
 * true if a matching, non-fixed ticket was updated.
 */
export async function reopenTicketForRefix(
  ticketRef: string,
  note: string,
  session: Session | null,
): Promise<boolean> {
  const pool = getPostgresPool();
  if (!pool) throw dbUnavailable();

  await resolveReporter(session); // ensures the caller is a known/guest reporter; no-op otherwise

  const appended = `\n\n[Still not fixed · ${reopenStamp(new Date())}] ${note}`;

  const result = await pool.query<{ sheet_row: number | null; message: string }>(
    `
      update support_tickets
         set status = 'open',
             ai_fixed = false,
             fixed_at = null,
             fixed_by_profile_id = null,
             message = message || $2,
             updated_at = now()
       where ticket_ref = $1 and is_issue = true
      returning sheet_row, message
    `,
    [ticketRef, appended],
  );

  if (result.rowCount === 0) return false; // unknown ref or triaged not-an-issue

  await markBugRowNotFixed(result.rows[0]?.sheet_row ?? null, result.rows[0]?.message ?? "");
  return true;
}

/**
 * Edit an open bug's description: "what is wrong" (message) and the optional
 * "what it should be" (expected_behavior), keeping the subject in sync. When a
 * `status` is supplied, the bug is also moved to that state (status / ai_fixed /
 * is_issue columns + fixed_at stamp). Mirrors everything into the Sheet. Returns
 * true if a matching, still-an-issue ticket was updated.
 */
export async function editTicket(
  ticketRef: string,
  fields: { message: string; expected: string | null; status?: BugStatus },
  session: Session | null,
): Promise<boolean> {
  const pool = getPostgresPool();
  if (!pool) throw dbUnavailable();

  const reporter = await resolveReporter(session); // ensures the caller is a known/guest reporter

  const message = fields.message.trim();
  const expected = fields.expected?.trim() || null;
  const subject = `Bug: ${message.slice(0, 120)}`;
  const state = fields.status ? BUG_STATE[fields.status] : null;

  // Only listed bugs (open + is_issue) are editable; the WHERE matches on the
  // pre-update row, so moving a bug to fixed/not_issue still applies here.
  const result = state
    ? await pool.query<{ sheet_row: number | null }>(
        `
          update support_tickets
             set message = $2,
                 expected_behavior = $3,
                 subject = $4,
                 status = $5,
                 ai_fixed = $6,
                 is_issue = $7,
                 fixed_at = case when $5 = 'fixed' then now() else null end,
                 fixed_by_profile_id = case when $5 = 'fixed' then $8::uuid else null end,
                 updated_at = now()
           where ticket_ref = $1 and is_issue = true
          returning sheet_row
        `,
        [ticketRef, message, expected, subject, state.status, state.aiFixed, state.isIssue, reporter.profileId],
      )
    : await pool.query<{ sheet_row: number | null }>(
        `
          update support_tickets
             set message = $2,
                 expected_behavior = $3,
                 subject = $4,
                 updated_at = now()
           where ticket_ref = $1 and is_issue = true
          returning sheet_row
        `,
        [ticketRef, message, expected, subject],
      );

  if (result.rowCount === 0) return false; // unknown ref or triaged not-an-issue

  await updateBugRowContent(
    result.rows[0]?.sheet_row ?? null,
    message,
    expected ?? "",
    state ? { isIssue: state.isIssue, aiFixed: state.aiFixed, status: state.status } : undefined,
  );
  return true;
}

/** Look up a ticket's stored screenshot URL (for the public redirect link). */
export async function getScreenshotUrl(ticketRef: string): Promise<string | null> {
  const pool = getPostgresPool();
  if (!pool) return null;
  const result = await pool.query<{ screenshot_url: string | null }>(
    `select screenshot_url from support_tickets where ticket_ref = $1 limit 1`,
    [ticketRef],
  );
  return result.rows[0]?.screenshot_url ?? null;
}
