// Verifies that a CLAIMED guest +1 reads as a held seat on the booking surfaces,
// against the REAL schema, entirely inside one transaction that is rolled back.
// Nothing is committed, so this is safe to run against the live database.
//
//   node scripts/test-guest-seat-visibility.mjs
//
// The bug this locks down: claimGuestSpotForProfile only stamps
// guest_spots.status='claimed'. The guest never gets an event_attendees row -
// the seat hangs off the PURCHASER's booking - so while viewerRsvpStatus,
// getProfileStatus, the dashboard queries and getConfirmedEvents all read
// event_attendees directly, a guest who claimed a paid +1 was told "Your spot
// is confirmed" and then handed the unregistered event page: venue locked,
// "Reserve & pay" on a seat their friend had already paid for.
//
// Each check runs the OLD query and the NEW one side by side, so a pass proves
// the fix is what changed the answer rather than the fixture being generous.

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
    console.log(`  FAIL - ${label}`);
    failures += 1;
  }
}

// The fragment as it ships in src/lib/event-repository.ts. Kept character-for-
// character so this script exercises the real thing; tests/attendee-ux.test.mjs
// asserts the source still contains it and still routes all six reads through it.
const seatRowsSql = `(
          select ea.event_id, ea.profile_id, ea.status::text as status, 'own' as seat_source
          from event_attendees ea
          union all
          select gs.event_id, gs.claimed_profile_id as profile_id,
                 'confirmed' as status, 'guest' as seat_source
          from guest_spots gs
          join event_attendees purchaser
            on purchaser.payment_transaction_id = gs.payment_transaction_id
           and purchaser.profile_id = gs.purchaser_profile_id
          where gs.status = 'claimed'
            and gs.claimed_profile_id is not null
            and purchaser.status = 'confirmed'
        )`;

const db = await pool.connect();
try {
  await db.query("begin");

  const mkProfile = async (label) => {
    const r = await db.query(
      `insert into profiles (email, display_name, age) values ($1,$2,30) returning id::text, email`,
      [`gsv-${randomUUID()}@test.local`, label],
    );
    return r.rows[0];
  };
  const mkEvent = async (whenSql) => {
    const slug = `gsv-evt-${randomUUID()}`;
    const r = await db.query(
      `insert into events (slug, title, description, group_name, host_name, category,
         starts_at, ends_at, location_name, address, suburb, capacity, status)
       values ($1,'Guest Seat Visibility','d','g','h','social',
         ${whenSql}, ${whenSql} + interval '2 hours','The Venue','1 Test St','Sydney',20,'live')
       returning id::text, slug`,
      [slug],
    );
    return r.rows[0];
  };

  const purchaser = await mkProfile("Purchaser");
  const guest = await mkProfile("Guest plus one");
  const stranger = await mkProfile("Stranger");
  const event = await mkEvent("now() + interval '10 days'");

  const txn = (
    await db.query(
      `insert into payment_transactions (event_id, profile_id, amount_cents, status)
       values ($1::uuid,$2::uuid,4000,'paid') returning id::text`,
      [event.id, purchaser.id],
    )
  ).rows[0].id;

  await db.query(
    `insert into event_attendees (event_id, profile_id, status, payment_transaction_id)
     values ($1::uuid,$2::uuid,'confirmed',$3::uuid)`,
    [event.id, purchaser.id, txn],
  );
  // The +1 the purchaser bought, then claimed by the guest - exactly the row
  // claimGuestSpotForProfile leaves behind, and the only row it leaves behind.
  await db.query(
    `insert into guest_spots (payment_transaction_id, event_id, purchaser_profile_id,
       status, claimed_profile_id, claimed_at, guest_email)
     values ($1::uuid,$2::uuid,$3::uuid,'claimed',$4::uuid, now(), $5)`,
    [txn, event.id, purchaser.id, guest.id, guest.email],
  );

  // ---- A. viewerRsvpStatus: does the event page think the guest has a seat? ----
  console.log("\nA. the event page (viewerRsvpStatus -> venue unlock, RSVP button)");

  const viewerStatus = async (from, email) =>
    (
      await db.query(
        `select attendee.status::text as status
           from ${from} attendee
           join profiles profile on profile.id = attendee.profile_id
           join events event on event.id = attendee.event_id
          where profile.email = $1 and event.slug = $2
          limit 1`,
        [email, event.slug],
      )
    ).rows[0]?.status ?? null;

  check(
    "OLD (event_attendees only): the guest reads as having NO seat - the bug",
    (await viewerStatus("event_attendees", guest.email)) === null,
  );
  check(
    "NEW: the guest reads as 'confirmed', so venueUnlocked is true and no pay button",
    (await viewerStatus(seatRowsSql, guest.email)) === "confirmed",
  );
  check(
    "NEW: the purchaser still reads as 'confirmed' - unchanged",
    (await viewerStatus(seatRowsSql, purchaser.email)) === "confirmed",
  );
  check(
    "NEW: an unrelated member still reads as having no seat",
    (await viewerStatus(seatRowsSql, stranger.email)) === null,
  );

  // ---- B. registeredEventIds: /discover, /dashboard, /people, /bookmarks ----
  console.log("\nB. getProfileStatus.registeredEventIds (the seat-held test 8 surfaces share)");

  const registered = async (from, profileId) =>
    (
      await db.query(
        `select distinct on (event.slug) event.slug, attendee.status::text as status
           from ${from} attendee
           join events event on event.id = attendee.event_id
          where attendee.profile_id = $1::uuid
            and attendee.status in ('confirmed', 'waitlisted')
          order by event.slug, case when attendee.seat_source = 'own' then 0 else 1 end`,
        [profileId],
      )
    ).rows;

  const oldRegistered = (
    await db.query(
      `select event.slug from event_attendees attendee
         join events event on event.id = attendee.event_id
        where attendee.profile_id = $1::uuid and attendee.status in ('confirmed','waitlisted')`,
      [guest.id],
    )
  ).rows;
  check("OLD: guest holds 0 registered events - the RSVP button on their own night", oldRegistered.length === 0);
  check("NEW: guest holds exactly 1 registered event", (await registered(seatRowsSql, guest.id)).length === 1);
  check(
    "NEW: and it is this event, as confirmed",
    (await registered(seatRowsSql, guest.id))[0]?.slug === event.slug,
  );

  // Own seat AND a claimed +1 on the same night must not list the slug twice -
  // /merchant reads attendingCount off registeredEventIds.length.
  await db.query("savepoint dbl");
  await db.query(
    `insert into event_attendees (event_id, profile_id, status) values ($1::uuid,$2::uuid,'confirmed')`,
    [event.id, guest.id],
  );
  const doubled = await registered(seatRowsSql, guest.id);
  check("NEW: holding both an own seat and a claimed +1 lists the event once", doubled.length === 1);
  check("NEW: and the OWN row wins, so the real status is the one shown", doubled[0]?.status === "confirmed");
  await db.query("rollback to savepoint dbl");

  // ---- C. the seat only counts while the purchaser's booking holds ----
  console.log("\nC. liveness: a guest seat dies with the booking it hangs off");

  await db.query("savepoint live");
  await db.query(
    `update event_attendees set status = 'cancelled'
      where event_id = $1::uuid and profile_id = $2::uuid`,
    [event.id, purchaser.id],
  );
  check(
    "purchaser cancels -> the claimed +1 stops counting as a seat",
    (await viewerStatus(seatRowsSql, guest.email)) === null,
  );
  await db.query("rollback to savepoint live");
  check(
    "and it is restored once that is rolled back",
    (await viewerStatus(seatRowsSql, guest.email)) === "confirmed",
  );

  // ---- D. an UNCLAIMED +1 belongs to nobody ----
  console.log("\nD. an unclaimed +1 is not somebody's seat");
  await db.query("savepoint unclaimed");
  await db.query(
    `insert into guest_spots (payment_transaction_id, event_id, purchaser_profile_id, status)
     values ($1::uuid,$2::uuid,$3::uuid,'unnamed')`,
    [txn, event.id, purchaser.id],
  );
  check(
    "an unnamed seat adds nobody to the roster",
    (await registered(seatRowsSql, stranger.id)).length === 0,
  );
  await db.query("rollback to savepoint unclaimed");

  // ---- E. /confirmed-events and the dashboard split it the same way ----
  console.log("\nE. /confirmed-events + /dashboard upcoming");

  const upcoming = async (from, profileId) =>
    (
      await db.query(
        `select event.slug
           from ${from} own_attendee
           join events event on event.id = own_attendee.event_id
          where own_attendee.profile_id = $1::uuid
            and own_attendee.status in ('confirmed','waitlisted')
            and coalesce(event.ends_at, event.starts_at) >= now()
          group by event.id, event.slug`,
        [profileId],
      )
    ).rows;

  check("OLD: guest's upcoming list is empty", (await upcoming("event_attendees", guest.id)).length === 0);
  check("NEW: guest's upcoming list has the night they were given", (await upcoming(seatRowsSql, guest.id)).length === 1);

  // A guest seat is 'confirmed', so it must never appear in the waitlisted bucket.
  const waitlisted = (
    await db.query(
      `select event.slug from ${seatRowsSql} own_attendee
         join events event on event.id = own_attendee.event_id
        where own_attendee.profile_id = $1::uuid and own_attendee.status = 'waitlisted'`,
      [guest.id],
    )
  ).rows;
  check("NEW: and never shows up as waitlisted", waitlisted.length === 0);

  // ---- F. a PAST event still files under past, not upcoming ----
  console.log("\nF. a guest seat on a past night files as past");
  const pastEvent = await mkEvent("now() - interval '10 days'");
  const pastTxn = (
    await db.query(
      `insert into payment_transactions (event_id, profile_id, amount_cents, status)
       values ($1::uuid,$2::uuid,4000,'paid') returning id::text`,
      [pastEvent.id, purchaser.id],
    )
  ).rows[0].id;
  await db.query(
    `insert into event_attendees (event_id, profile_id, status, payment_transaction_id)
     values ($1::uuid,$2::uuid,'confirmed',$3::uuid)`,
    [pastEvent.id, purchaser.id, pastTxn],
  );
  await db.query(
    `insert into guest_spots (payment_transaction_id, event_id, purchaser_profile_id,
       status, claimed_profile_id, claimed_at)
     values ($1::uuid,$2::uuid,$3::uuid,'claimed',$4::uuid, now())`,
    [pastTxn, pastEvent.id, purchaser.id, guest.id],
  );
  const past = (
    await db.query(
      `select event.slug from ${seatRowsSql} own_attendee
         join events event on event.id = own_attendee.event_id
        where own_attendee.profile_id = $1::uuid
          and own_attendee.status = 'confirmed'
          and coalesce(event.ends_at, event.starts_at) < now()
        group by event.id, event.slug`,
      [guest.id],
    )
  ).rows;
  check("the past night appears in the guest's past list", past.length === 1 && past[0].slug === pastEvent.slug);
  check("and the upcoming list still holds only the upcoming one", (await upcoming(seatRowsSql, guest.id)).length === 1);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
} finally {
  await db.query("rollback").catch(() => {});
  db.release();
  await pool.end();
}

process.exit(failures === 0 ? 0 : 1);
