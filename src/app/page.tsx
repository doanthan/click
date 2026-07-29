import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { auth } from "@/auth";
import type { EventItem } from "@/lib/click-data";
import { ButtonLink, Logo, Spark } from "@/components/ds";
import { EventCard } from "@/components/event-card";
import { LiveActivityMarquee } from "@/components/live-activity-marquee";
import { MutualToast } from "@/components/mutual-toast";
import { PartyGlow } from "@/components/party-glow";
import { HomeQuiz } from "@/components/home-quiz";
import { Reveal } from "@/components/reveal";
import { getEventsForExplore, getLatestPersonaForSession } from "@/lib/event-repository";
import heroMain from "../../public/home/hero-main.jpg";
import heroRings from "../../public/home/hero-rings.jpg";
import heroDinner from "../../public/home/hero-dinner.jpg";
import heroRooftop from "../../public/home/hero-rooftop.jpg";
import heroPickleball from "../../public/home/hero-pickleball.jpg";
import heroWine from "../../public/home/hero-wine.jpg";
import heroRun from "../../public/home/hero-run.jpg";
import wallWarehouse from "../../public/home/wall-warehouse.jpg";
import wallPicnic from "../../public/home/wall-picnic.jpg";
import wallPottery from "../../public/home/wall-pottery.jpg";
import wallTrivia from "../../public/home/wall-trivia.jpg";
import wallVolleyball from "../../public/home/wall-volleyball.jpg";
import wallDarts from "../../public/home/wall-darts.jpg";
import wallKaraoke from "../../public/home/wall-karaoke.jpg";

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

  return { marqueeItems };
}

/* The party wall - every photo is a Sydney candid from the /images studio
   (scripts/gen-home-images.mjs re-rolls them). The hero is ONE full-bleed
   night; the rail below is the pinned-up week. Captions are flavour for the
   kinds of events Click runs, not claims about specific past events. */

const WALL_PRINTS: Array<{
  src: StaticImageData;
  alt: string;
  caption: string;
  place: string;
  h: string;
  tilt: string;
}> = [
  {
    src: wallWarehouse,
    alt: "A crowd dancing at a warehouse party caught by a camera flash",
    caption: "Warehouse party",
    place: "Marrickville",
    h: "h-[280px] sm:h-[320px]",
    tilt: "tilt-l-2",
  },
  {
    src: wallPicnic,
    alt: "A picnic mixer on the grass in Centennial Park, long shadows",
    caption: "Picnic mixer",
    place: "Centennial Park",
    h: "h-[230px] sm:h-[260px]",
    tilt: "tilt-r-2",
  },
  {
    src: wallPottery,
    alt: "Clay-covered hands and laughter at a pottery class social",
    caption: "Pottery social",
    place: "Redfern",
    h: "h-[250px] sm:h-[290px]",
    tilt: "tilt-l-2",
  },
  {
    src: wallTrivia,
    alt: "A trivia team huddled over an answer sheet at a pub",
    caption: "Trivia night",
    place: "Newtown",
    h: "h-[280px] sm:h-[320px]",
    tilt: "tilt-r-3",
  },
  {
    src: wallVolleyball,
    alt: "A casual beach volleyball social at Bondi at golden hour",
    caption: "Beach volleyball",
    place: "Bondi",
    h: "h-[230px] sm:h-[260px]",
    tilt: "tilt-l-2",
  },
  {
    src: wallDarts,
    alt: "Darts and a chalk scoreboard at a pub social",
    caption: "Pub darts",
    place: "The Rocks",
    h: "h-[250px] sm:h-[290px]",
    tilt: "tilt-r-2",
  },
  {
    src: wallKaraoke,
    alt: "Friends mid-song in a private karaoke room in Haymarket",
    caption: "KTV night",
    place: "Haymarket",
    h: "h-[260px] sm:h-[300px]",
    tilt: "tilt-l-3",
  },
  // The old hero collage prints, re-pinned onto the wall so the rail runs long.
  {
    src: heroRooftop,
    alt: "Friends talking at a rooftop party with the Harbour Bridge behind",
    caption: "Rooftop drinks",
    place: "Kirribilli",
    h: "h-[280px] sm:h-[320px]",
    tilt: "tilt-r-3",
  },
  {
    src: heroPickleball,
    alt: "A pickleball social on an outdoor court at golden hour",
    caption: "Pickleball social",
    place: "Marrickville",
    h: "h-[230px] sm:h-[260px]",
    tilt: "tilt-l-2",
  },
  {
    src: heroWine,
    alt: "Mates over schooners and shared plates outside a pub",
    caption: "Long lunch",
    place: "Enmore",
    h: "h-[250px] sm:h-[290px]",
    tilt: "tilt-r-2",
  },
  {
    src: heroRun,
    alt: "A run club regrouping by the beach after a Saturday morning run",
    caption: "Saturday run club",
    place: "Bronte",
    h: "h-[280px] sm:h-[320px]",
    tilt: "tilt-l-3",
  },
];

/* The four prints that pop onto the hero - one glance at the kinds of events
   Click runs: make something, play something, eat together, move together. */
const HERO_FAN = [
  {
    src: heroRings,
    alt: "Friends leaning in as one torch-solders a silver ring at a jewellery workshop",
    caption: "Ring-making",
    place: "Surry Hills",
  },
  {
    src: heroPickleball,
    alt: "A pickleball social on an outdoor court at golden hour",
    caption: "Pickleball social",
    place: "Marrickville",
  },
  {
    src: heroDinner,
    alt: "Friends passing shared plates down a long candle-lit dinner table",
    caption: "Long-table dinner",
    place: "Enmore",
  },
  {
    src: heroRun,
    alt: "A run club regrouping by the beach after a Saturday morning run",
    caption: "Run club",
    place: "Bronte",
  },
];

/* The mechanic in four beats for a first-time visitor - the answer to "so
   what IS Click?". Copy stays diffed against the real flow (register ->
   attend -> private click -> mutual reveal); the privacy rail (one-sided
   clicks stay invisible) is the differentiator and gets said plainly. */
const HOW_IT_WORKS = [
  {
    title: "Pick a plan",
    body: "Small-group events across Sydney: run clubs, trivia nights, pottery wheels, long dinners. Come solo or bring a mate.",
  },
  {
    title: "Show up",
    body: "Everyone's there for the same thing, so talking to strangers never feels like talking to strangers.",
  },
  {
    title: "Click, privately",
    body: "Afterwards, tap who you clicked with. Nothing is sent and nothing shows - it stays between you and Click.",
  },
  {
    title: "It's mutual",
    body: "If they picked you too, you both find out - and the next plan is two taps away. If not, nobody ever knows.",
  },
];

export default async function Home() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user);
  const [events, persona] = await Promise.all([
    getEventsForExplore(),
    isLoggedIn ? getLatestPersonaForSession(session) : Promise.resolve(null),
  ]);

  const pulse = deriveCityPulse(events);

  // Trending = the upcoming events the most people are going to, citywide.
  const trending = [...events]
    .sort((a, b) => (b.attendees || 0) - (a.attendees || 0))
    .slice(0, 3);

  return (
    <main data-home-hero className="min-h-screen bg-[color:var(--champagne)] text-[color:var(--ink)]">
      {/* ===================== HERO - one real night, edge to edge =====================
          A single natural Sydney candid runs full bleed; the dictionary entry
          sits in its dark left third on the ink scrim, and the product's magic
          moment - a mutual click landing - floats as a notification card.
          The photo is the party; the type stays quiet. */}
      <section className="relative isolate overflow-hidden bg-[color:var(--surface-deep)]">
        <Image
          src={heroMain}
          alt="Two friends mid-dance at a small backyard party, one laughing with hair mid-whip, fairy lights on the brick wall behind"
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="object-cover object-[55%_center] lg:object-center"
        />
        <div aria-hidden className="hero-scrim absolute inset-0" />

        <div className="ck-page relative flex min-h-[100svh] flex-col justify-end pt-24 pb-12 lg:justify-center lg:pt-28 lg:pb-24">
          <div className="max-w-[560px]">
            <p className="rise-soft mb-5 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--on-deep)_28%,transparent)] bg-[color-mix(in_srgb,var(--surface-deep)_55%,transparent)] px-3.5 py-1.5 text-[13px] font-medium text-[color:var(--on-deep)]">
              <span aria-hidden className="text-[color:var(--lavender)]">✦</span>
              Now live in Sydney
            </p>
            <span className="rise-soft block lg:hidden">
              <Logo size={74} cream />
            </span>
            <span className="rise-soft hidden lg:block">
              <Logo size={104} cream />
            </span>

            <p className="rise-soft rise-d1 mt-3.5 text-base text-[color:var(--on-deep-soft)] lg:mt-4.5 lg:text-[19px]">
              /klɪk/ · <span className="italic">verb</span>
            </p>

            <div className="rise-soft rise-d2 mt-4.5 flex gap-3">
              <span className="font-display shrink-0 text-[21px] leading-[1.5] font-semibold text-[color:var(--lavender)] lg:text-[27px]">
                1.
              </span>
              <p className="text-[21px] leading-[1.5] text-pretty text-[color:var(--on-deep)] lg:text-[27px]">
                to connect effortlessly with someone through shared curiosity, energy, or experience.
              </p>
            </div>

            <p className="rise-soft rise-d3 mt-3 ml-9 text-[14.5px] leading-[1.55] text-pretty text-[color:var(--on-deep-soft)] italic lg:text-base">
              &ldquo;we met at pickleball and just clicked!&rdquo;
            </p>

            <p className="rise-soft rise-d5 font-display mt-7 max-w-[440px] text-[17px] leading-[1.45] font-medium text-pretty text-[color:var(--on-deep)] lg:text-[19px]">
              We help people click in real life - not just online.
            </p>

            <div className="rise-soft rise-d6 mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
              <ButtonLink href={isLoggedIn ? "/discover" : "/signup"} variant="onPurple" size="lg">
                {isLoggedIn ? "See what's on" : "Get in"}
              </ButtonLink>
              <Link
                href="/how-it-works"
                className="font-display inline-block border-b border-[color-mix(in_srgb,var(--on-deep)_35%,transparent)] pb-px text-sm font-medium text-[color:var(--on-deep)]"
              >
                How clicking works{" "}
                <span className="nudge-arrow" aria-hidden>
                  →
                </span>
              </Link>
            </div>
            <p className="rise-soft rise-d6 mt-4 max-w-[420px] text-[14.5px] leading-[1.55] text-[color:var(--on-deep-soft)]">
              Free to join. Somewhere else? Join anyway - we&apos;ll tell you the moment Click
              reaches you.
            </p>
          </div>
        </div>

        {/* The mutual-click notification, tossed onto the photo like a print.
            Top-right everywhere (the type owns the bottom left, the polaroid
            fan owns the bottom right), Partiful-style. */}
        <div
          className="pop-in absolute top-[11%] right-4 z-10 lg:top-[13%] lg:right-[4.5%]"
          style={{ "--pop-rot": "-2deg", animationDelay: "650ms" } as CSSProperties}
        >
          <MutualToast />
        </div>

        {/* Four event-kind polaroids tossed onto the photo after the toast -
            the "what does a Click event look like?" answer in one glance:
            make, play, eat, move. Desktop only; the photo-wall rail carries
            this job on mobile, where the photo stays clean. */}
        <div className="hero-fan-parallax absolute right-[3.5%] bottom-[5.5%] z-10 hidden items-end lg:flex">
          {HERO_FAN.map((print, i) => (
            <div
              key={print.caption}
              className={`home-float ${i > 0 ? "-ml-8" : ""} ${["mb-0", "mb-5", "mb-1", "mb-6"][i]}`}
              style={{
                "--float-delay": `${i * 0.9}s`,
                "--float-dur": `${7 + i}s`,
                zIndex: i,
              } as CSSProperties}
            >
              <div
                className="pop-in"
                style={{
                  "--pop-rot": ["-5deg", "3deg", "-3deg", "6deg"][i],
                  animationDelay: `${820 + i * 150}ms`,
                } as CSSProperties}
              >
                <figure className="polaroid">
                  <Image
                    src={print.src}
                    alt={print.alt}
                    placeholder="blur"
                    sizes="150px"
                    className="h-[164px] w-[148px] object-cover"
                  />                </figure>
              </div>
            </div>
          ))}
        </div>
      </section>

      <LiveActivityMarquee items={pulse.marqueeItems} />

      {/* ===================== How Click works =====================
          The first-visit explainer as a run of modular beats on a LIVING
          lavender colour-field (.aura-soft drifts, so the wash slowly changes
          colour, Partiful-style): four numbered cards tossed on it like prints
          - each tilted a hair and gently floating out of lockstep - the last
          (the mutual payoff) lifted onto the lavender wash and carrying the one
          sanctioned Spark. The numbering extends the hero's dictionary conceit;
          copy stays diffed against the real flow (register -> attend -> private
          click -> mutual reveal). */}
      <section className="aura-soft">
        <div className="ck-page py-16 lg:py-24">
          <Reveal>
            <div className="mb-11 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div>
                <p className="eyebrow">How Click works</p>
                <h2 className="font-display mt-3 max-w-[640px] text-[length:var(--text-display)] leading-[1.05] font-semibold tracking-[-0.02em] text-balance text-[color:var(--ink)]">
                  Go to things. Click with people.
                </h2>
                <p className="mt-3 max-w-[520px] text-[15.5px] leading-[1.6] text-[color:var(--slate)]">
                  Events worth leaving the house for - and a private, mutual way to keep the
                  people you clicked with at them.
                </p>
              </div>
              <Link
                href="/how-it-works"
                className="font-display shrink-0 text-[13.5px] font-semibold whitespace-nowrap text-[color:var(--purple)] hover:underline"
              >
                The full story{" "}
                <span className="nudge-arrow" aria-hidden>
                  →
                </span>
              </Link>
            </div>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, i) => {
              const isPeak = i === HOW_IT_WORKS.length - 1;
              return (
                <Reveal key={step.title} delay={i * 90} className="min-w-0">
                  <div
                    className={`home-float flex h-full flex-col rounded-[var(--radius-xl)] p-6 shadow-[var(--shadow-md)] transition-shadow hover:shadow-[var(--shadow-lg)] ${
                      isPeak ? "bg-[color:var(--lav-bg)]" : "bg-[color:var(--paper)]"
                    }`}
                    style={{
                      "--tilt": ["-1.3deg", "0.9deg", "-0.8deg", "1.4deg"][i],
                      "--float-delay": `${i * 0.8}s`,
                      "--float-dur": `${7 + i * 0.5}s`,
                    } as CSSProperties}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-display text-[48px] leading-[0.85] font-semibold tracking-[-0.02em] text-[color:var(--purple-300)] tabular-nums">
                        {i + 1}
                      </span>
                      {isPeak ? <Spark size={24} /> : null}
                    </div>
                    <h3 className="font-display mt-5 text-[18px] font-semibold text-[color:var(--ink)]">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-[14.5px] leading-[1.6] text-[color:var(--slate)]">
                      {step.body}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== Trending - the party glow band =====================
          The room mid-party: a WebGL aurora in the deep-band palette with
          camera-flash twinkles (PartyGlow degrades to the flat deep surface),
          and on top of it the events Sydney is piling into. White cards pop
          on the glow; status colours stay on their badges. */}
      {trending.length > 0 ? (
        <section className="relative overflow-hidden bg-[color:var(--surface-deep)]">
          <PartyGlow />
          <div className="ck-page relative py-14 lg:py-20">
            <Reveal>
              <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div>
                  <h2 className="font-display text-[length:var(--text-h1)] font-semibold tracking-[-0.015em] text-[color:var(--on-deep)]">
                    Trending this week
                  </h2>
                  <p className="mt-2 max-w-[460px] text-[15px] leading-[1.55] text-[color:var(--on-deep-soft)]">
                    The events Sydney is signing up for right now.
                  </p>
                </div>
                <Link
                  href="/discover"
                  className="font-display shrink-0 text-[13.5px] font-semibold whitespace-nowrap text-[color:var(--on-deep)] hover:underline"
                >
                  See everything near you{" "}
                  <span className="nudge-arrow" aria-hidden>
                    →
                  </span>
                </Link>
              </div>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {trending.map((event, i) => (
                <Reveal key={event.id} delay={i * 90} className="min-w-0">
                  <EventCard event={event} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ===================== The photo wall =====================
          Full-bleed rail of pinned-up prints - the kinds of nights (and
          mornings) Click runs across Sydney. Scroll-snap, no autoplay; the
          print cut off at the viewport edge is the invitation to drag.
          The wall + quiz share one .aura-field: Partiful-style lavender
          washes dissolving in and out of the cream, no hard borders. */}
      <div className="aura-field">
      <section className="py-14">
        <div className="ck-page">
          <Reveal>
            <h2 className="font-display max-w-[640px] text-[length:var(--text-display)] leading-[1.05] font-semibold tracking-[-0.02em] text-balance text-[color:var(--ink)]">
              Your week could look like this
            </h2>
            <p className="mt-3 max-w-[520px] text-[15.5px] leading-[1.6] text-[color:var(--slate)]">
              Rooftops, run clubs, trivia nights, pottery wheels - small groups in real Sydney
              places, with people you actually click with.
            </p>
          </Reveal>
        </div>
        <div
          className="ckRail mt-9 flex snap-x items-center gap-7 overflow-x-auto pt-2 pb-5 pr-6"
          style={{ paddingInlineStart: "max(20px, calc((100vw - 1200px) / 2 + 32px))" }}
        >
          {WALL_PRINTS.map((print, i) => (
            <Reveal key={print.caption} delay={i * 70} className="shrink-0 snap-start">
              <div className={print.tilt}>
                <figure className="polaroid">
                  <Image
                    src={print.src}
                    alt={print.alt}
                    placeholder="blur"
                    sizes="480px"
                    className={`w-auto ${print.h}`}
                  />                </figure>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal className="reveal--fade">
        <HomeQuiz isLoggedIn={isLoggedIn} persona={persona} />
      </Reveal>
      </div>

      {/* ===================== The closer - dictionary callback =====================
          The hero defines the verb; the closer conjugates it. One committed
          Deep-Purple moment on the reserved deep band (--surface-deep), cream
          type, the DS onPurple button. Sparks are decoration only. */}
      <section className="relative overflow-hidden bg-[color:var(--surface-deep)]">
        <div className="ck-page relative py-16 lg:py-24">
          <Reveal>
            <h2 className="font-display text-[length:var(--text-display)] leading-none font-semibold tracking-[-0.02em] text-[color:var(--on-deep)]">
              clicked
            </h2>
            <p className="mt-3 text-base text-[color:var(--on-deep-soft)] lg:text-[17px]">
              /klɪkt/ · <span className="italic">past tense</span>
            </p>

            <div className="mt-6 flex max-w-[560px] gap-3">
              <span className="font-display shrink-0 text-[19px] leading-[1.5] font-semibold text-[color:var(--lavender)] lg:text-[22px]">
                1.
              </span>
              <p className="text-[19px] leading-[1.5] text-pretty text-[color:var(--on-deep)] lg:text-[22px]">
                to have found your people at something you nearly skipped.
              </p>
            </div>
            <p className="mt-3 ml-8 text-[14.5px] leading-[1.55] text-[color:var(--on-deep-soft)] italic lg:text-base">
              &ldquo;see you next Saturday?&rdquo;
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
              <ButtonLink href={isLoggedIn ? "/discover" : "/signup"} variant="onPurple" size="lg">
                {isLoggedIn ? "See what's on" : "Get in"}
              </ButtonLink>
              <Link
                href="/merchant"
                className="font-display text-sm font-medium text-[color:var(--on-deep-soft)] transition-colors hover:text-[color:var(--on-deep)]"
              >
                Or host an event{" "}
                <span className="nudge-arrow" aria-hidden>
                  →
                </span>
              </Link>
            </div>
          </Reveal>

          <span
            aria-hidden
            className="absolute top-[16%] right-[7%] text-2xl text-[color:var(--lavender)] opacity-40 select-none"
          >
            ✦
          </span>
          <span
            aria-hidden
            className="absolute right-[15%] bottom-[20%] hidden text-lg text-[color:var(--lavender)] opacity-25 select-none sm:block"
          >
            ✦
          </span>
          <span
            aria-hidden
            className="absolute top-[48%] right-[24%] hidden text-sm text-[color:var(--lavender)] opacity-30 select-none sm:block"
          >
            ✦
          </span>
        </div>
      </section>
    </main>
  );
}
