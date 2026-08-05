"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Badge } from "@/components/ds";
import type { EventItem } from "@/lib/click-data";
import {
  scorePersonalizedEvent,
  type MatchingWeights,
  type SignalKey,
  type UserMatchContext,
} from "@/lib/personalized-matching";

/**
 * Dry-run ranking preview for the matching weights.
 *
 * The problem it solves: this panel used to score from the SAVED weights only,
 * so the only way to see what a change did was to write it to production and
 * look at the result. Tuning a live ranking by shipping it is not tuning.
 *
 * How it stays honest AND keeps working with scripting off:
 *  - The weight form is passed in as `children`. It is still the same plain
 *    server-action form with uncontrolled `defaultValue` inputs - this component
 *    never becomes its controlled owner, so with JS off the form submits and
 *    saves exactly as before and this panel simply shows the saved ranking.
 *  - The preview recomputes through scorePersonalizedEvent, the same pure
 *    function the real feed uses. It is not a re-implementation and not a
 *    plausible-looking mock: identical inputs in, identical scores out.
 *  - Nothing here writes. A preview is a preview until the operator saves.
 *
 * ponytail: the whole live catalogue is serialised to the client so the re-rank
 * is exact (a change can lift an event from outside the saved top 8, so a
 * pre-sliced list would quietly be wrong). If the catalogue ever gets big enough
 * for that payload to matter, the upgrade is a server dry-run action, not a
 * truncated candidate set.
 */

// The five signals that contribute points. readinessThreshold is deliberately
// absent: it gates personalised-vs-fallback, it never reorders a list, so it
// cannot move this preview and must not be reported as a pending change to it.
const SIGNAL_KEYS: SignalKey[] = [
  "tagOverlap",
  "intentMatch",
  "personaBoost",
  "momentum",
  "featured",
];

/**
 * Read the operator's in-progress weights straight off the uncontrolled form.
 *
 * A field is only believed when the browser itself says it is valid. That one
 * check covers every way the preview could otherwise mislead:
 *  - a box cleared to retype is `required`-invalid, so it falls back to the
 *    SAVED value - never to 0. That is exactly what num() in actions.ts does on
 *    save, and treating a half-typed field as a real zero is what switched a
 *    signal off for every member's feed before that fix.
 *  - a value past min/max/step is invalid, so it is ignored too. The browser
 *    would block the submit, and a preview of a ranking that cannot be saved is
 *    the same class of lie this panel exists to end.
 */
function readWeights(form: HTMLFormElement, saved: MatchingWeights): MatchingWeights {
  const next: MatchingWeights = { ...saved };

  for (const key of SIGNAL_KEYS) {
    const field = form.elements.namedItem(key);
    if (!(field instanceof HTMLInputElement) || !field.validity.valid) continue;
    const parsed = Number(field.value);
    if (Number.isFinite(parsed)) next[key] = parsed;
  }

  return next;
}

export function MatchingWeightPreview({
  children,
  events,
  ctx,
  savedWeights,
}: {
  /** The weight form, rendered on the server and passed through untouched. */
  children: ReactNode;
  events: EventItem[];
  ctx: UserMatchContext;
  savedWeights: MatchingWeights;
}) {
  // null until the operator touches a field. Starting from null (rather than
  // reading the DOM during render) keeps the server and first client render
  // identical, so there is no hydration mismatch and no flash of a preview the
  // no-JS reader would never get.
  const [draft, setDraft] = useState<MatchingWeights | null>(null);

  const active = draft ?? savedWeights;
  const previewing = draft !== null && SIGNAL_KEYS.some((key) => draft[key] !== savedWeights[key]);

  const ranking = useMemo(
    () =>
      events
        .map((event) => scorePersonalizedEvent(event, ctx, active))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8),
    [events, ctx, active],
  );

  // Rank each event under the SAVED weights too, so the preview can show what
  // actually moved. A reordered list with no marks makes the operator diff two
  // screenshots by eye; the arrow is the whole point of a dry run.
  const savedRank = useMemo(() => {
    const ordered = events
      .map((event) => scorePersonalizedEvent(event, ctx, savedWeights))
      .sort((a, b) => b.score - a.score);
    return new Map(ordered.map((scored, index) => [scored.event.id, index]));
  }, [events, ctx, savedWeights]);

  // Delegated: the inputs stay uncontrolled, React's synthetic input event
  // bubbles up here, and the event's own target tells us which form to read.
  function handleInput(event: FormEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.form) return;
    setDraft(readWeights(target.form, savedWeights));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]" onInput={handleInput}>
      {children}

      <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="eyebrow">{previewing ? "Ranking preview" : "Current ranking"}</h2>
          {previewing ? <Badge tone="amber">Unsaved</Badge> : null}
        </div>

        <p className="mt-2 text-xs font-medium leading-5 text-[color:var(--slate)]">
          What a sample member interested in{" "}
          <span className="font-semibold text-[color:var(--ink)]">
            {ctx.tagSlugs.length > 0 ? ctx.tagSlugs.join(", ") : "the most common tags"}
          </span>{" "}
          would see.{" "}
          {previewing
            ? "Scored with the weights currently in the form - nothing is saved until you tap Save weights, and members still see the saved ranking."
            : "Scored with the saved weights - the ranking members see right now. Edit a weight to preview the effect first."}
        </p>

        {ranking.length > 0 ? (
          <ol className="mt-4 space-y-2">
            {ranking.map((scored, i) => {
              const was = savedRank.get(scored.event.id);
              const moved = previewing && was !== undefined ? was - i : 0;
              return (
                <li
                  key={scored.event.id}
                  className="flex items-center gap-3 rounded-xl bg-[color:var(--champagne)] p-3"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[color:var(--purple)] text-xs font-semibold text-[color:var(--champagne)]">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[color:var(--ink)]">
                      {scored.event.title}
                    </span>
                    <span className="block truncate text-[11px] font-medium text-[color:var(--slate)]">
                      {scored.reasons.length > 0 ? scored.reasons.join(" · ") : scored.event.category}
                    </span>
                  </span>
                  {moved !== 0 ? (
                    // Position change vs the saved ranking. Neutral slate, not a
                    // status colour: a moved row is information, not good news
                    // or bad news - the operator decides which.
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[color:var(--slate)]">
                      {moved > 0 ? `↑${moved}` : `↓${-moved}`}
                    </span>
                  ) : null}
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-[color:var(--purple)]">
                    {scored.score.toFixed(1)}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-4 text-sm font-medium text-[color:var(--slate)]">
            No live events to preview yet.
          </p>
        )}

        <p className="mt-4 text-[11px] font-medium leading-5 text-[color:var(--slate)]">
          The readiness threshold is not part of this list - it decides who gets a personalised feed
          at all, not how the feed is ordered.
        </p>
      </div>
    </div>
  );
}
