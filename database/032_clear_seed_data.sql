-- 032_clear_seed_data.sql
--
-- Removes the demo/seed data inserted by 002_seed.sql and
-- 024_seed_remaining_events.sql so the site shows a true fresh/empty state.
--
-- WHAT THIS DELETES
--   * The seeded user/host/attendee profiles (auth_subject like 'seed:%' or
--     email like '%@click.local') and the 4 seeded merchant profiles.
--   * Every event owned by one of those seed profiles (host or merchant).
--   * Everything that hangs off them — attendees, waitlists, bookmarks,
--     event_tags, notifications, clicks, personas, messages, etc. — which the
--     schema removes automatically via ON DELETE CASCADE once the parent
--     profile/event rows go.
--
-- WHAT THIS KEEPS
--   * The tag taxonomy (tag_categories + interest/music tags). These are
--     functional reference data the /categories pages and the quiz/onboarding
--     tag pickers rely on — not visible "dummy content". An optional block at
--     the bottom removes them too, but it is commented out on purpose.
--   * Any real profiles/events you created through the UI (they don't carry a
--     seed marker, so the WHERE clauses below never match them).
--
-- This is REVERSIBLE: re-run 002_seed.sql + 024_seed_remaining_events.sql to
-- restore the demo dataset (both are idempotent — ON CONFLICT DO NOTHING).
--
-- HOW TO RUN (against the Supabase *pooler* host — direct db.* is IPv6-only):
--   psql "$DATABASE_URL" -f database/032_clear_seed_data.sql
-- or paste it into the Supabase SQL editor (it already runs as one txn).

begin;

-- Capture the seed profile ids up front. We need them to find seed-owned events
-- *before* the profile rows are deleted (events.host_profile_id /
-- merchant_profile_id are ON DELETE SET NULL, not CASCADE, so deleting profiles
-- would orphan the events instead of removing them).
create temporary table _seed_profiles on commit drop as
select id
from profiles
where auth_subject like 'seed:%'
   or email like '%@click.local';

-- 1. Seed-owned events (cascades event_tags / event_attendees / event_waitlists
--    / bookmarks). An event counts as seeded if its host OR merchant is a seed
--    profile.
delete from events
where host_profile_id in (select id from _seed_profiles)
   or merchant_profile_id in (
        select id from merchant_profiles
        where profile_id in (select id from _seed_profiles)
      );

-- 2. The seed profiles themselves. ON DELETE CASCADE then sweeps merchant_profiles,
--    notifications, user_tags, click_personas, user_clicks, mutual_clicks,
--    conversations, messages, bookmarks, safety rows, etc.
delete from profiles
where id in (select id from _seed_profiles);

-- Sanity check — both should report 0 remaining.
do $$
declare
  remaining_profiles int;
  remaining_events   int;
begin
  select count(*) into remaining_profiles
  from profiles
  where auth_subject like 'seed:%' or email like '%@click.local';

  select count(*) into remaining_events
  from events e
  where e.host_profile_id is null and e.merchant_profile_id is null
    and e.created_at < now(); -- informational only; real orphans, if any

  raise notice 'seed profiles remaining: %', remaining_profiles;
  raise notice 'events with no host and no merchant (orphans to review): %', remaining_events;
end $$;

commit;

-- -----------------------------------------------------------------------------
-- OPTIONAL — also wipe the seeded tag taxonomy.
-- Leave this commented unless you specifically want the category pages and the
-- quiz/onboarding tag pickers to start empty too. Re-seed with 002_seed.sql,
-- 026/028 (interest tag curation) and 029_seed_music_tags.sql.
-- -----------------------------------------------------------------------------
-- begin;
--   delete from tags;            -- event_tags / user_tags cascade off tags
--   delete from tag_categories;  -- delete tags first (category_id is SET NULL)
-- commit;
