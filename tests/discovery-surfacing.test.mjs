// HOTFIX 2026-10-12 H3 (Cindy): discovery surfacing, to 09 §3. Behaviour - a
// pending click keeping someone in the pool, yesterday's click holding the
// featured turn, a NULL-bio member appearing, a "we clicked offline" pair sinking
// to the back - was run on PGlite through the real repository; these pin the
// clauses that would have to change to bring the old behaviour back.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file) => readFileSync(path.join(process.cwd(), file), "utf8");
// SQL and TS comments removed, so a comment explaining a rule never satisfies it.
const code = (src) =>
  src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/^[ \t]*\/\/.*$/gm, "").replace(/--[^\n]*/g, "");
const repo = read("src/lib/event-repository.ts");
const fn = (start, end = "\nexport ") => {
  const at = repo.indexOf(start);
  assert.ok(at > -1, `${start} not found`);
  return code(repo.slice(at, repo.indexOf(end, at + 1)));
};
// Up to the next function - the helpers after it (clickBackPick) read clicks on purpose.
const pool = fn("export async function getSuggestedPeople(", "\nfunction strongestPickSignal(");
const daily = fn("export async function getDailyPicks(");

test("H3.1: a pending click never removes someone from the pool", () => {
  assert.doesNotMatch(pool, /from clicks/);
});

test("09 §3 pending-click featured down-rank: a click from the last ~6h holds the featured turn", () => {
  // Build prompt 1: the hold is "created within the last rotation interval
  // (~6 hours)", per 09 - in the featured-slot selection only, never the pool.
  assert.match(
    daily,
    /exists \(\s*select 1 from clicks c\s*where c\.sender_id = \$1::uuid\s*and c\.receiver_id = p\.id\s*and c\.status = 'pending'\s*and c\.expires_at > now\(\)\s*and c\.created_at > now\(\) - interval '\$\{FEATURED_PENDING_HOLD_HOURS\} hours'\s*\) as feature_hold/,
  );
  assert.match(daily, /featureHold: row\.feature_hold === true,/);
  assert.match(read("src/lib/clicks/daily-picks.ts"), /export const FEATURED_PENDING_HOLD_HOURS = 6;/);
});

test("H3.5: no bio requirement", () => {
  assert.doesNotMatch(pool, /bio is not null/);
});

test("H3.6: hidden only when inactive 30 days AND the re-engagement mail was ignored", () => {
  assert.match(
    pool,
    /and not \(\s*coalesce\(p\.last_active_at, p\.created_at\) < now\(\) - interval '\$\{INACTIVE_DOWNRANK_DAYS\} days'\s*and p\.reengagement_clicked_at is not null\s*and p\.reengagement_clicked_at <= now\(\) - interval '\$\{REENGAGEMENT_GRACE_DAYS\} days'\s*and coalesce\(p\.last_active_at, p\.created_at\) < p\.reengagement_clicked_at\s*\)/,
  );
});

test("H3.2: a 'we clicked offline' pair is down-ranked, never removed; co_attended is not", () => {
  const weClicked = /wc\.status = 'connected'\s*and wc\.connected_reason = 'we_clicked'/g;
  assert.equal((pool.match(weClicked) ?? []).length, 2, "selected as a flag AND in the SQL order");
  assert.doesNotMatch(pool, /co_attended/);
  assert.match(pool, /Boolean\(row\.inactive\) \|\|\s*Boolean\(row\.we_clicked\);/, "in the post-v2 partition");
  assert.match(pool, /rankKey: \[\s*downRanked\(row\) \? 1 : 0,/, "the down-rank leads the rank key");
  // Released 30 days and "not feeling it" 90 days stay as they were (21 §B7.9).
  assert.match(pool, /where rc\.status = 'released'\s*and rc\.ended_at > now\(\) - interval '\$\{REDISCOVERY_COOLDOWN_DAYS\} days'/);
  assert.match(read("src/lib/clicks/constants.ts"), /export const PAIR_SUPPRESSION_DAYS = 90;/);
  assert.match(read("src/lib/clicks/constants.ts"), /export const REDISCOVERY_COOLDOWN_DAYS = 30;/);
});
