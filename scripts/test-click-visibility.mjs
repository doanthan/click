// Behavioural check for the click mechanic's visibility + eligibility rules,
// against the REAL schema, entirely inside one transaction that is rolled back.
// Nothing is committed, so this is safe to run against the live database - same
// pattern as scripts/test-guest-capacity-and-participants.mjs.
//
//   node scripts/test-click-visibility.mjs
//
// The predicates below mirror the shipped queries in src/lib/event-repository.ts.
// tests/click-mechanic.test.mjs asserts the shipped source still CONTAINS them;
// this script asserts they DO the right thing on real rows. Neither is enough
// alone: production carries no events yet, so nothing else exercises this SQL.

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

const POST_EVENT_CLICK_WINDOW_HOURS = 48;
const POST_EVENT_PROMPT_DELAY_HOURS = 2;

const db = await pool.connect();
try {
  await db.query("begin");

  const mkProfile = async (opts = {}) => {
    const r = await db.query(
      `insert into profiles (email, display_name, age, role, photo_url,
                             default_attend_visibility, social_visible, paused_until,
                             is_banned, suspended_at)
       values ($1,$2,30,'attendee',$3,$4,$5,$6,$7,$8) returning id::text`,
      [
        `cv-${randomUUID()}@test.local`,
        opts.name ?? "Visibility tester",
        opts.photo === null ? null : (opts.photo ?? "https://example.test/p.jpg"),
        opts.attendVisible ?? true,
        opts.socialVisible ?? true,
        opts.pausedUntil ?? null,
        opts.banned ?? false,
        opts.suspendedAt ?? null,
      ],
    );
    return r.rows[0].id;
  };
  const mkEvent = async (endsAt = "now() + interval '10 days'") => {
    const r = await db.query(
      `insert into events (slug, title, description, group_name, host_name, category,
         starts_at, ends_at, location_name, suburb, capacity, status)
       values ($1,'Click visibility','d','g','h','social',
               ${endsAt} - interval '2 hours', ${endsAt},'loc','Sydney',50,'live')
       returning id::text, slug`,
      [`cv-evt-${randomUUID()}`],
    );
    return r.rows[0];
  };
  const mkTxn = async (eventId, profileId) => {
    const r = await db.query(
      `insert into payment_transactions (event_id, profile_id, amount_cents, status)
       values ($1::uuid,$2::uuid,2000,'paid') returning id::text`,
      [eventId, profileId],
    );
    return r.rows[0].id;
  };
  const addAttendee = (eventId, profileId, status = "confirmed", opts = {}) =>
    db.query(
      `insert into event_attendees (event_id, profile_id, status, payment_transaction_id,
                                    visible_to_attendees)
       values ($1::uuid,$2::uuid,$3,$4::uuid,$5)`,
      [eventId, profileId, status, opts.txnId ?? null, opts.visible ?? true],
    );

  // ── A. "Who's going" faces (event cards, signed out included) ────────────────
  console.log("A. the attendee-avatar preview honours the opt-out");
  const avatarPreview = (eventId) =>
    db
      .query(
        `select coalesce(array_agg(preview.photo_url order by preview.joined_at), '{}') as avatars
         from (
           select profile.photo_url, ea.created_at as joined_at
           from event_attendees ea
           join profiles profile on profile.id = ea.profile_id
           where ea.event_id = $1::uuid
             and ea.status = 'confirmed'
             and profile.photo_url is not null
             and profile.default_attend_visibility
             and profile.is_banned = false
             and ea.visible_to_attendees
           order by ea.created_at asc
           limit 3
         ) preview`,
        [eventId],
      )
      .then((r) => r.rows[0].avatars);
  {
    const ev = await mkEvent();
    const shown = await mkProfile({ photo: "https://example.test/shown.jpg" });
    const hiddenByProfile = await mkProfile({
      attendVisible: false,
      photo: "https://example.test/profile-off.jpg",
    });
    const banned = await mkProfile({ banned: true, photo: "https://example.test/banned.jpg" });
    const hiddenByBooking = await mkProfile({ photo: "https://example.test/booking-off.jpg" });
    await addAttendee(ev.id, shown);
    await addAttendee(ev.id, hiddenByProfile);
    await addAttendee(ev.id, banned);
    await addAttendee(ev.id, hiddenByBooking, "confirmed", { visible: false });
    const avatars = await avatarPreview(ev.id);
    check("an ordinary attendee's face is shown", avatars.includes("https://example.test/shown.jpg"));
    check(
      "default_attend_visibility = false takes the face off the card",
      !avatars.includes("https://example.test/profile-off.jpg"),
    );
    check(
      "visible_to_attendees = false on the booking takes the face off the card",
      !avatars.includes("https://example.test/booking-off.jpg"),
    );
    check("a banned account's face is never shown", !avatars.includes("https://example.test/banned.jpg"));
  }

  // ── B. The named "Who's going" list, and its count ───────────────────────────
  console.log("\nB. the named who's-going list hides the opt-out but still counts them");
  {
    const ev = await mkEvent();
    const shown = await mkProfile({ name: "Shown" });
    const hidden = await mkProfile({ name: "Hidden", attendVisible: false });
    await addAttendee(ev.id, shown);
    await addAttendee(ev.id, hidden);
    const named = await db.query(
      `select profile.display_name
         from event_attendees attendee
         join events event on event.id = attendee.event_id
         join profiles profile on profile.id = attendee.profile_id
        where event.slug = $1
          and attendee.status = 'confirmed'
          and profile.is_banned = false
          and profile.suspended_at is null
          and profile.default_attend_visibility`,
      [ev.slug],
    );
    const names = named.rows.map((r) => r.display_name);
    check("an ordinary attendee is named", names.includes("Shown"));
    check("someone who opted out is not named", !names.includes("Hidden"));
    const count = await db.query(
      `select count(*)::int as n from event_attendees attendee
         join events event on event.id = attendee.event_id
        where event.slug = $1 and attendee.status = 'confirmed'`,
      [ev.slug],
    );
    check("the headline count still counts them (it identifies nobody)", count.rows[0].n === 2);
  }

  // ── C. Post-event send eligibility: public clock vs private roster ───────────
  console.log("\nC. the post-event send splits the public clock from the private roster");
  const windowQuery = (slug) =>
    db.query(
      `select e.id::text, coalesce(e.ends_at, e.starts_at)::text as event_end
         from events e
        where e.slug = $1
          and coalesce(e.ends_at, e.starts_at) <= now()
          and coalesce(e.ends_at, e.starts_at) + interval '${POST_EVENT_CLICK_WINDOW_HOURS} hours' > now()
        order by coalesce(e.ends_at, e.starts_at) desc
        limit 1`,
      [slug],
    );
  const pairQuery = (eventId, senderId, receiverId) =>
    db.query(
      `select true as ok
         from event_participants_v a1
         join event_participants_v a2
           on a2.event_id = a1.event_id and a2.profile_id = $3::uuid
        where a1.event_id = $1::uuid and a1.profile_id = $2::uuid
        limit 1`,
      [eventId, senderId, receiverId],
    );
  {
    const live = await mkEvent("now() - interval '3 hours'");
    const closed = await mkEvent("now() - interval '9 days'");
    const future = await mkEvent("now() + interval '3 days'");
    check("an event inside its 48h window answers the clock", (await windowQuery(live.slug)).rowCount === 1);
    check("a long-finished event does not", (await windowQuery(closed.slug)).rowCount === 0);
    check("an event that hasn't happened does not", (await windowQuery(future.slug)).rowCount === 0);
    check("an unknown slug does not", (await windowQuery("cv-nope")).rowCount === 0);

    const sender = await mkProfile();
    const wasThere = await mkProfile();
    const wasNotThere = await mkProfile();
    await addAttendee(live.id, sender);
    await addAttendee(live.id, wasThere);
    check("both there → eligible", (await pairQuery(live.id, sender, wasThere)).rowCount === 1);
    check(
      "receiver wasn't there → not eligible (same refusal as everything else)",
      (await pairQuery(live.id, sender, wasNotThere)).rowCount === 0,
    );
    check(
      "sender wasn't there → not eligible",
      (await pairQuery(live.id, wasNotThere, wasThere)).rowCount === 0,
    );
  }

  // ── D. A claimed guest +1 is a real participant, both ways ───────────────────
  console.log("\nD. a claimed guest +1 counts as being there, and as holding a seat");
  {
    const ev = await mkEvent("now() - interval '3 hours'");
    const buyer = await mkProfile();
    const guest = await mkProfile();
    const txn = await mkTxn(ev.id, buyer);
    await addAttendee(ev.id, buyer, "confirmed", { txnId: txn });
    await db.query(
      `insert into guest_spots (payment_transaction_id, event_id, purchaser_profile_id,
                                claimed_profile_id, status)
       values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,'claimed')`,
      [txn, ev.id, buyer, guest],
    );
    check("the guest can click the buyer", (await pairQuery(ev.id, guest, buyer)).rowCount === 1);
    check("the buyer can click the guest", (await pairQuery(ev.id, buyer, guest)).rowCount === 1);

    // The seat flags getProposalsForSession renders the drawer from. The old query
    // asked event_attendees, where a claimed guest has no row of their own.
    const seats = await db.query(
      `select
         exists (select 1 from event_participants_v pv
                  where pv.event_id = $1::uuid and pv.profile_id = $2::uuid) as new_flag,
         exists (select 1 from event_attendees ea
                  where ea.event_id = $1::uuid and ea.profile_id = $2::uuid
                    and ea.status = 'confirmed') as old_flag`,
      [ev.id, guest],
    );
    check("the guest now reports a seat", seats.rows[0].new_flag === true);
    check("...which the old event_attendees flag did not", seats.rows[0].old_flag === false);
  }

  // ── E. The post-event roster only lists people the send path accepts ─────────
  console.log("\nE. the post-event roster never offers someone the send will refuse");
  {
    const ev = await mkEvent("now() - interval '3 hours'");
    const viewer = await mkProfile();
    const ordinary = await mkProfile({ name: "Ordinary" });
    const optedOut = await mkProfile({ name: "OptedOut", attendVisible: false });
    const paused = await mkProfile({ name: "Paused", pausedUntil: new Date(Date.now() + 864e5) });
    const antisocial = await mkProfile({ name: "Antisocial", socialVisible: false });
    const banned = await mkProfile({ name: "Banned", banned: true });
    for (const p of [viewer, ordinary, optedOut, paused, antisocial, banned]) {
      await addAttendee(ev.id, p);
    }
    const roster = await db.query(
      `select other.display_name
         from events e
         join event_participants_v mine on mine.event_id = e.id and mine.profile_id = $1::uuid
         join event_participants_v theirs on theirs.event_id = e.id and theirs.profile_id <> $1::uuid
         join profiles other on other.id = theirs.profile_id
           and other.role = 'attendee' and other.suspended_at is null and other.is_banned = false
           and other.social_visible = true
           and (other.paused_until is null or other.paused_until <= now())
           and other.default_attend_visibility
        where e.id = $2::uuid
          and coalesce(e.ends_at, e.starts_at) + interval '${POST_EVENT_PROMPT_DELAY_HOURS} hours' <= now()
          and coalesce(e.ends_at, e.starts_at) + interval '${POST_EVENT_CLICK_WINDOW_HOURS} hours' > now()
          and not exists (
            select 1 from user_blocks b
            where (b.blocker_profile_id = $1::uuid and b.blocked_profile_id = other.id)
               or (b.blocker_profile_id = other.id and b.blocked_profile_id = $1::uuid)
          )`,
      [viewer, ev.id],
    );
    const names = roster.rows.map((r) => r.display_name);
    check("an ordinary co-attendee is offered", names.includes("Ordinary"));
    check("someone hidden from attendee lists is not", !names.includes("OptedOut"));
    check("someone paused is not", !names.includes("Paused"));
    check("someone out of the social graph is not", !names.includes("Antisocial"));
    check("someone banned is not", !names.includes("Banned"));
    check("the viewer is never on their own roster", !names.includes(undefined) && roster.rowCount === 1);
  }

  // ── F. The public profile projection ─────────────────────────────────────────
  console.log("\nF. a banned or suspended profile is not publicly readable");
  {
    const ordinary = await mkProfile();
    const banned = await mkProfile({ banned: true });
    const suspended = await mkProfile({ suspendedAt: new Date() });
    const publicRead = (id) =>
      db.query(
        `select id::text from profiles
          where id = $1::uuid and is_banned = false and suspended_at is null`,
        [id],
      );
    check("an ordinary profile still renders", (await publicRead(ordinary)).rowCount === 1);
    check("a banned profile 404s", (await publicRead(banned)).rowCount === 0);
    check("a suspended profile 404s", (await publicRead(suspended)).rowCount === 0);
  }
} finally {
  await db.query("rollback");
  db.release();
  await pool.end();
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
