import { NextResponse } from "next/server";
import { remindProposalRsvps } from "@/lib/event-repository";

export const runtime = "nodejs";
// Never cache — this mutates state every run.
export const dynamic = "force-dynamic";

/**
 * Reminds mutual-click partners to RSVP to their proposal's suggested event when
 * they still haven't 24h+ after the proposal was created. Idempotent (one
 * reminder per participant+event), so any cadence is safe — hourly is plenty.
 *
 * Wire it to a scheduler that sends `Authorization: Bearer ${CRON_SECRET}`, e.g.
 * a Vercel cron in vercel.json:
 *   { "crons": [{ "path": "/api/cron/proposal-rsvp-reminders", "schedule": "0 * * * *" }] }
 *
 * Returns 503 until CRON_SECRET is configured, so the endpoint is never open.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; refusing to run unauthenticated." },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const reminded = await remindProposalRsvps();
    return NextResponse.json({ ok: true, reminded });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Proposal RSVP reminder sweep failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET is what Vercel Cron issues; POST is allowed for manual/curl triggers.
export const GET = handle;
export const POST = handle;
