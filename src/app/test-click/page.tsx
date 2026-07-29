import Link from "next/link";
import { ClickWalkthrough } from "@/components/click-walkthrough";
import { ClickAuditReport } from "./audit-report";

export const metadata = {
  title: "How a click works | Click",
  description:
    "A step-by-step walkthrough of the click mechanic: a private tap, a mutual click, a shared plan - never a chat.",
};

const MYTHS = ["not a notification to them", "not a DM", "not a chat request"];

const OUTCOMES = [
  {
    title: "No mutual",
    clock: "7 days",
    body: "Nothing happens. Nobody is ever told. Nobody is embarrassed. Your pending click just expires after 7 days.",
  },
  {
    title: "Plan winds down",
    clock: "7 days",
    body: "If neither of you confirms within 7 days, the plan quietly winds down - it’s not gone. Cross paths again and you can pick it back up.",
  },
  {
    title: "Event sold out",
    clock: "-",
    body: "If the suggested event fills up before you confirm: “That plan fell through - pick another together.” You’re never booked into anything you didn’t choose.",
  },
];

const RECAP = [
  "1 · Private pending - you tap, they never know · 7 days",
  "2 · Mutual - you both tap; a plan + 7-day window opens",
  "3 · Coordinate - by taps, no chat ever",
  "4 · Confirm - one tap by either of you; then you BOTH still RSVP",
  "5 · Both going - both seats held 🎉",
];

const RECAP_CLOCKS = ["2h post-event gate", "7-day click", "7-day proposal"];

export default function TestClickPage() {
  return (
    <main className="paper-noise min-h-screen text-[color:var(--ink)]">
      {/* Section 1 - hero: the one-sentence reframe */}
      <section className="bg-[color:var(--champagne)] px-4 pb-12 pt-14 sm:px-6 lg:pt-16">
        <div className="mx-auto max-w-6xl">
          <span className="sticker sticker--peach tilt-l-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
            How a click works
          </span>
          <h1 className="font-display mt-6 max-w-4xl text-5xl font-bold leading-[0.94] tracking-[-0.025em] sm:text-7xl">
            A click is a private tap that says{" "}
            <span className="text-[color:var(--coral)]">&ldquo;I&rsquo;d see you again.&rdquo;</span>
          </h1>
          <p className="mt-6 max-w-3xl text-base font-medium leading-7 text-[color:var(--mauve)] sm:text-lg">
            It&rsquo;s invisible to them. It only ever shows up when it&rsquo;s mutual - and a mutual
            unlocks a <strong className="text-[color:var(--ink)]">plan</strong>, not a chat. There is no
            messaging anywhere in Click.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {MYTHS.map((myth) => (
              <span
                key={myth}
                className="inline-flex items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-[color:var(--coral)] line-through"
              >
                {myth}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)]">
              ✓ just a private maybe
            </span>
          </div>
        </div>
      </section>

      {/* Sections 2–4 (diagram + entry fork + interactive stepper) */}
      <ClickWalkthrough />

      {/* Section 5 - what if nobody clicks back? */}
      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
            What if nobody clicks back?
          </p>
          <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
            It&rsquo;s safe to click.
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[color:var(--mauve)]">
            The worst case is silence - and silence costs you nothing. Here&rsquo;s every dead-end,
            spelled out.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {OUTCOMES.map((outcome) => (
              <div
                key={outcome.title}
                className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
                    {outcome.title}
                  </h3>
                  <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne-deep)] px-2.5 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[color:var(--mauve)]">
                    {outcome.clock}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                  {outcome.body}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm font-bold leading-6 text-[color:var(--ink)]">
            Worst case is silence. That&rsquo;s the whole point - click privately, lose nothing.
          </p>
        </div>
      </section>

      {/* Engineering audit - accuracy, edge cases, gaps */}
      <ClickAuditReport />

      {/* Section 6 - TL;DR recap + jump-off links */}
      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--ink)] px-4 py-16 text-[color:var(--on-deep)] sm:px-6">
        <div className="mx-auto max-w-6xl">
          <span className="sticker sticker--peach tilt-r-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)]" />
            TL;DR
          </span>
          <div className="mt-6 grid gap-2">
            {RECAP.map((line) => (
              <p
                key={line}
                className="font-mono text-sm font-semibold leading-6 text-[color:var(--on-deep)]/85"
              >
                {line}
              </p>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {RECAP_CLOCKS.map((clock) => (
              <span
                key={clock}
                className="rounded-full border-2 border-[color:var(--on-deep)]/25 px-3 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[color:var(--peach)]"
              >
                ⏱ {clock}
              </span>
            ))}
          </div>
          <h2 className="font-display mt-8 text-3xl font-bold leading-tight tracking-[-0.025em] sm:text-5xl">
            A private tap → a mutual → a plan.{" "}
            <span className="text-[color:var(--coral)]">Never a chat.</span>
          </h2>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/people"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--peach)]"
            >
              Find people to click with
            </Link>
            <Link
              href="/proposals"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
            >
              See your proposals
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border-2 border-[color:var(--on-deep)]/25 px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--on-deep)] hover:bg-[color:var(--surface-deep-2)]"
            >
              View dashboard
            </Link>
          </div>
          <p className="mt-6 text-sm font-medium text-[color:var(--on-deep)]/70">
            The public version of this lives at{" "}
            <Link
              href="/how-it-works"
              className="font-bold text-[color:var(--peach)] underline decoration-2 underline-offset-4 hover:text-[color:var(--coral)]"
            >
              How Click works
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
