// Step 2.5b-iv mutual-centric read test (getProposalsForSession rework).
//
// The list read is now FROM mutual_clicks LEFT JOIN LATERAL the single pending/accepted
// plan, so:
//   - an `open` mutual with NO live plan (brand-new, or its only proposal was declined)
//     still shows - the drawer's suggest step re-fills it (fixes decline → vanish);
//   - a mutual never fans out to duplicate rows even with several proposal rows;
//   - a blocked pair stays hidden (SAFE-05); an inactive mutual is excluded.
// Drives the exact reworked query against seeded rows. Self-cleaning.
//   node scripts/test-click-clicks-read.mjs

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
const events = [];
const mutuals = [];
function check(label, cond) {
  if (cond) console.log(`  ok   — ${label}`);
  else { failures++; console.error(`  FAIL — ${label}`); }
}

async function mkProfile() {
  const r = await pool.query(
    `insert into profiles (email, display_name, age) values ($1,'Read tester',30) returning id::text`,
    [`rd-${randomUUID()}@test.local`],
  );
  profiles.push(r.rows[0].id);
  return r.rows[0].id;
}
async function mkEvent() {
  const r = await pool.query(
    `insert into events (slug, title, description, group_name, host_name, category,
       starts_at, location_name, suburb, capacity, status)
     values ($1,'Read Event','d','g','h','social', now() + interval '10 days','loc','Sydney',10,'live')
     returning id::text`,
    [`rd-evt-${randomUUID()}`],
  );
  events.push(r.rows[0].id);
  return r.rows[0].id;
}
async function mkMutual(a, b, coordState = "open", status = "active") {
  const r = await pool.query(
    `insert into mutual_clicks (user_a_id, user_b_id, intent_a, intent_b, status, coord_state, mutual_at, expires_at)
     values (least($1::uuid,$2::uuid), greatest($1::uuid,$2::uuid), 'activities','activities',$3,$4, now(), now() + interval '7 days')
     returning id::text`,
    [a, b, status, coordState],
  );
  mutuals.push(r.rows[0].id);
  return r.rows[0].id;
}
async function mkProposal(mutualId, eventId, proposedBy, status = "pending") {
  await pool.query(
    `insert into click_proposals (mutual_click_id, suggested_event_id, proposed_by, status, expires_at)
     values ($1::uuid,$2::uuid,$3::uuid,$4, now() + interval '7 days')`,
    [mutualId, eventId, proposedBy, status],
  );
}

// The reworked getProposalsForSession core: mutual-centric + lateral single-plan.
async function readClicks(viewerId) {
  const r = await pool.query(
    `
      select
        m.id::text as mutual_id,
        p.id::text as proposal_id,
        p.status as proposal_status,
        m.coord_state
      from mutual_clicks m
      join profiles other on other.id = (case when m.user_a_id = $1::uuid then m.user_b_id else m.user_a_id end)
      left join lateral (
        select cp.*
        from click_proposals cp
        where cp.mutual_click_id = m.id and cp.status in ('pending','accepted')
        order by cp.updated_at desc
        limit 1
      ) p on true
      where (m.user_a_id = $1::uuid or m.user_b_id = $1::uuid)
        and m.status = 'active'
        and not exists (
          select 1 from user_blocks b
          where (b.blocker_profile_id = m.user_a_id and b.blocked_profile_id = m.user_b_id)
             or (b.blocker_profile_id = m.user_b_id and b.blocked_profile_id = m.user_a_id)
        )
    `,
    [viewerId],
  );
  return r.rows;
}

try {
  const V = await mkProfile();
  const [P1, P2, P3, P4, P5, P6] = await Promise.all([
    mkProfile(), mkProfile(), mkProfile(), mkProfile(), mkProfile(), mkProfile(),
  ]);

  const M1 = await mkMutual(V, P1, "open"); // open, no plan
  const M2 = await mkMutual(V, P2, "open"); // open, pending plan
  const M3 = await mkMutual(V, P3, "confirmed_together"); // both going
  const M4 = await mkMutual(V, P4, "open"); // only a declined plan
  const M5 = await mkMutual(V, P5, "open"); // declined + pending (fan-out guard)
  const M6 = await mkMutual(V, P6, "open"); // pending, but blocked

  const e = await mkEvent();
  await mkProposal(M2, e, V, "pending");
  await mkProposal(M3, e, V, "accepted");
  await mkProposal(M4, e, V, "declined");
  await mkProposal(M5, e, V, "declined");
  await mkProposal(M5, e, P5, "pending");
  await mkProposal(M6, e, V, "pending");
  await pool.query(`insert into user_blocks (blocker_profile_id, blocked_profile_id) values ($1::uuid,$2::uuid)`, [V, P6]);

  const rows = await readClicks(V);
  const by = new Map(rows.map((r) => [r.mutual_id, r]));
  const seen = rows.map((r) => r.mutual_id);
  const countOf = (id) => seen.filter((x) => x === id).length;

  console.log("Every active mutual shows, once, with its live plan (or none):");
  check("M1 open/no-plan → shows with null proposal", by.has(M1) && by.get(M1).proposal_id === null && by.get(M1).coord_state === "open");
  check("M2 open + pending → shows, status pending", by.get(M2)?.proposal_status === "pending");
  check("M3 both-going → shows, status accepted, coord confirmed_together", by.get(M3)?.proposal_status === "accepted" && by.get(M3)?.coord_state === "confirmed_together");
  check("M4 declined-only → shows with NULL proposal (the decline-vanish fix)", by.has(M4) && by.get(M4).proposal_id === null);
  check("M5 declined + pending → shows once, pending wins", countOf(M5) === 1 && by.get(M5)?.proposal_status === "pending");
  check("no mutual fans out (each appears exactly once)", seen.length === new Set(seen).size);
  check("M6 blocked pair → hidden (SAFE-05)", !by.has(M6));

  console.log(failures === 0 ? "\nPASS — mutual-centric read: open mutuals visible, no fan-out, block hidden." : `\nFAIL — ${failures} assertion(s).`);
} catch (err) {
  console.error("ERROR:", err.message);
  failures++;
} finally {
  for (const id of mutuals) await pool.query(`delete from click_proposals where mutual_click_id=$1::uuid`, [id]).catch(() => {});
  for (const id of mutuals) await pool.query(`delete from mutual_clicks where id=$1::uuid`, [id]).catch(() => {});
  for (const id of profiles) await pool.query(`delete from user_blocks where blocker_profile_id=$1::uuid or blocked_profile_id=$1::uuid`, [id]).catch(() => {});
  for (const id of events) await pool.query(`delete from events where id=$1::uuid`, [id]).catch(() => {});
  for (const id of profiles) await pool.query(`delete from profiles where id=$1::uuid`, [id]).catch(() => {});
  await pool.end();
}
process.exit(failures === 0 ? 0 : 1);
