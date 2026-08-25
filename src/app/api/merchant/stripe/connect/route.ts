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

/**
 * Where Stripe hands the host back. Same shape of guard as /merchant/login's
 * safeMerchantCallbackUrl: a merchant-portal path and nothing else, so a
 * request body cannot turn Stripe's return into an open redirect.
 *
 * Rejects anything that is not a single-slash-rooted /merchant path - which
 * rules out "//evil.example" (protocol-relative), any absolute URL, and any
 * attempt to smuggle a scheme through. Falls back to the payout step, which is
 * where every caller used to land unconditionally.
 */
const DEFAULT_RETURN_TO = "/merchant/onboarding/payouts";

export function safeMerchantReturnTo(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_RETURN_TO;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/merchant")) return DEFAULT_RETURN_TO;
  if (trimmed.startsWith("//")) return DEFAULT_RETURN_TO;
  // No control characters, no backslashes (some parsers fold "\" into "/").
  if (/[\\\s\u0000-\u001f]/.test(trimmed)) return DEFAULT_RETURN_TO;
  // A fragment would be dropped by Stripe anyway and only complicates the
  // query-string append below.
  return trimmed.split("#")[0] || DEFAULT_RETURN_TO;
}

// Creates (once) the merchant's Stripe Connect account and returns a single-use
// hosted-onboarding URL the client redirects to. Gated to approved merchants.
export async function POST(request: Request) {
  if (!isStripeConnectConfigured()) {
    return NextResponse.json(
      { error: "Payments aren't configured on this environment yet." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      returnTo?: unknown;
    } | null;
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
    // Where the host meant to end up: Finances, Settings, the dashboard setup
    // bar or the middle of the create wizard. It used to be hardcoded to the
    // payout step, so every entry point lost its intent and an established host
    // was dropped into step 2 of 3 of a first-run walkthrough that ends on
    // "Create your first event".
    const returnTo = safeMerchantReturnTo(body?.returnTo);
    // But Stripe still hands them back to the payout STEP, not straight to that
    // destination, because the payout step is the only page that re-reads the
    // connected account instead of trusting merchant_profiles. Those columns are
    // written by the account.updated webhook, which lands seconds-to-minutes
    // later - so returning a freshly-onboarded host directly to Finances showed
    // them the very "Connect Stripe" banner they had just finished acting on.
    // The destination rides along as ?returnTo=, and the step forwards them on
    // once the refresh has landed.
    const landing = (marker: "return" | "refresh") => {
      const query = new URLSearchParams({ stripe: marker });
      // Except when the destination IS the payout step - a genuine first run
      // through the walkthrough. Carrying it would hand that host a "back to
      // where you came from" link pointing at the page they are reading, in
      // place of the welcome/done chain the walkthrough needs.
      if (returnTo.split("?")[0] !== DEFAULT_RETURN_TO) query.set("returnTo", returnTo);
      return `${appUrl}${DEFAULT_RETURN_TO}?${query.toString()}`;
    };
    const url = await createAccountOnboardingLink(accountId, {
      returnUrl: landing("return"),
      refreshUrl: landing("refresh"),
    });

    return NextResponse.json({ ok: true, url });
  } catch (error) {
    console.error("[stripe/connect] onboarding failed:", error);
    return errorResponse(error);
  }
}
