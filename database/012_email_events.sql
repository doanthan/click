-- Dev/staging email log. Instead of wiring an SMTP provider, we render the
-- template + variables locally (src/lib/email.ts) and persist the result here.
-- View a row in Supabase Studio → Table Editor → email_events → click the row
-- and the side-drawer shows the full rendered `html` and the `vars` jsonb.
--
-- This is intentionally not a queue or outbox - there's no `sent_at`, no
-- retry, no provider id. Once a real provider is wired, add those columns
-- (or move to a proper `email_outbox` table) and keep this for the dev log.

begin;

create table if not exists email_events (
  id uuid primary key default gen_random_uuid(),
  template text not null,
  to_email citext not null,
  to_profile_id uuid references profiles(id) on delete set null,
  subject text not null,
  html text not null,
  vars jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_events_created_at_idx
  on email_events (created_at desc);

create index if not exists email_events_to_profile_id_idx
  on email_events (to_profile_id)
  where to_profile_id is not null;

commit;
