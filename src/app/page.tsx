import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { auth } from "@/auth";
import { ButtonLink, Icon } from "@/components/ds";
import { EventCard } from "@/components/event-card";
import { HomeQuiz } from "@/components/home-quiz";
import { LiveActivityMarquee } from "@/components/live-activity-marquee";
import { MutualToast } from "@/components/mutual-toast";
import { Reveal } from "@/components/reveal";
import type { EventItem } from "@/lib/click-data";
import { getEventsForExplore, getLatestPersonaForSession } from "@/lib/event-repository";
import heroDiscover from "../../public/home/hero-discover-v2.jpg";
import heroDinner from "../../public/home/hero-dinner.jpg";
import heroRings from "../../public/home/hero-rings.jpg";
import heroRooftop from "../../public/home/hero-rooftop.jpg";
import heroRun from "../../public/home/hero-run.jpg";
import wallKaraoke from "../../public/home/wall-karaoke.jpg";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/* The hero headline's last word cycles. "obsession." is the anchor - it stays in
   normal flow, so it is what crawlers, screen readers and reduced-motion
   visitors get; these are the aria-hidden overlays. Five slots total, and the
   slot timing is baked into the @keyframes - adding a word here means
   re-cutting the percentages in `word-cycle-slot`. */
const HERO_CYCLE_WORDS = ["long lunch.", "run club.", "big night.", "click."];

function deriveCityPulse(events: EventItem[]) {
  const now = Date.now();
  const within = (iso: string) => {
    const time = new Date(iso).getTime();
    return Number.isFinite(time) ? time : null;
  };

  const eventsThisWeek = events.filter((event) => {
    const time = within(event.startsAt);
    return time !== null && time >= now && time <= now + WEEK_MS;
  }).length;
  const peopleGoing = events.reduce((sum, event) => sum + (event.attendees || 0), 0);
  const suburbs = new Set(events.map((event) => event.suburb).filter(Boolean));
  const hosts = new Set(events.map((event) => event.host || event.group).filter(Boolean));
  const nextEvent =
    events.find((event) => {
      const time = within(event.startsAt);
      return time !== null && time >= now;
    }) ?? events[0];

  const marqueeItems = [
    eventsThisWeek > 0
      ? `${eventsThisWeek} ${eventsThisWeek === 1 ? "event" : "events"} this week`
      : events.length > 0
        ? `${events.length} upcoming ${events.length === 1 ? "event" : "events"}`
        : null,
    peopleGoing > 0
      ? `${peopleGoing} ${peopleGoing === 1 ? "person" : "people"} already going`
      : null,
    nextEvent ? `Next up: ${nextEvent.title} in ${nextEvent.suburb}` : null,
    hosts.size > 0 ? `${hosts.size} local ${hosts.size === 1 ? "host" : "hosts"}` : null,
    suburbs.size > 1 ? `Plans across ${suburbs.size} Sydney suburbs` : null,
  ].filter((item): item is string => Boolean(item));

  return { marqueeItems };
}

const ACTIVITY_LANES: Array<{
  title: string;
  detail: string;
  category: string;
  image: StaticImageData;
  alt: string;
  className: string;
}> = [
  {
    title: "Make something",
    detail: "Pottery, jewellery and creative workshops",
    category: "Creative",
    image: heroRings,
    alt: "Friends making silver rings together at a jewellery workshop",
    className: "md:col-span-7 md:row-span-2",
  },
  {
    title: "Eat together",
    detail: "Shared tables, tastings and long lunches",
    category: "Food",
    image: heroDinner,
    alt: "Friends passing plates at a candle-lit long-table dinner",
    className: "md:col-span-5",
  },
  {
    title: "Move together",
    detail: "Run clubs, sport and outdoor plans",
    category: "Fitness",
    image: heroRun,
    alt: "A run club regrouping together beside the beach",
    className: "md:col-span-5",
  },
  {
    title: "Go out out",
    detail: "Karaoke, live music and late-night energy",
    category: "Nightlife",
    image: wallKaraoke,
    alt: "Friends singing together in a private karaoke room",
    className: "md:col-span-12",
  },
];

const HOW_IT_WORKS = [
  {
    title: "Book something you actually want to do",
    body: "Browse by mood, date or neighbourhood, then reserve your place in a few taps.",
  },
  {
    title: "Meet without the awkward setup",
    body: "Shared activities make conversation easy, whether you arrive solo or bring a friend.",
  },
  {
    title: "Keep the people you clicked with",
    body: "After the event, choose privately. When the feeling is mutual, you both find out.",
  },
];

function ExploreForm() {
  return (
    <form
      action="/discover"
      method="get"
      className="home-explore-form mt-7 grid gap-2 rounded-[var(--radius-xl)] bg-[color:var(--paper)] p-2.5 shadow-[0_22px_60px_-24px_rgba(16,11,34,0.65)] sm:grid-cols-[minmax(0,1fr)_170px_auto] sm:items-stretch"
    >
      <label className="flex min-h-14 min-w-0 items-center gap-3 rounded-[var(--radius-md)] px-3 focus-within:bg-[color:var(--lavender-100)]">
        <Icon name="search" size={20} className="text-[color:var(--purple)]" />
        <span className="sr-only">What do you want to do?</span>
        <input
          type="search"
          name="q"
          placeholder="What do you feel like doing?"
          className="min-w-0 flex-1 bg-transparent text-base font-medium text-[color:var(--ink)] outline-none placeholder:text-[color:var(--slate)]"
        />
      </label>

      <label className="flex min-h-14 items-center gap-2.5 border-t border-[color:var(--mist)] px-3 sm:border-t-0 sm:border-l">
        <Icon name="calendar" size={18} className="text-[color:var(--purple)]" />
        <span className="sr-only">When</span>
        <select
          name="date"
          defaultValue="all"
          className="min-w-0 flex-1 appearance-none bg-transparent text-sm font-semibold text-[color:var(--ink)] outline-none"
        >
          <option value="all">Any day</option>
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="weekend">This weekend</option>
          <option value="7">Next 7 days</option>
        </select>
        <Icon name="chevD" size={15} className="text-[color:var(--slate)]" />
      </label>

      <button type="submit" className="ck-btn ck-btn--lg ck-btn--primary w-full sm:w-auto">
        <span className="ck-btn__label">See what&apos;s on</span>
      </button>
    </form>
  );
}

export default async function Home() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user);
  const [events, persona] = await Promise.all([
    getEventsForExplore(),
    isLoggedIn ? getLatestPersonaForSession(session) : Promise.resolve(null),
  ]);
  const pulse = deriveCityPulse(events);
  const upcoming = [...events]
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
    .slice(0, 3);

  return (
    <main data-home-hero className="min-h-[100dvh] bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <section className="home-hero relative isolate flex min-h-[100dvh] items-end overflow-hidden bg-[color:var(--surface-deep)] lg:items-center">
        <Image
          src={heroDiscover}
          alt="A lively group sharing dinner and conversation in a Sydney courtyard at dusk"
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="home-hero-photo object-cover object-[68%_center] sm:object-center"
        />
        <div aria-hidden className="hero-scrim absolute inset-0" />

        <div className="ck-page relative z-10 pb-8 pt-28 sm:pb-12 lg:py-28">
          <div className="home-hero-copy max-w-[760px]">
            <p className="rise-soft inline-flex items-center rounded-full border border-white/25 bg-[color-mix(in_srgb,var(--surface-deep)_66%,transparent)] px-3.5 py-1.5 text-[13px] font-semibold text-[color:var(--on-deep)] backdrop-blur-md">
              Sydney plans for real life
            </p>
            <h1 className="rise-soft rise-d1 font-display mt-5 max-w-[720px] text-[clamp(3.25rem,7vw,5.8rem)] leading-[0.96] font-semibold tracking-[-0.055em] text-balance text-[color:var(--on-deep)]">
              Find your next{" "}
              <span className="word-cycle">
                <span className="word-cycle__anchor">obsession.</span>
                {HERO_CYCLE_WORDS.map((word, index) => (
                  <span
                    key={word}
                    aria-hidden
                    className="word-cycle__alt"
                    style={{ "--cycle-i": index + 1 } as CSSProperties}
                  >
                    {word}
                  </span>
                ))}
              </span>
            </h1>
            <p className="rise-soft rise-d2 mt-5 max-w-[560px] text-lg leading-7 font-medium text-[color:var(--on-deep-soft)] sm:text-xl">
              Book fun Sydney activities, meet people naturally, and see who you click with.
            </p>
            <div className="rise-soft rise-d3">
              <ExploreForm />
            </div>
          </div>
        </div>

        <div
          className="pop-in absolute right-[5%] top-[18%] z-10 hidden lg:block"
          style={{ "--pop-rot": "2deg", animationDelay: "560ms" } as CSSProperties}
        >
          <MutualToast />
        </div>
      </section>

      <LiveActivityMarquee items={pulse.marqueeItems} />

      {upcoming.length > 0 ? (
        <section className="ck-page pb-12 pt-10 lg:pb-18 lg:pt-16">
          <Reveal className="home-reveal">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-[length:var(--text-h1)] leading-tight font-semibold tracking-[-0.025em]">
                  Happening soon
                </h2>
                <p className="mt-2 text-[15px] text-[color:var(--slate)]">
                  Real plans you can book right now.
                </p>
              </div>
              <Link href="/discover" className="ck-taplink font-display text-sm font-semibold text-[color:var(--purple)] hover:underline">
                See what&apos;s on <span className="nudge-arrow" aria-hidden>→</span>
              </Link>
            </div>
          </Reveal>

          <div className="ckRail -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
            {upcoming.map((event, index) => (
              <Reveal
                key={event.id}
                delay={index * 70}
                // reveal--rail: the peek is the affordance that says the row scrolls,
                // and at 26px into the viewport the observer never fires, so the
                // next card sat at opacity 0 until you had already swiped.
                className="home-reveal reveal--rail w-[84vw] max-w-[340px] shrink-0 snap-center sm:w-auto sm:max-w-none sm:min-w-0"
              >
                <EventCard event={event} priority={index === 0} />
              </Reveal>
            ))}
          </div>
        </section>
      ) : (
        <section className="ck-page pb-12 pt-10 lg:pb-18 lg:pt-16">
          <div className="rounded-[var(--radius-2xl)] bg-[color:var(--lav-bg)] px-6 py-12 text-center">
            <Icon name="calendar" size={30} className="mx-auto text-[color:var(--purple)]" />
            <h2 className="font-display mt-4 text-2xl font-semibold">Fresh plans are landing soon</h2>
            <p className="mx-auto mt-2 max-w-[440px] text-sm leading-6 text-[color:var(--slate)]">
              Take the vibe quiz now and we&apos;ll point you toward the right rooms as events go live.
            </p>
            <div className="mt-5 flex justify-center">
              <Link href="/quiz/personality" className="ck-btn ck-btn--md ck-btn--primary">
                <span className="ck-btn__label">Pick your vibe</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="ck-page py-12 lg:py-18">
        <Reveal className="home-reveal">
          <div className="max-w-[640px]">
            <h2 className="font-display text-[length:var(--text-display)] leading-[1.04] font-semibold tracking-[-0.035em] text-balance">
              Browse by what sounds fun
            </h2>
            <p className="mt-3 max-w-[520px] text-[15.5px] leading-6 text-[color:var(--slate)]">
              Start with the plan. The people part happens naturally once you&apos;re there.
            </p>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-4 md:grid-cols-12 md:auto-rows-[220px]">
          {ACTIVITY_LANES.map((lane, index) => (
            <Reveal key={lane.title} delay={index * 80} className={`home-reveal ${lane.className}`}>
              <Link
                href={`/discover?category=${encodeURIComponent(lane.category)}`}
                className="activity-lane group relative block h-[300px] overflow-hidden rounded-[var(--radius-xl)] bg-[color:var(--champagne-deep)] shadow-[var(--shadow-sm)] md:h-full"
              >
                <Image
                  src={lane.image}
                  alt={lane.alt}
                  fill
                  placeholder="blur"
                  sizes="(min-width: 768px) 58vw, 100vw"
                  className="activity-lane__image object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--surface-deep)]/90 via-[color:var(--surface-deep)]/5 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-[color:var(--on-deep)] sm:p-6">
                  <div>
                    <h3 className="font-display text-2xl font-semibold tracking-[-0.025em]">{lane.title}</h3>
                    <p className="mt-1 text-sm font-medium text-[color:var(--on-deep-soft)]">{lane.detail}</p>
                  </div>
                  <span className="activity-lane__arrow flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--champagne)] text-[color:var(--purple)] shadow-[var(--shadow-sm)]" aria-hidden>
                    <Icon name="arrowR" size={18} stroke={2.2} />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="aura-soft py-14 lg:py-22">
        <div className="ck-page grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
          <Reveal className="home-reveal home-story-visual lg:col-span-5">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-2xl)] shadow-[var(--shadow-lg)]">
              <Image
                src={heroRooftop}
                alt="Friends getting to know each other at a relaxed Sydney rooftop gathering"
                fill
                placeholder="blur"
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="home-story-image object-cover"
              />
            </div>
          </Reveal>

          <Reveal className="home-reveal lg:col-span-7">
            <h2 className="font-display max-w-[640px] text-[length:var(--text-display)] leading-[1.04] font-semibold tracking-[-0.035em] text-balance">
              Book the plan. Keep the people.
            </h2>
            <p className="mt-3 max-w-[540px] text-[15.5px] leading-6 text-[color:var(--slate)]">
              Click makes meeting people feel like a side effect of doing something fun.
            </p>

            <ol className="mt-8 grid gap-6">
              {HOW_IT_WORKS.map((step, index) => (
                <li
                  key={step.title}
                  className="home-step grid grid-cols-[44px_1fr] gap-4"
                  style={{ "--step-delay": `${180 + index * 110}ms` } as CSSProperties}
                >
                  <span className="font-display flex size-11 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--purple)] text-lg font-semibold text-[color:var(--champagne)]">
                    {index + 1}
                  </span>
                  <div className="pt-0.5">
                    <h3 className="font-display text-lg font-semibold text-[color:var(--ink)]">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--slate)]">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <Link href="/how-it-works" className="ck-taplink font-display mt-8 inline-flex text-sm font-semibold text-[color:var(--purple)] hover:underline">
              How Click works <span className="nudge-arrow ml-1" aria-hidden>→</span>
            </Link>
          </Reveal>
        </div>
      </section>

      <Reveal className="home-reveal reveal--fade">
        <HomeQuiz isLoggedIn={isLoggedIn} persona={persona} />
      </Reveal>

      <section className="ck-page pb-14 pt-4 lg:pb-20">
        <Reveal className="home-reveal">
          <div className="relative overflow-hidden rounded-[var(--radius-2xl)] bg-[color:var(--purple)] px-6 py-12 text-[color:var(--champagne)] sm:px-10 lg:px-14 lg:py-16">
            <div className="relative z-10 max-w-[680px]">
              <h2 className="font-display text-[length:var(--text-display)] leading-[1.04] font-semibold tracking-[-0.035em] text-balance">
                Your next good story is already on the calendar.
              </h2>
              <p className="mt-4 max-w-[520px] text-base leading-7 text-[color:var(--on-deep-soft)]">
                Pick something that sounds fun. We&apos;ll help with the rest.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-5">
                <ButtonLink href="/discover" variant="onPurple" size="lg">
                  See what&apos;s on
                </ButtonLink>
                {/* /merchant/signup, not /merchant - the latter bounces a
                    logged-out visitor through /merchant/login first. */}
                <Link href="/merchant/signup" className="ck-taplink font-display text-sm font-semibold text-[color:var(--champagne)] hover:underline">
                  Host an event <span className="nudge-arrow" aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
