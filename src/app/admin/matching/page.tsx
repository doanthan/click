import { getEventsForExplore, getSystemSettings } from "@/lib/event-repository";
import type { UserMatchContext } from "@/lib/personalized-matching";
import { updateMatchingWeightsAction } from "./actions";
import { MatchingWeightPreview } from "./weight-preview";

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
  // live catalogue. The scoring itself happens in MatchingWeightPreview so the
  // ranking can be recomputed from the weights in the form BEFORE they are
  // saved - see that file for why the form stays uncontrolled.
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

  return (
    <div className="space-y-8 py-6">
      <header>
        <span className="eyebrow">Discovery</span>
        <h1 className="font-display mt-2 text-4xl font-semibold leading-tight tracking-[-0.025em] text-[color:var(--ink)] sm:text-5xl">
          Matching Formula
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[color:var(--slate)]">
          Tune how events are ranked in each member&apos;s personalised feed. Members below the
          readiness threshold see the editorial fallback feed (popular events) instead.
        </p>
      </header>

      <MatchingWeightPreview events={events} ctx={sampleCtx} savedWeights={weights}>
        <form
          action={updateMatchingWeightsAction}
          className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6"
        >
          <h2 className="eyebrow">Signal weights</h2>
          <div className="mt-4 space-y-4">
            {WEIGHT_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-[color:var(--ink)]">{field.label}</span>
                  <span className="text-[11px] font-medium text-[color:var(--slate)]">
                    {field.hint}
                  </span>
                </span>
                {/* `required` so the browser blocks an empty submit outright -
                    a cleared box used to persist as a real 0 and switch this
                    signal off for every member's feed. The server keeps the
                    saved value as a second guard (see actions.ts num()). */}
                <input
                  type="number"
                  name={field.key}
                  required
                  min={0}
                  max={field.max}
                  step={0.5}
                  defaultValue={weights[field.key as keyof typeof weights]}
                  className="mt-1 w-full rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-3 py-2 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
                />
              </label>
            ))}

            <label className="block border-t border-[color:var(--line)] pt-4">
              <span className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-[color:var(--ink)]">
                  Readiness threshold
                </span>
                <span className="text-[11px] font-medium text-[color:var(--slate)]">
                  Below this → fallback feed (0–100)
                </span>
              </span>
              <input
                type="number"
                name="readinessThreshold"
                required
                min={0}
                max={100}
                step={1}
                defaultValue={weights.readinessThreshold}
                className="mt-1 w-full rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-3 py-2 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
              />
            </label>
          </div>

          <button
            type="submit"
            className="ck-btn ck-btn--primary ck-btn--md mt-6 w-full"
          >
            Save weights
          </button>
        </form>
      </MatchingWeightPreview>
    </div>
  );
}
