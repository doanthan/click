import Link from "next/link";
import { LinkButton, SectionIntro } from "@/components/click-ui";
import { lifeQuizSections, onboardingSteps, roleCards } from "@/lib/click-data";

export const metadata = {
  title: "How Click works | Click",
  description:
    "How Click works: pick your intent, take the quiz, find local events, and Click privately on the people you meet.",
};

const steps = [
  {
    n: "01",
    eyebrow: "Make your account",
    title: "Sign up in 30 seconds.",
    body: "Email or social login. Tell us your suburb, age, and what you’re here for. Your private Clicks stay private until there’s mutual interest.",
  },
  {
    n: "02",
    eyebrow: "Take the Life Quiz",
    title: "We tag you with what makes you, you.",
    body: "Life stage, energy, availability, event style. That’s how we surface the right rooms instead of dumping every event in your face.",
  },
  {
    n: "03",
    eyebrow: "Find a plan",
    title: "Browse, save, RSVP.",
    body: "Filter by category, suburb, distance, or vibe. RSVP free, pay for paid events through Click, or bounce out to an external booking. Cancel anytime.",
  },
  {
    n: "04",
    eyebrow: "Show up",
    title: "Meet people with a reason to talk.",
    body: "Every event has a relationship goal — what people are there for — so chat isn’t cold. You can Click someone privately during or after the event.",
  },
  {
    n: "05",
    eyebrow: "Mutual or move on",
    title: "Privacy is the default.",
    body: "Nobody sees your Clicks until both of you tap. Mutual = a suggested next event to attend together. No mutual = nothing happens and nobody’s embarrassed.",
  },
];

const benefits = [
  {
    title: "Built for ordinary people, not influencers.",
    body: "Profiles are simple. Photos are optional. You don’t need a bio to RSVP.",
  },
  {
    title: "Real-world only.",
    body: "Click is not a chat app. There is no DM until something happens in person, and even then chat lives outside Click.",
  },
  {
    title: "Designed against ghosting.",
    body: "Cancel an RSVP and the host gets a waitlist replacement. You can leave a slot without burning a bridge.",
  },
  {
    title: "Hosts are vetted.",
    body: "Every merchant goes through ABN verification before publishing. No mystery rooms.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="paper-noise min-h-screen overflow-hidden text-[color:var(--ink)]">
      <section className="relative overflow-hidden bg-[color:var(--champagne)] px-4 pb-16 pt-16 sm:px-6 lg:pt-20">
        <div className="relative z-10 mx-auto max-w-6xl">
          <span className="sticker sticker--peach tilt-l-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
            How Click works
          </span>
          <h1 className="font-display mt-6 max-w-4xl text-5xl font-bold leading-[0.94] tracking-[-0.025em] sm:text-7xl">
            A burst of <span className="text-[color:var(--coral)]">YES</span>{" "}
            — five honest steps from nervous to nearby.
          </h1>
          <p className="mt-6 max-w-3xl text-base font-medium leading-7 text-[color:var(--mauve)] sm:text-lg">
            Click is the antidote to scrolling. Pick your intent, take the Life
            Quiz, RSVP to something nearby this week, and meet people with a
            reason to talk. No DMs. No swiping. No vibes-only.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/auth">Make an account</LinkButton>
            <Link
              href="/events"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
            >
              Browse events first
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionIntro
            eyebrow="Step by step"
            title="From sign-up to mutual Click."
            body="Five steps. None of them require a paid plan or a perfect bio."
          />
          <ol className="mt-12 grid gap-6 md:grid-cols-2">
            {steps.map((step) => (
              <li
                key={step.n}
                className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm"
              >
                <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                  {step.n} · {step.eyebrow}
                </span>
                <h3 className="font-display mt-3 text-2xl font-semibold leading-tight tracking-[-0.02em]">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionIntro
            eyebrow="Two sides"
            title="One platform, three perspectives."
            body="Attendees, merchants, and admins each get their own view."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {roleCards.map((role) => (
              <div
                key={role.title}
                className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow-sm"
              >
                <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                  {role.eyebrow}
                </span>
                <h3 className="font-display mt-3 text-2xl font-semibold leading-tight tracking-[-0.02em]">
                  {role.title}
                </h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                  {role.body}
                </p>
              </div>
            ))}
            <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--peach)] p-6 hard-shadow-sm">
              <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--surface-deep)]">
                Admins
              </span>
              <h3 className="font-display mt-3 text-2xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
                Click HQ
              </h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--surface-deep)]">
                Approve merchants and events, govern tags, watch the audit log,
                keep the room civil.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionIntro
            eyebrow="Why Click"
            title="What makes this different."
            body="Click is opinionated about what it isn’t."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm"
              >
                <h3 className="font-display text-xl font-semibold leading-tight tracking-[-0.02em]">
                  {b.title}
                </h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                  {b.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <SectionIntro
              eyebrow="The Life Quiz"
              title="It’s short and it matters."
              body="Five quick sections that tag you with the things our matching algorithm actually uses."
            />
            <ul className="mt-8 grid gap-3">
              {lifeQuizSections.map((q) => (
                <li
                  key={q.title}
                  className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4 hard-shadow-sm"
                >
                  <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                    {q.title}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                    {q.output}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SectionIntro
              eyebrow="Onboarding"
              title="What we ask for, in order."
              body="Six steps. None of them are credit-card-first."
            />
            <ol className="mt-8 grid gap-3">
              {onboardingSteps.map((s, i) => (
                <li
                  key={s}
                  className="flex items-start gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4 hard-shadow-sm"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] text-xs font-bold text-[color:var(--surface-deep)]">
                    {i + 1}
                  </span>
                  <span className="text-sm font-bold text-[color:var(--ink)]">
                    {s}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--ink)] px-4 py-20 text-[color:var(--on-deep)] sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <span className="sticker sticker--peach tilt-r-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)]" />
            Ready?
          </span>
          <h2 className="font-display mt-6 text-4xl font-bold leading-tight tracking-[-0.025em] sm:text-6xl">
            Pick a plan. Show up. <span className="text-[color:var(--coral)]">See what clicks.</span>
          </h2>
          <p className="mt-6 text-base font-medium leading-7 text-[color:var(--peach)] sm:text-lg">
            30 seconds to make an account. No quiz required to RSVP your first
            event.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/auth"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--peach)]"
            >
              Make an account
            </Link>
            <Link
              href="/merchant"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
            >
              Host events instead
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
