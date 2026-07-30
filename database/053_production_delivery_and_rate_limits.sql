begin;

-- Turn the existing email audit table into a lightweight, idempotent outbox.
alter table email_events add column if not exists delivery_status text;
alter table email_events add column if not exists provider_message_id text;
alter table email_events add column if not exists delivery_error text;
alter table email_events add column if not exists attempt_count integer not null default 0;
alter table email_events add column if not exists sent_at timestamptz;

update email_events
set delivery_status = 'legacy'
where delivery_status is null;

alter table email_events alter column delivery_status set default 'pending';
alter table email_events alter column delivery_status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'email_events_delivery_status_check'
  ) then
    alter table email_events
      add constraint email_events_delivery_status_check
      check (delivery_status in ('pending', 'sent', 'failed', 'skipped', 'legacy'));
  end if;
end $$;

create index if not exists email_events_delivery_status_idx
  on email_events (delivery_status, created_at)
  where delivery_status in ('pending', 'failed');

create unique index if not exists email_events_event_reminder_once_idx
  on email_events (template, to_profile_id, (vars->>'eventId'))
  where template = 'event-reminder-attendee'
    and to_profile_id is not null
    and vars ? 'eventId';

-- Fixed-window counters are intentionally database-backed so limits hold across
-- serverless instances and regions. Raw email/IP/user identifiers are never stored.
create table if not exists api_rate_limits (
  scope text not null,
  identity_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  expires_at timestamptz not null,
  primary key (scope, identity_hash, window_started_at)
);

create index if not exists api_rate_limits_expires_at_idx
  on api_rate_limits (expires_at);

commit;
