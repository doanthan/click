// Step 2.3 capacity test (CAP-1 / CAP-2 / CAP-3 / CAP-4 / CAP-5).
//
// Exercises the REAL event_capacity_v view (migration 050) and the gate predicates the
// click suggestion/proposal sites now use, asserting:
//   • the view nets confirmed RSVPs + LIVE payment holds + paid guest +1s, and ignores
//     EXPIRED holds and cancelled guests (CAP-2/3 — the canonical seat count);
//   • generation/propose gate `status in ('live','featured') and available >= 2` (the
//     two-seat rule, CAP-1) excludes a one-free-seat event and waitlist/full events (CAP-4);
//   • the DISPLAY gate `available >= 1` keeps a one-seat (mid-progress) plan visible;
//   • the confirm sold-out predicate `available < 1` fires only when truly full (CAP-5).
//
// Drives the same SQL the repository uses, against real rows. Self-cleaning.
//   node scripts/test-click-capacity.mjs

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
const events = [];
const profiles = [];
function check(label, cond) {
  if (cond) console.log(`  ok   — ${label}`);
  else { failures++; console.error(`  FAIL — ${label}`); }
}

async function mkProfile() {
  const r = await pool.query(
    `insert into profiles (email, display_name, age) values ($1,$2,30) returning id::text`,
    [`cap-${randomUUID()}@test.local`, "Cap tester"],
  );
  profiles.push(r.rows[0].id);
  return r.rows[0].id;
}
async function mkEvent(capacity, status = "live") {
  const slug = `cap-evt-${randomUUID()}`;
  const r = await pool.query(
    `insert into events (slug, title, description, group_name, host_name, category,
       starts_at, location_name, suburb, capacity, status)
     values ($1,'Cap Event','d','g','h','social', now() + interval '10 days','loc','Sydney',$2,$3)
     returning id::text`,
    [slug, capacity, status],
  );
  events.push(r.rows[0].id);
  return r.rows[0].id;
}
async function addAttendee(eventId, status, holdHours = null, paymentTxId = null) {
  const pid = await mkProfile();
  const hold = holdHours == null ? null : new Date(Date.now() + holdHours * 3600_000).toISOString();
  await pool.query(
    `insert into event_attendees (event_id, profile_id, status, hold_expires_at, payment_transaction_id)
     values ($1::uuid,$2::uuid,$3,$4::timestamptz,$5::uuid)`,
    [eventId, pid, status, hold, paymentTxId],
  );
  return pid;
}
async function addPaymentTx(eventId, profileId) {
  const r = await pool.query(
    `insert into payment_transactions (event_id, profile_id, amount_cents, status)
     values ($1::uuid,$2::uuid,2000,'paid') returning id::text`,
    [eventId, profileId],
  );
  return r.rows[0].id;
}
async function addGuestSpot(eventId, purchaserId, paymentTxId, status = "claimed") {
  const r = await pool.query(
    `insert into guest_spots (event_id, purchaser_profile_id, payment_transaction_id, status)
     values ($1::uuid,$2::uuid,$3::uuid,$4) returning id::text`,
    [eventId, purchaserId, paymentTxId, status],
  );
  return r.rows[0].id;
}
async function cap(eventId) {
  const r = await pool.query(
    `select capacity, seats_taken, available from event_capacity_v where event_id = $1::uuid`,
    [eventId],
  );
  return r.rows[0];
}
// Mirrors the repointed gate predicates exactly.
async function passesGate(eventId, minAvail) {
  const r = await pool.query(
    `select exists (
       select 1 from events e join event_capacity_v c on c.event_id = e.id
       where e.id = $1::uuid and e.status in ('live','featured') and c.available >= $2
     ) as ok`,
    [eventId, minAvail],
  );
  return r.rows[0].ok;
}

try {
  console.log("event_capacity_v seat counting:");
  {
    const e = await mkEvent(2);
    check("empty cap-2 → available 2", (await cap(e)).available === 2);
    await addAttendee(e, "confirmed");
    check("+1 confirmed → available 1", (await cap(e)).available === 1);
    await addAttendee(e, "confirmed");
    let c = await cap(e);
    check("+1 confirmed → available 0 (full)", c.available === 0 && c.seats_taken === 2);
  }
  {
    const e = await mkEvent(2);
    await addAttendee(e, "pending_payment", -1); // expired hold
    check("expired hold does NOT count → available 2", (await cap(e)).available === 2);
    await addAttendee(e, "pending_payment", +1); // live hold
    check("live hold counts → available 1", (await cap(e)).available === 1);
  }
  {
    const e = await mkEvent(3);
    const buyer = await mkProfile();
    const tx = await addPaymentTx(e, buyer);
    await pool.query(
      `insert into event_attendees (event_id, profile_id, status, payment_transaction_id)
       values ($1::uuid,$2::uuid,'confirmed',$3::uuid)`,
      [e, buyer, tx],
    );
    const gs = await addGuestSpot(e, buyer, tx, "claimed");
    check("buyer + paid guest +1 → seats_taken 2, available 1", (await cap(e)).available === 1);
    await pool.query(`update guest_spots set status='cancelled' where id=$1::uuid`, [gs]);
    check("cancelled guest frees seat → available 2", (await cap(e)).available === 2);
  }

  console.log("\nLive waitlist offer counts as a taken seat (CAP-6 arm 3):");
  {
    const e = await mkEvent(2);
    await addAttendee(e, "confirmed"); // 1 confirmed → available 1
    check("before offer → available 1", (await cap(e)).available === 1);
    // The last seat is freed + re-offered to the next waitlister for 30 min.
    const wl = await mkProfile();
    await pool.query(
      `insert into event_attendees (event_id, profile_id, status) values ($1::uuid,$2::uuid,'waitlisted')`,
      [e, wl],
    );
    await pool.query(
      `insert into event_waitlists (event_id, profile_id, offered_until, accepted_at)
       values ($1::uuid,$2::uuid, now() + interval '20 minutes', null)`,
      [e, wl],
    );
    check("live waitlist offer reserves the seat → available 0", (await cap(e)).available === 0);
    // Offer lapses → seat frees again.
    await pool.query(
      `update event_waitlists set offered_until = now() - interval '1 minute' where event_id=$1::uuid and profile_id=$2::uuid`,
      [e, wl],
    );
    check("expired offer frees the seat → available 1", (await cap(e)).available === 1);
  }

  console.log("\nGate predicates (CAP-1 two-seat, CAP-4 status):");
  {
    const two = await mkEvent(2); // available 2
    const one = await mkEvent(2); await addAttendee(one, "confirmed"); // available 1
    const full = await mkEvent(2); await addAttendee(full, "confirmed"); await addAttendee(full, "confirmed"); // 0
    const wl = await mkEvent(5, "waitlist"); // available 5 but status excluded

    check("generation/propose gate (>=2): 2-seat event PASSES", (await passesGate(two, 2)) === true);
    check("generation/propose gate (>=2): 1-seat event EXCLUDED (CAP-1)", (await passesGate(one, 2)) === false);
    check("generation/propose gate (>=2): full event EXCLUDED", (await passesGate(full, 2)) === false);
    check("CAP-4: waitlist event EXCLUDED despite free seats", (await passesGate(wl, 2)) === false);
    check("display gate (>=1): 1-seat plan STAYS visible", (await passesGate(one, 1)) === true);
    check("display gate (>=1): full plan hidden", (await passesGate(full, 1)) === false);
  }

  console.log("\nConfirm sold-out re-check (CAP-5):");
  {
    const full = await mkEvent(2); await addAttendee(full, "confirmed"); await addAttendee(full, "confirmed");
    const ok = await mkEvent(2); // available 2
    const soldOut = async (eventId) => {
      const r = await pool.query(
        `select (c.available < 1) as sold_out from event_capacity_v c where c.event_id = $1::uuid`,
        [eventId],
      );
      return r.rows[0].sold_out;
    };
    check("confirm sees full event as sold_out", (await soldOut(full)) === true);
    check("confirm sees open event as NOT sold_out", (await soldOut(ok)) === false);
  }
} catch (e) {
  failures++;
  console.error(`  ERROR: ${e.message}`);
} finally {
  if (events.length) await pool.query(`delete from events where id = any($1::uuid[])`, [events]);
  if (profiles.length) await pool.query(`delete from profiles where id = any($1::uuid[])`, [profiles]);
  await pool.end();
}

if (failures === 0) {
  console.log("\nPASS — event_capacity_v + all capacity gates correct.");
  process.exit(0);
} else {
  console.error(`\nFAIL — ${failures} assertion(s) failed.`);
  process.exit(1);
}
