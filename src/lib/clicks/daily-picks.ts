// The daily picks (CHANGE BRIEF 2026-09-30 "Two click sources"). Standalone - no
// imports - so tests/two-click-sources.test.mjs can load it directly, the way
// the other pure helpers are tested.

/** How many people Click picks for each member each day. */
export const DAILY_PICK_COUNT = 3;

/** The dashboard card moves on to the next of today's picks this often: four
 *  featured turns a day (09 §3 "Card rotation", every 6 hours). */
export const DASHBOARD_PICK_ROTATION_HOURS = 6;

/** Sydney hour the daily-picks job writes the day's set (vercel.json "0 19 * * *"
 *  UTC is 06:00 AEDT, 05:00 AEST). The first turn after it features rank 1. */
export const DAILY_PICKS_BUILD_HOUR = 6;

/** 09 §3 "Pending-click featured down-rank": a pick the viewer clicked within the
 *  last rotation interval is listed, not featured. */
export const FEATURED_PENDING_HOLD_HOURS = 6;

/**
 * Which of today's picks the dashboard shows. The picks arrive in rank order
 * (best-scoring first), and the turns are counted from the morning build, so
 * the first turn of the day - and the small hours before the build - feature
 * rank 1 (09: "Feature rank-1 as the single dashboard card"), then each 6-hour
 * turn moves on round-robin. `hourOfDay` is Sydney's (0-23), the clock the pool
 * date is cut on. `count` is how many picks there are; with none there is
 * nothing to show.
 */
export function dashboardPickIndex(hourOfDay: number, count: number): number | null {
  if (count <= 0) return null;
  const sinceBuild = (((hourOfDay - DAILY_PICKS_BUILD_HOUR) % 24) + 24) % 24;
  return Math.floor(sinceBuild / DASHBOARD_PICK_ROTATION_HOURS) % count;
}
