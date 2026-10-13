import { NextResponse } from "next/server";
import { releaseHeldPayouts } from "@/lib/stripe-sync";

export const runtime = "nodejs";
// Never cache - this moves money every run.
export const dynamic = "force-dynamic";

/**
 * Pays hosts after their events. Hosts' Stripe payouts are manual, so ticket
 * money waits in their Stripe balance; this pays out whatever is no longer
 * held for an upcoming or cancelled event (see src/lib/payout-release.ts).
 * Daily is enough - the hold runs a couple of days past each event anyway.
 *
 * Wired in vercel.json; Vercel sends `Authorization: Bearer ${CRON_SECRET}`.
 * Returns 503 until CRON_SECRET is configured, so the endpoint is never open.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; refusing to run an unauthenticated sweep." },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await releaseHeldPayouts();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payout release failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET is what Vercel Cron issues; POST is allowed for manual/curl triggers.
export const GET = handle;
export const POST = handle;
