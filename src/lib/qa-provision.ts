import type { PoolClient } from "pg";
import { isAdminEmail } from "@/auth";
import { getPostgresPool } from "@/lib/postgres";
import { QA_EVENTS, QA_PERSONAS, findQaPersona, type QaPersona } from "@/lib/qa-personas";

// Makes the QA personas real, on demand, right before the switcher signs you in
// as one. There is no seed script to run and no migration to remember: pick a
// persona and the rows it needs exist by the time the session is minted.
//
// Everything here is confined to the @click.local namespace that
// 032_clear_seed_data.sql already sweeps, and every write is idempotent inside
// one transaction - so a re-run changes nothing, and a failed profile write
// leaves the database exactly as it was. (A failed seed-event write rolls back
// to its own savepoint and the rest still commits; see provisionQaPersona.)
//
// Callers are gated by src/lib/test-switcher.ts. Nothing in this file checks
// permissions; it assumes the caller already did.

/**
 * A merchant's Stripe Connect account, lifted off the row before a reset drops
 * it. This is the one thing on merchant_profiles that a persona reset must NOT
 * recreate from the declaration: QA_PERSONAS names no account id (there is no
 * real one to name at seed time), so a human has to walk the paid host through
 * Stripe's hosted onboarding once. That took a real minute, and it is the only
 * way a merchant-hosted paid event can take a card at all - the destination
 * charge needs a genuine `acct_1...` with transfers active.
 *
 * merchant_profiles.profile_id is `on delete cascade` (database/001_schema.sql),
 * so the profile DELETE in deletePersonaData takes the merchant row with it and
 * an ON CONFLICT clause never gets the chance to protect anything. Hence
 * capture-before-delete rather than a clever upsert.
 */
type PreservedConnect = {
  stripeAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingCompletedAt: Date | null;
};

// The SQL half of isRealConnectAccountId (src/lib/stripe-connect.ts). A
// placeholder like `acct_seed_theo` has underscores after the prefix and fails
// it; a real Stripe id doesn't. Keep the two in step.
const REAL_CONNECT_ACCOUNT_SQL = `stripe_connect_account_id ~ '^acct_[A-Za-z0-9]+$'`;

async function captureRealConnect(
  client: PoolClient,
  email: string,
): Promise<PreservedConnect | null> {
  const result = await client.query<{
    stripe_connect_account_id: string;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
    onboarding_completed_at: Date | null;
  }>(
    `
      select merchant.stripe_connect_account_id,
             merchant.charges_enabled,
             merchant.payouts_enabled,
             merchant.details_submitted,
             merchant.onboarding_completed_at
      from merchant_profiles merchant
      join profiles profile on profile.id = merchant.profile_id
      where profile.email = $1::citext
        and merchant.${REAL_CONNECT_ACCOUNT_SQL}
      limit 1
    `,
    [email],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    stripeAccountId: row.stripe_connect_account_id,
    chargesEnabled: row.charges_enabled,
    payoutsEnabled: row.payouts_enabled,
    detailsSubmitted: row.details_submitted,
    onboardingCompletedAt: row.onboarding_completed_at,
  };
}

async function writePersona(
  client: PoolClient,
  persona: QaPersona,
  reset: boolean,
  preservedConnect: PreservedConnect | null = null,
) {
  // This app has TWO admin checks, and they read different sources: the /admin
  // pages gate on isAdminEmail (the ADMIN_EMAILS env var), while the admin
  // repository actions gate on requireAdminProfile (profiles.role). Writing
  // role='admin' here regardless would put the admin persona in a half-state -
  // refused by the console, yet authorized to verify merchants and approve
  // events through the API. So the seeded role follows ADMIN_EMAILS: the
  // persona has admin power exactly when the deployment says that address is
  // an admin, and none at all when it doesn't.
  const role =
    persona.role === "admin" && !isAdminEmail(persona.email) ? "attendee" : persona.role;

  const profileConflict = reset
    ? `on conflict (email) do update set
        role = excluded.role,
        display_name = excluded.display_name,
        suburb = excluded.suburb,
        birth_date = excluded.birth_date,
        age = excluded.age,
        photo_url = case
          when profiles.photo_url is null or profiles.photo_url = ''
          then excluded.photo_url
          else profiles.photo_url
        end,
        updated_at = now()`
    : `on conflict (email) do update set
        role = excluded.role`;

  await client.query(
    `
    insert into profiles (
      auth_subject, role, email, display_name, suburb, city, bio,
      birth_date, age, photo_url,
      connection_intents, email_verified_at
    )
    values ($1, $2::user_role, $3::citext, $4, $5, 'Sydney', $6,
            $7::date, extract(year from age($7::date))::int, $8,
            '{friendship,exploring}'::connection_intent[], now())
    ${profileConflict}
    `,
    [
      `qa:${persona.email.split("@")[0]}`,
      role,
      persona.email,
      persona.displayName,
      persona.suburb,
      `QA persona - ${persona.exercises}`,
      persona.birthDate,
      persona.photoUrl,
    ],
  );

  // Interests + music taste. Real accounts pick these up from onboarding and the
  // profile-edit music picker; a persona goes straight to a finished profile and
  // so had NO user_tags at all - which is why the People Card showed no shared
  // interests and no commonality line beyond "you're both nearby". Matched
  // against the curated `tags` rows by slug, exactly like syncUserTagsOfType in
  // event-repository.ts: an unknown slug is dropped, never minted.
  await client.query(
    `
    insert into user_tags (profile_id, tag_id, source)
    select p.id, tag.id, case tag.tag_type when 'music' then 'music' else 'user' end
    from profiles p
    join tags tag
      on (tag.tag_type = 'interest' and tag.slug = any($2::text[]))
      or (tag.tag_type = 'music' and tag.slug = any($3::text[]))
    where p.email = $1::citext
    on conflict do nothing
    `,
    [persona.email, persona.interests, persona.music],
  );

  const merchant = persona.merchant;
  if (!merchant) return;

  const merchantConflict = reset
    ? `on conflict (profile_id) do update set
        business_name = excluded.business_name,
        verification_status = excluded.verification_status,
        stripe_connect_account_id = excluded.stripe_connect_account_id,
        charges_enabled = excluded.charges_enabled,
        payouts_enabled = excluded.payouts_enabled,
        details_submitted = excluded.details_submitted,
        onboarding_completed_at = excluded.onboarding_completed_at,
        auto_approve_events = excluded.auto_approve_events,
        updated_at = now()`
    : "on conflict (profile_id) do nothing";

  // preservedConnect, when present, is a REAL connected account captured off
  // this row moments ago (see captureRealConnect). It wins over the persona
  // declaration for all five Stripe columns - including the status booleans,
  // because those are Stripe's answer about THAT specific account. Restoring a
  // real account id next to the declaration's charges_enabled=false would leave
  // the host unable to sell until the next account webhook happened to land.
  const connect = preservedConnect ?? {
    stripeAccountId: merchant.stripeAccountId,
    chargesEnabled: merchant.chargesEnabled,
    payoutsEnabled: merchant.payoutsEnabled,
    detailsSubmitted: merchant.detailsSubmitted,
    onboardingCompletedAt: merchant.onboardingComplete ? new Date() : null,
  };

  await client.query(
    `
    insert into merchant_profiles (
      profile_id, business_name, contact_email, verification_status,
      stripe_connect_account_id, charges_enabled, payouts_enabled,
      details_submitted, onboarding_completed_at, auto_approve_events
    )
    select p.id, $2, p.email, $3, $4, $5::boolean, $6::boolean, $7::boolean,
           $8::timestamptz, $9::boolean
    from profiles p where p.email = $1::citext
    ${merchantConflict}
    `,
    [
      persona.email,
      merchant.businessName,
      merchant.verificationStatus,
      connect.stripeAccountId,
      connect.chargesEnabled,
      connect.payoutsEnabled,
      connect.detailsSubmitted,
      connect.onboardingCompletedAt,
      merchant.verificationStatus === "approved",
    ],
  );
}

async function deletePersonaData(client: PoolClient, email: string) {
  // Remove owned rooms before the profile. events.host_profile_id uses SET
  // NULL, which would otherwise leave a test event on Discover with no owner.
  //
  // The three rooms declared in QA_EVENTS are exempt, and the reason is not
  // tidiness. They are the SHARED catalogue - every persona is re-seeded onto
  // them on every switch - and both event_attendees.event_id and clicks.event_id
  // are ON DELETE CASCADE. So "start fresh" on whichever host happens to own a
  // seed room silently took every other tester's seats and clicks with it, real
  // signups included. A persona reset should only drop the rooms that host made
  // by hand during testing; the seed catalogue is re-dated below, not deleted.
  await client.query(
    `
      delete from events
      where slug <> all($2::text[])
      and (
        host_profile_id in (
          select id from profiles where email = $1::citext and email like '%@click.local'
        )
        or merchant_profile_id in (
          select merchant.id
          from merchant_profiles merchant
          join profiles profile on profile.id = merchant.profile_id
          where profile.email = $1::citext and profile.email like '%@click.local'
        )
      )
    `,
    [email, QA_EVENTS.map((event) => event.slug)],
  );
  await client.query(
    `delete from profiles where email = $1::citext and email like '%@click.local'`,
    [email],
  );
}

/**
 * Prepare `email`'s persona, plus the host personas and their two events so
 * there is always something to book. Throws if a PROFILE write fails - a QA
 * tool that quietly signs you in as the wrong thing is worse than one that
 * errors. The two seed events are best-effort by comparison: each is wrapped in
 * its own savepoint and a failure there is warn-logged, not raised.
 */
export async function provisionQaPersona(
  email: string,
  options: { resetTarget?: boolean } = {},
): Promise<void> {
  const target = findQaPersona(email);
  if (!target) return;

  const pool = getPostgresPool();
  // Local runs against the JSON store have no database to provision.
  if (!pool) return;

  const client = await pool.connect();
  try {
    await client.query("begin");

    // Lift the Stripe Connect account off the row BEFORE the delete cascades it
    // away, so "start fresh" doesn't also mean "redo Stripe's hosted onboarding".
    // Nothing else on merchant_profiles survives a reset, and nothing else needs
    // to - this is the only column whose value came from outside the app.
    const preservedConnect = options.resetTarget
      ? await captureRealConnect(client, target.email)
      : null;

    if (options.resetTarget) {
      await deletePersonaData(client, target.email);
    }

    if (target.suburb === null) {
      // A "start from nothing" persona is deleted by the resetTarget branch
      // above. A quick switch deliberately does nothing here: if the tester has
      // since completed onboarding, switching away and back must preserve it.
      // When no profile exists yet, ensureProfileForSession creates the blank
      // row after sign-in and /post-login routes it to onboarding.
    } else {
      await writePersona(client, target, Boolean(options.resetTarget), preservedConnect);
    }

    // Every OTHER persona exists too, whoever you signed in as. The hosts are
    // the obvious case - without them the customer personas open Discover to an
    // empty catalogue - but the customers matter just as much, and for a
    // sharper reason: it takes two people to click, and the discovery pool is
    // built from other profiles. Provision only the persona you picked and the
    // click surface greets the very first tester with an empty state, because
    // there is genuinely nobody else in the database yet. The one exclusion is
    // any persona that is meant to start blank - creating it here would defeat
    // the deletion above.
    for (const other of QA_PERSONAS) {
      if (other.email === target.email || other.suburb === null) continue;
      // A quick switch must not rewrite work belonging to another persona.
      // Insert dependencies only when missing; a fresh scenario resets only
      // its own target above.
      await writePersona(client, other, false);
    }

    for (const event of QA_EVENTS) {
      // Each seed event gets its own savepoint: the personas are the point of
      // this tool, the demo catalogue is garnish, and a host persona that
      // created its own event over this slot by hand legitimately trips the
      // overlap guard below. Losing a seed event must not take the whole
      // persona switch down with it.
      await client.query("savepoint qa_seed_event");
      try {
        // A fresh scenario re-dates the shared catalogue. A quick account
        // switch only checks that each seed room exists, so it does not undo a
        // host's edits or another tester's work.
        //
        // UPDATE first, and INSERT only when nothing owns the slug. This can
        // NOT be an INSERT that upserts on the slug conflict, because the
        // prevent_merchant_event_overlap trigger is BEFORE INSERT, so it runs
        // before the conflict is resolved, and `new.id` is a freshly defaulted
        // uuid - so it sees the row already sitting on this slug as a DIFFERENT
        // event of the same merchant covering the same two hours and raises
        // "merchant has an overlapping live event". That made the first persona
        // switch after a reset work and every switch after it fail. The UPDATE
        // fires the same trigger with the row's real id, which the guard's
        // `existing.id <> new.id` correctly excludes.
        // A past-dated room is the exception, and it is the reason the post-event
        // surface kept going dark. qa-past-pottery-night is the ONLY way Process 2
        // ("who was there") is reachable at all - you cannot RSVP to a room that has
        // already happened - and it is only reachable while it sits inside
        // event_end + POST_EVENT_CLICK_WINDOW_HOURS. Gated on resetTarget alone, it
        // aged out roughly two days after whoever last reset its owner, and every
        // tester after that opened the surface to an empty roster and reported the
        // click mechanic as broken. A negative daysFromNow means the room's whole
        // purpose is to be recently finished, so re-date it on every switch: there is
        // no host edit worth preserving on a room that is useless once it is stale.
        const refreshOwnedSeed =
          event.daysFromNow < 0 ||
          Boolean(options.resetTarget && event.ownerEmail === target.email);
        const existing = refreshOwnedSeed
          ? await client.query(
              `
                with owner as (
                  select p.id as profile_id, m.id as merchant_id,
                         m.business_name, p.display_name
                  from profiles p
                  join merchant_profiles m on m.profile_id = p.id
                  where p.email = $6::citext
                )
                update events set
                  title = $2,
                  status = 'live'::event_status,
                  starts_at = now() + ($3::text || ' days')::interval,
                  ends_at = now() + ($3::text || ' days')::interval + interval '2 hours',
                  price_cents = $4::integer,
                  capacity = $5::integer,
                  -- Converge on the DECLARED owner. The insert below only fires when
                  -- the slug is missing, so a room that changed hands in QA_EVENTS
                  -- kept its old host forever: the declared owner's /merchant console
                  -- showed nothing, and refreshOwnedSeed's ownerEmail test could never
                  -- match whoever actually held the row. coalesce keeps the current
                  -- owner when the declared one has no merchant profile yet, so the
                  -- row count still means "the slug exists" and can never fall through
                  -- to an insert that would collide on it.
                  host_profile_id = coalesce(
                    (select profile_id from owner), host_profile_id),
                  merchant_profile_id = coalesce(
                    (select merchant_id from owner), merchant_profile_id),
                  group_name = coalesce((select business_name from owner), group_name),
                  host_name = coalesce((select display_name from owner), host_name),
                  updated_at = now()
                where slug = $1
              `,
              [
                event.slug,
                event.title,
                String(event.daysFromNow),
                event.priceCents,
                event.capacity,
                event.ownerEmail,
              ],
            )
          : await client.query(`select 1 from events where slug = $1`, [event.slug]);

        const created = existing.rowCount === 0;
        if (created) {
          await client.query(
            `
            insert into events (
              slug, title, description, host_profile_id, merchant_profile_id,
              group_name, host_name, category, status, booking_model,
              starts_at, ends_at, location_name, address, suburb, city,
              price_cents, capacity, relationship_goal
            )
            select
              $1, $2, $3, p.id, m.id,
              m.business_name, p.display_name, $5, 'live'::event_status,
              'click_managed'::booking_model,
              now() + ($6::text || ' days')::interval,
              now() + ($6::text || ' days')::interval + interval '2 hours',
              $7, $7, $8, 'Sydney',
              $9::integer, $10::integer, 'Meet a couple of familiar faces.'
            from profiles p
            join merchant_profiles m on m.profile_id = p.id
            where p.email = $4::citext
            `,
            [
              event.slug,
              event.title,
              event.description,
              event.ownerEmail,
              event.category,
              String(event.daysFromNow),
              event.locationName,
              event.suburb,
              event.priceCents,
              event.capacity,
            ],
          );
        }

        const attendeeEmails = created
          ? event.attendeeEmails
          : options.resetTarget && event.attendeeEmails.includes(target.email)
            ? [target.email]
            : [];

        if (attendeeEmails.length > 0) {
          // Seats on the already-finished event. The post-event click roster
          // (Process 2) is gated on event_participants_v, and no amount of
          // clicking around produces a row there: you cannot RSVP to a room
          // that has already happened. Seeding the attendance is the only way
          // that surface is reachable at all. Idempotent, and the
          // ensure_event_capacity trigger caps it like any other seat.
          await client.query(
            `
            insert into event_attendees (event_id, profile_id, status)
            select e.id, p.id, 'confirmed'::rsvp_status
            from events e
            join profiles p on p.email = any($2::citext[])
            where e.slug = $1
            on conflict (event_id, profile_id) do nothing
            `,
            [event.slug, attendeeEmails],
          );
        }
        await client.query("release savepoint qa_seed_event");
      } catch (error) {
        await client.query("rollback to savepoint qa_seed_event");
        console.warn("[qa] seed event skipped", { slug: event.slug, error });
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete every QA persona and their events, so the sign-up journeys can be
 * walked again from zero. Touches nothing outside @click.local.
 */
export async function resetQaData(): Promise<void> {
  const pool = getPostgresPool();
  if (!pool) return;

  const client = await pool.connect();
  try {
    await client.query("begin");
    // Events first: events.host_profile_id is ON DELETE SET NULL, so dropping
    // the profiles first would strand the QA events as ownerless rows on
    // Discover rather than removing them.
    await client.query(`delete from events where slug = any($1::text[])`, [
      QA_EVENTS.map((event) => event.slug),
    ]);
    // Any event a QA host created by hand during testing goes too.
    await client.query(
      `delete from events where host_profile_id in (
         select id from profiles where email like '%@click.local'
       )`,
    );
    // merchant_profiles cascades off profiles.
    await client.query(`delete from profiles where email like '%@click.local'`);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
