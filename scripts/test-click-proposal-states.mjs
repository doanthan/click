// Step 2.5a proposal-state tests (C11 + C12).
//
// C11 (§B4.1 step 7): getProposalsForSession exposes viewer_has_seat / other_has_seat
//   computed against the SAME block-safe upcoming/bookable event join the read uses, so
//   the already-booked side renders "I'm in" / "both going" (never a live RSVP), AND a
//   dead/sold-out event drops the seat flags to false (card falls to the C12 recovery).
// C12 (§B0/§B6): proposeAlternativeForProposal reopens an ACCEPTED proposal only when its
//   agreed event has died (cancelled / past / sold out) - never a still-live agreement -
//   flipping it back to a live pending/proposed plan so a dead event is never a terminal.
//
// Drives the exact SQL added to the repository against seeded rows. Self-cleaning.
//   node scripts/test-click-proposal-states.mjs

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
  if (cond) console.log(`  ok - ${label}`);
  else { failures++; console.error(`  FAIL - ${label}`); }
}

async function mkProfile() {
  const r = await pool.query(
    `insert into profiles (email, display_name, age) values ($1,'PS tester',30) returning id::text`,
    [`ps-${randomUUID()}@test.local`],
  );
  profiles.push(r.rows[0].id);
  return r.rows[0].id;
}
async function mkEvent(capacity, { status = "live", startsInDays = 10 } = {}) {
  const r = await pool.query(
    `insert into events (slug, title, description, group_name, host_name, category,
       starts_at, location_name, suburb, capacity, status)
     values ($1,'PS Event','d','g','h','social', now() + ($2 || ' days')::interval,'loc','Sydney',$3,$4)
     returning id::text`,
    [`ps-evt-${randomUUID()}`, String(startsInDays), capacity, status],
  );
  events.push(r.rows[0].id);
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
async function mkProposal(mutualId, eventId, proposedBy, status = "pending") {
  const r = await pool.query(
    `insert into click_proposals (mutual_click_id, suggested_event_id, proposed_by, status, expires_at)
     values ($1::uuid,$2::uuid,$3::uuid,$4, now() + interval '7 days') returning id::text`,
    [mutualId, eventId, proposedBy, status],
  );
  return r.rows[0].id;
}
async function addConfirmed(eventId, profileId) {
  await pool.query(
    `insert into event_attendees (event_id, profile_id, status) values ($1::uuid,$2::uuid,'confirmed')`,
    [eventId, profileId],
  );
}
// Mirrors getProposalsForSession's block-safe event join + the C11 seat exists().
async function seatFlags(proposalId, viewerId, otherId) {
  const r = await pool.query(
    `
      select
        exists (select 1 from event_attendees ea where ea.event_id = e.id and ea.profile_id = $2::uuid and ea.status='confirmed') as viewer_has_seat,
        exists (select 1 from event_attendees ea where ea.event_id = e.id and ea.profile_id = $3::uuid and ea.status='confirmed') as other_has_seat,
        (e.id is not null) as event_live
      from click_proposals p
      left join events e on e.id = p.suggested_event_id
        and e.starts_at > now() and e.status in ('live','featured')
        and exists (select 1 from event_capacity_v cap where cap.event_id = e.id and cap.available >= 1)
      where p.id = $1::uuid
    `,
    [proposalId, viewerId, otherId],
  );
  return r.rows[0];
}
// Mirrors proposeAlternativeForProposal's C12 "still-live?" reopen guard exactly.
async function stillLive(proposalId) {
  const r = await pool.query(
    `
      select true as ok
      from click_proposals cp
      join events e on e.id = cp.suggested_event_id
      join event_capacity_v cap on cap.event_id = e.id
      where cp.id = $1::uuid
        and e.status in ('live','featured')
        and e.starts_at > now()
        and cap.available >= 1
    `,
    [proposalId],
  );
  return Boolean(r.rows[0]?.ok);
}

try {
  console.log("C11 - seat flags track the block-safe suggested-event join:");
  {
    const a = await mkProfile();
    const b = await mkProfile();
    const e = await mkEvent(10);
    const m = await mkMutual(a, b);
    const p = await mkProposal(m, e, a);

    let f = await seatFlags(p, a, b);
    check("no bookings → neither side has a seat", f.viewer_has_seat === false && f.other_has_seat === false);

    await addConfirmed(e, a);
    f = await seatFlags(p, a, b);
    check("A booked → viewer(A) has seat, other(B) does not", f.viewer_has_seat === true && f.other_has_seat === false);

    await addConfirmed(e, b);
    f = await seatFlags(p, a, b);
    check("both booked → both going", f.viewer_has_seat === true && f.other_has_seat === true);

    // C11 dead-event guard: even a confirmed attendee shows no seat once the event dies,
    // so the card falls to the C12 recovery rather than a stale "RSVP needed".
    await pool.query(`update events set status='cancelled' where id=$1::uuid`, [e]);
    f = await seatFlags(p, a, b);
    check("event cancelled → seat flags false despite confirmed attendance", f.event_live === false && f.viewer_has_seat === false);
  }

  console.log("\nC12 - reopen guard fires only on a DEAD agreed event:");
  {
    const a = await mkProfile();
    const b = await mkProfile();

    const eLive = await mkEvent(10);
    const mLive = await mkMutual(a, b);
    const pLive = await mkProposal(mLive, eLive, a, "accepted");
    check("accepted + live event → still-live guard TRUE (reopen refused)", (await stillLive(pLive)) === true);

    const eDead = await mkEvent(10);
    const mDead = await mkMutual(await mkProfile(), await mkProfile());
    const pDead = await mkProposal(mDead, eDead, a, "accepted");
    await pool.query(`update events set status='cancelled' where id=$1::uuid`, [eDead]);
    check("accepted + cancelled event → guard FALSE (reopen allowed)", (await stillLive(pDead)) === false);

    const ePast = await mkEvent(10, { startsInDays: -1 });
    const mPast = await mkMutual(await mkProfile(), await mkProfile());
    const pPast = await mkProposal(mPast, ePast, a, "accepted");
    check("accepted + past event → guard FALSE (reopen allowed)", (await stillLive(pPast)) === false);

    // The reopen UPDATE itself: flips accepted → pending, clears confirmation, coord_state → proposed.
    await pool.query(
      `update click_proposals set status='accepted', confirmed_by=$2::uuid, confirmed_at=now() where id=$1::uuid`,
      [pDead, a],
    );
    await pool.query(`update mutual_clicks set coord_state='confirmed_together' where id=$1::uuid`, [mDead]);
    await pool.query(
      `update click_proposals set status='pending', confirmed_by=null, confirmed_at=null, updated_at=now() where id=$1::uuid`,
      [pDead],
    );
    await pool.query(`update mutual_clicks set coord_state='proposed' where id=$1::uuid`, [mDead]);
    const reopened = await pool.query(
      `select p.status, p.confirmed_by, m.coord_state
       from click_proposals p join mutual_clicks m on m.id = p.mutual_click_id where p.id=$1::uuid`,
      [pDead],
    );
    const row = reopened.rows[0];
    check("reopen → status pending, confirmed_by null, coord_state proposed",
      row.status === "pending" && row.confirmed_by === null && row.coord_state === "proposed");
  }

  console.log(failures === 0 ? "\nPASS - C11 seat flags + C12 reopen guard correct." : `\nFAIL - ${failures} assertion(s).`);
} catch (err) {
  console.error("ERROR:", err.message);
  failures++;
} finally {
  // FK-safe teardown.
  for (const id of mutuals) await pool.query(`delete from click_proposals where mutual_click_id=$1::uuid`, [id]).catch(() => {});
  for (const id of mutuals) await pool.query(`delete from mutual_clicks where id=$1::uuid`, [id]).catch(() => {});
  for (const id of events) await pool.query(`delete from event_attendees where event_id=$1::uuid`, [id]).catch(() => {});
  for (const id of events) await pool.query(`delete from events where id=$1::uuid`, [id]).catch(() => {});
  for (const id of profiles) await pool.query(`delete from profiles where id=$1::uuid`, [id]).catch(() => {});
  await pool.end();
}
process.exit(failures === 0 ? 0 : 1);
