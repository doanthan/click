// Matching v2 §2 - cohort segmentation.
//
// One weight set can't fit all users (spec problem #1). A user belongs to
// exactly one cohort, recomputed weekly; the viewer's cohort selects the weights
// used to score their candidates. Cohorts are intentionally few - too many
// fragments the training data below usable N.

import type { CohortId, UserFeatures } from "./types";

// §2.1, adapted: no DOB in this schema, so the dating split uses `age`; the
// "new to town" life tag drives the new_to_sydney cohort; attendance thresholds
// separate active / engaged / brand-new locals.
const NEW_TO_TOWN_TAGS = new Set(["new_to_town", "new-to-town", "new_to_sydney", "new-to-sydney"]);

export function assignCohort(user: UserFeatures): CohortId {
  // Intent-first: dating users want different things than networking/friendship.
  if (user.intents.includes("dating")) {
    if (user.age != null && user.age >= 38) return "dating_38plus";
    return "dating_under_38";
  }

  // Recency-of-arrival: new-to-Sydney users have no behavioural data but a strong
  // "find anyone" affinity - score them on declared overlap, not history.
  if (user.lifeTags.some((t) => NEW_TO_TOWN_TAGS.has(t.toLowerCase()))) {
    return "new_to_sydney";
  }

  // Activity level decides how much we trust behavioural features.
  if (user.attendanceCount >= 3) return "active_local";
  if (user.attendanceCount >= 1) return "engaged_local";

  return "new_local"; // signed up, hasn't attended yet
}
