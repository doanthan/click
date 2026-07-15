import { OnboardingNav } from "@/components/merchant-onboarding-wizard";

// Informational mirror of the real 5-step event create wizard
// (src/components/event-create-wizard.tsx). Teaches the shape of event
// creation without making them build one yet — the real CTA is on the last
// onboarding step.
const STEPS = [
  {
    n: "01",
    title: "Basics",
    body: "Name your event, pick a category, and write the description people read on Discover. Set the relationship goal so we bring it to the right crowd.",
  },
  {
    n: "02",
    title: "Schedule & capacity",
    body: "Choose the start date/time and how many seats you're opening. We stop bookings at capacity and run a waitlist automatically.",
  },
  {
    n: "03",
    title: "Location",
    body: "Search your venue with the address autocomplete - we drop the pin and fill suburb, state, and postcode so it shows on the map.",
  },
  {
    n: "04",
    title: "Price",
    body: "Leave it free, or set a ticket price. Paid events use Stripe checkout and pay out to the bank account you connect next.",
  },
  {
    n: "05",
    title: "Review & publish",
    body: "Check the summary and submit. It goes to admin review, then lands on Discover with its own shareable page.",
  },
];

export default function OnboardingCreateEventsPage() {
  return (
    <div className="grid gap-6">
      <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow sm:p-8">
        <h2 className="font-display text-3xl font-semibold leading-tight">
          How creating an event works.
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          When you&apos;re ready, the create-event wizard walks these five
          steps. Here&apos;s the lay of the land so nothing&apos;s a surprise.
        </p>

        <ol className="mt-6 grid gap-3">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4"
            >
              <span className="font-mono text-sm font-bold text-[color:var(--rose)]">
                {step.n}
              </span>
              <div>
                <h3 className="text-base font-bold text-[color:var(--ink)]">{step.title}</h3>
                <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <OnboardingNav
        backHref="/merchant/onboarding/welcome"
        nextHref="/merchant/onboarding/payouts"
        nextLabel="Set up payouts →"
      />
    </div>
  );
}
