import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { EventCard } from "@/components/event-card";
import { LinkButton, SectionIntro } from "@/components/click-ui";
import { HomeQuiz } from "@/components/home-quiz";
import { LocationLabel } from "@/components/location-label";
import {
  architectureLayers,
  groups,
  personaCards,
  roleCards,
} from "@/lib/click-data";
import {
  getEventsForExplore,
  getLatestPersonaForSession,
} from "@/lib/event-repository";

const trustStats: Array<[string, string]> = [
  ["27", "weekly hosts"],
  ["8.4k", "showing up"],
  ["94%", "would return"],
];

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

const experienceTiles: Array<{
  eyebrow: string;
  title: string;
  body: string;
  href: string;
}> = [
  {
    eyebrow: "Slow tables",
    title: "Slow dating + small dinners",
    body: "10 people, one long table, a host who actually hosts. No swiping required.",
    href: "/events?category=Relationships",
  },
  {
    eyebrow: "Move + meet",
    title: "Walk, run, climb, swim",
    body: "Active rooms where the conversation is a side effect of the activity.",
    href: "/events?category=Fitness",
  },
  {
    eyebrow: "Hands on",
    title: "Classes + workshops",
    body: "Pottery, cooking, life-drawing — common output, common excuse to chat.",
    href: "/events?category=Creative",
  },
  {
    eyebrow: "Group rituals",
    title: "Recurring meetups",
    body: "Weekly run clubs, monthly book nights, regular brunch crews. Familiar by week 3.",
    href: "/discover",
  },
  {
    eyebrow: "Career rooms",
    title: "Networking + peer support",
    body: "Career pivots, founders, freelancers. Quiet enough to actually talk.",
    href: "/events?category=Career",
  },
  {
    eyebrow: "Quiet + curious",
    title: "Talks + screenings",
    body: "Low-pressure rooms where you don't need to be on. Listen first, mingle second.",
    href: "/events?category=Community",
  },
];

export default async function Home() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user);
  const [events, persona] = await Promise.all([
    getEventsForExplore(),
    isLoggedIn ? getLatestPersonaForSession(session) : Promise.resolve(null),
  ]);
  const upcomingEvents = events.slice(0, 6);

  return (
    <main className="min-h-screen max-w-full overflow-hidden bg-[color:var(--champagne)] text-[color:var(--ink)]">
      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-6 lg:pt-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          {/* ---- Copy column ---- */}
          <div className="relative z-10">
            <div className="rise rise-d1">
              <span className="sticker sticker--cream">
                <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
                Now in <LocationLabel /> · low pressure, high yes
              </span>
            </div>

            <h1 className="rise rise-d2 font-display mt-7 text-[3.3rem] font-light leading-[0.94] tracking-[-0.03em] text-[color:var(--ink)] sm:text-[4.6rem] lg:text-[5.3rem]">
              Where{" "}
              <span className="peach-highlight">interests</span>
              <br className="hidden sm:block" /> become{" "}
              <span className="italic text-[color:var(--rose)]">friendships.</span>
            </h1>

            <p className="rise rise-d3 mt-7 max-w-xl text-lg leading-8 text-[color:var(--mauve)]">
              Click is a local calendar with a human pulse. Join real rooms —
              dinners, walks, workshops, run clubs — where conversation already
              has a reason. Show up twice. Become familiar.
            </p>

            <div className="rise rise-d4 mt-9 flex flex-wrap items-center gap-3">
              <LinkButton href="/discover">Start exploring</LinkButton>
              <LinkButton href="/events" variant="secondary">
                Browse events
              </LinkButton>
              <span className="font-display ml-1 hidden text-lg italic text-[color:var(--mauve)] sm:inline">
                takes 30 seconds
              </span>
            </div>

            {/* trust row */}
            <div className="rise rise-d5 mt-12 grid max-w-lg grid-cols-3 gap-8 border-t border-[color:var(--line)] pt-7">
              {trustStats.map(([num, label]) => (
                <div key={label}>
                  <p className="font-display text-4xl font-light leading-none tracking-[-0.03em] text-[color:var(--ink)]">
                    {num}
                  </p>
                  <p className="font-condensed mt-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--mauve)]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ---- Photo collage column ---- */}
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
            {/* floating secondary photo */}
            <div className="absolute -bottom-10 -left-12 w-44 overflow-hidden rounded-[22px] border-4 border-[color:var(--champagne)] hard-shadow float-slow">
              <div className="relative aspect-square">
                <Image
                  src="/media/concert.jpg"
                  alt="Live music meetup"
                  fill
                  sizes="180px"
                  className="object-cover"
                />
              </div>
            </div>
            {/* lime tag */}
            <span className="absolute -right-3 top-8 inline-flex rotate-2 items-center gap-2 rounded-full bg-[color:var(--peach)] px-4 py-2 font-condensed text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--surface-deep)] hard-shadow-sm">
              ✦ Mutual click
            </span>
            {/* small stat card */}
            <div className="absolute -right-6 bottom-6 rounded-2xl border border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 hard-shadow">
              <p className="font-display text-2xl font-light leading-none text-[color:var(--ink)]">
                2nd time
              </p>
              <p className="font-condensed mt-1 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--mauve)]">
                familiar already
              </p>
            </div>
          </div>
        </div>

        {/* ---- Upcoming events ---- */}
        <div className="rise rise-d6 mx-auto mt-20 max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">Happening near <LocationLabel /></p>
              <h2 className="font-display mt-2 text-3xl font-light leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-4xl">
                Browse what&apos;s on near you.
              </h2>
            </div>
            <Link
              href="/events"
              className="shrink-0 rounded-full border border-[color:var(--line-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition-all duration-200 hover:-translate-y-0.5 hover:border-transparent hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
            >
              See all events →
            </Link>
          </div>
          {upcomingEvents.length > 0 ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} compact />
              ))}
            </div>
          ) : (
            <p className="mt-8 rounded-2xl border border-dashed border-[color:var(--line-strong)] bg-[color:var(--cream)] p-6 text-sm text-[color:var(--mauve)]">
              No upcoming events just yet — check back soon, or{" "}
              <Link href="/events" className="text-[color:var(--ink)] underline">
                browse the full calendar
              </Link>
              .
            </p>
          )}
        </div>
      </section>

      {/* ============================ HOME QUIZ ============================ */}
      <HomeQuiz isLoggedIn={isLoggedIn} persona={persona} />

      {/* ============================ STICKY CATEGORY BAR ============================ */}
      <section className="border-y border-[color:var(--line)] bg-[color:var(--cream)]">
        <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto px-4 py-4 sm:px-6">
          <span className="font-condensed shrink-0 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
            Browse →
          </span>
          {categoryStrip.map((category) => (
            <Link
              key={category.label}
              href={category.href}
              className="shrink-0 rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-1.5 text-sm font-medium text-[color:var(--ink)] transition-all duration-200 hover:-translate-y-0.5 hover:border-transparent hover:bg-[color:var(--peach)] hover:text-[color:var(--surface-deep)]"
            >
              {category.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ============================ EXPERIENCE-TYPE BROWSER ============================ */}
      <section className="border-b border-[color:var(--line)] bg-[color:var(--champagne)] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Pick a vibe"
            title={
              <>
                Browse by{" "}
                <span className="italic text-[color:var(--rose)]">experience</span>,
                not category.
              </>
            }
            body="What kind of room are you in the mood for? Click events are organised by feel, not by topic."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {experienceTiles.map((tile) => (
              <Link
                key={tile.title}
                href={tile.href}
                className="group flex flex-col rounded-[22px] border border-[color:var(--line)] bg-[color:var(--cream)] p-7 transition-all duration-300 hover:-translate-y-1.5 hard-shadow-sm hover:hard-shadow"
              >
                <span className="font-condensed text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                  {tile.eyebrow}
                </span>
                <h3 className="font-display mt-3 text-[1.75rem] font-light leading-[1.05] tracking-[-0.02em] text-[color:var(--ink)]">
                  {tile.title}
                </h3>
                <p className="mt-3 text-[0.95rem] leading-7 text-[color:var(--mauve)]">
                  {tile.body}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  See this room
                  <span
                    className="transition-transform group-hover:translate-x-1"
                    aria-hidden
                  >
                    →
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ DICTIONARY ENTRY ============================ */}
      <section className="border-b border-[color:var(--line)] bg-[color:var(--cream)] py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <article className="rounded-[28px] border border-[color:var(--line)] bg-[color:var(--champagne)] p-8 hard-shadow-lg sm:p-14">
            <p className="font-condensed text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--mauve)]">
              Dictionary entry · ed. 01
            </p>
            <h2 className="font-display mt-3 flex flex-wrap items-baseline gap-x-4 text-6xl font-light leading-[0.95] tracking-[-0.03em] text-[color:var(--ink)] sm:text-7xl">
              click
              <span className="font-display text-3xl italic text-[color:var(--mauve)] sm:text-4xl">
                /klɪk/
              </span>
              <span className="font-condensed text-base font-semibold uppercase tracking-[0.14em] text-[color:var(--mauve)]">
                noun · verb
              </span>
            </h2>
            <ol className="mt-10 space-y-7 border-l border-[color:var(--peach)] pl-7">
              <li>
                <p className="font-display text-2xl font-light leading-snug tracking-[-0.01em] text-[color:var(--ink)]">
                  1. <span className="italic">A burst of</span>{" "}
                  <span className="peach-highlight">YES</span> between two people
                  in the same room.
                </p>
                <p className="mt-2 text-[0.95rem] leading-7 text-[color:var(--mauve)]">
                  e.g.{" "}
                  <span className="font-display italic">
                    &ldquo;we clicked over the bread course.&rdquo;
                  </span>
                </p>
              </li>
              <li>
                <p className="font-display text-2xl font-light leading-snug tracking-[-0.01em] text-[color:var(--ink)]">
                  2. The reason a stranger becomes{" "}
                  <span className="italic">a friend</span>.
                </p>
                <p className="mt-2 text-[0.95rem] leading-7 text-[color:var(--mauve)]">
                  see also: <span className="font-mono text-sm">low pressure</span>,{" "}
                  <span className="font-mono text-sm">familiar by week 3</span>,{" "}
                  <span className="font-mono text-sm">slow dating</span>.
                </p>
              </li>
              <li>
                <p className="font-display text-2xl font-light leading-snug tracking-[-0.01em] text-[color:var(--ink)]">
                  3. <span className="italic">verb.</span> To privately tap a
                  person you&apos;d like to see again.
                </p>
                <p className="mt-2 text-[0.95rem] leading-7 text-[color:var(--mauve)]">
                  Mutual = an unlocked second event. No mutual = nobody knows.
                </p>
              </li>
            </ol>
            <p className="font-display mt-12 text-3xl italic text-[color:var(--rose)]">
              Clicks happen in person.
            </p>
          </article>
        </div>
      </section>

      {/* ============================ HOW IT WORKS ============================ */}
      <section className="bg-[color:var(--champagne)] py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="How Click works"
            title={
              <>
                Meet through something you{" "}
                <span className="italic text-[color:var(--rose)]">already</span>{" "}
                care about.
              </>
            }
            body="People join because the event is real: a walk, dinner, workout, class, coffee, or group ritual that makes conversation easier."
          />

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {roleCards.map((role, index) => (
              <article
                key={role.title}
                className="group relative rounded-[22px] border border-[color:var(--line)] bg-[color:var(--cream)] p-8 transition-all duration-300 hover:-translate-y-1.5 hard-shadow-sm hover:hard-shadow"
              >
                <span className="font-display text-5xl font-light leading-none tracking-[-0.03em] text-[color:var(--peach)] [text-shadow:0_1px_0_var(--line-strong)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="font-condensed mt-5 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                  {role.eyebrow}
                </p>
                <h3 className="font-display mt-2 text-[2rem] font-light leading-[1.04] tracking-[-0.02em] text-[color:var(--ink)]">
                  {role.title}
                </h3>
                <p className="mt-4 text-[0.95rem] leading-7 text-[color:var(--mauve)]">
                  {role.body}
                </p>
                <div className="mt-7 h-1 w-full rounded-full bg-[color:var(--champagne-deep)]">
                  <div
                    className="h-1 rounded-full bg-[color:var(--peach)]"
                    style={{ width: `${42 + index * 20}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ PERSONAS ============================ */}
      <section className="border-y border-[color:var(--line)] bg-[color:var(--champagne-deep)] py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div>
              <p className="eyebrow">Local rhythm</p>
              <h2 className="font-display mt-3 text-5xl font-light leading-[0.96] tracking-[-0.03em] text-[color:var(--ink)] sm:text-6xl">
                Small rituals beat{" "}
                <em className="text-[color:var(--rose)]">perfect</em> matches.
              </h2>
            </div>
            <p className="text-[0.95rem] leading-7 text-[color:var(--mauve)] lg:max-w-xl lg:justify-self-end">
              A familiar group, a friendly host, and a reason to show up again
              are what turn strangers into people you know.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {personaCards.map((persona, idx) => (
              <article
                key={persona.title}
                className="group relative rounded-[22px] border border-[color:var(--line)] bg-[color:var(--champagne)] p-7 transition-all duration-300 hover:-translate-y-1.5 hard-shadow-sm hover:hard-shadow"
              >
                <span className="font-display text-6xl font-light leading-none tracking-[-0.04em] text-[color:var(--peach)] [text-shadow:0_1px_0_var(--line-strong)]">
                  0{idx + 1}
                </span>
                <p className="font-condensed mt-5 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                  People style
                </p>
                <h3 className="font-display mt-2 text-[1.7rem] font-light leading-[1.05] tracking-[-0.02em] text-[color:var(--ink)]">
                  {persona.title}
                </h3>
                <p className="mt-3 text-[0.95rem] leading-7 text-[color:var(--mauve)]">
                  {persona.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ GROUPS — JOIN ONCE ============================ */}
      <section className="relative overflow-hidden bg-[color:var(--surface-deep)] py-24 text-[color:var(--on-deep)]">
        <div className="absolute inset-0 stamp-grid opacity-[0.06]" aria-hidden />

        <div className="relative mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="eyebrow text-[color:var(--peach)]">Groups for common people</p>
            <h2 className="font-display mt-4 text-5xl font-light leading-[0.96] tracking-[-0.03em] text-[color:var(--on-deep)] sm:text-6xl lg:text-7xl">
              Join <span className="italic text-[color:var(--peach)]">once.</span>{" "}
              Show up <span className="italic text-[color:var(--rose)]">twice.</span>{" "}
              Become <span className="italic text-[color:var(--peach)]">familiar.</span>
            </h2>
            <p className="mt-7 max-w-md text-[0.95rem] leading-7 text-[color:var(--on-deep)]/65 sm:text-base">
              Click favors recurring groups because relationships rarely start
              in a single perfect moment. They start when ordinary people keep
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
                className="group rounded-[22px] border border-[color:var(--on-deep)]/15 bg-[color:var(--surface-deep-2)] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--peach)]/60"
              >
                <p className="font-condensed text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[color:var(--peach)]">
                  {group.cadence}
                </p>
                <h3 className="font-display mt-3 text-[1.7rem] font-light leading-tight tracking-[-0.02em] text-[color:var(--on-deep)]">
                  {group.name}
                </h3>
                <p className="mt-2 text-sm font-semibold text-[color:var(--on-deep)]/80">
                  {group.members} members · {group.category}
                </p>
                <p className="mt-3 text-[0.95rem] leading-7 text-[color:var(--on-deep)]/60">
                  {group.focus}
                </p>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--peach)] transition-all group-hover:gap-3">
                  Join group <span aria-hidden>→</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ PHOTO + ARCHITECTURE ============================ */}
      <section className="bg-[color:var(--champagne)] py-24">
        <div className="mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          {/* framed photo */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] hard-shadow-lg">
              <Image
                src="/media/open-yoga.jpg"
                alt="People connecting at a local social event"
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-6 left-1/2 w-[88%] -translate-x-1/2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--cream)] px-6 py-4 text-center hard-shadow">
              <p className="font-display text-xl italic text-[color:var(--ink)]">
                You both love live jazz
              </p>
              <p className="font-condensed mt-1 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--mauve)]">
                Newtown · 2nd time
              </p>
            </div>
            <span className="absolute -right-3 top-6 inline-flex rotate-2 items-center gap-2 rounded-full bg-[color:var(--rose)] px-4 py-2 font-condensed text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white hard-shadow-sm">
              ✦ Mutual click
            </span>
          </div>

          <div>
            <SectionIntro
              eyebrow="Why it works"
              title={
                <>
                  A room feels{" "}
                  <span className="italic text-[color:var(--rose)]">easier</span>{" "}
                  when the reason to talk is already there.
                </>
              }
              body="Click should feel like a trusted local calendar with a human pulse: clear hosts, familiar groups, real photos, and enough context to make showing up less awkward."
            />
            <div className="mt-10 space-y-3">
              {architectureLayers.map(([layer, body], idx) => (
                <article
                  key={layer}
                  className="group flex gap-5 rounded-[18px] border border-[color:var(--line)] bg-[color:var(--cream)] p-5 transition-all duration-300 hover:-translate-y-1 hard-shadow-sm hover:hard-shadow"
                >
                  <span className="font-display grid size-12 shrink-0 place-items-center rounded-full bg-[color:var(--peach)] text-xl font-light text-[color:var(--surface-deep)]">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="font-display text-xl font-light leading-tight tracking-[-0.01em] text-[color:var(--ink)]">
                      {layer}
                    </h4>
                    <p className="mt-1 text-[0.95rem] leading-7 text-[color:var(--mauve)]">
                      {body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================ BIG CTA — signature lime band ============================ */}
      <section className="relative overflow-hidden bg-[color:var(--peach)] py-28 text-[color:var(--surface-deep)]">
        <div className="absolute inset-0 stamp-grid opacity-[0.08]" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
          <p className="font-condensed text-[0.78rem] font-semibold uppercase tracking-[0.24em] text-[color:var(--surface-deep)]/70">
            Ready when you are
          </p>
          <h2 className="font-display mt-6 text-5xl font-light leading-[0.94] tracking-[-0.03em] sm:text-7xl lg:text-[5.5rem]">
            Pick a plan. <span className="italic">Show up.</span>
            <br className="hidden sm:block" /> See what clicks.
          </h2>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <LinkButton href="/discover" variant="ink">
              Start exploring
            </LinkButton>
            <Link
              href="/onboarding"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[color:var(--surface-deep)]/30 px-6 text-[0.95rem] font-semibold text-[color:var(--surface-deep)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[color:var(--surface-deep)] hover:text-[color:var(--peach)]"
            >
              Take the Life Quiz
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
