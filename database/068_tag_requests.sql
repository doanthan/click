begin;

-- 068_tag_requests.sql
--
-- Hosts can ask for a tag that isn't in the list yet, and admins approve or
-- dismiss the ask (bug board #272, #275).
--
-- Tags stay admin-curated. The event wizard's picker only offers existing
-- tags, and createEventForMerchant drops anything else. This table is the
-- queue between the two: a host types the tag they're missing, the request
-- waits on /admin/tags, and approving it creates the tag through the same
-- upsert the admin form uses (createTagForAdmin) and links it back here.
--
--   status   'pending' until an admin decides, then 'approved' or 'dismissed'
--   tag_id   the tag that approving created or matched
--
-- One open request per host per label (case-insensitive), so a double submit
-- can't queue the same tag twice. The app reads this table fail-soft: until
-- this migration is applied, /admin/tags shows no requests and the wizard's
-- request form says requests aren't switched on yet.
--
-- Additive and idempotent - safe to re-run.

create table if not exists tag_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_profile_id uuid not null references merchant_profiles(id) on delete cascade,
  requested_by_profile_id uuid references profiles(id) on delete set null,
  label text not null check (char_length(btrim(label)) between 2 and 40),
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'dismissed')),
  tag_id uuid references tags(id) on delete set null,
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  decided_by_profile_id uuid references profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists tag_requests_one_open_per_label
  on tag_requests (merchant_profile_id, lower(btrim(label)))
  where status = 'pending';

-- The /admin/tags queue: pending only, oldest first.
create index if not exists tag_requests_pending_created_at_idx
  on tag_requests (created_at)
  where status = 'pending';

-- RLS parity: the service-role pooler bypasses it; enabled to match the
-- 001 / 019 / 049 convention so PostgREST never exposes the table.
alter table tag_requests enable row level security;

commit;
