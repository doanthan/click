import type { ClickQuizAnswers } from "@/lib/click-quiz";

/**
 * What a member's Click quiz answers ask of an event, used to RANK, never to
 * hide (bug board #336, Doan 2026-10-15). An event outside them sinks below the
 * ones inside; nothing is filtered out. No server imports, so node --test can
 * load it.
 */
export type QuizEventPrefs = { alcoholFree: boolean; maxKm: number | null };

// "How far you'll travel for a good one", as the willingness distances in
// click-tech TECH/08 §2 Section 4 (3 / 7 / 20 / 50 km).
const TRAVEL_KM: Record<string, number> = {
  suburb: 3,
  "twenty-minutes": 7,
  "across-city": 20,
  anywhere: 50,
};

export function quizEventPrefs(answers: ClickQuizAnswers | null | undefined): QuizEventPrefs {
  const comfort = answers?.comfort;
  const distance = answers?.distance;
  return {
    alcoholFree: Array.isArray(comfort) && comfort.includes("alcohol-free"),
    maxKm: typeof distance === "string" ? (TRAVEL_KM[distance] ?? null) : null,
  };
}

// Drink tags, matched on whole words of the tag's slug, so "Wine Tasting" and a
// host-requested "Craft Beer" count while "Barre" does not. The spec's own
// mechanism - hosts flagging an event alcohol-free (TECH/08 §4.2a,
// events.is_alcohol_free) - was never built; tags are what events carry today.
const DRINK_WORD =
  /(^|-)(wine|wines|beer|beers|brewery|breweries|cocktail|cocktails|whisky|whiskey|gin|sake|cider|pub|pubs|bar-crawl|pub-crawl|happy-hour)(-|$)/;

const slugOf = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function isAlcoholLed(tags: readonly string[]): boolean {
  return tags.some((tag) => DRINK_WORD.test(slugOf(tag)));
}

/**
 * How far an event sits outside what the member told the quiz: 0 fits. An
 * alcohol-led event for an alcohol-free member costs 2 and one past their
 * travel range costs 1, so a far event still outranks a near wine tasting - and
 * a member who lives far from everything (all of it "out of range") still sees
 * the wine tasting go last. Distance only counts when it was measured from the
 * member's own postcode, and an event with no distance never counts against
 * itself.
 */
export function quizMisfit(
  event: { tags: readonly string[]; distanceKm?: number | null },
  prefs: QuizEventPrefs,
  measuredFromMember: boolean,
): number {
  const drinks = prefs.alcoholFree && isAlcoholLed(event.tags) ? 2 : 0;
  const far =
    measuredFromMember && prefs.maxKm != null && event.distanceKm != null && event.distanceKm > prefs.maxKm ? 1 : 0;
  return drinks + far;
}

/** Stable: lower misfit first, the given order kept within each level. Nothing is dropped. */
export function rankByQuizFit<T>(events: readonly T[], misfitOf: (event: T) => number): T[] {
  return events
    .map((event, index) => ({ event, index, misfit: misfitOf(event) }))
    .sort((a, b) => a.misfit - b.misfit || a.index - b.index)
    .map(({ event }) => event);
}
