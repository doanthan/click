// Verifies migration 056 (guest-seat capacity trigger + event_participants_v)
// against the REAL schema, entirely inside one transaction that is rolled back.
// Nothing is committed, so this is safe to run against the live database.
//
//   node scripts/test-guest-capacity-and-participants.mjs

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
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const pool = new Pool({
  connectionString,
  max: 1,
  ssl: /supabase\.(co|com)/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
});

let failures = 0;
function check(label, cond) {
  if (cond) console.log(`  ok   - ${label}`);
  else {
    failures++;
    console.error(`  FAIL - ${label}`);
  }
}

const db = await pool.connect();
try {
  await db.query("begin");

  // Apply the migration inside this transaction. Strip its own begin/commit so
  // it cannot end the enclosing transaction we intend to roll back.
  const migration = readFileSync(
    path.join(root, "database/056_guest_capacity_and_participants.sql"),
    "utf8",
  )
    .replace(/^\s*begin\s*;\s*$/gim, "")
    .replace(/^\s*commit\s*;\s*$/gim, "");
  await db.query(migration);
  console.log("migration 056 applied (in-transaction)\n");

  const mkProfile = async () => {
    const r = await db.query(
      `insert into profiles (email, display_name, age) values ($1,$2,30) returning id::text`,
      [`gc-${randomUUID()}@test.local`, "Guest cap tester"],
    );
    return r.rows[0].id;
  };
  const mkEvent = async (capacity) => {
    const r = await db.query(
      `insert into events (slug, title, description, group_name, host_name, category,
         starts_at, location_name, suburb, capacity, status)
       values ($1,'Guest Cap','d','g','h','social', now() + interval '10 days','loc','Sydney',$2,'live')
       returning id::text`,
      [`gc-evt-${randomUUID()}`, capacity],
    );
    return r.rows[0].id;
  };
  const mkTxn = async (eventId, profileId) => {
    const r = await db.query(
      `insert into payment_transactions (event_id, profile_id, amount_cents, status)
       values ($1::uuid,$2::uuid,2000,'paid') returning id::text`,
      [eventId, profileId],
    );
    return r.rows[0].id;
  };
  const addAttendee = async (eventId, profileId, status, txnId = null) =>
    db.query(
      `insert into event_attendees (event_id, profile_id, status, payment_transaction_id)
       values ($1::uuid,$2::uuid,$3,$4::uuid)`,
      [eventId, profileId, status, txnId],
    );
  // Exactly the shape reserveUnnamedGuestSeats uses: one set-based statement.
  const reserveSeats = (eventId, purchaserId, txnId, count, status = "unnamed") =>
    db.query(
      `insert into guest_spots (payment_transaction_id, event_id, purchaser_profile_id, status)
       select $1::uuid, $2::uuid, $3::uuid, $5
       from generate_series(1, $4::int)`,
      [txnId, eventId, purchaserId, count, status],
    );
  const tryIt = async (fn) => {
    await db.query("savepoint sp");
    try {
      await fn();
      await db.query("release savepoint sp");
      return null;
    } catch (e) {
      await db.query("rollback to savepoint sp");
      return e.code || e.message;
    }
  };

  console.log("A. guest-seat capacity trigger");
  {
    // capacity 5: purchaser + 4 guests exactly fills it.
    const ev = await mkEvent(5);
    const buyer = await mkProfile();
    const txn = await mkTxn(ev, buyer);
    await addAttendee(ev, buyer, "confirmed", txn);
    const err = await tryIt(() => reserveSeats(ev, buyer, txn, 4));
    check("a party that exactly fills capacity is allowed", err === null);
  }
  {
    // capacity 5, purchaser + 5 guests = 6 seats. The multi-row insert is the
    // case a BEFORE ROW trigger would have missed entirely.
    const ev = await mkEvent(5);
    const buyer = await mkProfile();
    const txn = await mkTxn(ev, buyer);
    await addAttendee(ev, buyer, "confirmed", txn);
    const err = await tryIt(() => reserveSeats(ev, buyer, txn, 5));
    check("a party that overflows capacity is rejected (23514)", err === "23514");
  }
  {
    // 4 strangers already confirmed on a capacity-5 event leaves 1 seat; the
    // buyer's own seat takes it, so even a single guest overflows.
    const ev = await mkEvent(5);
    for (let i = 0; i < 4; i++) await addAttendee(ev, await mkProfile(), "confirmed");
    const buyer = await mkProfile();
    const txn = await mkTxn(ev, buyer);
    await addAttendee(ev, buyer, "confirmed", txn);
    const err = await tryIt(() => reserveSeats(ev, buyer, txn, 1));
    check("one guest into a full-but-for-the-buyer event is rejected", err === "23514");
  }
  {
    const ev = await mkEvent(2);
    const buyer = await mkProfile();
    const txn = await mkTxn(ev, buyer);
    await addAttendee(ev, buyer, "confirmed", txn);
    const err = await tryIt(() => reserveSeats(ev, buyer, txn, 9, "cancelled"));
    check("cancelled seats never count against capacity", err === null);
  }
  {
    // A guest tied to an EXPIRED hold occupies nothing, so a new party fits.
    const ev = await mkEvent(3);
    const ghost = await mkProfile();
    const gtxn = await mkTxn(ev, ghost);
    await db.query(
      `insert into event_attendees (event_id, profile_id, status, payment_transaction_id, hold_expires_at)
       values ($1::uuid,$2::uuid,'pending_payment',$3::uuid, now() - interval '1 hour')`,
      [ev, ghost, gtxn],
    );
    await db.query(
      `insert into guest_spots (payment_transaction_id, event_id, purchaser_profile_id, status)
       values ($1::uuid,$2::uuid,$3::uuid,'unnamed')`,
      [gtxn, ev, ghost],
    );
    const buyer = await mkProfile();
    const txn = await mkTxn(ev, buyer);
    await addAttendee(ev, buyer, "confirmed", txn);
    const err = await tryIt(() => reserveSeats(ev, buyer, txn, 2));
    check("seats held by an expired hold are reclaimable", err === null);
  }
  {
    // Privacy actions must never be refused by a full event.
    const ev = await mkEvent(2);
    const buyer = await mkProfile();
    const txn = await mkTxn(ev, buyer);
    await addAttendee(ev, buyer, "confirmed", txn);
    await reserveSeats(ev, buyer, txn, 1);
    const err = await tryIt(() =>
      db.query(
        `update guest_spots set status = 'removed', guest_email = '[removed]'
         where event_id = $1::uuid`,
        [ev],
      ),
    );
    check("'remove my details' on a full event is not blocked", err === null);
  }

  console.log("\nB. event_participants_v");
  const participants = async (eventId) => {
    const r = await db.query(
      `select profile_id::text from event_participants_v where event_id = $1::uuid`,
      [eventId],
    );
    return r.rows.map((x) => x.profile_id).sort();
  };
  {
    const ev = await mkEvent(10);
    const buyer = await mkProfile();
    const txn = await mkTxn(ev, buyer);
    await addAttendee(ev, buyer, "confirmed", txn);
    const waitlisted = await mkProfile();
    await addAttendee(ev, waitlisted, "waitlisted");
    const friend = await mkProfile();
    await db.query(
      `insert into guest_spots (payment_transaction_id, event_id, purchaser_profile_id, status, claimed_profile_id, claimed_at)
       values ($1::uuid,$2::uuid,$3::uuid,'claimed',$4::uuid, now())`,
      [txn, ev, buyer, friend],
    );
    await db.query(
      `insert into guest_spots (payment_transaction_id, event_id, purchaser_profile_id, status)
       values ($1::uuid,$2::uuid,$3::uuid,'invited')`,
      [txn, ev, buyer],
    );
    const got = await participants(ev);
    check("confirmed attendee is a participant", got.includes(buyer));
    check("claimed guest is a participant", got.includes(friend));
    check("waitlisted attendee is NOT a participant", !got.includes(waitlisted));
    check("unclaimed 'invited' seat contributes no participant", got.length === 2);
  }
  {
    // Purchaser's booking cancelled -> their guest's claim is no longer live.
    const ev = await mkEvent(10);
    const buyer = await mkProfile();
    const txn = await mkTxn(ev, buyer);
    await addAttendee(ev, buyer, "cancelled", txn);
    const friend = await mkProfile();
    await db.query(
      `insert into guest_spots (payment_transaction_id, event_id, purchaser_profile_id, status, claimed_profile_id, claimed_at)
       values ($1::uuid,$2::uuid,$3::uuid,'claimed',$4::uuid, now())`,
      [txn, ev, buyer, friend],
    );
    const got = await participants(ev);
    check("claimed guest of a cancelled booking is NOT a participant", !got.includes(friend));
  }
  {
    // Someone who both booked their own seat and claimed a guest spot appears once.
    const ev = await mkEvent(10);
    const buyer = await mkProfile();
    const txn = await mkTxn(ev, buyer);
    await addAttendee(ev, buyer, "confirmed", txn);
    const both = await mkProfile();
    await addAttendee(ev, both, "confirmed");
    await db.query(
      `insert into guest_spots (payment_transaction_id, event_id, purchaser_profile_id, status, claimed_profile_id, claimed_at)
       values ($1::uuid,$2::uuid,$3::uuid,'claimed',$4::uuid, now())`,
      [txn, ev, buyer, both],
    );
    const got = await participants(ev);
    check("a double-counted person appears exactly once", got.filter((x) => x === both).length === 1);
  }

  console.log("\nC. capacity view is unaffected by claiming");
  {
    const ev = await mkEvent(10);
    const buyer = await mkProfile();
    const txn = await mkTxn(ev, buyer);
    await addAttendee(ev, buyer, "confirmed", txn);
    await reserveSeats(ev, buyer, txn, 1);
    const before = await db.query(
      `select seats_taken from event_capacity_v where event_id = $1::uuid`,
      [ev],
    );
    const friend = await mkProfile();
    await db.query(
      `update guest_spots set status='claimed', claimed_profile_id=$2::uuid, claimed_at=now()
       where event_id = $1::uuid`,
      [ev, friend],
    );
    const after = await db.query(
      `select seats_taken from event_capacity_v where event_id = $1::uuid`,
      [ev],
    );
    check(
      `claiming a seat does not change seats_taken (${before.rows[0].seats_taken} -> ${after.rows[0].seats_taken})`,
      before.rows[0].seats_taken === after.rows[0].seats_taken,
    );
  }

  console.log("\nD. the four repaired click queries (verbatim SQL from event-repository)");
  {
    // An event that ended 3h ago: inside the +2h..+48h post-event window.
    const r = await db.query(
      `insert into events (slug, title, description, group_name, host_name, category,
         starts_at, ends_at, location_name, suburb, capacity, status, timezone)
       values ($1,'Ended Event','d','g','h','social',
         now() - interval '6 hours', now() - interval '3 hours','loc','Sydney',10,'live','Australia/Sydney')
       returning id::text, slug`,
      [`gc-ended-${randomUUID()}`],
    );
    const ev = r.rows[0].id;
    const slug = r.rows[0].slug;
    const buyer = await mkProfile();
    const txn = await mkTxn(ev, buyer);
    await addAttendee(ev, buyer, "confirmed", txn);
    const friend = await mkProfile();
    await db.query(
      `insert into guest_spots (payment_transaction_id, event_id, purchaser_profile_id, status, claimed_profile_id, claimed_at)
       values ($1::uuid,$2::uuid,$3::uuid,'claimed',$4::uuid, now())`,
      [txn, ev, buyer, friend],
    );

    // 1+2. Roster query (getPostEventClickPrompts / getPostEventClickPromptForEvent).
    const roster = async (viewer) => {
      const q = await db.query(
        `select other.id::text as other_id
         from events e
         join event_participants_v mine on mine.event_id = e.id
           and mine.profile_id = $1::uuid
         join event_participants_v theirs on theirs.event_id = e.id
           and theirs.profile_id <> $1::uuid
         join profiles other on other.id = theirs.profile_id
           and other.role = 'attendee' and other.suspended_at is null and other.is_banned = false
         where e.id = $2::uuid
           and coalesce(e.ends_at, e.starts_at) + interval '2 hours' <= now()
           and coalesce(e.ends_at, e.starts_at) + interval '48 hours' > now()`,
        [viewer, ev],
      );
      return q.rows.map((x) => x.other_id);
    };
    check("purchaser sees the claimed guest on the roster", (await roster(buyer)).includes(friend));
    check("claimed guest sees the purchaser on the roster", (await roster(friend)).includes(buyer));

    // 3. recordClick eligibility gate.
    const eligible = async (a, b) => {
      const q = await db.query(
        `select e.id::text
         from events e
         join event_participants_v a1 on a1.event_id = e.id and a1.profile_id = $1::uuid
         join event_participants_v a2 on a2.event_id = e.id and a2.profile_id = $2::uuid
         where e.slug = $3
           and coalesce(e.ends_at, e.starts_at) <= now()
           and coalesce(e.ends_at, e.starts_at) + interval '48 hours' > now()
         limit 1`,
        [a, b, slug],
      );
      return q.rows.length > 0;
    };
    check("claimed guest may click the purchaser", await eligible(friend, buyer));
    check("purchaser may click the claimed guest", await eligible(buyer, friend));
    const stranger = await mkProfile();
    check("a non-participant is still refused", !(await eligible(stranger, buyer)));

    // 4. notifyPostEventClickPrompts selection.
    const notif = await db.query(
      `select mine.profile_id::text
       from events e
       join event_participants_v mine on mine.event_id = e.id
       where e.id = $1::uuid
         and coalesce(e.ends_at, e.starts_at) + interval '2 hours' <= now()
         and coalesce(e.ends_at, e.starts_at) + interval '48 hours' > now()
         and exists (
           select 1
           from event_participants_v theirs
           join profiles other on other.id = theirs.profile_id
             and other.role = 'attendee' and other.suspended_at is null and other.is_banned = false
           where theirs.event_id = e.id
             and theirs.profile_id <> mine.profile_id
         )`,
      [ev],
    );
    const notified = notif.rows.map((x) => x.profile_id);
    check("cron would prompt the purchaser", notified.includes(buyer));
    check("cron would prompt the claimed guest", notified.includes(friend));
  }

  console.log("\nE. registerForEvent capacity gate (self-demotion + guest blindness)");
  // The exact count expression from registerForEvent, parameterised by viewer.
  const rsvpCount = async (eventId, viewer) => {
    const q = await db.query(
      `select (
         (select count(*) from event_attendees attendee
           where attendee.event_id = $1::uuid
             and attendee.profile_id <> $2::uuid
             and (attendee.status = 'confirmed'
                  or (attendee.status = 'pending_payment' and attendee.hold_expires_at > now())))
         + (select count(*) from guest_spots gs
              join event_attendees ga
                on ga.payment_transaction_id = gs.payment_transaction_id
               and ga.profile_id = gs.purchaser_profile_id
             where gs.event_id = $1::uuid
               and gs.status <> 'cancelled'
               and gs.purchaser_profile_id <> $2::uuid
               and (ga.status = 'confirmed'
                    or (ga.status = 'pending_payment' and ga.hold_expires_at > now())))
         + (select count(*) from event_waitlists w
              join event_attendees wa on wa.event_id = w.event_id
               and wa.profile_id = w.profile_id and wa.status = 'waitlisted'
             where w.event_id = $1::uuid and w.accepted_at is null
               and w.offered_until > now() and w.profile_id <> $2::uuid)
       )::int as n`,
      [eventId, viewer],
    );
    return q.rows[0].n;
  };
  {
    // Capacity 2, both seats confirmed, one of them the caller's. A replayed
    // RSVP must NOT read as full, or the upsert demotes the caller's own seat.
    const ev = await mkEvent(2);
    const me = await mkProfile();
    await addAttendee(ev, me, "confirmed");
    await addAttendee(ev, await mkProfile(), "confirmed");
    const n = await rsvpCount(ev, me);
    check(`replayed RSVP does not count the caller's own seat (${n} < 2)`, n < 2);
  }
  {
    // A genuine newcomer still sees the event as full.
    const ev = await mkEvent(2);
    await addAttendee(ev, await mkProfile(), "confirmed");
    await addAttendee(ev, await mkProfile(), "confirmed");
    const n = await rsvpCount(ev, await mkProfile());
    check(`a newcomer still sees a full event as full (${n} >= 2)`, n >= 2);
  }
  {
    // Capacity 3 filled by 1 attendee + 2 guest seats: previously invisible to
    // this gate, so the event read as open and the waitlist was unreachable.
    const ev = await mkEvent(3);
    const buyer = await mkProfile();
    const txn = await mkTxn(ev, buyer);
    await addAttendee(ev, buyer, "confirmed", txn);
    await reserveSeats(ev, buyer, txn, 2);
    const n = await rsvpCount(ev, await mkProfile());
    check(`an event full of guest seats now reads as full (${n} >= 3)`, n >= 3);
  }
} finally {
  await db.query("rollback").catch(() => {});
  db.release();
  await pool.end();
}

console.log(failures === 0 ? "\nAll checks passed. (rolled back)" : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
