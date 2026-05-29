import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getApprovedMerchantForSession } from "@/lib/event-repository";
import {
  createDashboardLoginUrl,
  isStripeConnectConfigured,
} from "@/lib/stripe-connect";

export const runtime = "nodejs";

// Returns a single-use URL into the merchant's Stripe Express dashboard so they
// can view payout history + bank details. Sibling to /api/merchant/stripe/connect
// (which mints the initial onboarding link); this one is for the post-connection
// "view my payouts" path surfaced from the Finances tab.

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown Stripe error." }, { status: 500 });
  }
  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error.name === "ForbiddenError") {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error.name === "NotFoundError") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  return NextResponse.json(
    { error: error.message || "Failed to open Stripe dashboard." },
    { status: 500 },
  );
}

export async function POST() {
  if (!isStripeConnectConfigured()) {
    return NextResponse.json(
      { error: "Payments aren't configured on this environment yet." },
      { status: 503 },
    );
  }

  try {
    const session = await auth();
    const merchant = await getApprovedMerchantForSession(session);

    // Gate: merchant must have completed Connect onboarding far enough that
    // charges_enabled is true — otherwise the Express dashboard is mostly
    // empty and we'd rather route them back to /merchant/onboarding/payouts.
    if (!merchant.stripe_connect_account_id || !merchant.charges_enabled) {
      return NextResponse.json(
        {
          error: "Connect payouts first to access your Stripe dashboard.",
          redirect: "/merchant/onboarding/payouts",
        },
        { status: 409 },
      );
    }

    const url = await createDashboardLoginUrl(merchant.stripe_connect_account_id);
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    return errorResponse(error);
  }
}
