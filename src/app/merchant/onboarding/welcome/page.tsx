import { OnboardingNav } from "@/components/merchant-onboarding-wizard";

const HIGHLIGHTS = [
  {
    title: "Create events in minutes",
    body: "A 5-step wizard (or a quick form) for the date, venue, capacity, and price. Submissions go live the moment they pass admin review.",
  },
  {
    title: "Free or paid — your call",
    body: "Run free meetups or sell tickets. For paid events, Click handles checkout; you connect your bank in the next step so funds land in your account.",
  },
  {
    title: "RSVPs + the door, handled",
    body: "Bookings flow into your portal. Check people in on the day, message no-shows, and export a guest list whenever you need it.",
  },
];

export default function OnboardingWelcomePage() {
  return (
    <div className="grid gap-6">
      <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow sm:p-8">
        <h2 className="font-display text-3xl font-light leading-tight">
          Welcome to the host portal.
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          You&apos;re approved to host on Click. This two-minute walkthrough
          shows how events work, then helps you connect payouts so you can take
          payments. You can skip the payout step and set it up later.
        </p>

        <ol className="mt-6 grid gap-3">
          {HIGHLIGHTS.map((item, i) => (
            <li
              key={item.title}
              className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4"
            >
              <span className="flex size-8 flex-none items-center justify-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] text-sm font-bold text-[color:var(--surface-deep)]">
                {i + 1}
              </span>
              <div>
                <h3 className="text-base font-bold text-[color:var(--ink)]">{item.title}</h3>
                <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <OnboardingNav nextHref="/merchant/onboarding/create-events" nextLabel="Let's go →" />
    </div>
  );
}
