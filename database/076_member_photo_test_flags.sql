-- 076: Member, photo and test-account flags (build prompt 1, Cindy 2026-10-15).
--
-- Safe to apply before the code that reads it: the code in production today
-- reads none of these columns, and the two triggers here only fill them in -
-- photo_status follows photo_url, and 08 §3's tags are marked by slug - so a
-- write by that code can never leave them wrong. The click rules that DO change
-- what that code can do are in 077, which goes in with the deploy.
--
-- Spec names, live names (00_MASTER_INDEX "Spec vs live-code names"):
--   onboarding_completed = profiles.member_onboarded_at
--   avatar_url           = profiles.photo_url
--   life_tags            = tags where tag_type = 'life'
--   discovery pool       = daily_picks
--
-- Order on deploy: 076, then the three backfills in scripts/ (photo, is_test,
-- member_onboarded_at - each needs Cindy and Doan's sign-off on its list), then
-- the code, then 077, then the photo backfill once more with --pending for any
-- photo changed in between. Until the backfills run every account fails the
-- new gates: photo_status is 'none' or 'pending', is_test is false and
-- member_onboarded_at is NULL.

begin;

-- 1. The photo quality flag (01 §2 Step 4, 09 §3, 13 §6, 21 S9). Every photo
--    gate reads photo_status = 'ok', never "photo_url is not null": a URL can
--    point at an object that is gone, unreadable (the 402 incident), or a
--    placeholder. 'none' = no photo; 'pending' = stored, not yet checked;
--    'ok' = the stored object loads publicly and is not a placeholder, stock or
--    default image; 'failed' = it does not, and the member is told so.
alter table profiles
  add column if not exists photo_status text not null default 'none';
alter table profiles drop constraint if exists profiles_photo_status_check;
alter table profiles add constraint profiles_photo_status_check
  check (photo_status in ('none', 'pending', 'ok', 'failed'));

-- photo_status follows photo_url. A new URL is 'pending' until the photo check
-- says otherwise; no URL is always 'none'. A writer may still set both in one
-- statement (the photo check does), but nothing - the code running before this
-- deploy included, which never sets photo_status - can change the photo and
-- keep an old 'ok', or hold 'ok' with no photo.
create or replace function profiles_photo_status_follows_url()
returns trigger
language plpgsql
as $$
begin
  if nullif(btrim(coalesce(new.photo_url, '')), '') is null then
    new.photo_status := 'none';
  elsif tg_op = 'INSERT' then
    if new.photo_status = 'none' then
      new.photo_status := 'pending';
    end if;
  elsif new.photo_url is distinct from old.photo_url
        and new.photo_status is not distinct from old.photo_status then
    new.photo_status := 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_photo_status_follows_url on profiles;
create trigger profiles_photo_status_follows_url
  before insert or update of photo_url, photo_status on profiles
  for each row execute function profiles_photo_status_follows_url();

-- Every row is 'none' here (the column is new), so this holds already.
alter table profiles drop constraint if exists profiles_photo_ok_needs_url;
alter table profiles add constraint profiles_photo_ok_needs_url
  check (photo_status <> 'ok' or nullif(btrim(photo_url), '') is not null);

-- 2. Test accounts (22A §4.5). Test accounts only ever see, click or are
--    counted with other test accounts. Replaces the @click.local email split on
--    every product surface. Set by the reviewed backfill and by every seed
--    script, never inferred at read time.
alter table profiles
  add column if not exists is_test boolean not null default false;

-- 3. Member status for every role (01 §1.4, 21 §B7.4). Written ONLY when the
--    user onboarding flow is finished (saveOnboarding with complete = true) -
--    never by a seed or backfill script beyond the one reviewed list, and never
--    by holding the admin or merchant role.
alter table profiles
  add column if not exists member_onboarded_at timestamptz;

-- 4. Life-tag sensitivity (08 §3, §4.1, §4.4). The spec keeps these on a
--    separate life_tags table; live, life tags are tags rows with
--    tag_type = 'life'. Sensitive and FOMO-only tags never enter pair scoring,
--    event scoring, cohort choice or pick reasons, and sensitive tags are never
--    listed against a named member, admins included.
alter table tags
  add column if not exists is_sensitive boolean not null default false,
  add column if not exists fomo_only boolean not null default false;

-- 08 §3: identity (lgbtq-plus) and functional (recently-single, needs-structure,
-- prefers-small-group) are sensitive; the five wired circumstance tags are
-- FOMO-only. Slugs that are not in 08 §3 are left as they are and listed in the
-- build report for Cindy to classify.
--
-- The class is fixed by slug, so the database holds it, not whoever writes the
-- row: the code running before this deploy creates life tags with neither
-- flag, and a tag it creates after this migration must still be born marked.
-- Only ever sets a flag, never clears one.
create or replace function tags_life_class_by_slug()
returns trigger
language plpgsql
as $$
begin
  if new.tag_type = 'life' then
    if new.slug in ('lgbtq-plus', 'recently-single', 'needs-structure', 'prefers-small-group') then
      new.is_sensitive := true;
    end if;
    if new.slug in ('returning-to-social', 'sober-curious', 'single-parent', 'career-pivot', 'empty-nester') then
      new.fomo_only := true;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tags_life_class_by_slug on tags;
create trigger tags_life_class_by_slug
  before insert or update on tags
  for each row execute function tags_life_class_by_slug();

-- The rows that already exist.
update tags set is_sensitive = true
 where tag_type = 'life'
   and slug in ('lgbtq-plus', 'recently-single', 'needs-structure', 'prefers-small-group')
   and not is_sensitive;
update tags set fomo_only = true
 where tag_type = 'life'
   and slug in ('returning-to-social', 'sober-curious', 'single-parent', 'career-pivot', 'empty-nester')
   and not fomo_only;

-- 5. Each pick's rank (09 "Display order and ties"): 1 is the best-scoring pick
--    and the dashboard's first featured card. NULL on rows written before this.
alter table daily_picks
  add column if not exists rank smallint;
alter table daily_picks drop constraint if exists daily_picks_rank_check;
alter table daily_picks add constraint daily_picks_rank_check
  check (rank is null or rank >= 1);

commit;
