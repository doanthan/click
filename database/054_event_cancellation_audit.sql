begin;

-- Preserve why an event was taken down and who initiated it. The immutable
-- audit_logs and booking_events tables remain the detailed history; these
-- columns make the event's current cancellation state self-describing.
alter table events
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by_profile_id uuid references profiles(id) on delete set null;

create index if not exists events_cancelled_at_idx
  on events (cancelled_at desc)
  where cancelled_at is not null;

commit;
