import type { EventItem } from "./click-data";

// Personalised event ranking. Unlike scoreEvent() in click-matching.ts (which
// scores a *text query*), this scores an event against a *member's profile* -
// their interest tags, connection intents, and quiz persona - using weights an
// admin can tune at /admin/matching.

export type MatchingWeights = {
  tagOverlap: number;
  intentMatch: number;
  personaBoost: number;
  momentum: number;
  featured: number;
  readinessThreshold: number;
};

export const DEFAULT_MATCHING_WEIGHTS: MatchingWeights = {
  tagOverlap: 5,
  intentMatch: 4,
  personaBoost: 3,
  momentum: 2,
  featured: 2,
  readinessThreshold: 40,
};

export type MatchPersona = {
  openness: "cautious" | "curious" | "ready";
  socialEnergy: "introvert" | "ambivert" | "extrovert";
} | null;

export type UserMatchContext = {
  tagSlugs: string[];
  intents: string[]; // connection_intents: dating | friendship | networking | exploring
  persona: MatchPersona;
};

// Which event category each connection intent gravitates toward.
const INTENT_CATEGORY: Record<string, string[]> = {
  dating: ["Relationships"],
  friendship: ["Social"],
  networking: ["Career"],
  exploring: ["Creative", "Food", "Fitness"],
};

// The five tunable signals (everything in MatchingWeights except the readiness
// gate, which decides personalised-vs-fallback rather than contributing points).
export type SignalKey = "tagOverlap" | "intentMatch" | "personaBoost" | "momentum" | "featured";

export type ScoredEvent = {
  event: EventItem;
  score: number;
  reasons: string[];
  // Per-signal point contribution to `score`. Sums to `score`. Surfaced so UIs
  // (e.g. /algo) can show *why* an event ranked where it did, from the same
  // source of truth that produces the score.
  contributions: Record<SignalKey, number>;
};

export function scorePersonalizedEvent(
  event: EventItem,
  ctx: UserMatchContext,
  weights: MatchingWeights,
): ScoredEvent {
  const reasons: string[] = [];
  const contributions: Record<SignalKey, number> = {
    tagOverlap: 0,
    intentMatch: 0,
    personaBoost: 0,
    momentum: 0,
    featured: 0,
  };

  // Tag overlap - the primary signal.
  const userTags = new Set(ctx.tagSlugs.map((t) => t.toLowerCase()));
  const shared = event.tags.filter((t) => userTags.has(t.toLowerCase()));
  if (shared.length > 0) {
    contributions.tagOverlap = shared.length * weights.tagOverlap;
    reasons.push(`${shared.length} shared interest${shared.length > 1 ? "s" : ""}`);
  }

  // Intent ↔ category alignment.
  const intentMatched = ctx.intents.some((intent) =>
    (INTENT_CATEGORY[intent] ?? []).includes(event.category),
  );
  if (intentMatched) {
    contributions.intentMatch = weights.intentMatch;
    reasons.push(`fits your ${ctx.intents.join("/")} intent`);
  }

  // Persona nudge: ready/curious + extro/ambivert lean toward fuller rooms.
  if (ctx.persona) {
    const fill = event.capacity > 0 ? event.attendees / event.capacity : 0;
    const outgoing =
      ctx.persona.openness !== "cautious" && ctx.persona.socialEnergy !== "introvert";
    if (outgoing && fill >= 0.5) {
      contributions.personaBoost = weights.personaBoost;
      reasons.push("matches your social energy");
    } else if (!outgoing && fill < 0.5) {
      contributions.personaBoost = weights.personaBoost;
      reasons.push("an intimate room");
    }
  }

  // Momentum + featured.
  if (event.capacity > 0) {
    contributions.momentum = (event.attendees / event.capacity) * weights.momentum;
  }
  if (event.status === "Featured") {
    contributions.featured = weights.featured;
  }

  const score =
    contributions.tagOverlap +
    contributions.intentMatch +
    contributions.personaBoost +
    contributions.momentum +
    contributions.featured;

  return { event, score, reasons, contributions };
}

// Profile readiness 0–100. Drives the editorial fallback feed: a cold-start
// member with little signal sees curated popular events rather than a thin,
// low-confidence personalised feed (business plan §4.2 / §7.2).
export function readinessScore(ctx: UserMatchContext, attendedCount: number): number {
  let score = 0;
  score += Math.min(ctx.tagSlugs.length, 5) * 10; // up to 50
  if (ctx.persona) score += 25;
  if (ctx.intents.length > 0) score += 15;
  if (attendedCount > 0) score += 10;
  return Math.min(score, 100);
}

// Cold-start ordering: featured first, then fullest rooms. Used when readiness
// is below the threshold so new members still see the platform's best events.
export function rankEditorialFallback(events: EventItem[]): EventItem[] {
  return [...events].sort((a, b) => {
    const featuredDelta = Number(b.status === "Featured") - Number(a.status === "Featured");
    if (featuredDelta !== 0) return featuredDelta;
    const fillA = a.capacity > 0 ? a.attendees / a.capacity : 0;
    const fillB = b.capacity > 0 ? b.attendees / b.capacity : 0;
    return fillB - fillA;
  });
}
