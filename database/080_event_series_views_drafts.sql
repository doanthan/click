begin;

-- 080_event_series_views_drafts.sql
--
-- Three merchant-audit fixes (context/MERCHANT_STRIPE_AUDIT_FOR_CINDY.md).
-- Additive only.
--
-- 1. events.series_id (fix 20). A repeating event is one events row per date,
--    all with the same title, so the portal showed four rows called "Trivia"
--    and nothing tied them together. The wizard now stamps one id on every
--    date it creates in a single submit. Null for a one-off.
--
-- 2. event_page_views (fix 34). Nothing counted event page views, so a host
--    had no views-to-bookings number. One row per event per Sydney day,
--    bumped by the public event page; a host's own views are not counted.
--
-- 3. event_drafts (fix 19). A half-built event lived only in one browser's
--    localStorage, so starting on a laptop and finishing on a phone lost it.
--    One draft per host, the wizard's own values as JSON, saved as they type.
--
-- Idempotent - safe to re-run.

alter table events
  add column if not exists series_id uuid;

create index if not exists events_series_id_idx
  on events (series_id)
  where series_id is not null;

create table if not exists event_page_views (
  event_id uuid not null references events(id) on delete cascade,
  day date not null,
  views integer not null default 0 check (views >= 0),
  primary key (event_id, day)
);

-- RLS parity with 001 / 049 / 072: the service-role pooler bypasses it, and
-- PostgREST never exposes the table.
alter table event_page_views enable row level security;

create table if not exists event_drafts (
  merchant_profile_id uuid primary key references merchant_profiles(id) on delete cascade,
  draft jsonb not null,
  updated_at timestamptz not null default now()
);

alter table event_drafts enable row level security;

commit;
