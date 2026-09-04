import "server-only";
import { getPostgresPool } from "@/lib/postgres";
import { assertHarnessAllowed, HarnessRefusedError } from "@/lib/click-test-harness";

/**
 * The world the /test-click harness needs, rebuilt relative to NOW.
 *
 * THIS IS THE FIX FOR "the click flow doesn't work any more".
 * The QA fixtures were seeded with absolute timestamps, so they aged out and
 * every surface downstream of them went quiet in a way that reads as a broken
 * mechanic rather than stale data:
 *
 *   * The post-event "who was there" surface is only open from an event's end
 *     until end + 48h. Once the seeded past event drifted past that, EVERY
 *     post-event click was refused with "That event is wrapped up now" - correct
 *     behaviour, impossible to distinguish from a bug.
 *   * `suggestPlanForMutual` needs an upcoming event with room for two, and the
 *     coordination picker additionally wants one at least 48h out. The seed set
 *     had drifted down to a single qualifying event; a day later it would have
 *     had none, and the entire coordination half of the mechanic would have had
 *     nothing to point at.
 *
 * Every timestamp below is an interval from now(), so re-running this is the
 * whole repair and it cannot go stale again.
 *
 * SAFETY: additive and idempotent, and it only ever touches its own `qa-click-*`
 * slugs and `@click.local` profiles. It does not delete, reprice, or re-time any
 * real or demo event, and it writes no payment rows - the paid arm is left to the
 * real Stripe path, which is not something a fixture may fake.
 */

/** Every fixture slug this module owns. Nothing outside this list is written. */
export const FIXTURE_SLUGS = [
  "qa-click-just-ended",
  "qa-click-last-night",
  "qa-click-old-night",
  "qa-click-soon",
  "qa-click-plan-a",
  "qa-click-plan-b",
  "qa-click-full-night",
] as const;

type FixtureSpec = {
  slug: string;
  title: string;
  purpose: string;
  /** SQL interval expression for starts_at, relative to now(). */
  startsIn: string;
  durationHours: number;
  capacity: number;
  suburb: string;
  category: string;
};

const FIXTURES: FixtureSpec[] = [
  {
    slug: "qa-click-just-ended",
    title: "QA - The one that just ended",
    purpose:
      "Ended 30 minutes ago. The SEND window is open the moment an event ends, but the 'did you click with someone?' prompt waits POST_EVENT_PROMPT_DELAY_HOURS = 2 - so this event accepts a post-event click while showing nobody a prompt. Two rules that look like one bug.",
    startsIn: "-1 hours",
    durationHours: 0.5,
    capacity: 12,
    suburb: "Marrickville",
    category: "music",
  },
  {
    slug: "qa-click-last-night",
    title: "QA - Last night's pottery social",
    purpose:
      "Ended 3 hours ago, so the post-event 'who was there' surface is OPEN and past the 2-hour prompt delay.",
    startsIn: "-5 hours",
    durationHours: 2,
    capacity: 12,
    suburb: "Newtown",
    category: "arts",
  },
  {
    slug: "qa-click-old-night",
    title: "QA - The night that closed",
    purpose: "Ended 4 days ago, so its post-event window is SHUT. Every click on it must refuse.",
    startsIn: "-100 hours",
    durationHours: 2,
    capacity: 12,
    suburb: "Redfern",
    category: "arts",
  },
  {
    slug: "qa-click-soon",
    title: "QA - The one that is too soon to suggest",
    purpose:
      "Starts in 24 hours - under SUGGESTION_LEADTIME_FLOOR_HOURS = 48. The floor lives in the picker (getProposalCatalogue), not in suggestPlanForMutual, so this event is absent from the suggestion list and still accepted if a plan names it directly. Manual propose is allowed on purpose.",
    startsIn: "24 hours",
    durationHours: 2,
    capacity: 20,
    suburb: "Glebe",
    category: "music",
  },
  {
    slug: "qa-click-plan-a",
    title: "QA - Plan A: Thursday supper",
    purpose: "5 days out with room for two - the first thing a pair can suggest to each other.",
    startsIn: "5 days",
    durationHours: 3,
    capacity: 20,
    suburb: "Surry Hills",
    category: "food",
  },
  {
    slug: "qa-click-plan-b",
    title: "QA - Plan B: Sunday harbour walk",
    purpose: "9 days out - the counter-proposal target, so 'suggest a different one' has somewhere to go.",
    startsIn: "9 days",
    durationHours: 2,
    capacity: 20,
    suburb: "Barangaroo",
    category: "outdoors",
  },
  {
    slug: "qa-click-full-night",
    title: "QA - The one that fills up",
    purpose:
      "6 days out with room for exactly two - one press of 'fill it' takes both seats and drives 'that one just filled up'.",
    startsIn: "6 days",
    durationHours: 2,
    capacity: 2,
    suburb: "Pyrmont",
    category: "music",
  },
];

function description(spec: FixtureSpec) {
  return `${spec.purpose} Fixture for the /test-click harness - not a real event.`;
}

export type FixtureReport = {
  slug: string;
  title: string;
  purpose: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  seatsTaken: number;
  participants: string[];
};

export async function refreshClickFixtures(): Promise<FixtureReport[]> {
  await assertHarnessAllowed();
  const pool = getPostgresPool();
  if (!pool) throw new HarnessRefusedError("No database connection.");

  const client = await pool.connect();
  try {
    await client.query("begin");

    // The APPROVED @click.local merchant with the fewest OTHER live events.
    //
    // Approved because a pending merchant's events are not live, and the click
    // surfaces only read live ones. Fewest-others because of
    // prevent_merchant_event_overlap: every rebuild slides these five events
    // forward by however long has passed, so hanging them off a merchant with a
    // busy calendar means a rebuild eventually lands one of them on top of a real
    // event and the whole refresh is refused. The quietest host is the one whose
    // schedule the fixtures can move around in.
    const host = await client.query<{ merchant_id: string; profile_id: string; name: string }>(
      `select mp.id::text as merchant_id, mp.profile_id::text, mp.business_name as name
         from merchant_profiles mp
         join profiles p on p.id = mp.profile_id
        where p.email like '%@click.local' and mp.verification_status = 'approved'
        order by (
          select count(*) from events e
           where e.merchant_profile_id = mp.id
             and e.status in ('live', 'featured', 'locked', 'waitlist')
             and not (e.slug = any($1::text[]))
        ), mp.created_at
        limit 1`,
      [FIXTURE_SLUGS as unknown as string[]],
    );
    const merchant = host.rows[0];
    if (!merchant) {
      throw new HarnessRefusedError(
        "No approved @click.local merchant to host the fixtures. Run the QA persona provisioner first.",
      );
    }

    // Everyone the harness can drive. They all go on the past event's list so the
    // post-event surface works for WHICHEVER pair the tester picks, not just the
    // pair somebody thought of when the fixtures were written.
    const people = await client.query<{ id: string }>(
      `select id::text from profiles
        where email like '%@click.local' and role <> 'merchant'
          and photo_url is not null and photo_url <> '' and age >= 18
        order by display_name`,
    );
    const attendeeIds = people.rows.map((row) => row.id);

    for (const spec of FIXTURES) {
      // UPDATE-then-INSERT, deliberately NOT `insert ... on conflict (slug) do update`.
      //
      // `events` carries prevent_merchant_event_overlap (001_schema.sql:295), a
      // BEFORE INSERT OR UPDATE trigger that refuses two overlapping live events
      // for one merchant. It excludes the row being written with
      // `existing.id <> new.id` - which works on an UPDATE, where new.id is the
      // row's own id, and cannot work on the INSERT half of an upsert, where
      // new.id is a freshly generated uuid. Postgres fires the BEFORE INSERT
      // trigger before ON CONFLICT resolves, so the statement sees the row it is
      // about to update as a *different* event at the same time and raises
      // "merchant has an overlapping live event".
      //
      // The upshot: an upsert on a live event's schedule works exactly once, on
      // the run that creates it, and every rebuild after that fails. That is not
      // a fixture quirk - any code upserting a live event by slug hits it.
      const updated = await client.query<{ id: string }>(
        `
          update events set
            title = $2,
            description = $3,
            status = 'live',
            starts_at = now() + $4::interval,
            ends_at = now() + $4::interval + ($5 || ' hours')::interval,
            capacity = $6,
            -- Re-homed on every rebuild, not just created with a host. A fixture
            -- left on a merchant who has since taken on real events is the exact
            -- state that makes the next rebuild collide with one of them.
            merchant_profile_id = $7::uuid,
            group_name = $8,
            host_name = $8,
            cancelled_at = null,
            cancellation_reason = null,
            updated_at = now()
          where slug = $1
          returning id::text
        `,
        [
          spec.slug,
          spec.title,
          description(spec),
          spec.startsIn,
          String(spec.durationHours),
          spec.capacity,
          merchant.merchant_id,
          merchant.name,
        ],
      );
      const event = updated.rowCount
        ? updated
        : await client.query<{ id: string }>(
            `
              insert into events (
                slug, title, description, merchant_profile_id, group_name, host_name,
                category, status, starts_at, ends_at, location_name, suburb, city,
                capacity, price_cents, relationship_goal
              )
              values (
                $1, $2, $3, $4::uuid, $5, $5, $6, 'live',
                now() + $7::interval,
                now() + $7::interval + ($8 || ' hours')::interval,
                $9, $10, 'Sydney', $11, 0, 'friendship'
              )
              returning id::text
            `,
            [
              spec.slug,
              spec.title,
              description(spec),
              merchant.merchant_id,
              merchant.name,
              spec.category,
              spec.startsIn,
              String(spec.durationHours),
              `${spec.suburb} QA venue`,
              spec.suburb,
              spec.capacity,
            ],
          );
      const eventId = event.rows[0].id;

      // Who sits on this event, and why:
      //   * the two PAST events get everybody, so any pair can test the
      //     post-event surface (open on one, refused on the other);
      //   * the FUTURE events get nobody at all - a pair must be able to suggest,
      //     confirm and then take a seat themselves, which is the flow under
      //     test. Pre-filling the sell-out fixture here was worse than useless:
      //     the seats would go to whichever QA people sorted first, which is
      //     sometimes the pair itself, and a pair holding seats on the event
      //     that is supposed to fill up beneath them tests nothing. The harness
      //     fills it on demand instead, excluding the pair by id.
      const seats = spec.startsIn.startsWith("-") ? attendeeIds : [];

      // Clear this fixture's own seats first so a re-run cannot accumulate stale
      // ones (e.g. the pair RSVP'd to plan-a last run). Scoped to the fixture row.
      await client.query(`delete from event_attendees where event_id = $1::uuid`, [eventId]);
      await client.query(`delete from event_waitlists where event_id = $1::uuid`, [eventId]);
      if (seats.length > 0) {
        await client.query(
          `insert into event_attendees (event_id, profile_id, status, visible_to_attendees)
           select $1::uuid, unnest($2::uuid[]), 'confirmed', true
           on conflict do nothing`,
          [eventId, seats],
        );
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  return readFixtureReport();
}

export async function readFixtureReport(): Promise<FixtureReport[]> {
  const pool = getPostgresPool();
  if (!pool) return [];
  const result = await pool.query<{
    slug: string;
    title: string;
    starts_at: string;
    ends_at: string;
    capacity: number;
    seats_taken: number;
    participants: string[] | null;
  }>(
    `
      select e.slug, e.title, e.starts_at::text, e.ends_at::text, e.capacity,
             cap.seats_taken,
             array(
               select p.display_name from event_participants_v v
                 join profiles p on p.id = v.profile_id
                where v.event_id = e.id order by p.display_name
             ) as participants
        from events e
        join event_capacity_v cap on cap.event_id = e.id
       where e.slug = any($1::text[])
       order by e.starts_at
    `,
    [FIXTURE_SLUGS as unknown as string[]],
  );
  const purpose = new Map(FIXTURES.map((f) => [f.slug, f.purpose]));
  return result.rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    purpose: purpose.get(row.slug) ?? "",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity: row.capacity,
    seatsTaken: row.seats_taken,
    participants: row.participants ?? [],
  }));
}
