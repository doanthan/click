-- 070 - two click sources (CHANGE BRIEF 2026-09-30)
--
-- NOT YET APPLIED. Apply BEFORE deploying the code that reads daily_picks and writes
-- mutual_clicks.source - the new code needs both, while the old code runs fine on
-- this schema (it just never writes source), so migrate first, deploy second.
--
-- Clicking is no longer post-event only. A click comes from EXPLORE (the three people
-- Click picks for you each day, on the Click page and the dashboard) or from
-- POST-EVENT (who was there), and the two now pair up with each other: one person is
-- one click, whichever surface sent it.
--
-- The brief is written against the spec's generic schema. Here:
--
--   brief                                   this repo
--   --------------------------------------  -------------------------------------------
--   daily_pick(user_id, picked_user, ...)   daily_picks(profile_id, picked_profile_id, ...)
--   click.source 'explore'|'post_event'     clicks.surface 'discovery'|'who_was_there' (049)
--   click.event_id NULLABLE                 already nullable (049)
--   UNIQUE(from_user, to_user)              uq_click_live_pair - one PENDING click per pair
--   mutual_click.source                     mutual_clicks.source, clicks.surface's words
--   mutual_click.source_event_id NULLABLE   already nullable (065)
--
-- Why the pair index is partial: a click here has a lifecycle (049's click_status),
-- and the runbook lets a pair click each other again once a click has lapsed or a
-- mutual has been released (B7.8 / B7.9). An unconditional unique would close that
-- door forever. uq_click_post_event stays as it is - one click per person per event,
-- which the post-event swap (§6.9) and the who-was-there roster rely on.
--
-- Run this FIRST, on its own. The new index cannot be built while a sender holds two
-- pending clicks at the same receiver - one from discovery and one from an event was
-- legal until now:
--
--   select sender_id, receiver_id, count(*)
--   from clicks
--   where status = 'pending'
--   group by sender_id, receiver_id
--   having count(*) > 1;
--
-- Any row back and this file fails and rolls back whole. Clearing it means marking one
-- of the two clicks 'invalidated', which is a data change that needs its own sign-off.
--
-- Otherwise additive: one new table, one index swap, one nullable column + backfill.

begin;

-- ---------------------------------------------------------------------------
-- 1. daily_picks - the explore source (brief §3.1, §3.3)
-- ---------------------------------------------------------------------------
create table if not exists daily_picks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  picked_profile_id uuid not null references profiles(id) on delete cascade,
  -- The viewer's calendar day on Sydney's clock. There is no per-member time zone
  -- anywhere in the schema, so "their local morning" is Sydney's (APP_TIME_ZONE).
  pool_date date not null,
  -- The matching signal that carried the pick. Server-side only: invariant 2 keeps
  -- why someone is shown off the wire, so nothing that renders ever selects this.
  reason text not null,
  created_at timestamptz not null default now(),
  constraint daily_picks_not_self check (profile_id <> picked_profile_id),
  -- The brief's UNIQUE(user_id, picked_user, pool_date), with the day second so the
  -- one index also serves "today's picks for this viewer" - the read, and the gate
  -- every explore send passes.
  constraint daily_picks_once_a_day unique (profile_id, pool_date, picked_profile_id)
);

alter table daily_picks enable row level security;

comment on table daily_picks is
  'The explore click source: the people Click picks for a member each day (CHANGE BRIEF 2026-09-30). Written once per member per Sydney day, by the daily-picks cron or on first view. An explore click is refused unless its receiver is in the sender''s picks for today. reason is server-side only.';

-- ---------------------------------------------------------------------------
-- 2. clicks - one live click per ordered pair, any source (brief §3.2)
-- ---------------------------------------------------------------------------
-- uq_click_discovery (sender, receiver) where event_id is null and pending is the
-- discovery-only half of this; the new index covers it, so it goes.
drop index if exists uq_click_discovery;
create unique index if not exists uq_click_live_pair on clicks (sender_id, receiver_id)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- 3. mutual_clicks.source (brief §3.2)
-- ---------------------------------------------------------------------------
-- The surface of the click that FORMED the mutual. source_event_id says which night
-- the two of them share, if any - a mutual formed from explore still carries one when
-- the other side's click came from who was there, because both were there.
--
-- Nullable with no default on purpose: code deployed before this migration keeps
-- inserting mutuals without it until the new build is live, and a default would
-- label those wrongly while a NOT NULL would make them fail.
alter table mutual_clicks
  add column if not exists source text check (source in ('discovery', 'who_was_there'));

-- Rows from before this migration. The click that formed a mutual is the later of the
-- two linked to it (clicks.mutual_click_id), and before 070 both were always on the
-- same surface anyway. A mutual with no linked click left (a profile deleted, taking
-- its clicks with it) falls back to source_event_id, which 065 only ever set for a
-- post-event mutual.
update mutual_clicks m
set source = coalesce(
  (
    select c.surface
    from clicks c
    where c.mutual_click_id = m.id
    order by c.created_at desc
    limit 1
  ),
  case when m.source_event_id is null then 'discovery' else 'who_was_there' end
)
where m.source is null;

comment on column mutual_clicks.source is
  'The surface of the click that formed this mutual (clicks.surface''s words). NULL only for a mutual formed by pre-070 code during the deploy gap.';

commit;
