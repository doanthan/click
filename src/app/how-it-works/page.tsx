import Link from "next/link";
import { auth } from "@/auth";
import { InfoCard, LinkButton, PageHero, Pill, SectionIntro } from "@/components/click-ui";

export const metadata = {
  title: "How Click works | Click",
  description:
    "Click is event-first: pick a room, show up, and the people part takes care of itself.",
};

const steps = [
  {
    eyebrow: "Step 1",
    title: "Pick a room you'd actually walk into.",
    body: "Browse Sydney events by interest, suburb, or vibe. Every event has a reason to talk built in — a topic, an activity, a shared excuse.",
    accent: "peach" as const,
  },
  {
    eyebrow: "Step 2",
    title: "RSVP. We hold a spot.",
    body: "Tap once. Free or paid, click_managed or external — we handle the ticket and quietly remind you the day before.",
    accent: "rose" as const,
  },
  {
    eyebrow: "Step 3",
    title: "Show up. Talk to people.",
    body: "No swipes, no profiles to grade. After the event you can Click someone you met — anonymously. Mutual Clicks unlock a future event suggestion together.",
    accent: "ink" as const,
  },
];

const benefits = [
  {
    title: "Event-first, not profile-first.",
    body: "Connection happens around a thing you both signed up for. The room does the heavy lifting.",
  },
  {
    title: "Friendship, dating, networking — same app.",
    body: "Tell us your intent. We keep the wrong rooms out of your feed.",
  },
  {
    title: "Hosted by humans you can vouch for.",
    body: "Verified hosts and small groups. No bots, no astroturf, no thousand-person mixers.",
  },
  {
    title: "Sydney-local by default.",
    body: "Suburbs, transport, and the kind of small-room scene the algorithms keep burying.",
  },
];

const testimonials = [
  {
    quote: "I went to a sketch night, met three people I now run with on Saturdays. That's it. That's the magic.",
    name: "Mira, 28",
    suburb: "Newtown",
  },
  {
    quote: "Stopped using dating apps the week I joined. The book club is a much better filter than a bio.",
    name: "Dan, 34",
    suburb: "Surry Hills",
  },
  {
    quote: "I host pottery now. Click sends me people who actually want to be there. Refreshing.",
    name: "Aki, 41",
    suburb: "Marrickville",
  },
];

export default async function HowItWorksPage() {
  const session = await auth();
  const ctaHref = session?.user ? "/events" : "/login?callbackUrl=/events";
  const ctaLabel = session?.user ? "Browse events" : "Sign in to start";

  return (
    <main className="bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <PageHero
        eyebrow="How Click works"
        title="Three steps, a room, real people."
        body="Click is event-first. You pick the room. We make sure something happens once you're in it."
      >
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <LinkButton href={ctaHref}>{ctaLabel}</LinkButton>
          <Link
            href="/discover"
            className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-6 text-sm font-bold tracking-wide hard-shadow-sm hover:bg-[color:var(--peach)]"
          >
            Or just explore <span aria-hidden>→</span>
          </Link>
        </div>
      </PageHero>

      <section className="px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="The flow"
            title={<>Pick. RSVP. <span className="italic">Show up.</span></>}
            body="No swiping. No profile-grading. The event is the introduction; the people part follows."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <InfoCard
                key={step.eyebrow}
                eyebrow={step.eyebrow}
                title={step.title}
                body={step.body}
                accent={step.accent}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[color:var(--cream)] px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="Why it works"
            title={<>The room <span className="italic">is</span> the filter.</>}
            body="Most apps put profiles between you and a person. We put an event between you and a person — and a much smaller crowd."
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <article
                key={benefit.title}
                className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm"
              >
                <h3 className="font-display text-2xl font-light leading-tight text-[color:var(--ink)]">
                  {benefit.title}
                </h3>
                <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                  {benefit.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="What people say"
            title={<>Receipts, not <span className="italic">vibes.</span></>}
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure
                key={t.name}
                className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--peach)] p-6 hard-shadow-sm"
              >
                <blockquote className="font-display text-2xl font-light italic leading-[1.15] text-[color:var(--surface-deep)]">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--surface-deep)]/80">
                  <span>{t.name}</span>
                  <Pill tone="cream">{t.suburb}</Pill>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[color:var(--ink)] px-4 py-16 text-[color:var(--on-deep)] sm:px-6 lg:py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow !text-[color:var(--peach)]">Ready when you are</p>
            <h2 className="font-display mt-3 text-5xl font-light leading-[0.95] tracking-tight text-[color:var(--champagne)] sm:text-6xl">
              Find a room. <span className="italic">Show up.</span>
            </h2>
          </div>
          <LinkButton href={ctaHref} variant="light">
            {ctaLabel}
          </LinkButton>
        </div>
      </section>
    </main>
  );
}
