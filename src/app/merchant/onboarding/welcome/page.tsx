import Link from "next/link";
import { auth } from "@/auth";
import { FinishOnboardingButton } from "@/components/merchant-onboarding-wizard";
import { getProfileStatus } from "@/lib/event-repository";

// Step 1, and the only place the "you're in" news is delivered. The sticker and
// the h1 used to live in the onboarding layout, so they repeated above every
// step - by the last one the header was still urging the merchant to get
// started over a page that said "that's the lap". Here it lands once, as news,
// and the later steps get to speak for themselves.
//
// Most hosts now arrive here straight from the signup form (instant access in
// the pilot, registerMerchantWizardSubmit), not from an admin's approval - so
// the sticker says "You're in", which is true either way.
//
// Bodies stay deliberately un-enumerated: an earlier version of this flow spelt
// out the create-event wizard step by step and drifted out of sync with it.
// Describe the shape, let the real wizard name its own steps.
function highlights(eventsAreReviewed: boolean) {
  return [
    {
      title: "Create events in minutes",
      // An untrusted host's event lands in the admin queue, not on Discover
      // (createEventForMerchant) - which is every host who joined with instant
      // access, until their first event is approved. Promising "straight away"
      // to them is the one claim on this page the next screen would break.
      body: eventsAreReviewed
        ? "A short guided wizard covers the details - date, venue, capacity, ticket price, photos. Events get a quick look from our team before they go live, usually same-day. A paid one also needs your Stripe payouts live first."
        : "A short guided wizard covers the details - date, venue, capacity, ticket price, photos. Publishing puts a free event on Discover straight away; a paid one needs your Stripe payouts live first.",
    },
    {
      title: "Free or paid - your call",
      body: "Run free meetups or sell tickets. For paid events, Click handles checkout; connect your bank whenever you are ready to charge.",
    },
    {
      title: "RSVPs + the door, handled",
      // No messaging feature exists anywhere in the product - the word "no-show"
      // appeared in this sentence and nowhere else in the codebase. Promising it
      // on the page that follows "You're in" is the worst place to overclaim.
      // Everything named here is a thing the portal actually does.
      body: "Bookings flow into your portal. See who's coming, check guests in on the day, and export a guest list whenever you need it.",
    },
  ];
}

export default async function OnboardingWelcomePage() {
  // The layout already read this and gated on it; getProfileStatus is memoised
  // per request, so this is the same read, not a second query.
  const status = await getProfileStatus(await auth());
  const eventsAreReviewed = status.merchantProfile?.auto_approve_events !== true;

  return (
    <div className="grid gap-6">
      {/* Four staged elements, no more: sticker, headline, sub-copy, card. The
          highlights inside the card ride in with it rather than cascading, so
          the last line isn't half a second of dead time. */}
      <header>
        {/* pop-in rides on a WRAPPER, per the DS note at globals.css:774 - the
            animation's forwards fill owns `transform`, so putting it on the
            sticker itself would eat .sticker:hover's lift. */}
        <span className="pop-in inline-flex">
          <span className="sticker sticker--peach inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--purple)] pulse-ring" />
            You&apos;re in
          </span>
        </span>
        <h1 className="font-display rise-soft mt-3 text-4xl font-bold leading-[0.96] tracking-[-0.025em] sm:text-5xl">
          Let&apos;s get you <span className="text-[color:var(--purple)]">hosting</span>.
        </h1>
        {/* Not "let's get you paid" - the payout step is skippable and free
            events are a first-class path, so the frame has to fit both. */}
        <p className="rise-soft rise-d1 mt-2 max-w-2xl text-sm font-medium leading-6 text-[color:var(--slate)]">
          A quick lap around hosting on Click. Running free events? You&apos;re
          already set - connect a bank account only when you want to charge.
        </p>
      </header>

      <div className="rise-soft rise-d2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6 sm:p-8">
        <h2 className="font-display text-3xl font-semibold leading-tight text-[color:var(--ink)]">
          Welcome to the host portal.
        </h2>
        <p className="mt-3 text-sm leading-6 text-[color:var(--slate)]">
          Here&apos;s what hosting looks like from your side. Start a free event now,
          or connect payouts first if you want to sell tickets.
        </p>

        <ol className="mt-6 grid gap-3">
          {highlights(eventsAreReviewed).map((item, i) => (
            <li
              key={item.title}
              className="grid grid-cols-[auto_1fr] gap-4 rounded-xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-4"
            >
              <span className="font-display flex size-8 flex-none items-center justify-center rounded-full bg-[color:var(--lavender-100)] text-sm font-semibold text-[color:var(--purple-700)]">
                {i + 1}
              </span>
              <div>
                <h3 className="text-base font-semibold text-[color:var(--ink)]">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-[color:var(--slate)]">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <FinishOnboardingButton
          href="/merchant/events/create"
          label="Create a free event →"
        />
        <Link
          href="/merchant/onboarding/payouts"
          className="ck-btn ck-btn--secondary ck-btn--md"
        >
          Set up payouts
        </Link>
      </div>
    </div>
  );
}
