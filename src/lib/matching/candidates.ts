// Matching v2 §5 - candidate generation & scoring strategy.
//
// You can't score every pair. Cheap hard filters cut the pool, then the
// (relatively) expensive logistic model scores only survivors. Spec targets:
// user↔user 200 candidates → top 3; user↔event 100 → top 6. match_impressions
// gives anti-repeat (don't re-show within 14 days) and future ML labels.
//
// Phase-0 deviation, documented: spec §5.1 hard-filters on shared-intent AND
// shared-interest-tag AND geo proximity. At current data density most profiles
// are sparsely tagged and carry no coordinates, so an AND of all three starves
// the pool. We gate on shared INTENT only (cheap, everyone has one) and let
// interest overlap + suburb proximity act as SCORING signals instead. Tighten
// to the full AND once profiles are densely tagged + geocoded.

import type { Pool } from "pg";
import { scorePair, scoreUserEvent, type ScoreResult } from "./score";
import type { CohortId, EventFeatures, SocialEnergy, UserFeatures } from "./types";
import { MODEL_VERSION } from "./weights";

// ---- feature loaders ------------------------------------------------------

const USER_FEATURE_COLUMNS = `
  profile_id::text, interest_tag_ids::text[], life_tags, social_energy,
  intents, age, suburb, city, behavioural_sub_tags, attendance_count, rsvp_count,
  cancellation_rate, attended_with_profile_ids::text[], clicks_made_count,
  clicks_received_count, mutual_click_count, event_categories_attended, cohort_id
`;

type UserFeatureRow = {
  profile_id: string;
  interest_tag_ids: string[];
  life_tags: string[];
  social_energy: string | null;
  intents: string[];
  age: number | null;
  suburb: string | null;
  city: string | null;
  behavioural_sub_tags: Record<string, number> | null;
  attendance_count: number;
  rsvp_count: number;
  cancellation_rate: string;
  attended_with_profile_ids: string[];
  clicks_made_count: number;
  clicks_received_count: number;
  mutual_click_count: number;
  event_categories_attended: string[];
  cohort_id: string | null;
};

function mapUserFeatures(row: UserFeatureRow): UserFeatures {
  return {
    profileId: row.profile_id,
    interestTagIds: row.interest_tag_ids ?? [],
    lifeTags: row.life_tags ?? [],
    socialEnergy: row.social_energy as SocialEnergy | null,
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
    cohortId: row.cohort_id as CohortId | null,
  };
}

export async function loadUserFeatures(
  pool: Pool,
  profileId: string,
): Promise<UserFeatures | null> {
  const { rows } = await pool.query<UserFeatureRow>(
    `select ${USER_FEATURE_COLUMNS} from user_features where profile_id = $1::uuid`,
    [profileId],
  );
  return rows[0] ? mapUserFeatures(rows[0]) : null;
}

// Batch load - for re-ranking an already-selected candidate list (e.g. the
// people surface) without N round-trips. Profiles absent from the store are
// simply missing from the map.
export async function loadManyUserFeatures(
  pool: Pool,
  profileIds: string[],
): Promise<Map<string, UserFeatures>> {
  if (profileIds.length === 0) return new Map();
  const { rows } = await pool.query<UserFeatureRow>(
    `select ${USER_FEATURE_COLUMNS} from user_features where profile_id = any($1::uuid[])`,
    [profileIds],
  );
  return new Map(rows.map((r) => [r.profile_id, mapUserFeatures(r)]));
}

// ---- user ↔ user ----------------------------------------------------------

export type ScoredPersonCandidate = {
  profileId: string;
  score: number;
  contributions: ScoreResult["contributions"];
};

export async function generatePeopleCandidates(
  pool: Pool,
  viewerProfileId: string,
  limit = 3,
): Promise<ScoredPersonCandidate[]> {
  const viewer = await loadUserFeatures(pool, viewerProfileId);
  if (!viewer) return [];

  // §5.1 cheap pre-filter → ≤200 candidates (see file header for the Phase-0
  // relaxation). Excludes self, blocks (either direction), inactive >30d, and
  // anyone shown in the last 14 days (anti-repeat).
  const { rows } = await pool.query<UserFeatureRow>(
    `
      select ${USER_FEATURE_COLUMNS}
      from user_features uf
      where uf.profile_id <> $1::uuid
        and uf.last_active_at > now() - interval '30 days'
        and uf.intents && $2::text[]
        and not exists (
          select 1 from user_blocks b
          where (b.blocker_profile_id = $1::uuid and b.blocked_profile_id = uf.profile_id)
             or (b.blocker_profile_id = uf.profile_id and b.blocked_profile_id = $1::uuid)
        )
        and not exists (
          select 1 from match_impressions mi
          where mi.viewer_profile_id = $1::uuid
            and mi.shown_profile_id = uf.profile_id
            and mi.created_at > now() - interval '14 days'
        )
      limit 200
    `,
    [viewerProfileId, viewer.intents],
  );

  return rows
    .map((row) => {
      const candidate = mapUserFeatures(row);
      const { score, contributions } = scorePair(viewer, candidate);
      return { profileId: candidate.profileId, score, contributions };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---- user ↔ event ---------------------------------------------------------

export type ScoredEventCandidate = {
  eventId: string;
  slug: string;
  title: string;
  score: number;
  contributions: ScoreResult["contributions"];
};

type EventFeatureRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  suburb: string | null;
  sub_tags: string[];
  start_hour: number | null;
  interest_tag_ids: string[];
  life_targets: string[];
  attendees: number;
  capacity: number;
};

export async function generateEventCandidates(
  pool: Pool,
  profileId: string,
  limit = 6,
): Promise<ScoredEventCandidate[]> {
  const user = await loadUserFeatures(pool, profileId);
  if (!user) return [];

  // §5.2 candidate pool: upcoming live events the user isn't already on and
  // hasn't been shown in 14d. Tag prefilter dropped at N≈26 - we score them all
  // (well under the spec's LIMIT 100) and let interest_match rank.
  const { rows } = await pool.query<EventFeatureRow>(
    `
      select
        e.id::text as id, e.slug, e.title, e.category, e.suburb,
        e.sub_tags,
        extract(hour from (e.starts_at at time zone coalesce(e.timezone, 'Australia/Sydney')))::int as start_hour,
        coalesce(array_agg(t.id) filter (where t.tag_type = 'interest'), '{}')::text[] as interest_tag_ids,
        coalesce(array_agg(t.slug) filter (where t.tag_type = 'life'), '{}') as life_targets,
        count(distinct a.id) filter (where a.status = 'confirmed')::int as attendees,
        e.capacity
      from events e
      left join event_tags et on et.event_id = e.id
      left join tags t on t.id = et.tag_id
      left join event_attendees a on a.event_id = e.id
      where e.status in ('live', 'featured')
        and coalesce(e.ends_at, e.starts_at) > now()
        and not exists (
          select 1 from event_attendees me
          where me.event_id = e.id and me.profile_id = $1::uuid
            and me.status in ('confirmed', 'waitlisted', 'pending_payment')
        )
        and not exists (
          select 1 from match_impressions mi
          where mi.viewer_profile_id = $1::uuid
            and mi.shown_event_id = e.id
            and mi.created_at > now() - interval '14 days'
        )
      group by e.id
      order by e.starts_at
      limit 100
    `,
    [profileId],
  );

  return rows
    .map((row) => {
      const event: EventFeatures = {
        eventId: row.id,
        interestTagIds: row.interest_tag_ids ?? [],
        subTags: row.sub_tags ?? [],
        lifeTagTargets: row.life_targets ?? [],
        category: row.category,
        suburb: row.suburb,
        startHour: row.start_hour,
        fillRatio: row.capacity > 0 ? row.attendees / row.capacity : 0,
      };
      const { score, contributions } = scoreUserEvent(user, event);
      return { eventId: row.id, slug: row.slug, title: row.title, score, contributions };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---- impressions (§5.4 / §9) ----------------------------------------------

export type ImpressionItem = {
  shownProfileId?: string;
  shownEventId?: string;
  score: number;
};

// Record what was actually surfaced. Called by the serving surface at render
// time (Stage 4), not by generation - so generating a preview doesn't burn the
// anti-repeat window.
export async function recordImpressions(
  pool: Pool,
  viewerProfileId: string,
  surface: string,
  items: ImpressionItem[],
): Promise<number> {
  let written = 0;
  for (const item of items) {
    await pool.query(
      `
        insert into match_impressions
          (viewer_profile_id, shown_profile_id, shown_event_id, surface, score, model_version)
        values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)
      `,
      [
        viewerProfileId,
        item.shownProfileId ?? null,
        item.shownEventId ?? null,
        surface,
        item.score,
        MODEL_VERSION,
      ],
    );
    written += 1;
  }
  return written;
}
