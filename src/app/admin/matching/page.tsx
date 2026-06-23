import { getEventsForExplore, getSystemSettings } from "@/lib/event-repository";
import { scorePersonalizedEvent, type UserMatchContext } from "@/lib/personalized-matching";
import { updateMatchingWeightsAction } from "./actions";

export const metadata = {
  title: "Matching Formula | Admin",
};

const WEIGHT_FIELDS: { key: string; label: string; hint: string; max: number }[] = [
  { key: "tagOverlap", label: "Tag overlap", hint: "Points per shared interest tag", max: 50 },
  { key: "intentMatch", label: "Intent match", hint: "Event category fits a user intent", max: 50 },
  { key: "personaBoost", label: "Persona fit", hint: "Room size matches social energy", max: 50 },
  { key: "momentum", label: "Momentum", hint: "Multiplier on how full the event is", max: 50 },
  { key: "featured", label: "Featured bonus", hint: "Flat boost for Featured events", max: 50 },
];

export default async function AdminMatchingPage() {
  const [settings, events] = await Promise.all([getSystemSettings(), getEventsForExplore()]);
  const weights = settings.matchingWeights;

  // Build a representative "sample member" from the most common tags across the
  // live catalogue, so the preview below reacts to the weights you set.
  const tagCounts = new Map<string, number>();
  for (const event of events) {
    for (const tag of event.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  const sampleTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  const sampleCtx: UserMatchContext = {
    tagSlugs: sampleTags,
    intents: ["friendship"],
    persona: { openness: "curious", socialEnergy: "ambivert" },
  };

  const preview = events
    .map((event) => scorePersonalizedEvent(event, sampleCtx, weights))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return (
    <div className="space-y-8 py-6">
      <header>
        <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--rose)]">
          Discovery
        </span>
        <h1 className="font-display mt-2 text-4xl font-bold leading-tight tracking-[-0.025em] sm:text-5xl">
          Matching Formula
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Tune how events are ranked in each member&apos;s personalised feed. Members below the
          readiness threshold see the editorial fallback feed (popular events) instead.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <form
          action={updateMatchingWeightsAction}
          className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm"
        >
          <h2 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--ink)]">
            Signal weights
          </h2>
          <div className="mt-4 space-y-4">
            {WEIGHT_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-[color:var(--ink)]">{field.label}</span>
                  <span className="font-mono text-[0.65rem] uppercase tracking-wide text-[color:var(--mauve)]">
                    {field.hint}
                  </span>
                </span>
                <input
                  type="number"
                  name={field.key}
                  min={0}
                  max={field.max}
                  step={0.5}
                  defaultValue={weights[field.key as keyof typeof weights]}
                  className="mt-1 w-full rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-2 text-sm font-semibold text-[color:var(--ink)]"
                />
              </label>
            ))}

            <label className="block border-t-2 border-dashed border-[color:var(--line)] pt-4">
              <span className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-[color:var(--ink)]">
                  Readiness threshold
                </span>
                <span className="font-mono text-[0.65rem] uppercase tracking-wide text-[color:var(--mauve)]">
                  Below this → fallback feed (0–100)
                </span>
              </span>
              <input
                type="number"
                name="readinessThreshold"
                min={0}
                max={100}
                step={1}
                defaultValue={weights.readinessThreshold}
                className="mt-1 w-full rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-2 text-sm font-semibold text-[color:var(--ink)]"
              />
            </label>
          </div>

          <button
            type="submit"
            className="mt-6 w-full rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
          >
            Save weights
          </button>
        </form>

        <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow-sm">
          <h2 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--ink)]">
            Live preview
          </h2>
          <p className="mt-2 text-xs font-medium leading-5 text-[color:var(--mauve)]">
            Top events for a sample member interested in{" "}
            <span className="font-bold text-[color:var(--ink)]">
              {sampleTags.length > 0 ? sampleTags.join(", ") : "the most common tags"}
            </span>
            , ranked with the currently saved weights.
          </p>
          {preview.length > 0 ? (
            <ol className="mt-4 space-y-2">
              {preview.map((scored, i) => (
                <li
                  key={scored.event.id}
                  className="flex items-center gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-3"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[color:var(--ink)] text-xs font-black text-[color:var(--champagne)]">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[color:var(--ink)]">
                      {scored.event.title}
                    </span>
                    <span className="block truncate font-mono text-[0.62rem] uppercase tracking-wide text-[color:var(--mauve)]">
                      {scored.reasons.length > 0 ? scored.reasons.join(" · ") : scored.event.category}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs font-black tabular-nums text-[color:var(--rose)]">
                    {scored.score.toFixed(1)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm font-medium text-[color:var(--mauve)]">
              No live events to preview yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
