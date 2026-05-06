import Image from "next/image";
import Link from "next/link";
import { AIMatchPanel } from "@/components/ai-match-panel";
import { LinkButton, SectionIntro } from "@/components/click-ui";
import { EventCard } from "@/components/event-card";
import {
  architectureLayers,
  clickEvents,
  groups,
  personaCards,
  roleCards,
} from "@/lib/click-data";

const marqueeWords = [
  "✶ MAKE FRIENDS",
  "✷ DATE SLOWER",
  "✦ MOVE TOGETHER",
  "✧ SHOW UP TWICE",
  "✶ EAT WITH STRANGERS",
  "✷ JOIN A RITUAL",
  "✦ FIND YOUR LOCALS",
];

const floatingChips = [
  { label: "Make friends", tone: "peach", rotate: "-rotate-3", left: "left-[6%]", top: "top-[12%]" },
  { label: "Slow dates", tone: "rose", rotate: "rotate-2", left: "left-[14%]", top: "top-[42%]" },
  { label: "Find your locals", tone: "ink", rotate: "rotate-3", left: "right-[6%]", top: "top-[26%]" },
  { label: "Walk + talk", tone: "cream", rotate: "-rotate-2", left: "right-[3%]", top: "top-[50%]" },
];

const chipPalette: Record<string, string> = {
  peach: "bg-[color:var(--peach)] text-[color:var(--ink)]",
  rose: "bg-[color:var(--rose)] text-[color:var(--champagne)]",
  ink: "bg-[color:var(--ink)] text-[color:var(--champagne)]",
  cream: "bg-[color:var(--cream)] text-[color:var(--ink)]",
};

export default function Home() {
  return (
    <main className="paper-noise min-h-screen max-w-full overflow-hidden text-[color:var(--ink)]">
      {/* ============================ MARQUEE STRIP ============================ */}
      <section
        aria-hidden
        className="border-b-2 border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--peach)]"
      >
        <div className="marquee py-3">
          {[0, 1, 2].map((dup) => (
            <div
              key={dup}
              className="marquee__track font-display text-2xl italic font-light tracking-tight whitespace-nowrap"
            >
              {marqueeWords.map((word) => (
                <span key={`${dup}-${word}`} className="inline-flex items-center gap-3">
                  {word}
                  <span className="text-[color:var(--rose)]">●</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden bg-[color:var(--champagne)] px-4 pb-16 pt-12 sm:px-6 lg:pt-20">
        {/* Decorative confetti dots */}
        <div className="confetti-field absolute inset-0 opacity-30" aria-hidden />

        {/* Floating sticker chips, only on lg+ */}
        <div className="pointer-events-none absolute inset-0 z-0 hidden lg:block" aria-hidden>
          {floatingChips.map((chip, idx) => (
            <span
              key={chip.label}
              style={{ animationDelay: `${200 + idx * 110}ms` }}
              className={`pop-in absolute ${chip.left} ${chip.top} ${chip.rotate} float-slow inline-flex items-center gap-1 rounded-full border-2 border-[color:var(--ink)] px-4 py-2 text-xs font-bold uppercase tracking-wider hard-shadow-sm ${chipPalette[chip.tone]}`}
            >
              ✷ {chip.label}
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
              Now in Sydney · low pressure, high yes
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
            Find local events, recurring groups, and low-pressure ways to meet
            people around Sydney. Show up twice. Become familiar.
          </p>

          {/* AI search panel */}
          <div className="rise rise-d4 mt-10">
            <AIMatchPanel showEvents={false} title="" />
          </div>

          <div className="rise rise-d5 mt-9 flex flex-wrap items-center justify-center gap-3">
            <LinkButton href="/discover">Start exploring</LinkButton>
            <LinkButton href="/events" variant="secondary">
              Browse events
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
                className="rounded-2xl border-2 border-[color:var(--ink)] bg-[color:var(--champagne)] px-3 py-4 hard-shadow-sm"
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
      <section className="border-y-2 border-[color:var(--ink)] bg-[color:var(--cream)]">
        <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto px-4 py-4 sm:px-6">
          <span className="font-mono shrink-0 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Browse →
          </span>
          {[
            { label: "Make friends", tone: "peach" },
            { label: "Dating", tone: "rose" },
            { label: "Sports + Fitness", tone: "cream" },
            { label: "Food + Drink", tone: "peach" },
            { label: "Creative people", tone: "ink" },
            { label: "Career support", tone: "cream" },
            { label: "This weekend", tone: "rose" },
            { label: "Free events", tone: "peach" },
          ].map((category, idx) => (
            <Link
              key={category.label}
              href="/discover"
              className={`shrink-0 rounded-full border-2 border-[color:var(--ink)] px-4 py-1.5 text-sm font-bold uppercase tracking-wide hard-shadow-sm hover:-translate-x-[1px] hover:-translate-y-[1px] ${
                idx % 3 === 0 ? "tilt-l-2" : idx % 3 === 1 ? "tilt-r-2" : ""
              } ${chipPalette[category.tone]}`}
            >
              {category.label}
            </Link>
          ))}
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
                  ? "bg-[color:var(--rose)] text-[color:var(--champagne)]"
                  : accentClass === "ink"
                    ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
                    : "bg-[color:var(--peach)] text-[color:var(--ink)]";

              return (
                <article
                  key={role.title}
                  className="group relative rounded-3xl border-2 border-[color:var(--ink)] bg-[color:var(--champagne)] p-7 hard-shadow-sm transition-transform duration-300 hover:-translate-y-2 hover:rotate-[-0.7deg] hover:[box-shadow:10px_10px_0_0_var(--ink)]"
                >
                  <div
                    className={`absolute -right-4 -top-5 grid size-16 place-items-center rounded-full border-2 border-[color:var(--ink)] ${numberBg} font-display text-3xl font-light italic hard-shadow-sm`}
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
      <section className="relative overflow-hidden border-y-2 border-[color:var(--ink)] bg-[color:var(--peach)] py-20 text-[color:var(--ink)]">
        <div className="absolute inset-0 stamp-grid opacity-30" aria-hidden />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Local rhythm"
            title={
              <>
                Small rituals beat
                <br className="hidden md:block" />
                <em>perfect</em> matches.
              </>
            }
            body="A familiar group, a friendly host, and a reason to show up again are what turn strangers into people you know."
          />

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {personaCards.map((persona, idx) => (
              <article
                key={persona.title}
                className="group relative rounded-2xl border-2 border-[color:var(--ink)] bg-[color:var(--champagne)] p-6 hard-shadow-sm transition-transform duration-300 hover:-translate-y-1.5 hover:rotate-[-1deg] hover:[box-shadow:8px_8px_0_0_var(--ink)]"
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

      {/* ============================ EVENTS ============================ */}
      <section className="relative bg-[color:var(--champagne)] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="eyebrow">Events near Sydney</p>
              <h2 className="font-display mt-3 text-5xl font-light leading-[0.95] tracking-tight sm:text-6xl">
                A few good reasons to{" "}
                <span className="italic text-[color:var(--rose)]">leave the house.</span>
              </h2>
              <p className="mt-4 text-base font-medium leading-7 text-[color:var(--mauve)] sm:text-lg">
                The best events feel specific, hosted, and easy to join. Date,
                host, who&apos;s going, and why the room works.
              </p>
            </div>
            <Link
              href="/events"
              className="group inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--ink)] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--champagne)] hard-shadow-sm hover:bg-[color:var(--rose)]"
            >
              All events
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {clickEvents.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        </div>
      </section>

      {/* ============================ GROUPS — JOIN ONCE ============================ */}
      <section className="relative overflow-hidden border-t-2 border-[color:var(--ink)] bg-[color:var(--ink)] py-20 text-[color:var(--champagne)]">
        <div className="absolute inset-0 confetti-field opacity-20" aria-hidden />
        <SunRays className="absolute -left-12 top-12 spin-slow text-[color:var(--peach)]/40" size={220} />
        <SunRays className="absolute -right-16 bottom-12 spin-slow text-[color:var(--rose)]/40" size={180} />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="eyebrow !text-[color:var(--peach)]">Groups for common people</p>
            <h2 className="font-display mt-4 text-5xl font-light leading-[0.95] tracking-tight text-[color:var(--champagne)] sm:text-6xl lg:text-7xl">
              Join <span className="italic text-[color:var(--peach)]">once.</span>{" "}
              Show up{" "}
              <span className="italic text-[color:var(--rose)]">twice.</span>{" "}
              Become <span className="font-script text-[1.1em] text-[color:var(--peach)]">familiar.</span>
            </h2>
            <p className="mt-6 text-base font-medium leading-7 text-[color:var(--champagne)]/72 sm:text-lg">
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
                className="group relative rounded-2xl border-2 border-[color:var(--peach)] bg-[color:var(--ink-deep)] p-6 transition-transform duration-300 hover:-translate-y-1 hover:rotate-[-0.5deg]"
                style={{ transform: idx % 2 === 0 ? "translateY(0)" : "translateY(18px)" }}
              >
                <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--peach)]">
                  {group.cadence}
                </p>
                <h3 className="font-display mt-3 text-3xl font-light leading-tight text-[color:var(--champagne)]">
                  {group.name}
                </h3>
                <p className="mt-2 text-sm font-bold text-[color:var(--peach)]">
                  {group.members} members · {group.category}
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--champagne)]/72">
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
            <div className="tilt-l-3 relative rounded-md border-2 border-[color:var(--ink)] bg-[color:var(--champagne)] p-3 hard-shadow-lg">
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
                  className="group flex gap-5 rounded-2xl border-2 border-[color:var(--ink)] bg-[color:var(--champagne)] p-5 hard-shadow-sm transition-transform duration-300 hover:-translate-x-1 hover:-translate-y-1"
                >
                  <span className="font-display grid size-14 shrink-0 place-items-center rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--peach)] text-2xl font-light italic">
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

      {/* ============================ BIG CTA ============================ */}
      <section className="relative overflow-hidden border-t-2 border-[color:var(--ink)] bg-[color:var(--rose)] py-20 text-[color:var(--champagne)]">
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
