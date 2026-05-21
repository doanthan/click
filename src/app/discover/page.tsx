import Link from "next/link";
import { AIMatchPanel } from "@/components/ai-match-panel";
import { Pill, SectionIntro } from "@/components/click-ui";
import { categories } from "@/lib/click-data";

export const metadata = {
  title: "Discover | Click",
  description: "Local people and event discovery for Click.",
};

const locationFilters = [
  "Around me",
  "Sydney",
  "Inner West",
  "Eastern Suburbs",
  "Northern Beaches",
  "Parramatta",
  "Online",
];

const dateFilters = ["Today", "This weekend", "Next 7 days", "Next 30 days"];

const proofStats = [
  ["18", "Sydney suburbs"],
  ["64", "weekly events"],
  ["4 hr", "card refresh"],
];

const cardRules = [
  {
    title: "Events first",
    body: "Every recommendation starts with a place, time, host, and reason to show up.",
  },
  {
    title: "People second",
    body: "People suggestions sit under event cards because Click is built around shared plans, not swiping.",
  },
  {
    title: "Private by design",
    body: "A private Click can become a mutual event suggestion without opening a direct chat thread.",
  },
];

export default function DiscoverPage() {
  return (
    <main className="paper-noise fit-viewport min-h-screen overflow-hidden bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <section className="border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-end lg:py-14">
          <div className="min-w-0">
            <span className="sticker sticker--peach">Sydney social calendar</span>
            <h1 className="font-display mt-6 max-w-[23rem] text-[2.75rem] font-light leading-[0.96] tracking-tight sm:max-w-4xl sm:text-6xl lg:text-7xl">
              Find your people through things worth leaving the house for.
            </h1>
            <p className="mt-5 max-w-[22rem] text-base font-bold leading-7 text-[color:var(--mauve)] sm:max-w-2xl sm:text-lg">
              Tell Click what you want more of: friends in Marrickville, a
              CrossFit crew, weekend walks, singles dinners, pottery nights, or
              a low-pressure way to meet locals nearby.
            </p>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {proofStats.map(([value, label]) => (
              <div
                key={label}
                className="rounded-lg border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4 hard-shadow-sm"
              >
                <p className="font-display text-4xl font-light italic leading-none text-[color:var(--rose)]">
                  {value}
                </p>
                <p className="font-mono mt-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:py-12">
        <div className="mx-auto max-w-7xl min-w-0">
          <AIMatchPanel
            defaultPrompt="I want to make new friends around Sydney"
            eventLimit={6}
            title="Click conversation"
            eventsEyebrow="Recommended event cards"
            eventsTitle={
              <>
                Start with the plan. Let the people follow.
              </>
            }
            peopleEyebrow="People and group suggestions"
            peopleTitle={
              <>
                Example names with a shared reason to show up.
              </>
            }
          />
        </div>
      </section>

      <section className="border-y-2 border-[color:var(--line)] bg-[color:var(--cream)]">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[auto_1fr] lg:items-center">
          <div>
            <p className="eyebrow">Browse like a calendar</p>
            <p className="mt-1 text-sm font-bold text-[color:var(--mauve)]">
              Fast filters for suburb, date, and activity.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {locationFilters.map((filter, index) => (
              <Link
                key={filter}
                href={`/events?location=${encodeURIComponent(filter)}`}
                className={`rounded-full border-2 border-[color:var(--line)] px-4 py-2 text-xs font-black uppercase tracking-wider hard-shadow-sm ${
                  index === 0
                    ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                    : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                }`}
              >
                {filter}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="Event marketplace"
            title={
              <>
                Dense cards, clear filters, no endless chat loop.
              </>
            }
            body="This page follows the new event-first design direction: the AI prompt is a concierge, the cards do the selling, and every surface points toward showing up in person."
          />

          <div className="mt-8 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-lg border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
              <p className="eyebrow">Date windows</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {dateFilters.map((filter, index) => (
                  <Pill key={filter} tone={index === 2 ? "rose" : index === 3 ? "peach" : "cream"}>
                    {filter}
                  </Pill>
                ))}
              </div>
              <p className="mt-5 text-sm font-bold leading-6 text-[color:var(--mauve)]">
                The events page should carry these controls into a fuller
                search surface with map pins, around-me ranking, cards/list
                toggles, and manual suburb fallback.
              </p>
            </div>

            <div className="rounded-lg border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
              <p className="eyebrow">Categories</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {categories
                  .filter((category) => category !== "All")
                  .map((category, index) => (
                    <Pill
                      key={category}
                      tone={index % 3 === 0 ? "peach" : index % 3 === 1 ? "rose" : "cream"}
                    >
                      {category}
                    </Pill>
                  ))}
              </div>
              <p className="mt-5 text-sm font-bold leading-6 text-[color:var(--mauve)]">
                Tags should feel like practical event filters: music, food,
                wellness, fitness, social, community, dating, and local groups.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {cardRules.map((rule, index) => (
              <article
                key={rule.title}
                className="rounded-lg border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm"
              >
                <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-3 py-1 text-[0.68rem] font-black uppercase tracking-wider text-[color:var(--surface-deep)]">
                  Rule {index + 1}
                </span>
                <h2 className="font-display mt-5 text-3xl font-light leading-tight">
                  {rule.title}
                </h2>
                <p className="mt-3 text-sm font-bold leading-6 text-[color:var(--mauve)]">
                  {rule.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
