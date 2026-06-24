import Link from "next/link";
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
  "rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow sm:p-8";

type PageProps = {
  searchParams?: Promise<{ stripe?: string }>;
};

export default async function OnboardingPayoutsPage({ searchParams }: PageProps) {
  const session = await auth();
  const merchant = await getApprovedMerchantForSession(session);
  const params = (await searchParams) ?? {};

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
      // Best-effort — fall back to the cached columns above.
    }
  }

  const connected = Boolean(accountId);

  return (
    <div className="grid gap-6">
      <div className={cardClass}>
        <h2 className="font-display text-3xl font-semibold leading-tight">
          Connect payouts.
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Paid events run through Stripe. Connect your business and bank details
          once — Stripe collects them securely (we never see your bank
          numbers), and your event earnings pay out automatically.
        </p>

        {!stripeConfigured ? (
          <div className="mt-6 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4">
            <p className="text-sm font-bold text-[color:var(--ink)]">
              Payments aren&apos;t enabled on this environment yet.
            </p>
            <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--mauve)]">
              You can keep going and run free events — connect payouts later from
              your dashboard.
            </p>
          </div>
        ) : payoutsEnabled ? (
          <div className="mt-6 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--peach)] p-4">
            <p className="text-sm font-bold text-[color:var(--surface-deep)]">
              ✓ Payouts connected — you&apos;re ready to take payments.
            </p>
          </div>
        ) : connected ? (
          <div className="mt-6 grid gap-4">
            <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4">
              <p className="text-sm font-bold text-[color:var(--ink)]">
                {detailsSubmitted
                  ? "Stripe is verifying your details."
                  : "You started setup but a few details are still needed."}
              </p>
              <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                {detailsSubmitted
                  ? "This usually takes a few minutes. You can continue — we'll flip payouts on automatically once Stripe approves."
                  : "Pick up where you left off to finish connecting your bank."}
              </p>
            </div>
            <ConnectPayoutsButton label="Continue on Stripe →" />
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            <ul className="grid gap-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
              <li>• Business + bank details, collected securely by Stripe</li>
              <li>• Automatic payouts after each event wraps</li>
              <li>• Takes about 5 minutes — you can skip and do it later</li>
            </ul>
            <ConnectPayoutsButton />
          </div>
        )}
      </div>

      {payoutsEnabled ? (
        <OnboardingNav
          backHref="/merchant/onboarding/create-events"
          nextHref="/merchant/onboarding/done"
          nextLabel="Continue →"
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/merchant/onboarding/create-events"
            className="inline-flex items-center justify-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--cream)]"
          >
            ← Back
          </Link>
          <Link
            href="/merchant/onboarding/done"
            className="inline-flex items-center justify-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--mauve)] hard-shadow-sm hover:bg-[color:var(--cream)]"
          >
            Skip for now →
          </Link>
        </div>
      )}
    </div>
  );
}
