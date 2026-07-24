// Step 2.5b-i reveal-gate tests (COORDINATION_MODAL_SYSTEM §4).
//
// The mutual reveal must fire EXACTLY ONCE per user per mutual. It's persisted on
// mutual_clicks.seen_at_a/b (user_a = least(pair)); getMutualRevealState reports the
// viewer's side, markMutualSeen stamps it idempotently and returns first-view only.
// This drives the exact SQL both functions run, against seeded rows. Self-cleaning.
//   node scripts/test-click-reveal.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
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
const profiles = [];
const mutuals = [];
function check(label, cond) {
  if (cond) console.log(`  ok   — ${label}`);
  else { failures++; console.error(`  FAIL — ${label}`); }
}

async function mkProfile() {
  const r = await pool.query(
    `insert into profiles (email, display_name, age) values ($1,'Reveal tester',30) returning id::text`,
    [`rv-${randomUUID()}@test.local`],
  );
  profiles.push(r.rows[0].id);
  return r.rows[0].id;
}
async function mkMutual(a, b) {
  const r = await pool.query(
    `insert into mutual_clicks (user_a_id, user_b_id, intent_a, intent_b, status, coord_state, mutual_at, expires_at)
     values (least($1::uuid,$2::uuid), greatest($1::uuid,$2::uuid), 'activities','activities','active','open', now(), now() + interval '7 days')
     returning id::text`,
    [a, b],
  );
  mutuals.push(r.rows[0].id);
  return r.rows[0].id;
}
// Mirrors getMutualRevealState exactly.
async function revealState(mutualId, viewerId) {
  const r = await pool.query(
    `select case when user_a_id = $2::uuid then seen_at_a is not null else seen_at_b is not null end as seen
     from mutual_clicks
     where id = $1::uuid and status = 'active' and (user_a_id = $2::uuid or user_b_id = $2::uuid)
     limit 1`,
    [mutualId, viewerId],
  );
  return r.rows[0] ? { seen: Boolean(r.rows[0].seen) } : null;
}
// Mirrors markMutualSeen exactly — returns true only on the first view.
async function markSeen(mutualId, viewerId) {
  const r = await pool.query(
    `update mutual_clicks
       set seen_at_a = case when user_a_id = $2::uuid then now() else seen_at_a end,
           seen_at_b = case when user_b_id = $2::uuid then now() else seen_at_b end
     where id = $1::uuid and status = 'active'
       and ((user_a_id = $2::uuid and seen_at_a is null) or (user_b_id = $2::uuid and seen_at_b is null))
     returning id::text`,
    [mutualId, viewerId],
  );
  return r.rows.length > 0;
}

try {
  console.log("§4 — reveal fires once per user, per mutual:");
  const a = await mkProfile();
  const b = await mkProfile();
  const stranger = await mkProfile();
  const m = await mkMutual(a, b);

  check("fresh mutual → A unseen", (await revealState(m, a))?.seen === false);
  check("fresh mutual → B unseen", (await revealState(m, b))?.seen === false);
  check("non-participant → no reveal state (null)", (await revealState(m, stranger)) === null);

  check("A first view → markMutualSeen returns true", (await markSeen(m, a)) === true);
  check("A now seen", (await revealState(m, a))?.seen === true);
  check("B still unseen (per-user gate, not per-mutual)", (await revealState(m, b))?.seen === false);

  check("A re-open → markMutualSeen returns false (idempotent)", (await markSeen(m, a)) === false);
  check("A still seen after re-open", (await revealState(m, a))?.seen === true);

  check("B first view → returns true", (await markSeen(m, b)) === true);
  check("B now seen → both sides seen", (await revealState(m, b))?.seen === true);

  check("stranger can't stamp a mutual they're not in", (await markSeen(m, stranger)) === false);

  console.log(failures === 0 ? "\nPASS — reveal fires once per user, idempotent, per-side." : `\nFAIL — ${failures} assertion(s).`);
} catch (err) {
  console.error("ERROR:", err.message);
  failures++;
} finally {
  for (const id of mutuals) await pool.query(`delete from mutual_clicks where id=$1::uuid`, [id]).catch(() => {});
  for (const id of profiles) await pool.query(`delete from profiles where id=$1::uuid`, [id]).catch(() => {});
  await pool.end();
}
process.exit(failures === 0 ? 0 : 1);
