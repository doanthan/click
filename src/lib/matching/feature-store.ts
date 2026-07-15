// Matching v2 — feature population (spec §1.2 / §1.5 / §10 items 2 & 4).
//
// Turns the live relational tables into the denormalised `user_features` store
// and event `sub_tags` the scoring engine reads. Pure data layer: every function
// takes a pg Pool so it runs identically from the cron route, a server action,
// or a one-off backfill script.
//
// Deviation from spec, documented on purpose: the spec defines "attendance" as
// `checked_in_at IS NOT NULL`. This app only sets check-in via a rarely-used
// admin toggle, so on real/seed data that count is ~0 and every user collapses
// into one cohort. We use a pragmatic proxy — a CONFIRMED RSVP to an event that
// has already ENDED — which is the strongest attendance signal actually present.
// Swap the `attended` CTE to `checked_in_at IS NOT NULL` once check-in is wired.

import type { Pool } from "pg";
import { assignCohort } from "./cohorts";
import { deriveSubTags } from "./sub-tags";
import type { SocialEnergy, UserFeatures } from "./types";

// ---------------------------------------------------------------------------
// Event sub-tags (§1.2). Derive from title+description scoped to the event's
// interest tags, write events.sub_tags. Idempotent — safe to re-run.
// ---------------------------------------------------------------------------

const EVENT_INTEREST_SLUGS_SQL = `
  select e.id::text as id, e.title, e.description,
    coalesce(
      array_agg(t.slug) filter (where t.tag_type = 'interest' and t.slug is not null),
      '{}'
    ) as slugs
  from events e
  left join event_tags et on et.event_id = e.id
  left join tags t on t.id = et.tag_id
  group by e.id
`;

export async function backfillEventSubTags(pool: Pool): Promise<number> {
  const { rows } = await pool.query<{
    id: string;
    title: string;
    description: string;
    slugs: string[];
  }>(EVENT_INTEREST_SLUGS_SQL);

  let updated = 0;
  for (const row of rows) {
    const subTags = deriveSubTags(row.title ?? "", row.description ?? "", row.slugs ?? []);
    await pool.query(`update events set sub_tags = $2::text[] where id = $1::uuid`, [
      row.id,
      subTags,
    ]);
    updated += 1;
  }
  return updated;
}

// Single event, by slug — called fire-and-forget at publish so a new event has
// sub-tags before the next batch cycle.
export async function deriveEventSubTagsBySlug(pool: Pool, slug: string): Promise<void> {
  const { rows } = await pool.query<{ title: string; description: string; slugs: string[] }>(
    `${EVENT_INTEREST_SLUGS_SQL.replace("group by e.id", "where e.slug = $1 group by e.id")}`,
    [slug],
  );
  const row = rows[0];
  if (!row) return;
  const subTags = deriveSubTags(row.title ?? "", row.description ?? "", row.slugs ?? []);
  await pool.query(`update events set sub_tags = $2::text[] where slug = $1`, [slug, subTags]);
}

// ---------------------------------------------------------------------------
// user_features (§1.4). One set-based query produces every raw aggregate per
// profile; cohort assignment (TS logic) runs per row; we upsert the store.
// ---------------------------------------------------------------------------

type FeatureRow = {
  profile_id: string;
  age: number | null;
  suburb: string | null;
  city: string | null;
  intents: string[];
  interest_tag_ids: string[];
  life_tags: string[];
  social_energy: string | null;
  behavioural_sub_tags: Record<string, number> | null;
  attendance_count: number;
  rsvp_count: number;
  cancellation_rate: string; // numeric → string from pg
  attended_with_profile_ids: string[];
  clicks_made_count: number;
  clicks_received_count: number;
  mutual_click_count: number;
  event_categories_attended: string[];
  last_active_at: Date | null;
};

const FEATURES_QUERY = `
  with attended as (
    -- proxy: confirmed RSVP to an event that has already ended (see file header)
    select ea.profile_id, ea.event_id, e.category, e.sub_tags
    from event_attendees ea
    join events e on e.id = ea.event_id
    where ea.status = 'confirmed'
      and coalesce(e.ends_at, e.starts_at) < now()
  ),
  sub_counts as (
    select profile_id, st as sub_tag, count(*)::int as cnt
    from attended, unnest(sub_tags) as st
    group by profile_id, st
  ),
  subtags as (
    select profile_id, jsonb_object_agg(sub_tag, cnt) as sub_tags
    from sub_counts group by profile_id
  ),
  cats as (
    select profile_id, array_agg(distinct category) as cats from attended group by profile_id
  ),
  att_count as (
    select profile_id, count(distinct event_id)::int as c from attended group by profile_id
  ),
  withed as (
    select a.profile_id, array_agg(distinct o.profile_id) as others
    from attended a
    join event_attendees o
      on o.event_id = a.event_id and o.status = 'confirmed' and o.profile_id <> a.profile_id
    group by a.profile_id
  ),
  rsvp as (
    select profile_id,
      count(*) filter (where status = 'confirmed')::int as confirmed,
      count(*) filter (where status = 'cancelled')::int as cancelled
    from event_attendees group by profile_id
  ),
  interests as (
    select ut.profile_id, array_agg(t.id) as ids
    from user_tags ut join tags t on t.id = ut.tag_id and t.tag_type = 'interest'
    group by ut.profile_id
  ),
  lifet as (
    select ut.profile_id, array_agg(t.slug) as slugs
    from user_tags ut join tags t on t.id = ut.tag_id and t.tag_type = 'life'
    group by ut.profile_id
  ),
  persona as (
    select distinct on (profile_id) profile_id, social_energy
    from click_personas order by profile_id, generated_at desc
  ),
  clicks_made as (select sender_id as pid, count(*)::int as c from clicks group by 1),
  clicks_recv as (select receiver_id as pid, count(*)::int as c from clicks group by 1),
  mutuals as (
    select pid, count(*)::int as c from (
      select user_a_id as pid from mutual_clicks
      union all select user_b_id from mutual_clicks
    ) m group by pid
  ),
  last_act as (
    select profile_id, max(ts) as ts from (
      select profile_id, updated_at as ts from event_attendees
      union all select sender_id as profile_id, created_at from clicks
    ) x group by profile_id
  )
  select
    p.id::text as profile_id,
    p.age,
    p.suburb,
    p.city,
    p.connection_intents::text[] as intents,
    coalesce(interests.ids, '{}')::text[] as interest_tag_ids,
    coalesce(lifet.slugs, '{}') as life_tags,
    persona.social_energy,
    coalesce(subtags.sub_tags, '{}'::jsonb) as behavioural_sub_tags,
    coalesce(att_count.c, 0) as attendance_count,
    coalesce(rsvp.confirmed, 0) as rsvp_count,
    case when coalesce(rsvp.confirmed, 0) + coalesce(rsvp.cancelled, 0) > 0
         then round(coalesce(rsvp.cancelled, 0)::numeric
              / (rsvp.confirmed + rsvp.cancelled), 3)
         else 0 end as cancellation_rate,
    coalesce(withed.others, '{}')::text[] as attended_with_profile_ids,
    coalesce(clicks_made.c, 0) as clicks_made_count,
    coalesce(clicks_recv.c, 0) as clicks_received_count,
    coalesce(mutuals.c, 0) as mutual_click_count,
    coalesce(cats.cats, '{}') as event_categories_attended,
    greatest(p.updated_at, last_act.ts) as last_active_at
  from profiles p
  left join interests on interests.profile_id = p.id
  left join lifet on lifet.profile_id = p.id
  left join persona on persona.profile_id = p.id
  left join subtags on subtags.profile_id = p.id
  left join cats on cats.profile_id = p.id
  left join att_count on att_count.profile_id = p.id
  left join withed on withed.profile_id = p.id
  left join rsvp on rsvp.profile_id = p.id
  left join clicks_made on clicks_made.pid = p.id
  left join clicks_recv on clicks_recv.pid = p.id
  left join mutuals on mutuals.pid = p.id
  left join last_act on last_act.profile_id = p.id
`;

function rowToFeatures(row: FeatureRow): UserFeatures {
  const energy = row.social_energy as SocialEnergy | null;
  const features: UserFeatures = {
    profileId: row.profile_id,
    interestTagIds: row.interest_tag_ids ?? [],
    lifeTags: row.life_tags ?? [],
    socialEnergy: energy,
    intents: row.intents ?? [],
    age: row.age,
    suburb: row.suburb,
    city: row.city,
    behaviouralSubTags: row.behavioural_sub_tags ?? {},
    attendanceCount: row.attendance_count,
    rsvpCount: row.rsvp_count,
    cancellationRate: Number(row.cancellation_rate),
    attendedWithProfileIds: row.attended_with_profile_ids ?? [],
    clicksMadeCount: row.clicks_made_count,
    clicksReceivedCount: row.clicks_received_count,
    mutualClickCount: row.mutual_click_count,
    eventCategoriesAttended: row.event_categories_attended ?? [],
    cohortId: null,
  };
  features.cohortId = assignCohort(features);
  return features;
}

const UPSERT_SQL = `
  insert into user_features (
    profile_id, interest_tag_ids, life_tags, social_energy, intents, age, suburb, city,
    behavioural_sub_tags, attendance_count, rsvp_count, cancellation_rate,
    attended_with_profile_ids, clicks_made_count, clicks_received_count, mutual_click_count,
    event_categories_attended, last_active_at, cohort_id, features_updated_at
  ) values (
    $1::uuid, $2::uuid[], $3::text[], $4, $5::text[], $6, $7, $8,
    $9::jsonb, $10, $11, $12, $13::uuid[], $14, $15, $16, $17::text[], $18, $19, now()
  )
  on conflict (profile_id) do update set
    interest_tag_ids = excluded.interest_tag_ids,
    life_tags = excluded.life_tags,
    social_energy = excluded.social_energy,
    intents = excluded.intents,
    age = excluded.age,
    suburb = excluded.suburb,
    city = excluded.city,
    behavioural_sub_tags = excluded.behavioural_sub_tags,
    attendance_count = excluded.attendance_count,
    rsvp_count = excluded.rsvp_count,
    cancellation_rate = excluded.cancellation_rate,
    attended_with_profile_ids = excluded.attended_with_profile_ids,
    clicks_made_count = excluded.clicks_made_count,
    clicks_received_count = excluded.clicks_received_count,
    mutual_click_count = excluded.mutual_click_count,
    event_categories_attended = excluded.event_categories_attended,
    last_active_at = excluded.last_active_at,
    cohort_id = excluded.cohort_id,
    features_updated_at = now()
`;

async function upsertFeatures(pool: Pool, f: UserFeatures, lastActiveAt: Date | null) {
  await pool.query(UPSERT_SQL, [
    f.profileId,
    f.interestTagIds,
    f.lifeTags,
    f.socialEnergy,
    f.intents,
    f.age,
    f.suburb,
    f.city,
    JSON.stringify(f.behaviouralSubTags),
    f.attendanceCount,
    f.rsvpCount,
    f.cancellationRate,
    f.attendedWithProfileIds,
    f.clicksMadeCount,
    f.clicksReceivedCount,
    f.mutualClickCount,
    f.eventCategoriesAttended,
    lastActiveAt,
    f.cohortId,
  ]);
}

export async function refreshAllUserFeatures(pool: Pool): Promise<number> {
  const { rows } = await pool.query<FeatureRow>(FEATURES_QUERY);
  for (const row of rows) {
    await upsertFeatures(pool, rowToFeatures(row), row.last_active_at);
  }
  return rows.length;
}

// Single profile — for the dirty-row / on-change refresh path (spec §1.5).
export async function refreshUserFeatures(pool: Pool, profileId: string): Promise<boolean> {
  const { rows } = await pool.query<FeatureRow>(
    `${FEATURES_QUERY} where p.id = $1::uuid`,
    [profileId],
  );
  const row = rows[0];
  if (!row) return false;
  await upsertFeatures(pool, rowToFeatures(row), row.last_active_at);
  return true;
}
