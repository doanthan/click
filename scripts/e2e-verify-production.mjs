// End-to-end verification against the REAL production database, with rows that
// are actually COMMITTED (so triggers fire for real, and the deployed app can
// render them over HTTP). Everything created is tracked and deleted in the
// finally block, including on failure.
//
// Fixtures use @click.local addresses, the same marker 032_clear_seed_data.sql
// uses, so anything ever orphaned is swept by the existing cleanup path.
//
//   node scripts/e2e-verify-production.mjs

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

const BASE = process.env.SMOKE_BASE_URL || "https://www.letsclick.app";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: /supabase\.(co|com)/.test(process.env.DATABASE_URL || "")
    ? { rejectUnauthorized: false }
    : undefined,
});

let failures = 0;
const check = (label, cond, detail = "") => {
  if (cond) console.log(`  ok   - ${label}${detail ? ` ${detail}` : ""}`);
  else {
    failures++;
    console.error(`  FAIL - ${label}${detail ? ` ${detail}` : ""}`);
  }
};

const created = { profiles: [], events: [] };

async function mkProfile(name) {
  const r = await pool.query(
    `insert into profiles (email, display_name, age, suburb, role)
     values ($1,$2,30,'Sydney','attendee') returning id::text`,
    [`e2e-${randomUUID()}@click.local`, name],
  );
  created.profiles.push(r.rows[0].id);
  return r.rows[0].id;
}
async function mkEvent({ capacity, past, slugHint }) {
  const times = past
    ? "now() - interval '6 hours', now() - interval '3 hours'"
    : "now() + interval '10 days', now() + interval '10 days' + interval '3 hours'";
  const r = await pool.query(
    `insert into events (slug, title, description, group_name, host_name, category,
       starts_at, ends_at, location_name, suburb, city, capacity, status, timezone, price_cents)
     values ($1,$2,'End-to-end verification fixture.','Click QA','Click QA','social',
       ${times},'Verification Venue','Sydney','Sydney',$3,'live','Australia/Sydney',0)
     returning id::text, slug`,
    [`e2e-${slugHint}-${randomUUID()}`, `E2E ${slugHint}`, capacity],
  );
  created.events.push(r.rows[0].id);
  return r.rows[0];
}
const addAttendee = (eventId, profileId, status, txnId = null) =>
  pool.query(
    `insert into event_attendees (event_id, profile_id, status, payment_transaction_id)
     values ($1::uuid,$2::uuid,$3,$4::uuid)`,
    [eventId, profileId, status, txnId],
  );
async function mkTxn(eventId, profileId) {
  const r = await pool.query(
    `insert into payment_transactions (event_id, profile_id, amount_cents, status)
     values ($1::uuid,$2::uuid,2000,'paid') returning id::text`,
    [eventId, profileId],
  );
  return r.rows[0].id;
}
const tryIt = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e.code || e.message;
  }
};

try {
  console.log(`Target: ${BASE}\n`);

  // ------------------------------------------------------------------
  console.log("1. Past event - click mechanic roster (the four repointed queries)");
  const past = await mkEvent({ capacity: 5, past: true, slugHint: "past" });
  const alice = await mkProfile("Alice QA");
  const bob = await mkProfile("Bob QA");
  const cara = await mkProfile("Cara QA"); // attends as a claimed guest of Alice
  const aliceTxn = await mkTxn(past.id, alice);
  await addAttendee(past.id, alice, "confirmed", aliceTxn);
  await addAttendee(past.id, bob, "confirmed");
  await pool.query(
    `insert into guest_spots (payment_transaction_id, event_id, purchaser_profile_id,
       status, claimed_profile_id, claimed_at, guest_first_name)
     values ($1::uuid,$2::uuid,$3::uuid,'claimed',$4::uuid, now(), 'Cara')`,
    [aliceTxn, past.id, alice, cara],
  );

  const parts = (
    await pool.query(
      `select profile_id::text as id from event_participants_v where event_id = $1::uuid`,
      [past.id],
    )
  ).rows.map((r) => r.id);
  check("participants view returns all three", parts.length === 3, `(got ${parts.length})`);
  check("claimed guest counts as a participant", parts.includes(cara));

  const roster = async (viewer) =>
    (
      await pool.query(
        `select other.id::text as id
         from events e
         join event_participants_v mine on mine.event_id = e.id and mine.profile_id = $1::uuid
         join event_participants_v theirs on theirs.event_id = e.id and theirs.profile_id <> $1::uuid
         join profiles other on other.id = theirs.profile_id
           and other.role = 'attendee' and other.suspended_at is null and other.is_banned = false
         where e.id = $2::uuid
           and coalesce(e.ends_at, e.starts_at) + interval '2 hours' <= now()
           and coalesce(e.ends_at, e.starts_at) + interval '48 hours' > now()`,
        [viewer, past.id],
      )
    ).rows.map((r) => r.id);
  const caraSees = await roster(cara);
  check("guest sees both ticketed attendees", caraSees.includes(alice) && caraSees.includes(bob));
  check("ticketed attendee sees the guest", (await roster(alice)).includes(cara));

  const eligible = async (a, b) =>
    (
      await pool.query(
        `select 1 from events e
         join event_participants_v a1 on a1.event_id = e.id and a1.profile_id = $1::uuid
         join event_participants_v a2 on a2.event_id = e.id and a2.profile_id = $2::uuid
         where e.slug = $3 and coalesce(e.ends_at, e.starts_at) <= now()
           and coalesce(e.ends_at, e.starts_at) + interval '48 hours' > now() limit 1`,
        [a, b, past.slug],
      )
    ).rows.length > 0;
  check("guest is authorised to click an attendee", await eligible(cara, alice));
  const outsider = await mkProfile("Outsider QA");
  check("a non-participant is still refused", !(await eligible(outsider, alice)));

  // Real click rows, honouring the surface/event constraints.
  const clickErr = await tryIt(() =>
    pool.query(
      `insert into clicks (sender_id, receiver_id, event_id, intent_mode, surface, expires_at)
       values ($1::uuid,$2::uuid,$3::uuid,'friendship','who_was_there',
               coalesce((select ends_at from events where id = $3::uuid), now()) + interval '48 hours')`,
      [cara, alice, past.id],
    ),
  );
  check("a post-event click from the guest inserts", clickErr === null, clickErr ? `(${clickErr})` : "");
  const dupErr = await tryIt(() =>
    pool.query(
      `insert into clicks (sender_id, receiver_id, event_id, intent_mode, surface, expires_at)
       values ($1::uuid,$2::uuid,$3::uuid,'friendship','who_was_there', now() + interval '48 hours')`,
      [cara, alice, past.id],
    ),
  );
  check("uq_click_post_event blocks a duplicate send", dupErr === "23505");
  const selfErr = await tryIt(() =>
    pool.query(
      `insert into clicks (sender_id, receiver_id, event_id, intent_mode, surface, expires_at)
       values ($1::uuid,$1::uuid,$2::uuid,'friendship','who_was_there', now() + interval '48 hours')`,
      [cara, past.id],
    ),
  );
  check("self-click is refused by the check constraint", selfErr === "23514");

  // already_clicked must be scoped to THIS event (the fix shipped earlier today).
  const already = await pool.query(
    `select exists (select 1 from clicks c
       where c.sender_id = $1::uuid and c.receiver_id = $2::uuid and c.event_id = $3::uuid) as hit`,
    [cara, alice, past.id],
  );
  check("already_clicked is true for the event just clicked", already.rows[0].hit === true);

  // ------------------------------------------------------------------
  console.log("\n2. Free RSVP + capacity gate (self-demotion fix)");
  const free = await mkEvent({ capacity: 2, past: false, slugHint: "free" });
  await addAttendee(free.id, alice, "confirmed");
  await addAttendee(free.id, bob, "confirmed");
  const rsvpCount = async (viewer) =>
    (
      await pool.query(
        `select ((select count(*) from event_attendees a
                   where a.event_id = $1::uuid and a.profile_id <> $2::uuid
                     and (a.status = 'confirmed'
                          or (a.status='pending_payment' and a.hold_expires_at > now())))
               + (select count(*) from guest_spots gs
                    join event_attendees ga on ga.payment_transaction_id = gs.payment_transaction_id
                     and ga.profile_id = gs.purchaser_profile_id
                   where gs.event_id = $1::uuid and gs.status <> 'cancelled'
                     and gs.purchaser_profile_id <> $2::uuid
                     and (ga.status='confirmed'
                          or (ga.status='pending_payment' and ga.hold_expires_at > now())))
               )::int as n`,
        [free.id, viewer],
      )
    ).rows[0].n;
  const nSelf = await rsvpCount(alice);
  check("replayed RSVP does not see the caller's own seat", nSelf < 2, `(${nSelf} < 2)`);
  const nNew = await rsvpCount(outsider);
  check("a newcomer still sees the event as full", nNew >= 2, `(${nNew} >= 2)`);
  const stillConfirmed = await pool.query(
    `select status::text from event_attendees where event_id=$1::uuid and profile_id=$2::uuid`,
    [free.id, alice],
  );
  check("existing seat is still 'confirmed'", stillConfirmed.rows[0].status === "confirmed");

  // ------------------------------------------------------------------
  console.log("\n3. Guest capacity trigger, on committed rows");
  const tight = await mkEvent({ capacity: 3, past: false, slugHint: "tight" });
  const buyer = await mkProfile("Buyer QA");
  const buyerTxn = await mkTxn(tight.id, buyer);
  await addAttendee(tight.id, buyer, "confirmed", buyerTxn);
  const okErr = await tryIt(() =>
    pool.query(
      `insert into guest_spots (payment_transaction_id, event_id, purchaser_profile_id, status)
       select $1::uuid,$2::uuid,$3::uuid,'unnamed' from generate_series(1,2)`,
      [buyerTxn, tight.id, buyer],
    ),
  );
  check("a party that exactly fills capacity commits", okErr === null, okErr ? `(${okErr})` : "");
  const overErr = await tryIt(() =>
    pool.query(
      `insert into guest_spots (payment_transaction_id, event_id, purchaser_profile_id, status)
       values ($1::uuid,$2::uuid,$3::uuid,'unnamed')`,
      [buyerTxn, tight.id, buyer],
    ),
  );
  check("one seat past capacity is rejected by the trigger", overErr === "23514", `(${overErr})`);
  const seats = await pool.query(
    `select capacity, seats_taken, available from event_capacity_v where event_id=$1::uuid`,
    [tight.id],
  );
  const s = seats.rows[0];
  check(
    "capacity view agrees the event is exactly full",
    Number(s.seats_taken) === 3 && Number(s.available) === 0,
    `(taken ${s.seats_taken}/${s.capacity}, available ${s.available})`,
  );

  // ------------------------------------------------------------------
  console.log("\n4. The deployed app renders these real rows over HTTP");
  for (const [label, slug, title] of [
    ["past event page", past.slug, "E2E past"],
    ["free event page", free.slug, "E2E free"],
  ]) {
    const res = await fetch(`${BASE}/events/${slug}`, { redirect: "manual" });
    check(`${label} responds 200`, res.status === 200, `(${res.status})`);
    if (res.status === 200) {
      const html = await res.text();
      check(`${label} renders the real row from the database`, html.includes(title));
      // The venue is deliberately withheld until the viewer has RSVP'd, so an
      // anonymous fetch must NOT contain it. Asserting the absence turns this
      // into a live check of that privacy gate.
      check(
        `${label} withholds the venue from a signed-out viewer`,
        !html.includes("Verification Venue"),
      );
    }
  }
  const disc = await fetch(`${BASE}/discover`);
  const discHtml = await disc.text();
  check(
    "/discover now lists a real event instead of the first-run state",
    !discHtml.includes("Just getting started"),
  );
} catch (error) {
  failures++;
  console.error(`\nUNCAUGHT: ${error.message}`);
} finally {
  console.log("\n5. Cleanup");
  try {
    // clicks/guest_spots/event_attendees/payment_transactions all cascade from
    // events and profiles, but delete explicitly so a missing cascade surfaces.
    await pool.query(`delete from clicks where sender_id = any($1::uuid[]) or receiver_id = any($1::uuid[])`, [created.profiles]);
    await pool.query(`delete from guest_spots where event_id = any($1::uuid[])`, [created.events]);
    await pool.query(`delete from event_attendees where event_id = any($1::uuid[])`, [created.events]);
    await pool.query(`delete from payment_transactions where event_id = any($1::uuid[])`, [created.events]);
    await pool.query(`delete from notifications where profile_id = any($1::uuid[])`, [created.profiles]);
    await pool.query(`delete from email_events where to_profile_id = any($1::uuid[])`, [created.profiles]);
    await pool.query(`delete from events where id = any($1::uuid[])`, [created.events]);
    await pool.query(`delete from profiles where id = any($1::uuid[])`, [created.profiles]);
    const leftE = await pool.query(`select count(*)::int n from events where slug like 'e2e-%'`);
    const leftP = await pool.query(`select count(*)::int n from profiles where email like 'e2e-%@click.local'`);
    check("no fixture events remain", leftE.rows[0].n === 0, `(${leftE.rows[0].n})`);
    check("no fixture profiles remain", leftP.rows[0].n === 0, `(${leftP.rows[0].n})`);
  } catch (e) {
    failures++;
    console.error(`  FAIL - cleanup: ${e.message}`);
    console.error(`  events: ${created.events.join(", ")}`);
    console.error(`  profiles: ${created.profiles.join(", ")}`);
  }
  await pool.end();
}

console.log(failures === 0 ? "\nAll end-to-end checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
