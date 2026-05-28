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

const floatingChips = [
  { label: "Make friends", tone: "peach", rotate: "-rotate-3", left: "left-[6%]", top: "top-[12%]" },
  { label: "Slow dates", tone: "rose", rotate: "rotate-2", left: "left-[14%]", top: "top-[42%]" },
  { label: "Find your locals", tone: "ink", rotate: "rotate-3", left: "right-[6%]", top: "top-[26%]" },
  { label: "Walk + talk", tone: "cream", rotate: "-rotate-2", left: "right-[3%]", top: "top-[50%]" },
];

const chipPalette: Record<string, string> = {
  peach: "bg-[color:var(--peach)] text-[color:var(--surface-deep)]",
  rose: "bg-[color:var(--rose)] text-[color:var(--surface-deep)]",
  ink: "bg-[color:var(--ink)] text-[color:var(--champagne)]",
  cream: "bg-[color:var(--cream)] text-[color:var(--ink)]",
};

export default async function Home() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user);
  const [events, persona] = await Promise.all([
    getEventsForExplore(),
    isLoggedIn ? getLatestPersonaForSession(session) : Promise.resolve(null),
  ]);
  const upcomingEvents = events.slice(0, 6);

  return (
    <main className="paper-noise min-h-screen max-w-full overflow-hidden text-[color:var(--ink)]">
      {/* ============================ HOME QUIZ ============================ */}
      <HomeQuiz isLoggedIn={isLoggedIn} persona={persona} />

      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden bg-[color:var(--champagne)] px-4 pb-16 pt-12 sm:px-6 lg:pt-20">
        {/* Decorative confetti dots */}
        <div className="confetti-field absolute inset-0 opacity-30" aria-hidden />

        {/* Floating sticker chips, only on lg+ */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 hidden h-[36rem] lg:block" aria-hidden>
          {floatingChips.map((chip, idx) => (
            <span
              key={chip.label}
              style={{
                animationDelay: `${200 + idx * 110}ms, ${idx * 600}ms`,
                animationDuration: `600ms, ${4200 + idx * 350}ms`,
              }}
              className={`chip-bob absolute ${chip.left} ${chip.top} inline-block`}
            >
              <span
                className={`${chip.rotate} inline-flex items-center gap-1 rounded-full border-2 border-[color:var(--line)] px-4 py-2 text-xs font-bold uppercase tracking-wider hard-shadow-sm ${chipPalette[chip.tone]}`}
              >
                ✷ {chip.label}
              </span>
            </span>
          ))}
        </div>

        {/* Decorative SVG bursts */}
        <SparkleBurst className="absolute left-[3%] top-[55%] hidden text-[color:var(--rose)] md:block" />
        <SparkleBurst className="absolute right-[4%] top-[68%] hidden text-[color:var(--ink)] md:block" size={48} />
        <SunRays className="absolute right-[2%] top-[2%] hidden text-[color:var(--punch)] lg:block spin-slow" size={92} />

        <div className="relative z-10 mx-auto max-w-6xl">
          {/* Sticker badge above the headline */}
          <div className="rise rise-d1 flex justify-center">
            <span className="sticker sticker--peach tilt-l-2">
              <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
              Now in <LocationLabel /> · low pressure, high yes
            </span>
          </div>

          <h1 className="rise rise-d2 font-display mt-7 text-center text-[3.4rem] font-light leading-[0.92] tracking-[-0.02em] text-[color:var(--ink)] sm:text-7xl lg:text-[7.5rem]">
            <span className="italic">Click</span> is where{" "}
            <span className="relative inline-block">
              <span className="peach-highlight">interests</span>
            </span>{" "}
            <br className="hidden sm:block" />
            become{" "}
            <span className="relative inline-block">
              <span className="font-script text-[1.15em] not-italic text-[color:var(--rose)]">
                friendships.
              </span>
              <SquiggleUnderline className="absolute -bottom-3 left-0 w-full text-[color:var(--rose)]" />
            </span>
          </h1>

          <p className="rise rise-d3 mx-auto mt-7 max-w-2xl text-center text-lg font-medium leading-8 text-[color:var(--mauve)] sm:text-xl">
            Show up twice. Become familiar.
          </p>

          {/* Upcoming events near you */}
          <div className="rise rise-d4 mt-12 text-left">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">Happening near <LocationLabel /></p>
                <h2 className="font-display mt-2 text-3xl font-light leading-tight text-[color:var(--ink)] sm:text-4xl">
                  Browse what&apos;s on near you.
                </h2>
              </div>
              <Link
                href="/events"
                className="font-mono shrink-0 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--ink)] hard-shadow-sm hover:-translate-x-[1px] hover:-translate-y-[1px] hover:bg-[color:var(--peach)] hover:text-[color:var(--surface-deep)]"
              >
                See all events →
              </Link>
            </div>
            {upcomingEvents.length > 0 ? (
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {upcomingEvents.map((event) => (
                  <EventCard key={event.id} event={event} compact />
                ))}
              </div>
            ) : (
              <p className="mt-6 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6 text-sm font-bold text-[color:var(--mauve)]">
                No upcoming events just yet — check back soon, or{" "}
                <Link href="/events" className="underline">browse the full calendar</Link>.
              </p>
            )}
          </div>

          <div className="rise rise-d5 mt-9 flex flex-wrap items-center justify-center gap-3">
            <LinkButton href="/discover">Start exploring</LinkButton>
            <LinkButton href="/events" variant="secondary">
              Browse events
            </LinkButton>
            <LinkButton href="/merchant/signup" variant="ink">
              Host an event
            </LinkButton>
            <span className="font-script ml-2 hidden text-2xl text-[color:var(--mauve)] sm:inline-flex sm:items-center sm:gap-2">
              <ArrowSquiggle className="text-[color:var(--rose)]" /> takes 30 seconds
            </span>
          </div>

          {/* trust micro row */}
          <div className="rise rise-d6 mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-4 text-center">
            {[
              ["27", "weekly hosts"],
              ["8.4k", "showing up"],
              ["94%", "would return"],
            ].map(([num, label]) => (
              <div
                key={label as string}
                className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-4 hard-shadow-sm"
              >
                <p className="font-display text-3xl font-light italic leading-none text-[color:var(--rose)] sm:text-4xl">
                  {num}
                </p>
                <p className="font-mono mt-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ STICKY CATEGORY BAR ============================ */}
      <section className="border-y-2 border-[color:var(--line)] bg-[color:var(--cream)]">
        <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto px-4 py-4 sm:px-6">
          <span className="font-mono shrink-0 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Browse →
          </span>
          {[
            { label: "Make friends", tone: "peach", href: "/events?category=Social" },
            { label: "Dating", tone: "rose", href: "/events?category=Relationships" },
            { label: "Sports + Fitness", tone: "cream", href: "/events?category=Fitness" },
            { label: "Food + Drink", tone: "peach", href: "/events?category=Food" },
            { label: "Creative people", tone: "ink", href: "/events?category=Creative" },
            { label: "Career support", tone: "cream", href: "/events?category=Career" },
            { label: "This weekend", tone: "rose", href: "/events?tag=weekend" },
            { label: "Free events", tone: "peach", href: "/events?search=free" },
          ].map((category, idx) => (
            <Link
              key={category.label}
              href={category.href}
              className={`shrink-0 rounded-full border-2 border-[color:var(--line)] px-4 py-1.5 text-sm font-bold uppercase tracking-wide hard-shadow-sm hover:-translate-x-[1px] hover:-translate-y-[1px] ${
                idx % 3 === 0 ? "tilt-l-2" : idx % 3 === 1 ? "tilt-r-2" : ""
              } ${chipPalette[category.tone]}`}
            >
              {category.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ============================ EXPERIENCE-TYPE BROWSER ============================ */}
      <section className="border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Pick a vibe"
            title={
              <>
                Browse by{" "}
                <span className="rose-highlight italic">experience type</span>,
                not category.
              </>
            }
            body="What kind of room are you in the mood for? Click events are organised by feel, not by topic."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                tone: "peach",
                eyebrow: "Slow tables",
                title: "Slow dating + small dinners",
                body: "10 people, one long table, a host who actually hosts. No swiping required.",
                href: "/events?category=Relationships",
              },
              {
                tone: "rose",
                eyebrow: "Move + meet",
                title: "Walk, run, climb, swim",
                body: "Active rooms where the conversation is a side effect of the activity.",
                href: "/events?category=Fitness",
              },
              {
                tone: "cream",
                eyebrow: "Hands on",
                title: "Classes + workshops",
                body: "Pottery, cooking, life-drawing — common output, common excuse to chat.",
                href: "/events?category=Creative",
              },
              {
                tone: "ink",
                eyebrow: "Group rituals",
                title: "Recurring meetups",
                body: "Weekly run clubs, monthly book nights, regular brunch crews. Familiar by week 3.",
                href: "/discover",
              },
              {
                tone: "peach",
                eyebrow: "Career rooms",
                title: "Networking + peer support",
                body: "Career pivots, founders, freelancers. Quiet enough to actually talk.",
                href: "/events?category=Career",
              },
              {
                tone: "rose",
                eyebrow: "Quiet + curious",
                title: "Talks + screenings",
                body: "Low-pressure rooms where you don’t need to be on. Listen first, mingle second.",
                href: "/events?category=Community",
              },
            ].map((tile, idx) => (
              <Link
                key={tile.title}
                href={tile.href}
                className={`group flex flex-col rounded-3xl border-2 border-[color:var(--line)] p-6 hard-shadow-sm transition-transform duration-300 hover:-translate-y-1.5 hover:[box-shadow:10px_10px_0_0_var(--shadow-ink)] ${chipPalette[tile.tone]}`}
                style={{ transform: idx % 2 === 0 ? "rotate(-0.4deg)" : "rotate(0.3deg)" }}
              >
                <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] opacity-80">
                  ✷ {tile.eyebrow}
                </span>
                <h3 className="font-display mt-3 text-3xl font-light leading-tight">
                  {tile.title}
                </h3>
                <p className="mt-3 text-sm font-medium leading-6 opacity-90">
                  {tile.body}
                </p>
                <span className="font-script mt-6 inline-flex items-center gap-2 text-2xl">
                  see this room
                  <span className="transition-transform group-hover:translate-x-1" aria-hidden>→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ DICTIONARY HERO ============================ */}
      <section className="relative overflow-hidden border-y-2 border-[color:var(--line)] bg-[color:var(--cream)] py-20">
        <div className="confetti-field absolute inset-0 opacity-20" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
          <article className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-8 hard-shadow-lg sm:p-12">
            <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.22em] text-[color:var(--rose)]">
              ✷ Dictionary entry · ed. 01
            </p>
            <h2 className="font-display mt-3 text-6xl font-light leading-[0.95] tracking-tight text-[color:var(--ink)] sm:text-7xl">
              click
              <span className="ml-3 font-script text-3xl text-[color:var(--mauve)] sm:text-4xl">
                /klɪk/
              </span>
              <span className="ml-3 font-mono text-base font-medium uppercase tracking-wide text-[color:var(--mauve)]">
                noun · verb
              </span>
            </h2>
            <ol className="mt-8 space-y-5 border-l-4 border-dashed border-[color:var(--rose)] pl-6">
              <li>
                <p className="font-display text-2xl font-light leading-snug text-[color:var(--ink)]">
                  1. <span className="italic">A burst of</span>{" "}
                  <span className="peach-highlight">YES</span> between two people
                  in the same room.
                </p>
                <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                  e.g. <span className="font-script">“we clicked over the bread course.”</span>
                </p>
              </li>
              <li>
                <p className="font-display text-2xl font-light leading-snug text-[color:var(--ink)]">
                  2. The reason a stranger becomes{" "}
                  <span className="italic">a friend</span>.
                </p>
                <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                  see also: <span className="font-mono">low pressure</span>,{" "}
                  <span className="font-mono">familiar by week 3</span>,{" "}
                  <span className="font-mono">slow dating</span>.
                </p>
              </li>
              <li>
                <p className="font-display text-2xl font-light leading-snug text-[color:var(--ink)]">
                  3. <span className="italic">verb.</span> To privately tap a
                  person you’d like to see again.
                </p>
                <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                  Mutual = an unlocked second event. No mutual = nobody knows.
                </p>
              </li>
            </ol>
            <p className="font-script mt-10 text-3xl text-[color:var(--rose)]">
              clicks happen in person ✷
            </p>
          </article>
        </div>
      </section>

      {/* ============================ HOW IT WORKS ============================ */}
      <section className="relative overflow-hidden bg-[color:var(--champagne)] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="How Click works"
            title={
              <>
                Meet through something
                <br className="hidden md:block" />
                you <span className="rose-highlight italic">already</span> care about.
              </>
            }
            body="People join because the event is real: a walk, dinner, workout, class, coffee, or group ritual that makes conversation easier."
          />

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {roleCards.map((role, index) => {
              const accents = ["peach", "rose", "ink"] as const;
              const accentClass = accents[index];
              const numberBg =
                accentClass === "rose"
                  ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                  : accentClass === "ink"
                    ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
                    : "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";

              return (
                <article
                  key={role.title}
                  className="group relative rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-7 hard-shadow-sm transition-transform duration-300 hover:-translate-y-2 hover:rotate-[-0.7deg] hover:[box-shadow:10px_10px_0_0_var(--shadow-ink)]"
                >
                  <div
                    className={`absolute -right-4 -top-5 grid size-16 place-items-center rounded-full border-2 border-[color:var(--line)] ${numberBg} font-display text-3xl font-light italic hard-shadow-sm`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                    ✷ {role.eyebrow}
                  </p>
                  <h3 className="font-display mt-3 text-4xl font-light leading-[1.04] text-[color:var(--ink)]">
                    {role.title}
                  </h3>
                  <p className="mt-4 text-base font-medium leading-7 text-[color:var(--mauve)]">
                    {role.body}
                  </p>
                  <div className="mt-6 h-1 w-full rounded-full bg-[color:var(--peach-soft)]">
                    <div
                      className={`h-1 rounded-full ${
                        accentClass === "rose"
                          ? "bg-[color:var(--rose)]"
                          : accentClass === "ink"
                            ? "bg-[color:var(--ink)]"
                            : "bg-[color:var(--peach)]"
                      }`}
                      style={{ width: `${33 + index * 22}%` }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================ PERSONAS ============================ */}
      <section className="relative overflow-hidden border-y-2 border-[color:var(--surface-deep)] bg-[color:var(--peach)] py-20 text-[color:var(--surface-deep)]">
        <div className="absolute inset-0 stamp-grid opacity-30" aria-hidden />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          {/* Inline intro — peach band stays peach in both modes, so use
              constant dark text instead of the flipping --ink token. */}
          <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div>
              <p className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.22em] text-[color:var(--surface-deep)]/70">
                Local rhythm
              </p>
              <h2 className="font-display mt-3 text-5xl font-light leading-[0.95] tracking-tight text-[color:var(--surface-deep)] sm:text-6xl">
                Small rituals beat
                <br className="hidden md:block" />
                <em>perfect</em> matches.
              </h2>
            </div>
            <p className="text-base font-medium leading-7 text-[color:var(--surface-deep)]/75 lg:max-w-xl lg:justify-self-end">
              A familiar group, a friendly host, and a reason to show up again
              are what turn strangers into people you know.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {personaCards.map((persona, idx) => (
              <article
                key={persona.title}
                className="group relative rounded-2xl border-2 border-[color:var(--surface-deep)] bg-[color:var(--champagne)] p-6 [box-shadow:3px_3px_0_0_var(--surface-deep)] transition-transform duration-300 hover:-translate-y-1.5 hover:rotate-[-1deg] hover:[box-shadow:8px_8px_0_0_var(--surface-deep)]"
                style={{ transform: idx % 2 === 0 ? "rotate(-0.6deg)" : "rotate(0.5deg)" }}
              >
                <span className="font-display absolute -top-5 left-5 text-7xl font-light italic leading-none text-[color:var(--rose)]">
                  0{idx + 1}
                </span>
                <p className="font-mono mt-6 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                  People style
                </p>
                <h3 className="font-display mt-3 text-3xl font-light leading-[1.05] text-[color:var(--ink)]">
                  {persona.title}
                </h3>
                <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                  {persona.body}
                </p>
                <span className="font-script mt-5 inline-block text-2xl text-[color:var(--rose)]">
                  this could be you ✷
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ GROUPS — JOIN ONCE ============================ */}
      <section className="relative overflow-hidden border-t-2 border-[color:var(--surface-deep)] bg-[color:var(--surface-deep)] py-20 text-[color:var(--on-deep)]">
        <div className="absolute inset-0 confetti-field opacity-20" aria-hidden />
        <SunRays className="absolute -left-12 top-12 spin-slow text-[color:var(--peach)]/40" size={220} />
        <SunRays className="absolute -right-16 bottom-12 spin-slow text-[color:var(--rose)]/40" size={180} />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="eyebrow !text-[color:var(--peach)]">Groups for common people</p>
            <h2 className="font-display mt-4 text-5xl font-light leading-[0.95] tracking-tight text-[color:var(--on-deep)] sm:text-6xl lg:text-7xl">
              Join <span className="italic text-[color:var(--peach)]">once.</span>{" "}
              Show up{" "}
              <span className="italic text-[color:var(--rose)]">twice.</span>{" "}
              Become <span className="font-script text-[1.1em] text-[color:var(--peach)]">familiar.</span>
            </h2>
            <p className="mt-6 text-base font-medium leading-7 text-[color:var(--on-deep)]/72 sm:text-lg">
              Click favors recurring groups because relationships rarely start in
              a single perfect moment. They start when ordinary people keep
              crossing paths.
            </p>
            <div className="mt-8">
              <LinkButton href="/discover" variant="light">
                Find a group
              </LinkButton>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((group, idx) => (
              <article
                key={group.name}
                className="group relative rounded-2xl border-2 border-[color:var(--peach)] bg-[color:var(--surface-deep-2)] p-6 transition-transform duration-300 hover:-translate-y-1 hover:rotate-[-0.5deg]"
                style={{ transform: idx % 2 === 0 ? "translateY(0)" : "translateY(18px)" }}
              >
                <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--peach)]">
                  {group.cadence}
                </p>
                <h3 className="font-display mt-3 text-3xl font-light leading-tight text-[color:var(--on-deep)]">
                  {group.name}
                </h3>
                <p className="mt-2 text-sm font-bold text-[color:var(--peach)]">
                  {group.members} members · {group.category}
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--on-deep)]/72">
                  {group.focus}
                </p>
                <div className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[color:var(--peach)] transition group-hover:gap-3">
                  Join group <span>→</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ POLAROID + ARCHITECTURE ============================ */}
      <section className="relative bg-[color:var(--champagne)] py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          {/* polaroid */}
          <div className="relative">
            <div className="tilt-l-3 relative rounded-md border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-3 hard-shadow-lg">
              <div className="relative h-[420px] overflow-hidden rounded-sm">
                <Image
                  src="/media/networking.jpg"
                  alt="People connecting at a local social event"
                  fill
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="px-2 pb-2 pt-4 text-center">
                <p className="font-script text-3xl text-[color:var(--ink)]">
                  Click outcome ✷
                </p>
                <p className="mt-1 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  You both love live jazz · Newtown · 2nd time
                </p>
              </div>
            </div>

            {/* tape */}
            <span className="diagonal-stripes absolute -top-4 left-12 h-7 w-24 rotate-[-8deg] opacity-90" aria-hidden />
            <span className="diagonal-stripes absolute -bottom-3 right-10 h-7 w-24 rotate-[6deg] opacity-90" aria-hidden />

            {/* sticker on top */}
            <span className="sticker sticker--rose absolute -right-3 top-6 tilt-r-5 wiggle">
              ✷ MUTUAL CLICK
            </span>
          </div>

          <div>
            <SectionIntro
              eyebrow="Why it works"
              title={
                <>
                  A room feels{" "}
                  <span className="rose-highlight italic">easier</span> when the
                  reason to talk is already there.
                </>
              }
              body="Click should feel like a trusted local calendar with a human pulse: clear hosts, familiar groups, real photos, and enough context to make showing up less awkward."
            />
            <div className="mt-10 space-y-4">
              {architectureLayers.map(([layer, body], idx) => (
                <article
                  key={layer}
                  className="group flex gap-5 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm transition-transform duration-300 hover:-translate-x-1 hover:-translate-y-1"
                >
                  <span className="font-display grid size-14 shrink-0 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] text-2xl font-light italic text-[color:var(--surface-deep)]">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="font-display text-2xl font-light leading-tight text-[color:var(--ink)]">
                      {layer}
                    </h4>
                    <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                      {body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================ PARTNER / HOST CTA ============================ */}
      <section className="relative overflow-hidden border-t-2 border-[color:var(--line)] bg-[color:var(--peach)] py-20 text-[color:var(--surface-deep)]">
        <div className="absolute inset-0 stamp-grid opacity-30" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.22em] text-[color:var(--surface-deep)]/70">
              For hosts + venues
            </p>
            <h2 className="font-display mt-4 text-5xl font-light leading-[0.95] tracking-tight text-[color:var(--surface-deep)] sm:text-6xl">
              You run the room.{" "}
              <span className="italic">We bring the right people.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-[color:var(--surface-deep)]/80 sm:text-lg">
              List your event in minutes. Click matches it with users who already
              care — by interest tag, suburb, life stage, and intent. Free events
              are free to list. Paid events get Click-managed booking + secure
              payouts via Stripe.
            </p>
            <ul className="mt-6 grid gap-2 text-sm font-bold text-[color:var(--surface-deep)] sm:grid-cols-2">
              {[
                "Vetted attendee profiles",
                "Capacity + waitlist on autopilot",
                "Free events stay free",
                "ABN verification once, list forever",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 border-[color:var(--surface-deep)] bg-[color:var(--champagne)] text-[10px] font-bold">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/merchant/signup"
                className="rounded-full border-2 border-[color:var(--surface-deep)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] [box-shadow:4px_4px_0_0_var(--surface-deep)] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:[box-shadow:6px_6px_0_0_var(--surface-deep)]"
              >
                Become a host
              </Link>
              <Link
                href="/merchant"
                className="rounded-full border-2 border-[color:var(--surface-deep)] bg-[color:var(--champagne)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hover:bg-[color:var(--cream)]"
              >
                Tour the host portal
              </Link>
            </div>
          </div>
          <aside className="relative">
            <div className="rounded-3xl border-2 border-[color:var(--surface-deep)] bg-[color:var(--champagne)] p-6 [box-shadow:6px_6px_0_0_var(--surface-deep)] sm:p-8">
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                Quick numbers
              </p>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  ["7 days", "Avg. time to first booking"],
                  ["94%", "Show-up rate"],
                  ["Free", "Listing fee for free events"],
                  ["2.9% + 30¢", "Click managed fee per paid ticket"],
                ].map(([num, label]) => (
                  <div
                    key={label}
                    className="rounded-2xl border-2 border-[color:var(--surface-deep)] bg-[color:var(--cream)] p-4"
                  >
                    <dt className="font-display text-3xl font-light italic leading-none text-[color:var(--rose)]">
                      {num}
                    </dt>
                    <dd className="font-mono mt-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                      {label}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="font-script mt-6 text-2xl text-[color:var(--rose)]">
                hosts who care, win ✷
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* ============================ BIG CTA ============================ */}
      <section className="relative overflow-hidden border-t-2 border-[color:var(--line)] bg-[color:var(--rose)] py-20 text-[color:var(--surface-deep)]">
        <div className="confetti-field absolute inset-0 opacity-25" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
          <p className="font-mono text-[0.75rem] font-bold uppercase tracking-[0.22em] text-[color:var(--peach)]">
            ✷ ✷ ✷ ready when you are ✷ ✷ ✷
          </p>
          <h2 className="font-display mt-5 text-5xl font-light leading-[0.92] tracking-tight sm:text-7xl lg:text-8xl">
            Pick a plan.{" "}
            <span className="italic">Show up.</span>{" "}
            <span className="font-script text-[1.05em] text-[color:var(--ink)]">
              See what clicks.
            </span>
          </h2>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <LinkButton href="/discover" variant="ink">
              Start exploring
            </LinkButton>
            <LinkButton href="/onboarding" variant="light">
              Take the Life Quiz
            </LinkButton>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ============================ DECOR SVGs ============================ */

function SparkleBurst({
  className = "",
  size = 64,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
    >
      <path
        d="M32 4 L36 28 L60 32 L36 36 L32 60 L28 36 L4 32 L28 28 Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SunRays({
  className = "",
  size = 120,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden
    >
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i * 360) / 16;
          const rad = (angle * Math.PI) / 180;
          const x1 = 60 + Math.cos(rad) * 28;
          const y1 = 60 + Math.sin(rad) * 28;
          const x2 = 60 + Math.cos(rad) * 56;
          const y2 = 60 + Math.sin(rad) * 56;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>
      <circle cx="60" cy="60" r="20" fill="currentColor" />
    </svg>
  );
}

function SquiggleUnderline({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="100%"
      height="14"
      viewBox="0 0 200 14"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M2 8 Q 25 -2 50 8 T 100 8 T 150 8 T 198 8"
        stroke="currentColor"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowSquiggle({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="48"
      height="22"
      viewBox="0 0 48 22"
      fill="none"
      aria-hidden
    >
      <path
        d="M2 11 Q 12 2 22 11 T 42 11"
        stroke="currentColor"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M36 5 L 44 11 L 36 17"
        stroke="currentColor"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
