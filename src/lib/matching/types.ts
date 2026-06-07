// Matching v2 — shared types. See context/04_MATCHING_ALGORITHM_V2.md.
//
// These mirror the `user_features` store (migration 041) but are the in-memory
// shape the scoring engine consumes. The batch jobs (later stage) populate the
// table; for now features can also be derived on demand for the /algo demo.

// The six cohorts from spec §2.1, adapted to this app's schema (no DOB → `age`;
// no dating range sub-features yet).
export const COHORTS = [
  "dating_under_38",
  "dating_38plus",
  "new_to_sydney",
  "active_local",
  "engaged_local",
  "new_local",
] as const;

export type CohortId = (typeof COHORTS)[number];

export type SocialEnergy = "introvert" | "ambivert" | "extrovert";

export type UserFeatures = {
  profileId: string;

  // Declared
  interestTagIds: string[];
  lifeTags: string[];
  socialEnergy: SocialEnergy | null;
  intents: string[]; // connection_intents: dating | friendship | networking | exploring
  age: number | null;
  suburb: string | null;
  city: string | null;

  // Behavioural
  behaviouralSubTags: Record<string, number>; // sub_tag -> attended count
  attendanceCount: number;
  rsvpCount: number;
  cancellationRate: number;
  attendedWithProfileIds: string[];
  clicksMadeCount: number;
  clicksReceivedCount: number;
  mutualClickCount: number;
  eventCategoriesAttended: string[];

  // Meta
  cohortId: CohortId | null;
};

// Event-side feature vector for user↔event scoring.
export type EventFeatures = {
  eventId: string;
  interestTagIds: string[];
  subTags: string[];
  lifeTagTargets: string[];
  category: string;
  suburb: string | null;
  startHour: number | null; // 0–23, local
  fillRatio: number; // attendees / capacity, 0–1
};

// The feature names the model scores on. Each maps to a learned/curated weight
// per cohort. Keep this list and DEFAULT_COHORT_WEIGHTS in lockstep.
export type PairFeatureName =
  | "interest_overlap"
  | "sub_tag_overlap"
  | "life_tag_overlap"
  | "intent_overlap"
  | "energy_match"
  | "attended_same_events"
  | "age_closeness"
  | "same_suburb";

export type UserEventFeatureName =
  | "interest_match"
  | "sub_tag_match"
  | "life_tag_target_match"
  | "category_history"
  | "same_suburb"
  | "momentum";

export type FeatureName = PairFeatureName | UserEventFeatureName;

// A cohort's weight set: one coefficient per feature plus an intercept. Phase 0
// values are hand-curated; the training pipeline (Month 2+) overwrites them with
// versioned, learned coefficients from cohort_weights.
export type CohortWeights = {
  intercept: number;
} & Partial<Record<FeatureName, number>>;
