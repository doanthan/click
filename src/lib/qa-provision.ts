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
      connection_intents, email_verified_at
    )
    values ($1, $2::user_role, $3::citext, $4, $5, 'Sydney', $6,
            '{friendship,exploring}'::connection_intent[], now())
    on conflict (email) do update set
      role = excluded.role,
      display_name = excluded.display_name,
      suburb = excluded.suburb,
      updated_at = now()
    `,
    [
      `qa:${persona.email.split("@")[0]}`,
      role,
      persona.email,
      persona.displayName,
      persona.suburb,
      `QA persona - ${persona.exercises}`,
    ],
  );

  const merchant = persona.merchant;
  if (!merchant) return;

  await client.query(
    `
    insert into merchant_profiles (
      profile_id, business_name, contact_email, verification_status,
      stripe_connect_account_id, charges_enabled, payouts_enabled,
      details_submitted, onboarding_completed_at
    )
    select p.id, $2, p.email, $3, $4, $5::boolean, $6::boolean, $5::boolean,
           case when $5::boolean then now() else null end
    from profiles p where p.email = $1::citext
    on conflict (profile_id) do update set
      business_name = excluded.business_name,
      verification_status = excluded.verification_status,
      stripe_connect_account_id = excluded.stripe_connect_account_id,
      charges_enabled = excluded.charges_enabled,
      payouts_enabled = excluded.payouts_enabled,
      details_submitted = excluded.details_submitted,
      onboarding_completed_at = excluded.onboarding_completed_at,
      updated_at = now()
    `,
    [
      persona.email,
      merchant.businessName,
      merchant.verificationStatus,
      merchant.stripeAccountId,
      merchant.chargesEnabled,
      merchant.payoutsEnabled,
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

    // The hosts always exist, whoever you signed in as - otherwise the customer
    // personas open Discover to an empty catalogue.
    for (const host of QA_PERSONAS) {
      if (host.merchant && host.email !== target.email) await upsertPersona(client, host);
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
