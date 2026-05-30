import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getApprovedMerchantForSession,
  setMerchantConnectAccountId,
} from "@/lib/event-repository";
import {
  createAccountOnboardingLink,
  createConnectedAccount,
  isRealConnectAccountId,
  isStripeConnectConfigured,
} from "@/lib/stripe-connect";
import { getAppUrl } from "@/lib/stripe";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown Stripe Connect error." }, { status: 500 });
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
    { error: error.message || "Stripe Connect onboarding failed." },
    { status: 500 },
  );
}

// Creates (once) the merchant's Stripe Connect account and returns a single-use
// hosted-onboarding URL the client redirects to. Gated to approved merchants.
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

    // A seed placeholder (acct_seed_*) is treated as no account so we mint a
    // real one rather than 404 on the onboarding-link call below.
    let accountId = isRealConnectAccountId(merchant.stripe_connect_account_id)
      ? merchant.stripe_connect_account_id
      : null;
    if (!accountId) {
      accountId = await createConnectedAccount({
        contactEmail: merchant.contact_email,
        businessName: merchant.business_name,
        businessType: merchant.business_type,
        country: "AU",
      });
      await setMerchantConnectAccountId(merchant.id, accountId);
    }

    const appUrl = getAppUrl();
    const url = await createAccountOnboardingLink(accountId, {
      returnUrl: `${appUrl}/merchant/onboarding/payouts?stripe=return`,
      refreshUrl: `${appUrl}/merchant/onboarding/payouts?stripe=refresh`,
    });

    return NextResponse.json({ ok: true, url });
  } catch (error) {
    console.error("[stripe/connect] onboarding failed:", error);
    return errorResponse(error);
  }
}
