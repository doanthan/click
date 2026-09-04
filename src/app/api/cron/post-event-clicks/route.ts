import { NextResponse } from "next/server";
import { notifyPostEventClickPrompts } from "@/lib/event-repository";

export const runtime = "nodejs";
// Never cache - this mutates state every run.
export const dynamic = "force-dynamic";

/**
 * Sends the post-event "did you click with anyone?" notification to attendees
 * once an event has crossed the 12-hour Click window. Idempotent (dedupes per
 * attendee+event), so it's safe to run on any cadence - hourly is plenty.
 *
 * Wire it to a scheduler that sends `Authorization: Bearer ${CRON_SECRET}`, e.g.
 * a Vercel cron in vercel.json:
 *   { "crons": [{ "path": "/api/cron/post-event-clicks", "schedule": "0 * * * *" }] }
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
    const notified = await notifyPostEventClickPrompts();
    return NextResponse.json({ ok: true, notified });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Post-event click sweep failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET is what Vercel Cron issues; POST is allowed for manual/curl triggers.
export const GET = handle;
export const POST = handle;
