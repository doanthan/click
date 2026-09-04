-- 049_click_mechanic_v2.sql
-- Spec: TECH/21_CLICK_MECHANIC.md v9 (canonical owner of the click mechanic).
-- START_HERE Step 2.1 - the schema spine for the two-process click rewrite.
--
-- Replaces the pre-June-2026 model:
--   * user_clicks  (one undifferentiated row per pair)        -> clicks (two-process)
--   * mutual_clicks (5-col stub, no lifecycle)                -> reshaped per §B2
--   * event_proposals (status pending/confirmed/expired)      -> click_proposals (+coord)
--   * create_mutual_click() AFTER-INSERT trigger              -> DROPPED (detection now
--     runs in the send transaction with FOR UPDATE lock ordering, §4)
--
-- PRE-PRODUCTION: per CLAUDE.md the DB is seed/demo data - these tables hold no real
-- clicks, so we drop + recreate clean rather than migrate rows in. No seed file inserts
-- clicks/mutuals/proposals, so nothing downstream breaks.

begin;

-- ---------------------------------------------------------------------------
-- 1. Tear down the old send/coordination objects (order: FK dependents first)
-- ---------------------------------------------------------------------------
-- event_proposals FKs mutual_clicks(on delete cascade); drop it first.
drop table if exists event_proposals cascade;

-- The double-firing detection trigger + its function (§4 retires this pattern).
drop trigger if exists create_mutual_click_after_click on user_clicks;
drop function if exists create_mutual_click() cascade;

drop table if exists user_clicks cascade;
-- mutual_clicks is referenced by conversations.source_mutual_click_id (004, the dead
-- chat table - no DMs ever, §1). CASCADE drops only that FK *constraint*, leaving the
-- (now-orphan, unused) column in place; the conversations table itself is untouched.
drop table if exists mutual_clicks cascade;

-- Old enums (only the dropped tables used them). ADD VALUE can't run in a txn block,
-- so we recreate rather than alter.
drop type if exists click_status cascade;
drop type if exists proposal_status cascade;

-- ---------------------------------------------------------------------------
-- 2. Enums
-- ---------------------------------------------------------------------------
-- §3: click row lifecycle. 'invalidated' is the terminal block/cancel/ban writes.
create type click_status as enum ('pending', 'mutual', 'expired', 'invalidated');

-- §B2 axis 1 - the mutual's lifecycle.
create type mutual_status as enum ('active', 'connected', 'released', 'suppressed', 'expired');

-- §B2 axis 2 - where an active mutual is in arranging an event.
create type coord_state as enum ('open', 'proposed', 'confirmed_together', 'dormant');

-- §B4 - a single proposal's lifecycle (replaces the 3-value proposal_status).
create type click_proposal_status as enum (
  'pending',        -- awaiting the other user's response
  'accepted',       -- §B5 booking coordination underway
  'declined',       -- "Not this one" (§B4.2) - mutual untouched, coord_state -> open
  'superseded',     -- counter-proposed (§B4.2) - the new proposal replaces this
  'expired',        -- 48h response window lapsed (§B4.2)
  'withdrawn',      -- proposer pulled it before a response (§B8 row 16)
  'event_full',     -- capacity lost at propose/accept time (§B5.1/§B5.5)
  'event_cancelled' -- merchant cancelled the proposed event (§B8 row 10)
);

-- ---------------------------------------------------------------------------
-- 3. mutual_clicks - the RELATIONSHIP layer (§B2 unified state model)
--    Created before clicks because clicks.mutual_click_id references it.
-- ---------------------------------------------------------------------------
create table mutual_clicks (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references profiles(id) on delete cascade,
  user_b_id uuid not null references profiles(id) on delete cascade,
  -- Intent snapshot at formation (§8 "dual-intent line is a snapshot" - immutable for
  -- the life of the mutual; a later intent change never rewrites it).
  intent_a text,
  intent_b text,
  status mutual_status not null default 'active',
  coord_state coord_state not null default 'open',
  -- How a mutual reached 'connected' (§B2). NULL until status = 'connected'.
  connected_reason text check (connected_reason in ('co_attended', 'we_clicked')),
  connected_event_id uuid references events(id) on delete set null,
  mutual_at timestamptz not null default now(),
  -- The mutual's own 7-day relationship clock (§5 / §B4.3) - distinct from the
  -- discovery click's 7-day window and from a proposal's 48h window.
  expires_at timestamptz not null default now() + interval '7 days',
  ended_at timestamptz,                         -- set on any move out of 'active' (§B2)
  -- Awareness gate (§B7.6a): per-side first-view markers. Read-time branch, no cron.
  seen_at_a timestamptz,
  seen_at_b timestamptz,
  unseen_release_shown_at_a timestamptz,
  unseen_release_shown_at_b timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ordered_pair check (user_a_id < user_b_id)
);

-- §B2 invariant 1: exactly one ACTIVE mutual per pair, ever. History rows
-- (connected/released/suppressed/expired) never block a fresh active one (§B7.8).
create unique index uq_mutual_active on mutual_clicks (user_a_id, user_b_id)
  where status = 'active';
create index idx_mutual_user_a on mutual_clicks (user_a_id);
create index idx_mutual_user_b on mutual_clicks (user_b_id);
create index idx_mutual_active_expiry on mutual_clicks (expires_at) where status = 'active';

-- ---------------------------------------------------------------------------
-- 4. clicks - the SEND layer (§3)
-- ---------------------------------------------------------------------------
create table clicks (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  receiver_id uuid not null references profiles(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,  -- NULL = Process-1 discovery
  intent_mode text not null,                              -- sender's intent at send time
  surface text not null check (surface in ('discovery', 'who_was_there')),
  status click_status not null default 'pending',
  -- discovery: created_at + 7 days; post-event: event_end + 48h. Denormalised at insert.
  expires_at timestamptz not null,
  mutual_click_id uuid references mutual_clicks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_self_click check (sender_id <> receiver_id),
  constraint click_surface_event_consistency check (
    (surface = 'discovery'     and event_id is null) or
    (surface = 'who_was_there' and event_id is not null)
  )
);

-- §3 two partial unique indexes (replace the old single unconditional unique):
--   Process 1: one LIVE discovery click per ordered pair at a time.
create unique index uq_click_discovery on clicks (sender_id, receiver_id)
  where event_id is null and status = 'pending';
--   Process 2: one click per ordered pair per event.
create unique index uq_click_post_event on clicks (sender_id, receiver_id, event_id)
  where event_id is not null;
create index idx_clicks_receiver_pending on clicks (receiver_id, status) where status = 'pending';
create index idx_clicks_expiry on clicks (expires_at) where status = 'pending';
create index idx_clicks_sender on clicks (sender_id);

-- ---------------------------------------------------------------------------
-- 5. click_proposals - POST-MUTUAL COORDINATION (§B4) - replaces event_proposals
-- ---------------------------------------------------------------------------
create table click_proposals (
  id uuid primary key default gen_random_uuid(),
  mutual_click_id uuid not null references mutual_clicks(id) on delete cascade,
  suggested_event_id uuid references events(id) on delete set null,
  status click_proposal_status not null default 'pending',
  proposed_by uuid references profiles(id) on delete set null,
  -- §B5.5: room existed when proposed → a later accept-time fill is a *contended* fill.
  created_at_capacity_ok boolean not null default true,
  alternatives_count integer not null default 0,   -- joint counter-propose budget (cap 3)
  confirmed_by uuid references profiles(id) on delete set null,
  confirmed_at timestamptz,
  -- §B4.1: least(now()+48h, event_start-2h, mutual.expires_at). Default is the 48h arm.
  expires_at timestamptz not null default now() + interval '48 hours',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- §B4.4: one PENDING proposal per mutual (partial - history rows don't block a new one).
create unique index uq_one_pending_proposal on click_proposals (mutual_click_id)
  where status = 'pending';
create index click_proposals_status_idx on click_proposals (status, expires_at);
create index click_proposals_mutual_idx on click_proposals (mutual_click_id);

-- ---------------------------------------------------------------------------
-- 6. pair_suppressions - "Not feeling it" soft-no (§B7.1), time-boxed + silent
-- ---------------------------------------------------------------------------
create table pair_suppressions (
  user_a_id uuid not null references profiles(id) on delete cascade,
  user_b_id uuid not null references profiles(id) on delete cascade,  -- a < b canonical
  reason text not null check (reason in ('not_feeling_it')),
  expires_at timestamptz not null,                                    -- now() + 90 days
  created_at timestamptz not null default now(),
  primary key (user_a_id, user_b_id),
  constraint pair_suppressions_ordered check (user_a_id < user_b_id)
);
create index idx_pair_suppressions_expiry on pair_suppressions (expires_at);

-- ---------------------------------------------------------------------------
-- 7. click_swaps - post-event budget swap guard (§6.9): one swap per sender/event
-- ---------------------------------------------------------------------------
create table click_swaps (
  sender_id uuid not null references profiles(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  released_click_id uuid not null references clicks(id) on delete cascade,
  new_click_id uuid not null references clicks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sender_id, event_id)
);

-- ---------------------------------------------------------------------------
-- 8. Visibility + social-layer columns the mechanic reads (§6.6, §6.7a/b, §B7.3/B7.4)
--    Schema lands here once; the surfaces/enforcement that read them land in 2.2–2.6.
--    (This app models seats as event_attendees + guest_spots, not the spec's `bookings`.)
-- ---------------------------------------------------------------------------
alter table event_attendees add column if not exists visible_to_attendees boolean not null default true;
alter table guest_spots    add column if not exists visible_to_attendees boolean not null default true;

alter table profiles add column if not exists default_attend_visibility boolean not null default true;  -- §6.6
alter table profiles add column if not exists social_visible boolean not null default true;             -- §B7.4
alter table profiles add column if not exists paused_until timestamptz;                                  -- §B7.4a
alter table profiles add column if not exists last_active_at timestamptz default now();                  -- §B7.4b
alter table profiles add column if not exists reengagement_clicked_at timestamptz;                       -- §B7.4b
alter table profiles add column if not exists is_banned boolean not null default false;                  -- §6.7a (permanent)
alter table profiles add column if not exists post_event_click_suppressed_until timestamptz;             -- §B7.3

-- ---------------------------------------------------------------------------
-- 9. RLS parity (service-role pooler bypasses RLS; enabled to match 001/019 convention)
-- ---------------------------------------------------------------------------
alter table clicks          enable row level security;
alter table mutual_clicks   enable row level security;
alter table click_proposals enable row level security;

comment on table clicks is
  'Two-process anonymous one-way clicks (21 v9). surface=discovery (event_id null, 7d) or who_was_there (event_id set, event_end+48h). Mutual detection runs in the send transaction with FOR UPDATE lock ordering - no trigger.';
comment on table mutual_clicks is
  'Pair-level mutual (21 v9 §B2). status=active/connected/released/suppressed/expired; coord_state while active. One active mutual per pair (partial unique index).';
comment on table click_proposals is
  'Post-mutual coordination handshake (21 v9 §B4). One pending proposal per mutual; history rows kept.';

commit;
