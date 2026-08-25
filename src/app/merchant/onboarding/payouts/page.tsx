import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getApprovedMerchantForSession,
  updateMerchantConnectStatus,
} from "@/lib/event-repository";
import {
  getConnectedAccountStatus,
  isStripeConnectConfigured,
} from "@/lib/stripe-connect";
import {
  ConnectPayoutsButton,
  OnboardingNav,
} from "@/components/merchant-onboarding-wizard";

export const dynamic = "force-dynamic";

const cardClass =
  "rounded-[18px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] sm:p-8";

type PageProps = {
  searchParams?: Promise<{ stripe?: string; returnTo?: string }>;
};

export default async function OnboardingPayoutsPage({ searchParams }: PageProps) {
  // searchParams is independent of the session chain, so resolve it alongside
  // rather than after. getApprovedMerchantForSession genuinely needs the session
  // first, so that one stays sequential - there's no honest way to overlap it.
  const [session, params] = await Promise.all([
    auth(),
    searchParams ?? Promise.resolve<{ stripe?: string; returnTo?: string }>({}),
  ]);
  const merchant = await getApprovedMerchantForSession(session);

  // Carried through the Stripe round trip so an established host connecting
  // from Finances / Settings / the dashboard / the create wizard is returned to
  // where they started. Only a /merchant path rides. The connect route
  // re-validates whatever we hand it, but this value now also drives a real
  // redirect() below - a Location header - so it gets the same character rule as
  // safeMerchantReturnTo rather than leaning on the route: no backslashes (some
  // parsers fold "\" into "/"), no whitespace, no control characters.
  const returnTo =
    params.returnTo &&
    params.returnTo.startsWith("/merchant") &&
    !params.returnTo.startsWith("//") &&
    !/[\\\s\u0000-\u001f]/.test(params.returnTo)
      ? params.returnTo
      : undefined;

  const stripeConfigured = isStripeConnectConfigured();
  const accountId = merchant.stripe_connect_account_id;

  let payoutsEnabled = merchant.payouts_enabled;
  let detailsSubmitted = merchant.details_submitted;

  // Returning from Stripe's hosted flow (or refresh): re-fetch the authoritative
  // status now rather than waiting on the account.updated webhook, so the UI is
  // correct the instant the merchant lands back here.
  if (params.stripe && accountId && stripeConfigured) {
    try {
      const status = await getConnectedAccountStatus(accountId);
      await updateMerchantConnectStatus(accountId, status);
      payoutsEnabled = status.payoutsEnabled;
      detailsSubmitted = status.detailsSubmitted;
    } catch {
      // Best-effort - fall back to the cached columns above.
    }
  }

  const connected = Boolean(accountId);

  // Stripe hands EVERY host back here, whichever surface they started from - the
  // connect route pins its return_url to this step precisely because the refresh
  // above is the only place that re-reads the account rather than trusting
  // columns the account.updated webhook has not written yet. Now that the read
  // has landed, send them back where they were: they get a Finances / Settings /
  // dashboard banner that finally agrees with Stripe.
  //
  // Only once their part is genuinely done, though. A host who backed out of
  // Stripe half-way needs the "Continue on Stripe" button on this page, not a
  // bounce straight back to the setup prompt they left thirty seconds ago.
  if (params.stripe === "return" && returnTo && (payoutsEnabled || detailsSubmitted)) {
    redirect(returnTo);
  }

  return (
    <div className="grid gap-6">
      <div className={`${cardClass} rise-soft`}>
        <h1 className="font-display text-3xl font-semibold leading-tight text-[color:var(--ink)]">
          Connect payouts.
        </h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--slate)]">
          Paid events run through Stripe. Connect your business and bank details
          once - Stripe collects them securely (we never see your bank
          numbers), and your event earnings pay out automatically.
        </p>

        {!stripeConfigured ? (
          <div className="mt-6 rounded-2xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-4">
            <p className="text-sm font-semibold text-[color:var(--ink)]">
              Payments aren&apos;t enabled on this environment yet.
            </p>
            <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--slate)]">
              You can keep going and run free events - connect payouts later from
              your dashboard.
            </p>
          </div>
        ) : payoutsEnabled ? (
          <div className="mt-6 rounded-2xl bg-[color:var(--lavender-100)] p-4">
            <p className="text-sm font-semibold text-[color:var(--ink)]">
              ✓ Payouts connected - you&apos;re ready to take payments.
            </p>
          </div>
        ) : connected ? (
          <div className="mt-6 grid gap-4">
            <div
              className={`rounded-2xl p-4 ${
                detailsSubmitted
                  ? "bg-[color:var(--lavender-100)]"
                  : "border border-[color:var(--line)] bg-[color:var(--champagne)]"
              }`}
            >
              <p className="text-sm font-semibold text-[color:var(--ink)]">
                {detailsSubmitted
                  ? "✓ Details submitted - Stripe is verifying."
                  : "You started setup but a few details are still needed."}
              </p>
              <p
                className={`mt-1 text-sm font-medium leading-6 ${
                  detailsSubmitted ? "text-[color:var(--ink-soft)]" : "text-[color:var(--slate)]"
                }`}
              >
                {detailsSubmitted
                  ? "Nothing more to do on Stripe - this usually clears in a few minutes and we'll flip payouts on automatically. You're good to continue."
                  : "Pick up where you left off to finish connecting your bank."}
              </p>
            </div>
            {/*
              Only prompt "Continue on Stripe" when setup is genuinely
              incomplete. Once details are submitted the merchant has finished
              their part - showing the button made it look like more action was
              required while Stripe verified asynchronously (bug board #206).
            */}
            {!detailsSubmitted ? <ConnectPayoutsButton label="Continue on Stripe →" returnTo={returnTo} /> : null}
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            <ul className="grid gap-2 text-sm font-medium leading-6 text-[color:var(--slate)]">
              <li>• Business + bank details, collected securely by Stripe</li>
              <li>• Stripe pays out to your bank on its own schedule</li>
              <li>• Takes about 5 minutes - you can skip and do it later</li>
            </ul>
            <ConnectPayoutsButton returnTo={returnTo} />
          </div>
        )}
      </div>

      <div className="rise-soft rise-d1">
        {returnTo ? (
          // This host did not walk in through the walkthrough - they came from
          // Finances, Settings, the dashboard setup bar or the middle of the
          // create wizard, and the welcome/done chain is the first run they
          // finished months ago. "Skip for now" ended it on "Create your first
          // event" for someone with forty of them, and "Back" sent them to a
          // welcome page nobody asked to re-read. One link back to whatever they
          // left is the entire nav this visit needs.
          <OnboardingNav backHref={returnTo} />
        ) : payoutsEnabled || detailsSubmitted || !stripeConfigured ? (
          // Two states earn the primary Continue. Details submitted counts as
          // "done" - the merchant has finished their part and payouts activate
          // asynchronously (#206). And when Stripe isn't configured on this
          // environment there is nothing on the page to act on, so offering a
          // ghost "Skip for now" would name an opt-out that doesn't exist and
          // hand the merchant the quietest button in the system at the exact
          // moment the flow is asking them to trust us with money.
          <OnboardingNav
            backHref="/merchant/onboarding/welcome"
            nextHref="/merchant/onboarding/done"
            nextLabel="Continue →"
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/merchant/onboarding/welcome"
              className="ck-btn ck-btn--secondary ck-btn--md"
            >
              ← Back
            </Link>
            <Link
              href="/merchant/onboarding/done"
              className="ck-btn ck-btn--ghost ck-btn--md"
            >
              Skip for now →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
