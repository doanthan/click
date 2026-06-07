// Matching v2 §4.1 — Phase 0 hand-curated cohort weights.
//
// No behavioural data exists pre-launch, so we can't train yet. These are the
// hand-curated priors the engine ships with; the Month 2+ training pipeline
// (spec §4.3) overwrites them with learned, versioned coefficients in the
// cohort_weights table. Until then, getCohortWeights() falls back here.
//
// Weights are logistic-regression coefficients. All features feed in on a 0–1
// scale (jaccard overlaps, normalised closeness, fill ratio), so a weight is its
// feature's contribution to the logit. Intercepts are negative to keep the
// baseline match probability low — a pair/event has to earn its score.

import type { CohortId, CohortWeights } from "./types";

// Stamped on every match_impression so we can later attribute outcomes (mutual
// clicks, RSVPs) to the model that surfaced them. Bump when weights become
// trained rather than hand-curated.
export const MODEL_VERSION = "v2-handcurated-phase0";

// The priors encode the spec's intuitions:
//  • new_to_sydney / new_local — no history, so declared overlap (interest, life,
//    intent) dominates and behavioural features (sub-tags, shared events) are
//    near-zero.
//  • active_local / engaged_local — trust behaviour: sub-tag overlap and
//    having-attended-the-same-events carry real weight.
//  • dating_* — interest + social-energy fit + age closeness lead; intent
//    overlap matters less (both are already dating-mode).
export const DEFAULT_COHORT_WEIGHTS: Record<CohortId, CohortWeights> = {
  new_local: {
    intercept: -2.2,
    // user↔user
    interest_overlap: 3.0,
    sub_tag_overlap: 0.3,
    life_tag_overlap: 1.6,
    intent_overlap: 1.4,
    energy_match: 0.8,
    attended_same_events: 0.4,
    age_closeness: 0.6,
    same_suburb: 0.7,
    // user↔event
    interest_match: 3.0,
    sub_tag_match: 0.3,
    life_tag_target_match: 1.2,
    category_history: 0.2,
    momentum: 0.8,
  },
  new_to_sydney: {
    intercept: -2.0,
    interest_overlap: 3.2,
    sub_tag_overlap: 0.2,
    life_tag_overlap: 2.0, // shared "new to town" is a strong affinity here
    intent_overlap: 1.2,
    energy_match: 0.9,
    attended_same_events: 0.2,
    age_closeness: 0.5,
    same_suburb: 1.0, // proximity matters more when you know no one
    interest_match: 3.2,
    sub_tag_match: 0.2,
    life_tag_target_match: 1.6,
    category_history: 0.1,
    momentum: 1.1, // fuller rooms are easier to walk into alone
  },
  engaged_local: {
    intercept: -2.4,
    interest_overlap: 2.4,
    sub_tag_overlap: 1.4,
    life_tag_overlap: 1.0,
    intent_overlap: 1.2,
    energy_match: 0.9,
    attended_same_events: 1.0,
    age_closeness: 0.6,
    same_suburb: 0.6,
    interest_match: 2.4,
    sub_tag_match: 1.4,
    life_tag_target_match: 0.8,
    category_history: 0.9,
    momentum: 0.6,
  },
  active_local: {
    intercept: -2.6,
    interest_overlap: 2.0,
    sub_tag_overlap: 2.2, // strongest behavioural signal for habitual users
    life_tag_overlap: 0.8,
    intent_overlap: 1.0,
    energy_match: 1.0,
    attended_same_events: 1.6,
    age_closeness: 0.6,
    same_suburb: 0.5,
    interest_match: 2.0,
    sub_tag_match: 2.2,
    life_tag_target_match: 0.6,
    category_history: 1.3,
    momentum: 0.4,
  },
  dating_under_38: {
    intercept: -2.6,
    interest_overlap: 2.6,
    sub_tag_overlap: 1.2,
    life_tag_overlap: 0.9,
    intent_overlap: 0.4,
    energy_match: 1.4,
    attended_same_events: 0.8,
    age_closeness: 1.6,
    same_suburb: 0.8,
    interest_match: 2.6,
    sub_tag_match: 1.0,
    life_tag_target_match: 0.7,
    category_history: 0.7,
    momentum: 0.5,
  },
  dating_38plus: {
    intercept: -2.6,
    interest_overlap: 2.6,
    sub_tag_overlap: 1.2,
    life_tag_overlap: 1.0,
    intent_overlap: 0.4,
    energy_match: 1.4,
    attended_same_events: 0.8,
    age_closeness: 1.8, // age band tightens with the older cohort
    same_suburb: 0.9,
    interest_match: 2.6,
    sub_tag_match: 1.0,
    life_tag_target_match: 0.8,
    category_history: 0.7,
    momentum: 0.4,
  },
};

// Latest weights for a cohort. `trained` is the latest versioned row set from
// cohort_weights (passed in by the caller that read the DB); when absent or
// empty we fall back to the hand-curated prior. This is the single seam the ML
// pipeline plugs into — nothing else in the engine changes when training starts.
export function getCohortWeights(
  cohortId: CohortId,
  trained?: Partial<Record<string, number>> | null,
): CohortWeights {
  const prior = DEFAULT_COHORT_WEIGHTS[cohortId] ?? DEFAULT_COHORT_WEIGHTS.new_local;
  if (!trained || Object.keys(trained).length === 0) return prior;
  // A trained row set is authoritative once present — it already carries every
  // feature + intercept the model fit.
  return { intercept: 0, ...trained } as CohortWeights;
}
