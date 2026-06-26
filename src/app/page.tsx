import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import type { EventItem } from "@/lib/click-data";
import { EventCard } from "@/components/event-card";
import { FaceStack } from "@/components/face-stack";
import { LiveActivityMarquee } from "@/components/live-activity-marquee";
import { LinkButton, SectionIntro } from "@/components/click-ui";
import { HomeQuiz } from "@/components/home-quiz";
import { LocationLabel } from "@/components/location-label";
import { architectureLayers, groups } from "@/lib/click-data";
import {
  getEventsForExplore,
  getLatestPersonaForSession,
  getPersonalizedDiscovery,
} from "@/lib/event-repository";

const categoryStrip: Array<{ label: string; href: string }> = [
  { label: "Make friends", href: "/events?category=Social" },
  { label: "Dating", href: "/events?category=Relationships" },
  { label: "Sports + Fitness", href: "/events?category=Fitness" },
  { label: "Food + Drink", href: "/events?category=Food" },
  { label: "Creative people", href: "/events?category=Creative" },
  { label: "Career support", href: "/events?category=Career" },
  { label: "This weekend", href: "/events?tag=weekend" },
  { label: "Free events", href: "/events?search=free" },
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Honest social proof, derived entirely from the real events array. No
// invented percentages, no satisfaction claims, nothing about private Clicks.
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
  const peopleThisWeek = weekEvents.reduce((sum, e) => sum + (e.attendees || 0), 0);
  const peopleGoing = events.reduce((sum, e) => sum + (e.attendees || 0), 0);
  const distinctSuburbs = new Set(
    events.map((e) => e.suburb).filter(Boolean),
  ).size;
  const distinctHosts = new Set(
    events.map((e) => e.host || e.group).filter(Boolean),
  ).size;
  // Prefer the next event that has not started yet, so the hero "Starts ..."
  // framing stays truthful; fall back to the earliest only if all are underway.
  const soonest =
    events.find((e) => {
      const t = within(e.startsAt);
      return t !== null && t >= now;
    }) ??
    events[0] ??
    null;
  // Pool real attendee faces across the soonest events for the hero stack.
  const heroAvatars = Array.from(
    new Set(events.flatMap((e) => e.attendeeAvatars ?? [])),
  ).slice(0, 3);

  const marqueeItems = [
    eventsThisWeek > 0
      ? `${eventsThisWeek} ${eventsThisWeek === 1 ? "event" : "events"} this week`
      : events.length > 0
        ? `${events.length} upcoming ${events.length === 1 ? "event" : "events"}`
        : null,
    peopleGoing > 0 ? `${peopleGoing} going across Sydney` : null,
    soonest ? `Next up: ${soonest.title} in ${soonest.suburb}` : null,
    distinctHosts > 0
      ? `${distinctHosts} ${distinctHosts === 1 ? "host" : "hosts"} on the calendar`
      : null,
    distinctSuburbs > 1 ? `${distinctSuburbs} Sydney suburbs active` : null,
  ].filter((x): x is string => Boolean(x));

  return {
    hasEvents: events.length > 0,
    eventsThisWeek,
    peopleThisWeek,
    peopleGoing,
    distinctSuburbs,
    distinctHosts,
    soonest,
    heroAvatars,
    marqueeItems,
  };
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

  // Bento source: a genuinely personalised feed when we have one, otherwise the
  // live city catalogue. "Picked for you" only when the feed is real, not the
  // cold-start editorial fallback.
  const personalized = Boolean(
    discovery && !discovery.fallback && discovery.events.length >= 3,
  );
  const bentoEvents = (personalized ? discovery!.events : events).slice(0, 6);

  return (
    <main className="min-h-screen max-w-full overflow-hidden bg-[color:var(--champagne)] text-[color:var(--ink)]">
      {/* ============================ HERO. Living "tonight in Sydney" panel ============================ */}
      <section className="relative overflow-hidden px-5 pb-12 pt-12 sm:px-8 sm:pb-16 lg:px-12 lg:pt-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          {/* Copy column */}
          <div className="relative z-10">
            <p className="rise rise-d1 eyebrow">Now in <LocationLabel /></p>

            <h1 className="rise rise-d2 font-display mt-6 text-[3.1rem] font-bold leading-[0.98] tracking-[-0.03em] text-[color:var(--ink)] sm:text-[4.2rem] lg:text-[4.8rem]">
              Where <span className="peach-highlight">interests</span>
              <br className="hidden sm:block" /> become{" "}
              <span className="text-[color:var(--coral)]">friendships.</span>
            </h1>

            <p className="rise rise-d3 mt-6 max-w-md text-lg leading-8 text-[color:var(--mauve)]">
              Real dinners, walks, workshops and run clubs across Sydney. Show up
              twice, become familiar.
            </p>

            <div className="rise rise-d4 mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
              <LinkButton href="/discover">Start exploring</LinkButton>
              <Link
                href="#events"
                className="group/bl inline-flex items-center gap-1.5 text-[0.95rem] font-semibold text-[color:var(--ink)] transition-colors hover:text-[color:var(--coral)]"
              >
                See who is going
                <span aria-hidden className="inline-block transition-transform group-hover/bl:translate-x-1">→</span>
              </Link>
            </div>

            {/* Mobile-only social proof — the living panel is desktop-only, so the
                real faces still reach phones here. */}
            {pulse.hasEvents && pulse.peopleGoing > 0 ? (
              <div className="rise rise-d5 mt-8 lg:hidden">
                <FaceStack
                  avatars={pulse.heroAvatars}
                  count={pulse.peopleGoing}
                  label={
                    pulse.eventsThisWeek > 0
                      ? `${pulse.peopleGoing} going to ${pulse.eventsThisWeek} ${pulse.eventsThisWeek === 1 ? "event" : "events"} this week`
                      : `${pulse.peopleGoing} going across Sydney`
                  }
                />
              </div>
            ) : null}
          </div>

          {/* Living panel — framed photo + one honest social-proof card + the
              soonest-event pulse chip. Collapses to the bare photo when empty. */}
          <div className="rise rise-d3 relative mx-auto hidden w-full max-w-md lg:block">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] hard-shadow-lg">
              <Image
                src="/media/networking.jpg"
                alt="People connecting at a local social event"
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
                priority
              />
            </div>

            {pulse.hasEvents ? (
              <>
                <div className="absolute -bottom-6 -left-8 max-w-[16rem] rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] px-5 py-4 hard-shadow">
                  {pulse.peopleGoing > 0 ? (
                    <>
                      <FaceStack
                        avatars={pulse.heroAvatars}
                        count={pulse.peopleGoing}
                        ringClass="border-[color:var(--paper)]"
                      />
                      <p className="mt-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--mauve)]">
                        to{" "}
                        {pulse.eventsThisWeek > 0 ? pulse.eventsThisWeek : events.length}{" "}
                        {(pulse.eventsThisWeek > 0 ? pulse.eventsThisWeek : events.length) === 1
                          ? "event"
                          : "events"}{" "}
                        {pulse.eventsThisWeek > 0 ? "this week" : "coming up"}
                      </p>
                    </>
                  ) : (
                    <p className="font-display text-base font-bold leading-snug text-[color:var(--ink)]">
                      {pulse.eventsThisWeek > 0
                        ? `${pulse.eventsThisWeek} ${pulse.eventsThisWeek === 1 ? "event" : "events"} this week`
                        : `${events.length} ${events.length === 1 ? "event" : "events"} coming up`}
                    </p>
                  )}
                </div>

                {pulse.soonest ? (
                  <Link
                    href={`/events/${pulse.soonest.id}`}
                    className="absolute -right-3 top-6 inline-flex rotate-2 items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-2 text-[0.72rem] font-semibold text-[color:var(--ink)] hard-shadow-sm transition-transform hover:rotate-0"
                  >
                    <span className="relative inline-flex size-2.5" aria-hidden>
                      <span className="absolute inline-flex h-full w-full rounded-full bg-[color:var(--coral)] pulse-ring" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-[color:var(--coral)]" />
                    </span>
                    Starts {pulse.soonest.time} · {pulse.soonest.suburb}
                  </Link>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </section>

      {/* ============================ LIVE ACTIVITY MARQUEE ============================ */}
      <LiveActivityMarquee items={pulse.marqueeItems} />

      {/* ============================ EVENTS. Party-board bento ============================ */}
      <section id="events" className="scroll-mt-24 bg-[color:var(--champagne)] px-5 pb-16 pt-16 sm:px-8 lg:px-12">
        <div className="rise mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display min-w-0 text-3xl font-bold leading-[1.05] tracking-[-0.025em] text-[color:var(--ink)] sm:text-4xl">
              {personalized ? "Picked for you." : "What is on near you."}
            </h2>
            <Link
              href="/events"
              className="shrink-0 rounded-full border border-[color:var(--line-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition-all duration-200 hover:-translate-y-0.5 hover:border-transparent hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
            >
              See all events →
            </Link>
          </div>

          {bentoEvents.length > 0 ? (
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {bentoEvents.map((event, i) => (
                <div key={event.id} className={i === 0 ? "sm:col-span-2 xl:col-span-2" : ""}>
                  <EventCard event={event} compact={i !== 0} showLivePulse />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-8 rounded-2xl border border-dashed border-[color:var(--line-strong)] bg-[color:var(--cream)] p-6 text-sm text-[color:var(--mauve)]">
              No events on the calendar just yet. Check back soon, or{" "}
              <Link href="/events" className="text-[color:var(--coral)] underline">
                browse the full calendar
              </Link>
              .
            </p>
          )}
        </div>
      </section>

      {/* ============================ PERSONA QUIZ. The "pick your vibe" moment ============================ */}
      <HomeQuiz isLoggedIn={isLoggedIn} persona={persona} />

      {/* ============================ CATEGORY PILL BAR ============================ */}
      <section className="border-y border-[color:var(--line)] bg-[color:var(--cream)]">
        <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto px-5 py-4 sm:px-8 lg:px-12">
          {categoryStrip.map((category) => (
            <Link
              key={category.label}
              href={category.href}
              className="shrink-0 rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-1.5 text-sm font-medium text-[color:var(--ink)] transition-all duration-200 hover:-translate-y-0.5 hover:border-transparent hover:bg-[color:var(--lavender)] hover:text-[color:var(--ink)]"
            >
              {category.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ============================ WHAT IS A CLICK. Centered definition ============================ */}
      <section className="border-b border-[color:var(--line)] bg-[color:var(--cream)] py-24">
        <div className="mx-auto max-w-3xl px-5 text-center sm:px-8 lg:px-12">
          <h2 className="font-display flex flex-wrap items-baseline justify-center gap-x-4 text-6xl font-bold leading-[0.98] tracking-[-0.03em] text-[color:var(--ink)] sm:text-7xl">
            click
            <span className="text-2xl font-medium text-[color:var(--mauve)] sm:text-3xl">
              /klɪk/
            </span>
            <span className="text-base font-semibold uppercase tracking-[0.14em] text-[color:var(--mauve)]">
              noun · verb
            </span>
          </h2>
          <div className="mt-12 grid gap-7 text-left sm:grid-cols-3">
            <div className="border-t-2 border-[color:var(--lavender)] pt-5">
              <p className="text-[0.98rem] leading-7 text-[color:var(--mauve)]">
                A burst of <span className="peach-highlight">yes</span> between two
                people in the same room.
              </p>
            </div>
            <div className="border-t-2 border-[color:var(--lavender)] pt-5">
              <p className="text-[0.98rem] leading-7 text-[color:var(--mauve)]">
                The reason a stranger becomes a friend. Familiar by week 3.
              </p>
            </div>
            <div className="border-t-2 border-[color:var(--lavender)] pt-5">
              <p className="text-[0.98rem] leading-7 text-[color:var(--mauve)]">
                <span className="font-semibold text-[color:var(--ink)]">verb.</span> To
                privately tap a person you&apos;d see again. No mutual, nobody knows.
              </p>
            </div>
          </div>
          <p className="font-display mt-12 text-2xl font-semibold italic text-[color:var(--coral)] sm:text-3xl">
            Clicks happen in person.
          </p>
        </div>
      </section>

      {/* ============================ HOW IT WORKS. Merged mechanic grid ============================ */}
      <section className="bg-[color:var(--champagne)] py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
          <SectionIntro
            eyebrow="How Click works"
            title={
              <>
                Meet through something you{" "}
                <span className="text-[color:var(--purple)]">already</span> care
                about.
              </>
            }
            body="People show up for the event itself, a walk, a dinner, a class, a run. The conversation comes free, because the reason to talk is already in the room."
          />

          <div className="mt-14 grid gap-x-10 gap-y-12 lg:grid-cols-3">
            {architectureLayers.map(([layer, body], index) => (
              <article key={layer} className="group relative">
                <span className="font-display text-5xl font-bold leading-none tracking-[-0.03em] text-[color:var(--coral)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display mt-5 text-[1.9rem] font-bold leading-[1.06] tracking-[-0.025em] text-[color:var(--ink)]">
                  {layer}
                </h3>
                <p className="mt-3 text-[0.95rem] leading-7 text-[color:var(--mauve)]">
                  {body}
                </p>
                {index === architectureLayers.length - 1 ? (
                  <span className="mt-5 inline-flex rotate-[-2deg] items-center gap-2 rounded-full bg-[color:var(--coral)] px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--surface-deep)] hard-shadow-sm">
                    ✦ Mutual click
                  </span>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ GROUPS. JOIN ONCE (deep band anchor) ============================ */}
      <section className="relative overflow-hidden bg-[color:var(--surface-deep)] py-24 text-[color:var(--on-deep)]">
        <div className="absolute inset-0 stamp-grid opacity-[0.06]" aria-hidden />

        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:px-12">
          <div>
            <h2 className="font-display text-5xl font-bold leading-[1.0] tracking-[-0.03em] text-[color:var(--on-deep)] sm:text-6xl lg:text-[4.3rem]">
              Join <span className="text-[color:var(--lavender)]">once.</span> Show
              up <span className="text-[color:var(--coral)]">twice.</span> Become{" "}
              <span className="text-[color:var(--lavender)]">familiar.</span>
            </h2>
            <p className="mt-7 max-w-md text-[0.98rem] leading-7 text-[color:var(--on-deep)]/65">
              Click favours recurring groups because relationships rarely start in
              a single perfect moment. They start when ordinary people keep
              crossing paths.
            </p>
            <div className="mt-9">
              <LinkButton href="/discover" variant="light">
                Find a group
              </LinkButton>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <article
                key={group.name}
                className="group rounded-[22px] border border-[color:var(--on-deep)]/15 bg-[color:var(--surface-deep-2)] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--lavender)]/60"
              >
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[color:var(--lavender)]">
                  {group.cadence}
                </p>
                <h3 className="font-display mt-3 text-[1.6rem] font-bold leading-tight tracking-[-0.025em] text-[color:var(--on-deep)]">
                  {group.name}
                </h3>
                <p className="mt-2 text-sm font-semibold text-[color:var(--on-deep)]/80">
                  {group.members} members · {group.category}
                </p>
                <p className="mt-3 text-[0.95rem] leading-7 text-[color:var(--on-deep)]/60">
                  {group.focus}
                </p>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--lavender)] transition-all group-hover:gap-3">
                  Join group <span aria-hidden>→</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ CLOSING. Calm centered cream ============================ */}
      <section className="bg-[color:var(--champagne)] py-28">
        <div className="mx-auto max-w-3xl px-5 text-center sm:px-8 lg:px-12">
          <h2 className="font-display text-5xl font-bold leading-[1.0] tracking-[-0.03em] text-[color:var(--ink)] sm:text-7xl">
            Pick a room. Show up.
            <br className="hidden sm:block" />{" "}
            <span className="text-[color:var(--purple)]">See what clicks.</span>
          </h2>
          <p className="mt-6 text-lg text-[color:var(--mauve)]">
            It takes 30 seconds to find your first room. The rest happens in person.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <LinkButton href="/discover">Start exploring</LinkButton>
            <Link
              href="/onboarding"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[color:var(--line-strong)] px-6 text-[0.95rem] font-semibold text-[color:var(--ink)] transition-all duration-200 hover:-translate-y-0.5 hover:border-transparent hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
            >
              Take the quiz
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
