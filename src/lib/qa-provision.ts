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

async function upsertPersona(
  client: { query: (text: string, values?: unknown[]) => Promise<unknown> },
  persona: QaPersona,
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
    on conflict (email) do update set
      role = excluded.role,
      display_name = excluded.display_name,
      suburb = excluded.suburb,
      birth_date = excluded.birth_date,
      -- Derived, never carried over: profiles.age is a plain column, so a
      -- persona seeded before a birthday would sit a year stale forever, and
      -- the click layer's independent 18+ gate reads age, not birth_date.
      age = excluded.age,
      -- The ONE field a re-provision does not stamp back. Uploading an avatar
      -- is itself something you test, and this runs on every persona switch -
      -- overwriting it would silently undo the thing you just did. The seeded
      -- face is only there because the discovery pool refuses a photoless
      -- profile; once a real one exists the seed has no more work to do.
      -- "Reset all test data" still restores the seeded face, by deleting the row.
      photo_url = case
        when profiles.photo_url is null or profiles.photo_url = ''
        then excluded.photo_url
        else profiles.photo_url
      end,
      updated_at = now()
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

  const merchant = persona.merchant;
  if (!merchant) return;

  await client.query(
    `
    insert into merchant_profiles (
      profile_id, business_name, contact_email, verification_status,
      stripe_connect_account_id, charges_enabled, payouts_enabled,
      details_submitted, onboarding_completed_at, auto_approve_events
    )
    select p.id, $2, p.email, $3, $4, $5::boolean, $6::boolean, $5::boolean,
           case when $5::boolean then now() else null end, $7::boolean
    from profiles p where p.email = $1::citext
    on conflict (profile_id) do update set
      business_name = excluded.business_name,
      verification_status = excluded.verification_status,
      stripe_connect_account_id = excluded.stripe_connect_account_id,
      charges_enabled = excluded.charges_enabled,
      payouts_enabled = excluded.payouts_enabled,
      details_submitted = excluded.details_submitted,
      onboarding_completed_at = excluded.onboarding_completed_at,
      auto_approve_events = excluded.auto_approve_events,
      updated_at = now()
    `,
    [
      persona.email,
      merchant.businessName,
      merchant.verificationStatus,
      merchant.stripeAccountId,
      merchant.chargesEnabled,
      merchant.payoutsEnabled,
      merchant.verificationStatus === "approved",
    ],
  );
}

/**
 * Prepare `email`'s persona, plus the host personas and their two events so
 * there is always something to book. Throws if a PROFILE write fails - a QA
 * tool that quietly signs you in as the wrong thing is worse than one that
 * errors. The two seed events are best-effort by comparison: each is wrapped in
 * its own savepoint and a failure there is warn-logged, not raised.
 */
export async function provisionQaPersona(email: string): Promise<void> {
  const target = findQaPersona(email);
  if (!target) return;

  const pool = getPostgresPool();
  // Local runs against the JSON store have no database to provision.
  if (!pool) return;

  const client = await pool.connect();
  try {
    await client.query("begin");

    if (target.suburb === null) {
      // A "start from nothing" persona. Deleting the row is what makes the
      // sign-up journey re-runnable: ensureProfileForSession recreates it bare
      // on the next page load, so /post-login sends you to /onboarding with an
      // empty form every single time.
      // The `like` is redundant given findQaPersona already vetted the address,
      // and it stays anyway: the blast radius should be enforced by the
      // statement, not by remembering to call the right lookup first.
      await client.query(
        `delete from profiles where email = $1::citext and email like '%@click.local'`,
        [target.email],
      );
    } else {
      await upsertPersona(client, target);
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
      await upsertPersona(client, other);
    }

    for (const event of QA_EVENTS) {
      // Each seed event gets its own savepoint: the personas are the point of
      // this tool, the demo catalogue is garnish, and a host persona that
      // created its own event over this slot by hand legitimately trips the
      // overlap guard below. Losing a seed event must not take the whole
      // persona switch down with it.
      await client.query("savepoint qa_seed_event");
      try {
        // Re-date first, and INSERT only when nothing owns the slug. This can
        // NOT be an INSERT that upserts on the slug conflict, because the
        // prevent_merchant_event_overlap trigger is BEFORE INSERT, so it runs
        // before the conflict is resolved, and `new.id` is a freshly defaulted
        // uuid - so it sees the row already sitting on this slug as a DIFFERENT
        // event of the same merchant covering the same two hours and raises
        // "merchant has an overlapping live event". That made the first persona
        // switch after a reset work and every switch after it fail. The UPDATE
        // fires the same trigger with the row's real id, which the guard's
        // `existing.id <> new.id` correctly excludes.
        const redated = await client.query(
          `
          update events set
            title = $2,
            status = 'live'::event_status,
            starts_at = now() + ($3::text || ' days')::interval,
            ends_at = now() + ($3::text || ' days')::interval + interval '2 hours',
            price_cents = $4::integer,
            capacity = $5::integer,
            updated_at = now()
          where slug = $1
          `,
          [event.slug, event.title, String(event.daysFromNow), event.priceCents, event.capacity],
        );

        if (redated.rowCount === 0) {
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

        if (event.attendeeEmails.length > 0) {
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
            [event.slug, event.attendeeEmails],
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
