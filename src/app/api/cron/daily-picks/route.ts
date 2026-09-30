import { NextResponse } from "next/server";
import { generateDailyPicksForAll } from "@/lib/event-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One candidate query per member; the default limit is too tight past a few hundred.
export const maxDuration = 300;

/**
 * The daily picks job (CHANGE BRIEF 2026-09-30 §3.3). Writes today's three picks for
 * every member active in the last month, in the Sydney morning (vercel.json). Emits
 * no notification. Anyone it doesn't reach gets their picks on first view instead,
 * so a missed run delays nothing a member can see.
 *
 * Same `Authorization: Bearer ${CRON_SECRET}` guard as every other cron, and 503
 * until the secret is configured, so the endpoint is never open.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await generateDailyPicksForAll()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Daily picks run failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
