-- Safety primitives: block / mute / report.
--
-- Launch blocker per the business plan (§7.2): "User can block another user
-- from seeing them; mute disables notifications from that user; report sends
-- to admin queue with 24hr SLA." Must be live before dating mode opens.
--
--   user_blocks - blocker no longer appears to / can interact with blocked,
--                  and vice-versa (block is symmetric for discovery purposes).
--   user_mutes - muter stops receiving notifications originating from muted.
--   user_reports - flags a profile for admin review; feeds /admin/reports.

begin;

create table if not exists user_blocks (
  blocker_profile_id uuid not null references profiles(id) on delete cascade,
  blocked_profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_profile_id, blocked_profile_id),
  constraint no_self_block check (blocker_profile_id <> blocked_profile_id)
);

create index if not exists user_blocks_blocked_idx
  on user_blocks (blocked_profile_id);

create table if not exists user_mutes (
  muter_profile_id uuid not null references profiles(id) on delete cascade,
  muted_profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_profile_id, muted_profile_id),
  constraint no_self_mute check (muter_profile_id <> muted_profile_id)
);

create type report_reason as enum (
  'harassment',
  'inappropriate_messages',
  'spam_or_scam',
  'fake_profile',
  'safety_concern',
  'other'
);

create type report_status as enum ('open', 'actioned', 'dismissed');

create table if not exists user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid not null references profiles(id) on delete cascade,
  reported_profile_id uuid not null references profiles(id) on delete cascade,
  source_event_id uuid references events(id) on delete set null,
  reason report_reason not null,
  details text,
  status report_status not null default 'open',
  resolution_note text,
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint no_self_report check (reporter_profile_id <> reported_profile_id)
);

-- One open report per reporter→reported pair (re-reporting reuses the open row);
-- resolved reports don't block a fresh one.
create unique index if not exists user_reports_open_unique
  on user_reports (reporter_profile_id, reported_profile_id)
  where status = 'open';

create index if not exists user_reports_status_idx
  on user_reports (status, created_at);

-- RLS on, no anon/authenticated policies - all access is via the server's
-- service-role pool, matching the convention in 001_schema.sql.
alter table user_blocks enable row level security;
alter table user_mutes enable row level security;
alter table user_reports enable row level security;

commit;
