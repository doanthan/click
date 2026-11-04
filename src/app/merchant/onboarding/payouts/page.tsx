import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getApprovedMerchantForSession } from "@/lib/event-repository";
import {
  isRealConnectAccountId,
  isStripeConnectConfigured,
} from "@/lib/stripe-connect";
import { syncConnectAccount } from "@/lib/stripe-sync";
import {
  hostRequirementPhrases,
  joinPhrases,
  onlyStripeIsReviewing,
} from "@/lib/stripe-requirements";
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

  let chargesEnabled = merchant.charges_enabled;
  let payoutsEnabled = merchant.payouts_enabled;
  let detailsSubmitted = merchant.details_submitted;
  let requirements = merchant.stripe_requirements ?? [];
  let requirementsDueAt = merchant.stripe_requirements_due_at;

  // Returning from Stripe's hosted flow (or refresh): re-fetch the authoritative
  // status now rather than waiting on the account.updated webhook, so the UI is
  // correct the instant the merchant lands back here. The same locked sync the
  // webhook runs, so the two can't save in the wrong order.
  if (params.stripe && accountId && stripeConfigured) {
    try {
      const { status } = await syncConnectAccount(accountId);
      chargesEnabled = status.chargesEnabled;
      payoutsEnabled = status.payoutsEnabled;
      detailsSubmitted = status.detailsSubmitted;
      requirements = status.requirements;
      requirementsDueAt = status.requirementsDueAt;
    } catch {
      // Best-effort - fall back to the cached columns above.
    }
  }

  const connected = Boolean(accountId);
  // Signup no longer asks how the business is set up, so the first connect
  // does - and only then: once a real account exists its entity type is set.
  // Same test the connect route uses to decide it must create one.
  const askBusinessType = !merchant.business_type && !isRealConnectAccountId(accountId);

  // The two things Stripe switches on separately, shown separately (fix 4).
  // This page used to branch on payouts alone, so a host whose CHARGES Stripe
  // had paused was told "you're ready to take payments" with no way forward,
  // while the paused-payments email sent them here to fix it.
  const ready = chargesEnabled && payoutsEnabled;
  const toDo = hostRequirementPhrases(requirements);
  const dueLabel = requirementsDueAt
    ? new Intl.DateTimeFormat("en-AU", {
        day: "numeric",
        month: "short",
        timeZone: "Australia/Sydney",
      }).format(new Date(requirementsDueAt))
    : null;
  // A trip to Stripe only when the host has something to do there. When only
  // Stripe has to act - checking a document already sent - the button would
  // send them to a form with nothing on it (bug board #206).
  const hostHasToAct = !connected || toDo.length > 0 || (!detailsSubmitted && !ready);
  const stripeReviewing = connected && !ready && !hostHasToAct;

  // Stripe hands EVERY host back here, whichever surface they started from - the
  // connect route pins its return_url to this step precisely because the refresh
  // above is the only place that re-reads the account rather than trusting
  // columns the account.updated webhook has not written yet. Now that the read
  // has landed, send them back where they were: they get a Finances / Settings /
  // dashboard banner that finally agrees with Stripe.
  //
  // Only once their part is genuinely done, though. A host who backed out of
  // Stripe half-way - or one Stripe still wants something from - needs the
  // "Finish on Stripe" button on this page, not a bounce straight back to the
  // setup prompt they left thirty seconds ago.
  if (params.stripe === "return" && returnTo && connected && !hostHasToAct) {
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
          numbers), and each event&apos;s earnings go to your bank a couple of
          days after it ends.
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
        ) : connected ? (
          <div className="mt-6 grid gap-4">
            <ul className="grid gap-2 rounded-2xl bg-[color:var(--lavender-100)] p-4 text-sm leading-6 text-[color:var(--ink)]">
              <li className="flex items-start gap-2">
                <span aria-hidden className="w-4 shrink-0 font-semibold">{chargesEnabled ? "✓" : "·"}</span>
                <span>
                  <span className="font-semibold">Taking payments</span>{" "}
                  <span className="text-[color:var(--ink-soft)]">
                    {chargesEnabled ? "- on. Guests can pay for your events." : "- not on yet."}
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden className="w-4 shrink-0 font-semibold">{payoutsEnabled ? "✓" : "·"}</span>
                <span>
                  <span className="font-semibold">Paying out to your bank</span>{" "}
                  <span className="text-[color:var(--ink-soft)]">
                    {payoutsEnabled
                      ? "- on. Each event's earnings go to your bank a couple of days after it ends."
                      : "- not on yet."}
                  </span>
                </span>
              </li>
            </ul>
            {toDo.length > 0 ? (
              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-4">
                <p className="text-sm font-semibold text-[color:var(--ink)]">
                  Stripe needs {joinPhrases(toDo)}
                  {dueLabel ? ` by ${dueLabel}` : ""}.
                </p>
                <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--slate)]">
                  {ready
                    ? "Everything is on for now - sort it before then so nothing pauses."
                    : "It takes a few minutes, and whatever is off switches on by itself once Stripe has checked it."}
                </p>
              </div>
            ) : stripeReviewing || (detailsSubmitted && !ready) ? (
              <div className="rounded-2xl bg-[color:var(--lavender-100)] p-4">
                <p className="text-sm font-semibold text-[color:var(--ink)]">
                  ✓ Nothing to do - Stripe is checking what you sent.
                </p>
                <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--ink-soft)]">
                  {onlyStripeIsReviewing(requirements)
                    ? "This usually clears within a day, and we'll switch everything on automatically."
                    : "This usually clears in a few minutes, and we'll switch everything on automatically. You're good to continue."}
                </p>
              </div>
            ) : !ready ? (
              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-4">
                <p className="text-sm font-semibold text-[color:var(--ink)]">
                  You started setup but a few details are still needed.
                </p>
                <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--slate)]">
                  Pick up where you left off to finish connecting your bank.
                </p>
              </div>
            ) : null}
            {/*
              Only offer the trip to Stripe when the host has something to do
              there. Once their part is done, the button made it look like more
              action was required while Stripe verified (bug board #206).
            */}
            {hostHasToAct ? (
              <ConnectPayoutsButton
                label="Finish on Stripe →"
                returnTo={returnTo}
                askBusinessType={askBusinessType}
              />
            ) : null}
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            <ul className="grid gap-2 text-sm font-medium leading-6 text-[color:var(--slate)]">
              <li>• Business + bank details, collected securely by Stripe</li>
              <li>• Each event&apos;s earnings go to your bank a couple of days after it ends</li>
              <li>• Takes about 5 minutes - you can skip and do it later</li>
            </ul>
            <ConnectPayoutsButton returnTo={returnTo} askBusinessType={askBusinessType} />
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
        ) : (connected && !hostHasToAct) || !stripeConfigured ? (
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
