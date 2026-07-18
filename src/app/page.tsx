import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import type { EventItem } from "@/lib/click-data";
import { ButtonLink, Logo } from "@/components/ds";
import { EventCard } from "@/components/event-card";
import { LiveActivityMarquee } from "@/components/live-activity-marquee";
import { HomeQuiz } from "@/components/home-quiz";
import { Reveal } from "@/components/reveal";
import {
  getEventsForExplore,
  getLatestPersonaForSession,
  getPersonalizedDiscovery,
} from "@/lib/event-repository";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Honest social proof, derived entirely from the real events array. No
// invented percentages, no satisfaction claims, nothing about private clicks.
// Every value collapses to nothing when the data does not support it.
function deriveCityPulse(events: EventItem[]) {
  const now = Date.now();
  const within = (iso: string) => {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : null;
  };

  const weekEvents = events.filter((e) => {
    const t = within(e.startsAt);
    return t !== null && t <= now + WEEK_MS;
  });

  const eventsThisWeek = weekEvents.length;
  const peopleGoing = events.reduce((sum, e) => sum + (e.attendees || 0), 0);
  const suburbs = Array.from(new Set(events.map((e) => e.suburb).filter(Boolean)));
  const distinctHosts = new Set(events.map((e) => e.host || e.group).filter(Boolean)).size;
  // Prefer the next event that has not started yet, so the "Next up" framing
  // stays truthful; fall back to the earliest only if all are underway.
  const soonest =
    events.find((e) => {
      const t = within(e.startsAt);
      return t !== null && t >= now;
    }) ??
    events[0] ??
    null;

  const marqueeItems = [
    eventsThisWeek > 0
      ? `${eventsThisWeek} ${eventsThisWeek === 1 ? "event" : "events"} this week`
      : events.length > 0
        ? `${events.length} upcoming ${events.length === 1 ? "event" : "events"}`
        : null,
    peopleGoing > 0 ? `${peopleGoing} going across Sydney` : null,
    soonest ? `Next up: ${soonest.title} in ${soonest.suburb}` : null,
    distinctHosts > 0 ? `${distinctHosts} ${distinctHosts === 1 ? "host" : "hosts"} on the calendar` : null,
    suburbs.length > 1 ? `${suburbs.length} Sydney suburbs active` : null,
  ].filter((x): x is string => Boolean(x));

  return { eventsThisWeek, suburbs, soonest, marqueeItems };
}

export default async function Home() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user);
  const [events, persona, discovery] = await Promise.all([
    getEventsForExplore(),
    isLoggedIn ? getLatestPersonaForSession(session) : Promise.resolve(null),
    isLoggedIn ? getPersonalizedDiscovery(session) : Promise.resolve(null),
  ]);

  const pulse = deriveCityPulse(events);

  // The strip is a genuinely personalised feed when we have one, otherwise the
  // live city catalogue.
  const personalized = Boolean(discovery && !discovery.fallback && discovery.events.length >= 3);
  const strip = (personalized ? discovery!.events : events).slice(0, 3);
  const band = events[0] ?? null;
  const bandSuburbs = pulse.suburbs.slice(0, 3).join(", ");

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] text-[color:var(--ink)]">
      {/* ===================== HERO - a real dictionary entry =====================
          The signature of the brand: the headword, the pronunciation, one
          numbered sense, an example sentence in italics, a short rule, then the
          positioning line. No feature grid, no hero image. */}
      <section className="ck-page grid items-start gap-10 pt-8 pb-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-[72px] lg:pt-14">
        {/* The dictionary entry composes itself in reading order - a pure-CSS
            cascade (rise-soft + the shared rise-d* delays) so it plays before
            hydration and collapses to instant under reduced motion. */}
        <div className="max-w-[560px]">
          <span className="rise-soft lg:hidden">
            <Logo size={74} />
          </span>
          <span className="rise-soft hidden lg:inline-flex">
            <Logo size={104} />
          </span>

          <p className="rise-soft rise-d1 mt-3.5 text-base text-[color:var(--slate)] lg:mt-4.5 lg:text-[19px]">
            /klɪk/ · <span className="italic">verb</span>
          </p>

          <div className="rise-soft rise-d2 mt-4.5 flex gap-3">
            <span className="font-display shrink-0 text-[21px] leading-[1.5] font-semibold text-[color:var(--purple-500)] lg:text-[28px]">
              1.
            </span>
            <p className="text-[21px] leading-[1.5] text-pretty text-[color:var(--ink)] lg:text-[28px]">
              to connect effortlessly with someone through shared curiosity, energy, or experience.
            </p>
          </div>

          <p className="rise-soft rise-d3 mt-3 ml-9 text-[14.5px] leading-[1.55] text-pretty text-[color:var(--slate)] italic lg:text-base">
            &ldquo;we met at pickleball and just clicked!&rdquo;
          </p>

          <hr className="draw-line rise-d4 mt-7 w-[110px] border-0 border-t border-[color:var(--mist-strong)]" />

          <p className="rise-soft rise-d5 font-display mt-6 max-w-[440px] text-[17px] leading-[1.45] font-medium text-pretty text-[color:var(--ink)] lg:text-[19px]">
            We help people click in real life - not just online.
          </p>
        </div>

        {/* Action column */}
        <div className="rise-soft rise-d6 lg:mt-1.5">
          <ButtonLink href={isLoggedIn ? "/discover" : "/signup"} size="lg">
            {isLoggedIn ? "See what's on" : "Get in"}
          </ButtonLink>
          <p className="mt-4 max-w-[380px] text-[14.5px] leading-[1.55] text-[color:var(--slate)]">
            Free to join. Live in Sydney. Somewhere else? Join anyway - we&apos;ll tell you the moment Click reaches
            you.
          </p>
          <Link
            href="/how-it-works"
            className="font-display mt-4.5 inline-block border-b border-[color-mix(in_srgb,var(--purple)_30%,transparent)] pb-px text-sm font-medium text-[color:var(--purple)]"
          >
            How clicking works →
          </Link>
        </div>
      </section>

      <LiveActivityMarquee items={pulse.marqueeItems} />

      {/* ===================== What's on ===================== */}
      {strip.length > 0 ? (
        <section className="ck-page pt-12">
          <Reveal>
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="font-display text-[length:var(--text-h2)] font-semibold tracking-[-0.01em] text-[color:var(--ink)]">
                What&apos;s on near you this week
              </h2>
              <Link
                href="/discover"
                className="font-display shrink-0 text-[13.5px] font-semibold whitespace-nowrap text-[color:var(--purple)] hover:underline"
              >
                See everything near you →
              </Link>
            </div>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {strip.map((event, i) => (
              <Reveal key={event.id} delay={i * 90} className="min-w-0">
                <EventCard event={event} priority={i === 0} />
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {/* ===================== Real life, real places ===================== */}
      {band ? (
        <section className="ck-page py-12">
          <Reveal>
            <div className="relative flex min-h-[320px] items-end overflow-hidden rounded-[var(--radius-2xl)] shadow-[var(--shadow-md)] lg:min-h-[300px]">
            <Image src={band.image} alt="" fill sizes="100vw" className="object-cover" />
            <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(38,20,10,0.66),rgba(38,20,10,0.14)_58%,transparent)]" />
            <div className="relative max-w-[520px] p-6 sm:p-9">
              <p className="font-display text-[21px] leading-[1.2] font-semibold text-balance text-[color:var(--champagne)] lg:text-[30px]">
                Real things, real people - across inner Sydney.
              </p>
              {bandSuburbs ? (
                <p className="mt-2.5 max-w-[420px] text-sm leading-[1.55] text-[rgba(249,246,240,0.92)] lg:text-[15.5px]">
                  What&apos;s on this week across {bandSuburbs} - small groups, real places, every week.
                </p>
              ) : null}
            </div>
            </div>
          </Reveal>
        </section>
      ) : null}

      <Reveal className="reveal--fade">
        <HomeQuiz isLoggedIn={isLoggedIn} persona={persona} />
      </Reveal>
    </main>
  );
}
