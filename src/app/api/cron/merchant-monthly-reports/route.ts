import { NextResponse } from "next/server";
import { sendMerchantMonthlyReports } from "@/lib/event-repository";

export const runtime = "nodejs";
// Never cache — this writes email_events rows every run.
export const dynamic = "force-dynamic";

/**
 * Monthly merchant recap email (bug board #154).
 *
 * For every approved merchant who hosted at least one event in the target
 * month, logs a `merchant-monthly-report` email_events row: events hosted,
 * confirmed attendees, paid revenue, and their best-attended event. The real
 * provider send rides on the one-time email-provider migration; the row is the
 * audit trail / dev inbox until then.
 *
 * Target month: defaults to the PREVIOUS calendar month (so a run on the 1st
 * reports the month that just ended). Override for backfills/tests with
 * `?year=YYYY&month=MM`.
 *
 * Wire to a scheduler that sends `Authorization: Bearer ${CRON_SECRET}` — e.g.
 * a Vercel cron in vercel.json running at the start of each month:
 *   { "path": "/api/cron/merchant-monthly-reports", "schedule": "0 8 1 * *" }
 * Returns 503 until CRON_SECRET is configured, so the endpoint is never open.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; refusing to run." },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let year = Number(searchParams.get("year"));
  let month = Number(searchParams.get("month"));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    // Default to the previous calendar month.
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    year = prev.getUTCFullYear();
    month = prev.getUTCMonth() + 1;
  }

  try {
    const result = await sendMerchantMonthlyReports({ year, month });
    return NextResponse.json({ ok: true, year, month, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Monthly report run failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET is what Vercel Cron issues; POST is allowed for manual/curl triggers.
export const GET = handle;
export const POST = handle;
