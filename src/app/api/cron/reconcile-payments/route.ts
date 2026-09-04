import { NextResponse } from "next/server";
import { reconcilePendingPayments } from "@/lib/stripe-sync";

export const runtime = "nodejs";
// Never cache - this mutates state every run.
export const dynamic = "force-dynamic";

/**
 * Safety net for missed Stripe webhooks: walks recent Checkout Sessions Stripe
 * reports as paid and promotes any booking still stuck on 'pending' /
 * 'pending_payment' (see reconcilePendingPayments). Idempotent - already
 * confirmed sessions are cheap no-ops - so it's safe on any schedule; every
 * 15 minutes is plenty.
 *
 * Wire it to a scheduler that sends `Authorization: Bearer ${CRON_SECRET}` - e.g.
 * a Vercel cron entry in vercel.json:
 *   { "crons": [{ "path": "/api/cron/reconcile-payments", "schedule": "*\/15 * * * *" }] }
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
    const result = await reconcilePendingPayments({ sinceHours: 72 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment reconcile failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET is what Vercel Cron issues; POST is allowed for manual/curl triggers.
export const GET = handle;
export const POST = handle;
