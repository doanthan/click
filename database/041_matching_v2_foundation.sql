-- 041_matching_v2_foundation.sql
--
-- Matching Algorithm v2 - Phase 0 foundation (spec: context/04_MATCHING_ALGORITHM_V2.md).
--
-- v1 (src/lib/personalized-matching.ts) is a hand-tuned, uniform-weight linear
-- scorer with a "popular events" cold-start fallback and Click-Persona as a
-- signal - the three things §0/§4.2/§9 of the spec call out as wrong. This
-- migration lays the persistent foundation for v2 WITHOUT ripping out v1: a
-- feature store, sub-tag column, impression log, cold-start label table, and a
-- versioned cohort-weights table. v1 stays wired until v2 is verified.
--
-- The spec assumes a Supabase auth.users / personality_profiles schema; this app
-- uses profiles / click_personas / event_attendees / user_clicks. Columns below
-- are mapped to what actually exists. Features with no source yet (event vibe
-- prefs, availability, distance willingness, dating range) are intentionally
-- omitted - they need profile/persona schema extensions in a later stage.
--
-- Additive and idempotent: safe to run on every environment.

begin;

-- ---------------------------------------------------------------------------
-- §1.2 events.sub_tags - behavioural sub-tag source. Derived at publish from
-- title+description against the SUB_TAG_PATTERNS taxonomy in code
-- (src/lib/matching/sub-tags.ts), e.g. {'yoga_hot','wine_natural'}.
-- ---------------------------------------------------------------------------
alter table events add column if not exists sub_tags text[] not null default '{}';
create index if not exists idx_events_sub_tags on events using gin(sub_tags);

-- ---------------------------------------------------------------------------
-- §1.4 user_features - denormalised feature store, one row per profile. Declared
-- features mirror profiles/click_personas/user_tags; behavioural features are
-- refreshed by batch jobs (later stage). Read only via the matching engine.
-- ---------------------------------------------------------------------------
create table if not exists user_features (
  profile_id uuid primary key references profiles(id) on delete cascade,

  -- Declared (denormalised for fast read; refreshed when source changes)
  interest_tag_ids uuid[] not null default '{}',
  life_tags text[] not null default '{}',
  social_energy text,                       -- click_personas.social_energy (energy_match feature)
  intents text[] not null default '{}',     -- profiles.connection_intents
  age int,
  suburb text,
  city text,

  -- Behavioural (nightly/weekly batch; see spec §1.2)
  behavioural_sub_tags jsonb not null default '{}'::jsonb,  -- sub_tag -> attended count
  attendance_count int not null default 0,                 -- confirmed AND checked_in
  rsvp_count int not null default 0,                        -- confirmed
  cancellation_rate numeric(4,3) not null default 0,
  attended_with_profile_ids uuid[] not null default '{}',
  clicks_made_count int not null default 0,
  clicks_received_count int not null default 0,
  mutual_click_count int not null default 0,
  event_categories_attended text[] not null default '{}',
  time_of_day_histogram jsonb not null default '{}'::jsonb,
  last_active_at timestamptz,

  -- Meta
  cohort_id text,
  features_updated_at timestamptz not null default now()
);

create index if not exists idx_user_features_cohort on user_features(cohort_id);
create index if not exists idx_user_features_active on user_features(last_active_at desc);
create index if not exists idx_user_features_interests on user_features using gin(interest_tag_ids);
create index if not exists idx_user_features_subtags on user_features using gin(behavioural_sub_tags);

alter table user_features enable row level security;

-- ---------------------------------------------------------------------------
-- §2.3 cohort_weights - versioned per-cohort feature weights. Phase 0 seeds
-- hand-curated weights from code (src/lib/matching/weights.ts); Month 2+ the
-- training pipeline writes new versioned rows. Never overwritten → rollback is
-- a time-bounded SELECT.
-- ---------------------------------------------------------------------------
create table if not exists cohort_weights (
  cohort_id text not null,
  feature_name text not null,
  weight numeric not null,
  trained_at timestamptz not null default now(),
  training_data_size int not null default 0,
  primary key (cohort_id, feature_name, trained_at)
);

create index if not exists idx_cohort_weights_latest
  on cohort_weights(cohort_id, trained_at desc);

-- ---------------------------------------------------------------------------
-- §5.4 / §9 match_impressions - every surfaced candidate, for anti-repeat
-- (don't re-show within 14d) and as future ML training labels (shown-but-not-
-- clicked = negative example).
-- ---------------------------------------------------------------------------
create table if not exists match_impressions (
  id uuid primary key default gen_random_uuid(),
  viewer_profile_id uuid not null references profiles(id) on delete cascade,
  shown_profile_id uuid references profiles(id) on delete cascade,   -- user↔user
  shown_event_id uuid references events(id) on delete cascade,       -- user↔event
  surface text not null,            -- 'people' | 'discovery' | ...
  score numeric,
  model_version text,
  created_at timestamptz not null default now(),
  constraint impression_target_present
    check (shown_profile_id is not null or shown_event_id is not null)
);

create index if not exists idx_match_impressions_viewer
  on match_impressions(viewer_profile_id, created_at desc);
create index if not exists idx_match_impressions_user_pair
  on match_impressions(viewer_profile_id, shown_profile_id);

-- ---------------------------------------------------------------------------
-- §4.1 curated_match_labels - human cold-start labels (community-manager admin
-- tool, Month 0–2). features_snapshot captures the feature vector AT label time
-- so training isn't corrupted by later feature drift.
-- ---------------------------------------------------------------------------
create table if not exists curated_match_labels (
  id uuid primary key default gen_random_uuid(),
  profile_a uuid not null references profiles(id) on delete cascade,
  profile_b uuid not null references profiles(id) on delete cascade,
  judgment text not null check (judgment in ('strong_fit', 'maybe', 'not_a_fit')),
  reason text,
  labeler_profile_id uuid not null references profiles(id) on delete cascade,
  features_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_curated_labels_pair
  on curated_match_labels(profile_a, profile_b);

commit;
