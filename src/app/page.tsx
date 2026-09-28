import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { auth } from "@/auth";
import { ButtonLink, Icon, Logo } from "@/components/ds";
import { EventCard } from "@/components/event-card";
import { HomeQuiz } from "@/components/home-quiz";
import { MutualToast } from "@/components/mutual-toast";
import { Reveal } from "@/components/reveal";
import { getEventsForExplore, getLatestPersonaForSession } from "@/lib/event-repository";
import heroCourtyard from "../../public/home/hero-courtyard.jpg";
import heroDinner from "../../public/home/hero-dinner.jpg";
import heroPickleball from "../../public/home/hero-pickleball.jpg";
import heroRings from "../../public/home/hero-rings.jpg";
import heroRun from "../../public/home/hero-run.jpg";
import heroSlideBowls from "../../public/home/hero-slide-bowls.jpg";
import heroSlideGig from "../../public/home/hero-slide-gig.jpg";
import heroSlideRooftop from "../../public/home/hero-slide-rooftop.jpg";
import wallKaraoke from "../../public/home/wall-karaoke.jpg";
import wallPicnic from "../../public/home/wall-picnic.jpg";
import wallTrivia from "../../public/home/wall-trivia.jpg";

/* Below the full-bleed photo hero the page reads as a social page, not a
   product tour: real plans, the mechanic told as one sentence, a pinboard to
   browse by, and a `clicked` bookend. No stat ticker or feature grid - those
   were what made it read as software. Prints are photos only, no captions
   (dropped on purpose in caff3f8). */

/* The photos that dissolve in over the courtyard, in play order, each with the
   word the headline lands on while it shows, so photo and word change on one
   beat. Decorative (the courtyard carries the alt). The timing lives in
   `hero-slide` and `word-cycle-slot`, both cut for exactly three slides. Each
   crop keeps its people in a phone's narrow window; from sm the scrim covers
   the left and the frame shows whole. */
const HERO_SLIDES: Array<{ src: StaticImageData; word: string; crop: string }> = [
  { src: heroSlideRooftop, word: "catch-up.", crop: "object-[77%_center] sm:object-center" },
  { src: heroSlideBowls, word: "bowls night.", crop: "object-[84%_center] sm:object-center" },
  { src: heroSlideGig, word: "big night.", crop: "object-[72%_center] sm:object-center" },
];

/* The headline's last word. "obsession." is the anchor - it stays in normal
   flow, so it is what crawlers, screen readers and reduced-motion visitors get,
   and it plays once, over the courtyard on arrival. These are the aria-hidden
   overlays: one per slide, then "click." for every later pass back to the
   courtyard. */
const HERO_CYCLE_WORDS = [...HERO_SLIDES.map((slide) => slide.word), "click."];

/* Logo takes a px size, so each breakpoint gets its own copy and CSS shows one.
   The copies are aria-hidden; the sr-only span is what a screen reader hears. */
const HEADWORD_SIZES = [
  { size: 84, className: "inline-flex sm:hidden" },
  { size: 112, className: "hidden sm:inline-flex lg:hidden" },
  { size: 148, className: "hidden lg:inline-flex" },
] as const;

function Headword({ suffix = "", cream = false }: { suffix?: string; cream?: boolean }) {
  return (
    <>
      <span className="sr-only">{`click${suffix}`}</span>
      {HEADWORD_SIZES.map(({ size, className }) => (
        <span key={size} aria-hidden className={`${className} items-baseline`}>
          <Logo size={size} cream={cream} />
          {suffix ? (
            <span
              className="font-display"
              style={{
                fontSize: size,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                color: cream ? "var(--champagne)" : "var(--purple)",
              }}
            >
              {suffix}
            </span>
          ) : null}
        </span>
      ))}
    </>
  );
}

/* Browse by feel, not by feature - the same four doors into Discover. */
const LANES: Array<{
  title: string;
  detail: string;
  category: string;
  image: StaticImageData;
  alt: string;
  rot: string;
  lift: string;
}> = [
  {
    title: "Make something",
    detail: "Pottery, jewellery and creative workshops",
    category: "Creative",
    image: heroRings,
    alt: "Friends making silver rings together at a jewellery workshop",
    rot: "-2deg",
    lift: "0px",
  },
  {
    title: "Eat together",
    detail: "Shared tables, tastings and long lunches",
    category: "Food",
    image: heroDinner,
    alt: "Friends sharing yum cha around a crowded lazy Susan, seen from above",
    rot: "1.5deg",
    lift: "28px",
  },
  {
    title: "Move together",
    detail: "Run clubs, sport and outdoor plans",
    category: "Fitness",
    image: heroRun,
    alt: "A run club chatting along a sandstone coastal walk",
    rot: "-1deg",
    lift: "8px",
  },
  {
    title: "Go out out",
    detail: "Karaoke, live music and late-night energy",
    category: "Nightlife",
    image: wallKaraoke,
    alt: "Friends at a private-room karaoke night, one belting into the mic",
    rot: "2deg",
    lift: "36px",
  },
];

/* A photo set into a line of display type. Decorative - the sentence carries
   the meaning - so the alt is empty. */
function InlinePic({ src, rot }: { src: StaticImageData; rot: string }) {
  return (
    <span className="home-inline-pic" style={{ "--rot": rot } as CSSProperties}>
      <Image src={src} alt="" sizes="160px" />
    </span>
  );
}

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

/* WCAG 2.2.2 asks for a way to pause motion that starts on its own and runs
   past five seconds, and the hero's photo and word cycles never stop. A plain
   checkbox does it with no JS - `.hero-motion-toggle` in globals.css. It sits
   beside the tag rather than in a corner: the support button owns the
   bottom-right on every page, and here it comes before the headline in tab
   order. */
function HeroMotionToggle() {
  return (
    <label className="hero-motion-toggle size-8 cursor-pointer place-items-center rounded-[var(--radius-md)] border border-white/25 bg-[color-mix(in_srgb,var(--surface-deep)_66%,transparent)] text-[color:var(--on-deep)] backdrop-blur-md transition-colors hover:bg-[color-mix(in_srgb,var(--surface-deep)_86%,transparent)]">
      <input type="checkbox" className="sr-only" />
      <span className="sr-only">Pause animation</span>
      <Icon name="pause" size={15} className="hero-motion-toggle__pause" />
      <Icon name="play" size={15} className="hero-motion-toggle__play" />
    </label>
  );
}

export default async function Home() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user);
  const [events, persona] = await Promise.all([
    getEventsForExplore(),
    isLoggedIn ? getLatestPersonaForSession(session) : Promise.resolve(null),
  ]);
  const upcoming = [...events]
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
    .slice(0, 3);

  return (
    <main data-home-hero className="min-h-[100dvh] bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <section className="home-hero relative isolate flex min-h-[100dvh] items-end overflow-hidden bg-[color:var(--surface-deep)] lg:items-center">
        <Image
          src={heroCourtyard}
          alt="A lively group sharing dinner and conversation in a Sydney courtyard at dusk"
          fill
          preload
          placeholder="blur"
          sizes="100vw"
          className="home-hero-photo object-cover object-[68%_center] sm:object-center"
        />
        {/* Low priority, so they never share bandwidth with the courtyard (the LCP photo). */}
        {HERO_SLIDES.map((slide, index) => (
          <Image
            key={slide.src.src}
            src={slide.src}
            alt=""
            fill
            sizes="100vw"
            fetchPriority="low"
            className={`home-hero-slide object-cover ${slide.crop}${index === HERO_SLIDES.length - 1 ? " home-hero-slide--last" : ""}`}
            style={{ "--slide-i": index + 1 } as CSSProperties}
          />
        ))}
        <div aria-hidden className="hero-scrim absolute inset-0" />

        <div className="ck-page relative z-10 pb-8 pt-28 sm:pb-12 lg:py-28">
          <div className="home-hero-copy max-w-[760px]">
            <div className="rise-soft flex items-center gap-2">
              <p className="inline-flex items-center rounded-full border border-white/25 bg-[color-mix(in_srgb,var(--surface-deep)_66%,transparent)] px-3.5 py-1.5 text-[13px] font-semibold text-[color:var(--on-deep)] backdrop-blur-md">
                Sydney plans for real life
              </p>
              <HeroMotionToggle />
            </div>
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

      {/* ============ Real plans - the canonical Event Card, untouched ============ */}
      {upcoming.length > 0 ? (
        <section className="ck-page pb-16 pt-12 lg:pb-24 lg:pt-16">
          <Reveal>
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-[length:var(--text-h1)] leading-tight font-semibold tracking-[-0.025em]">
                Coming up
              </h2>
              <Link
                href="/discover"
                className="ck-taplink font-display text-sm font-semibold text-[color:var(--purple)] hover:underline"
              >
                See what&apos;s on <span className="nudge-arrow" aria-hidden>→</span>
              </Link>
            </div>
          </Reveal>

          {/* Two columns from sm to lg would strand the third card on a row of
              its own, so it sits out that range; the rail and lg show all three. */}
          <div className="ckRail -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 sm:[&>*:nth-child(3)]:hidden lg:[&>*:nth-child(3)]:block">
            {upcoming.map((event, index) => (
              <Reveal
                key={event.id}
                delay={index * 70}
                // reveal--rail: the peek is the affordance that says the row scrolls,
                // and at 26px into the viewport the observer never fires, so the
                // next card sat at opacity 0 until you had already swiped.
                className="reveal--rail w-[84vw] max-w-[340px] shrink-0 snap-center sm:w-auto sm:max-w-none sm:min-w-0"
              >
                <EventCard event={event} />
              </Reveal>
            ))}
          </div>
        </section>
      ) : (
        <section className="ck-page pb-16 pt-12 lg:pb-24 lg:pt-16">
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

      {/* ============ The mechanic, told as one sentence ============ */}
      <section className="ck-page pb-20 lg:pb-28">
        <Reveal>
          <p className="eyebrow">How it usually goes</p>
          {/* Each photo rides in a nowrap span with the word before it, so a
              wrap can never strand a photo (or the full stop) on its own line. */}
          <h2 className="font-display mt-6 text-[length:var(--text-display)] leading-[1.18] font-semibold tracking-[-0.03em] text-[color:var(--ink)]">
            Pick a{" "}
            <span className="whitespace-nowrap">
              plan <InlinePic src={heroPickleball} rot="-3deg" />,
            </span>{" "}
            <span className="whitespace-nowrap">
              show up <InlinePic src={wallTrivia} rot="2deg" />
            </span>{" "}
            and see who you{" "}
            <span className="whitespace-nowrap">
              clicked with <InlinePic src={wallPicnic} rot="-2deg" />.
            </span>
          </h2>
          <div className="mt-8 grid lg:grid-cols-12">
            <div className="max-w-[560px] lg:col-span-6 lg:col-start-7">
              <p className="text-base leading-7 text-[color:var(--ink-soft)]">
                Book something you&apos;d happily do anyway. Come solo or bring someone - the activity
                does the small talk. Afterwards, see who you clicked with, and make the next plan
                together.
              </p>
              <Link
                href="/how-it-works"
                className="ck-taplink font-display mt-4 inline-block text-[15px] font-semibold text-[color:var(--purple)] hover:underline"
              >
                How Click works <span className="nudge-arrow" aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============ The pinboard: four doors into Discover ============ */}
      <section className="bg-[color:var(--lav-bg)] py-16 lg:py-24">
        <div className="ck-page">
          <Reveal>
            <h2 className="font-display text-[length:var(--text-display)] leading-[1.05] font-semibold tracking-[-0.035em]">
              What sounds{" "}
              <span className="relative inline-block">
                fun?
                <svg aria-hidden viewBox="0 0 120 16" preserveAspectRatio="none" className="home-scribble">
                  <path pathLength={1} d="M3 11 C 28 4, 70 3, 117 8" />
                </svg>
              </span>
            </h2>
            <p className="mt-4 max-w-[480px] text-base leading-7 text-[color:var(--slate)]">
              Start with the plan. The people part happens once you&apos;re there.
            </p>
          </Reveal>

          <ul className="ckRail -mx-5 mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-6 pt-4 sm:mx-0 sm:mt-10 sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-10 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 lg:gap-x-7">
            {LANES.map((lane, index) => (
              <li
                key={lane.title}
                className="w-[72vw] max-w-[300px] shrink-0 snap-center sm:w-auto sm:max-w-none lg:mt-[var(--lift)]"
                style={{ "--lift": lane.lift } as CSSProperties}
              >
                <Reveal delay={index * 80} className="reveal--rail">
                  <Link
                    href={`/discover?category=${encodeURIComponent(lane.category)}`}
                    className="home-lane block rounded-[var(--radius-lg)]"
                  >
                    <span className="home-lane__tilt block" style={{ "--rot": lane.rot } as CSSProperties}>
                      <figure className="polaroid">
                        <Image
                          src={lane.image}
                          alt={lane.alt}
                          placeholder="blur"
                          sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 72vw"
                          className="aspect-[4/3] w-full object-cover"
                        />
                      </figure>
                    </span>
                    <span className="font-display mt-5 flex items-center gap-1.5 text-lg font-semibold tracking-[-0.015em] text-[color:var(--ink)]">
                      {lane.title}
                      <span className="nudge-arrow text-[color:var(--purple)]" aria-hidden>
                        →
                      </span>
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-[color:var(--slate)]">{lane.detail}</span>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Reveal className="reveal--fade">
        <HomeQuiz isLoggedIn={isLoggedIn} persona={persona} />
      </Reveal>

      {/* ============ The bookend: the hero's verb, past tense ============ */}
      <section className="bg-[color:var(--surface-deep)] text-[color:var(--on-deep)]">
        <div className="ck-page py-16 lg:py-24">
          <Reveal>
            <h2>
              <Headword suffix="ed" cream />
            </h2>
            <p className="mt-3 text-base text-[color:var(--on-deep-soft)] lg:text-lg">
              /klɪkt/ · <span className="italic">past tense</span>
            </p>
            <div className="mt-5 flex max-w-[620px] gap-3">
              <span className="font-display text-xl leading-[1.45] font-semibold text-[color:var(--lavender)] lg:text-2xl">
                1.
              </span>
              <div>
                <p className="text-xl leading-[1.45] text-pretty lg:text-2xl">what you&apos;ll be saying about Saturday.</p>
                <p className="mt-2.5 text-[15px] leading-6 text-[color:var(--on-deep-soft)] italic lg:text-base">
                  &ldquo;we clicked at trivia, and now it&apos;s every Tuesday.&rdquo;
                </p>
              </div>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
              <ButtonLink href="/discover" variant="onPurple" size="lg">
                See what&apos;s on
              </ButtonLink>
              {/* /merchant/signup, not /merchant - the latter bounces a
                  logged-out visitor through /merchant/login first. */}
              <Link
                href="/merchant/signup"
                className="ck-taplink font-display text-[15px] font-semibold text-[color:var(--champagne)] hover:underline"
              >
                Host an event <span className="nudge-arrow" aria-hidden>→</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
