// Matching v2 §3 - scoring.
//
// Two scorers, same shape: build a 0–1 feature vector, dot it with the viewer's
// cohort weights, squash through a sigmoid → 0–100. Logistic regression is
// deliberate (spec §3.3): interpretable for diligence, tractable at our data
// volume, and every feature contribution is inspectable when a match looks off.

import {
  type CohortWeights,
  type EventFeatures,
  type FeatureName,
  type PairFeatureName,
  type SocialEnergy,
  type UserEventFeatureName,
  type UserFeatures,
} from "./types";
import { getCohortWeights } from "./weights";

// ---- math helpers ---------------------------------------------------------

export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const sa = new Set(a.map((x) => x.toLowerCase()));
  const sb = new Set(b.map((x) => x.toLowerCase()));
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

// Cosine-ish overlap of two sub-tag count maps - weights shared sub-tags by how
// strongly each user expresses them, so yoga_hot:6↔yoga_hot:5 beats a single
// incidental overlap. Returns 0–1.
export function subTagOverlap(
  a: Record<string, number>,
  b: Record<string, number>,
): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const k of keys) {
    const va = a[k] ?? 0;
    const vb = b[k] ?? 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Fraction of an event's sub-tags the user has demonstrated behaviourally. 0–1.
export function subTagMatch(userSubTags: Record<string, number>, eventSubTags: string[]): number {
  if (eventSubTags.length === 0) return 0;
  const hits = eventSubTags.filter((t) => (userSubTags[t] ?? 0) > 0).length;
  return hits / eventSubTags.length;
}

// Social-energy compatibility, 0–1. Same energy reads best; ambiverts flex to
// anyone; the introvert↔extrovert extreme is the weakest pairing.
export function socialEnergyCompatibility(
  a: SocialEnergy | null,
  b: SocialEnergy | null,
): number {
  if (!a || !b) return 0.5; // unknown → neutral, don't penalise
  if (a === b) return 1;
  if (a === "ambivert" || b === "ambivert") return 0.75;
  return 0.4; // introvert ↔ extrovert
}

// Age closeness on a soft ramp: identical age = 1, falls to ~0 by ~20y apart.
export function ageCloseness(a: number | null, b: number | null): number {
  if (a == null || b == null) return 0.5;
  return Math.max(0, 1 - Math.abs(a - b) / 20);
}

function sameSuburb(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
}

// ---- feature builders -----------------------------------------------------

const notExploring = (intent: string) => intent !== "exploring";

export function buildPairFeatures(
  a: UserFeatures,
  b: UserFeatures,
): Record<PairFeatureName, number> {
  return {
    interest_overlap: jaccard(a.interestTagIds, b.interestTagIds),
    sub_tag_overlap: subTagOverlap(a.behaviouralSubTags, b.behaviouralSubTags),
    life_tag_overlap: jaccard(a.lifeTags, b.lifeTags),
    intent_overlap: jaccard(a.intents.filter(notExploring), b.intents.filter(notExploring)),
    energy_match: socialEnergyCompatibility(a.socialEnergy, b.socialEnergy),
    attended_same_events: a.attendedWithProfileIds.includes(b.profileId) ? 1 : 0,
    age_closeness: ageCloseness(a.age, b.age),
    same_suburb: sameSuburb(a.suburb, b.suburb),
  };
}

export function buildUserEventFeatures(
  user: UserFeatures,
  event: EventFeatures,
): Record<UserEventFeatureName, number> {
  return {
    interest_match: jaccard(user.interestTagIds, event.interestTagIds),
    sub_tag_match: subTagMatch(user.behaviouralSubTags, event.subTags),
    life_tag_target_match: jaccard(user.lifeTags, event.lifeTagTargets),
    category_history: user.eventCategoriesAttended.includes(event.category) ? 1 : 0,
    same_suburb: sameSuburb(user.suburb, event.suburb),
    momentum: Math.max(0, Math.min(1, event.fillRatio)),
  };
}

// ---- scoring --------------------------------------------------------------

export type ScoreResult = {
  score: number; // 0–100
  contributions: Partial<Record<FeatureName, number>>; // logit contribution per feature
};

function applyWeights(
  features: Partial<Record<FeatureName, number>>,
  weights: CohortWeights,
): ScoreResult {
  const contributions: Partial<Record<FeatureName, number>> = {};
  let logit = weights.intercept;
  for (const [name, value] of Object.entries(features) as [FeatureName, number][]) {
    const w = weights[name] ?? 0;
    const c = w * value;
    contributions[name] = c;
    logit += c;
  }
  return { score: sigmoid(logit) * 100, contributions };
}

// User↔User. The viewer's cohort drives the weights (spec §3.1). `trainedWeights`
// is the latest DB row set for that cohort when available; otherwise the
// hand-curated prior is used.
export function scorePair(
  viewer: UserFeatures,
  candidate: UserFeatures,
  trainedWeights?: Partial<Record<string, number>> | null,
): ScoreResult {
  const cohort = viewer.cohortId ?? "new_local";
  const weights = getCohortWeights(cohort, trainedWeights);
  return applyWeights(buildPairFeatures(viewer, candidate), weights);
}

// User↔Event. Same model, event feature set; viewer's cohort selects weights.
export function scoreUserEvent(
  user: UserFeatures,
  event: EventFeatures,
  trainedWeights?: Partial<Record<string, number>> | null,
): ScoreResult {
  const cohort = user.cohortId ?? "new_local";
  const weights = getCohortWeights(cohort, trainedWeights);
  return applyWeights(buildUserEventFeatures(user, event), weights);
}
