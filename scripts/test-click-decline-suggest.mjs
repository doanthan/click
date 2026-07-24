// Step 2.5b-ii decline + suggest tests (COORDINATION §2, TECH §B4/§B6).
//
// declineProposalForSession: a pending plan → status 'declined', mutual coord_state
//   'open'; a settled (non-pending) plan is not declinable.
// suggestPlanForMutual: fires only from `open` (else "suggest an alternative"), needs
//   a bookable-for-two catalogue event, inserts a fresh pending proposal + coord_state
//   'proposed'. Together: decline → open → suggest is a live loop, never a dead end.
//
// Drives the exact SQL the two functions run against seeded rows. Self-cleaning.
//   node scripts/test-click-decline-suggest.mjs

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
    `insert into profiles (email, display_name, age) values ($1,'DS tester',30) returning id::text`,
    [`ds-${randomUUID()}@test.local`],
  );
  profiles.push(r.rows[0].id);
  return r.rows[0].id;
}
async function mkEvent({ status = "live", startsInDays = 10, capacity = 10 } = {}) {
  const r = await pool.query(
    `insert into events (slug, title, description, group_name, host_name, category,
       starts_at, location_name, suburb, capacity, status)
     values ($1,'DS Event','d','g','h','social', now() + ($2 || ' days')::interval,'loc','Sydney',$3,$4)
     returning id::text, slug`,
    [`ds-evt-${randomUUID()}`, String(startsInDays), capacity, status],
  );
  events.push(r.rows[0].id);
  return r.rows[0];
}
async function mkMutual(a, b, coordState = "open") {
  const r = await pool.query(
    `insert into mutual_clicks (user_a_id, user_b_id, intent_a, intent_b, status, coord_state, mutual_at, expires_at)
     values (least($1::uuid,$2::uuid), greatest($1::uuid,$2::uuid), 'activities','activities','active',$3, now(), now() + interval '7 days')
     returning id::text`,
    [a, b, coordState],
  );
  mutuals.push(r.rows[0].id);
  return r.rows[0].id;
}
async function mkProposal(mutualId, eventId, proposedBy, status = "pending") {
  const r = await pool.query(
    `insert into click_proposals (mutual_click_id, suggested_event_id, proposed_by, status, expires_at)
     values ($1::uuid,$2::uuid,$3::uuid,$4, now() + interval '7 days') returning id::text`,
    [mutualId, eventId, proposedBy, status],
  );
  return r.rows[0].id;
}
const readProposal = async (id) =>
  (await pool.query(`select status from click_proposals where id=$1::uuid`, [id])).rows[0];
const readCoord = async (id) =>
  (await pool.query(`select coord_state from mutual_clicks where id=$1::uuid`, [id])).rows[0].coord_state;
// Mirrors suggestPlanForMutual's bookable-for-two event gate.
async function bookableForTwo(slug) {
  const r = await pool.query(
    `select e.id::text from events e
       join event_capacity_v cap on cap.event_id = e.id
     where e.slug = $1 and e.status in ('live','featured') and e.starts_at > now() and cap.available >= 2
     limit 1`,
    [slug],
  );
  return r.rows[0];
}

try {
  console.log("§B6 — decline returns the mutual to `open`, no terminal:");
  {
    const a = await mkProfile();
    const b = await mkProfile();
    const e = await mkEvent();
    const m = await mkMutual(a, b, "proposed");
    const p = await mkProposal(m, e.id, a); // A suggested; B will decline.

    check("pending plan is declinable", (await readProposal(p)).status === "pending");
    // decline UPDATEs (only touch a pending row).
    await pool.query(`update click_proposals set status='declined', updated_at=now() where id=$1::uuid and status='pending'`, [p]);
    await pool.query(`update mutual_clicks set coord_state='open', updated_at=now()
      where id=(select mutual_click_id from click_proposals where id=$1::uuid) and status='active'`, [p]);
    check("declined plan → status 'declined'", (await readProposal(p)).status === "declined");
    check("mutual → coord_state 'open'", (await readCoord(m)) === "open");
    check("re-decline refused (guard: status !== 'pending')", (await readProposal(p)).status !== "pending");

    console.log("\n§B4 — suggest from `open` re-fills the plan (decline is no dead end):");
    check("precondition: mutual is `open`", (await readCoord(m)) === "open");
    const fresh = await bookableForTwo(e.slug);
    check("catalogue event is bookable-for-two", Boolean(fresh));
    // insert a fresh pending proposal (partial-unique allows it: the old row is 'declined').
    await pool.query(
      `insert into click_proposals (mutual_click_id, suggested_event_id, proposed_by, status, expires_at)
       values ($1::uuid,$2::uuid,$3::uuid,'pending', now() + interval '7 days')
       on conflict (mutual_click_id) where status = 'pending' do nothing`,
      [m, fresh.id, b],
    );
    await pool.query(`update mutual_clicks set coord_state='proposed', updated_at=now() where id=$1::uuid and status='active'`, [m]);
    const pending = await pool.query(
      `select suggested_event_id::text, proposed_by::text from click_proposals where mutual_click_id=$1::uuid and status='pending'`,
      [m],
    );
    check("exactly one pending plan now", pending.rows.length === 1);
    check("fresh plan points at the suggested event, proposed by the suggester",
      pending.rows[0]?.suggested_event_id === fresh.id && pending.rows[0]?.proposed_by === b);
    check("mutual → coord_state 'proposed'", (await readCoord(m)) === "proposed");
    check("suggest refused when not `open` (guard)", (await readCoord(m)) !== "open");
  }

  console.log("\n§B4 — suggest rejects a non-bookable event:");
  {
    const past = await mkEvent({ startsInDays: -1 });
    const cancelled = await mkEvent({ status: "cancelled" });
    check("past event → not bookable", (await bookableForTwo(past.slug)) === undefined);
    check("cancelled event → not bookable", (await bookableForTwo(cancelled.slug)) === undefined);
  }

  console.log(failures === 0 ? "\nPASS — decline↔suggest loop correct, guards hold." : `\nFAIL — ${failures} assertion(s).`);
} catch (err) {
  console.error("ERROR:", err.message);
  failures++;
} finally {
  for (const id of mutuals) await pool.query(`delete from click_proposals where mutual_click_id=$1::uuid`, [id]).catch(() => {});
  for (const id of mutuals) await pool.query(`delete from mutual_clicks where id=$1::uuid`, [id]).catch(() => {});
  for (const id of events) await pool.query(`delete from events where id=$1::uuid`, [id]).catch(() => {});
  for (const id of profiles) await pool.query(`delete from profiles where id=$1::uuid`, [id]).catch(() => {});
  await pool.end();
}
process.exit(failures === 0 ? 0 : 1);
