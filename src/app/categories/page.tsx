import Link from "next/link";
import { MetricCard, SectionIntro } from "@/components/click-ui";
import { getEventCategories } from "@/lib/event-repository";

export const metadata = {
  title: "Categories | Click",
  description:
    "Browse Click events by category — friendship, fitness, dating, food, creative, career, and community — and the tags that power matching.",
};

// Event and tag counts are read live from Postgres, so never statically cache.
export const dynamic = "force-dynamic";

// Each category gets a hand-drawn sticker badge and a rotating accent bar so the
// grid reads like a wall of stickers rather than a uniform table.
const categoryEmoji: Record<string, string> = {
  social: "🤝",
  fitness: "🏃",
  relationships: "💘",
  food: "🍜",
  creative: "🎨",
  career: "💼",
  community: "🌱",
  family: "👨‍👩‍👧",
  games: "🎲",
  learning: "📚",
  nightlife: "🌃",
  outdoors: "🏞️",
  sports: "⚽",
  travel: "✈️",
  wellness: "🧘",
  music: "🎧",
  life: "✨",
};

const accentBars = [
  "bg-[color:var(--peach)]",
  "bg-[color:var(--rose)]",
  "bg-[color:var(--punch)]",
  "bg-[color:var(--ink)]",
];

const tilts = ["tilt-l-2", "tilt-r-2", "tilt-l-3", "tilt-r-3"];

export default async function CategoriesPage() {
  const categories = await getEventCategories();
  const totalEvents = categories.reduce((sum, category) => sum + category.eventCount, 0);
  const totalTags = categories.reduce((sum, category) => sum + category.tagCount, 0);

  return (
    <main className="paper-noise min-h-screen overflow-hidden text-[color:var(--ink)]">
      <section className="relative overflow-hidden bg-[color:var(--champagne)] px-4 pb-12 pt-16 sm:px-6 lg:pt-20">
        <div className="confetti-field absolute inset-0 opacity-20" aria-hidden />
        <div className="relative z-10 mx-auto max-w-6xl">
          <span className="sticker sticker--peach tilt-l-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
            Find your kind of plan
          </span>
          <h1 className="font-display mt-6 max-w-4xl text-5xl font-light leading-[0.94] tracking-tight sm:text-7xl">
            Every <span className="italic"><span className="peach-highlight">category</span></span>{" "}
            of getting out.
          </h1>
          <p className="mt-6 max-w-3xl text-base font-medium leading-7 text-[color:var(--mauve)] sm:text-lg">
            Click sorts Sydney&apos;s social calendar into a handful of honest
            categories — and tags the vibe underneath each one. Pick a lane to
            see what&apos;s on, or follow the tags that quietly power who you meet.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <MetricCard label="Categories" value={String(categories.length)} tone="rose" />
            <MetricCard label="Tags" value={String(totalTags)} tone="peach" />
            <MetricCard label="Live events" value={String(totalEvents)} tone="ink" />
          </div>
        </div>
      </section>

      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionIntro
            eyebrow={`${categories.length} categories`}
            title="Pick a lane."
            body="Each category collects related events and the interest, vibe, and music tags hosts attach to them. Tap a card to browse everything live in that lane."
          />

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category, index) => {
              const emoji = categoryEmoji[category.slug] ?? "✷";
              const accent = accentBars[index % accentBars.length];
              const badgeTilt = tilts[index % tilts.length];
              const shownTags = category.tags.slice(0, 6);
              const extraTags = category.tags.length - shownTags.length;

              return (
                <Link
                  key={category.slug}
                  href={`/discover?category=${encodeURIComponent(category.name)}`}
                  className="group flex flex-col rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 transition-transform duration-300 hard-shadow-sm hover:-translate-y-1 hover:rotate-[-0.6deg] hover:hard-shadow"
                >
                  <span className={`block h-2 w-14 rounded-full ${accent}`} />

                  <div className="mt-5 flex items-start justify-between gap-3">
                    <span
                      className={`flex size-12 items-center justify-center rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] text-2xl ${badgeTilt}`}
                      aria-hidden
                    >
                      {emoji}
                    </span>
                    <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-3 py-1 text-[0.7rem] font-black uppercase tracking-wider text-[color:var(--surface-deep)]">
                      {category.eventCount} {category.eventCount === 1 ? "event" : "events"}
                    </span>
                  </div>

                  <h3 className="font-display mt-4 text-3xl font-light leading-[1.04] text-[color:var(--ink)]">
                    {category.name}
                  </h3>
                  {category.description ? (
                    <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                      {category.description}
                    </p>
                  ) : null}

                  {shownTags.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {shownTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-[color:var(--line)] bg-[color:var(--cream)] px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-[color:var(--ink)]"
                        >
                          {tag}
                        </span>
                      ))}
                      {extraTags > 0 ? (
                        <span className="rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-[color:var(--mauve)]">
                          +{extraTags} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-auto flex items-center justify-between border-t-2 border-dashed border-[color:var(--line)] pt-4">
                    <span className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                      {category.tagCount} {category.tagCount === 1 ? "tag" : "tags"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-[color:var(--ink)]">
                      Browse
                      <span
                        aria-hidden
                        className="inline-block transition-transform duration-300 group-hover:translate-x-1"
                      >
                        →
                      </span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          <p className="mt-10 text-sm font-medium text-[color:var(--mauve)]">
            Looking for something specific?{" "}
            <Link
              href="/discover"
              className="font-bold text-[color:var(--ink)] underline decoration-[color:var(--rose)] decoration-2 underline-offset-4 hover:decoration-[color:var(--ink)]"
            >
              Search every event in Discover →
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
