import { NextResponse } from "next/server";
import { expirePaymentHolds, expireWaitlistOffers } from "@/lib/event-repository";

export const runtime = "nodejs";
// Never cache - this mutates state every run.
export const dynamic = "force-dynamic";

/**
 * Sweeps lapsed waitlist promotion offers (30-min window elapsed) and rolls each
 * freed seat to the next person in the queue. Intended to run every few minutes.
 *
 * Wire it to a scheduler that sends `Authorization: Bearer ${CRON_SECRET}` - e.g.
 * a Vercel cron entry in vercel.json:
 *   { "crons": [{ "path": "/api/cron/waitlist-expiry", "schedule": "*\/5 * * * *" }] }
 * (Vercel injects the CRON_SECRET bearer automatically when the env var is set.)
 *
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
    // Release abandoned checkout holds first (frees seats + re-offers them),
    // then sweep lapsed waitlist offers and roll those seats on too.
    const holds = await expirePaymentHolds();
    const offers = await expireWaitlistOffers();
    return NextResponse.json({
      ok: true,
      paymentHolds: holds,
      waitlistOffers: offers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Waitlist sweep failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET is what Vercel Cron issues; POST is allowed for manual/curl triggers.
export const GET = handle;
export const POST = handle;
