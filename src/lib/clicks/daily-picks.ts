// The daily picks (CHANGE BRIEF 2026-09-30 "Two click sources"). Standalone - no
// imports - so tests/two-click-sources.test.mjs can load it directly, the way the
// other pure helpers are tested.

/** How many people Click picks for each member each day. */
export const DAILY_PICK_COUNT = 3;

/** The dashboard card moves on to the next of today's picks this often. */
export const DASHBOARD_PICK_ROTATION_HOURS = 3;

/**
 * Which of today's picks the dashboard shows: pick[floor(hoursSinceMidnight / 3) % n].
 * `hourOfDay` is Sydney's (0-23), the same clock the pool date is cut on, so the card
 * walks the same three people the Click page lists and starts again at midnight.
 * `count` is how many picks there are today; with none there is nothing to show.
 */
export function dashboardPickIndex(hourOfDay: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.floor(hourOfDay / DASHBOARD_PICK_ROTATION_HOURS) % count;
}
