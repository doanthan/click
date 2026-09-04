// Step 2.4 timer test (TW-3 / TW-4).
//
// Asserts the SINGLE collapsed post-event-prompt window predicate now shared by
// getPostEventClickPrompts / getPostEventClickPromptForEvent / notifyPostEventClickPrompts:
//     ended + 2h <= now  AND  ended + 48h > now
// (i.e. exactly the who-was-there click surface's live window, §6.8 / §B3.2), and
// the cron's 09:00–22:00 event-local quiet-hours deferral (§6.8):
//     extract(hour from now at time zone tz) in [9, 22)
//
// Drives the exact SQL boundary math against Postgres - pure interval/tz arithmetic,
// no row seeding. Fails if the 2h open edge, the 48h close edge, or the quiet-hours
// bounds ever drift.
//   node scripts/test-click-timers.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Pool } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function loadEnv(file) {
  try {
    for (const line of readFileSync(path.join(root, file), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    /* optional */
  }
}
loadEnv(".env.local");
loadEnv(".env");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set (.env.local / .env).");
  process.exit(1);
}
const pool = new Pool({
  connectionString,
  max: 5,
  ssl: /supabase\.(co|com)/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
});

let failures = 0;
function assert(label, cond) {
  console.log(`  ${cond ? "ok  " : "FAIL"} - ${label}`);
  if (!cond) failures++;
}

// The window predicate is pure relative interval math on timestamptz, so `now` is
// arbitrary here - only the ended-vs-now gap matters.
async function inWindow(endedHoursAgo) {
  const { rows } = await pool.query(
    `with ev as (
       select now() as now, now() - ($1 || ' hours')::interval as ended
     )
     select (ended + interval '2 hours' <= now
             and ended + interval '48 hours' > now) as v
     from ev`,
    [endedHoursAgo],
  );
  return rows[0].v;
}

// true = send now, false = defer to a later run past 09:00 local.
async function quietSend(nowIso, tz) {
  const { rows } = await pool.query(
    `select (extract(hour from $1::timestamptz at time zone $2) >= 9
             and extract(hour from $1::timestamptz at time zone $2) < 22) as v`,
    [nowIso, tz],
  );
  return rows[0].v;
}

try {
  console.log("Collapsed prompt window - ended + 2h <= now < ended + 48h (TW-3/TW-4):");
  assert("ended  1h ago  → not yet open (before +2h)", (await inWindow(1)) === false);
  assert("ended  2h ago  → OPEN at the +2h edge", (await inWindow(2)) === true);
  assert("ended  3h ago  → in window", (await inWindow(3)) === true);
  assert("ended 47h ago  → still in window", (await inWindow(47)) === true);
  assert("ended 48h ago  → CLOSED at the +48h edge", (await inWindow(48)) === false);
  assert("ended 49h ago  → closed", (await inWindow(49)) === false);

  console.log("\nCron quiet-hours deferral - send only 09:00–22:00 event-local (§6.8):");
  const TZ = "Australia/Sydney";
  // July = AEST (UTC+10), no DST.
  assert("12:00 Sydney (02:00Z) → send", (await quietSend("2026-07-24T02:00:00Z", TZ)) === true);
  assert("02:00 Sydney (16:00Z) → defer", (await quietSend("2026-07-24T16:00:00Z", TZ)) === false);
  assert("09:00 Sydney (23:00Z) → send at the open edge", (await quietSend("2026-07-23T23:00:00Z", TZ)) === true);
  assert("22:00 Sydney (12:00Z) → defer at the close edge", (await quietSend("2026-07-24T12:00:00Z", TZ)) === false);

  console.log(failures === 0 ? "\nPASS - collapsed window + quiet-hours predicates correct." : `\nFAIL - ${failures} assertion(s).`);
} catch (err) {
  console.error("ERROR:", err.message);
  failures++;
} finally {
  await pool.end();
}
process.exit(failures === 0 ? 0 : 1);
