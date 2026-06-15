-- 045_booking_events.sql
-- Spec: TECH/22_ANALYTICS.md §2 (Phase A — "ship before first paid ticket").
--
-- Append-only log of every booking-lifecycle transition. The live tables
-- (`event_attendees`, `payment_transactions`) remain the source of truth for
-- CURRENT state; this table is the immutable source of truth for ANALYTICS and
-- financial/Stripe reconciliation. Mutating `event_attendees.status` in place
-- destroys cancellation/refund history that can never be reconstructed, which
-- is exactly what this log preserves.
--
-- Schema deviations from the spec, by design, to match this codebase:
--   * `booking_id` = `event_attendees.id` (we have no separate `bookings`
--     table; the attendee row IS the booking). No FK — history outlives deletes.
--   * `merchant_id` is NULLABLE here. The spec assumes every event has a
--     merchant ("no open hosting"), but this implementation still has
--     platform-owned events (seed/admin) with `events.merchant_profile_id IS
--     NULL`; forcing NOT NULL would make their lifecycle un-loggable.
--   * `refund_tier` stores the spec's time-band values; the app's
--     RefundTier ('full'|'half'|'none') maps full→gt_48h, half→within_48h,
--     none→within_24h (the >48h / 24–48h / <24h policy in refund-policy.ts).

create table if not exists booking_events (
  id               bigint generated always as identity primary key,
  booking_id       uuid not null,            -- event_attendees.id; no FK cascade
  event_id         uuid not null,
  merchant_id      uuid,                     -- NULL for platform-owned events
  user_id          uuid,                     -- NULL for guest RSVPs (spec 19)
  guest_rsvp_id    uuid,                     -- set when user_id is NULL
  event_type       text not null check (event_type in (
                     'reserved',
                     'reservation_expired',
                     'confirmed',
                     'cancelled_by_attendee',
                     'cancelled_by_merchant',
                     'refunded_full',
                     'refunded_partial',
                     'refund_denied',
                     'attended',
                     'no_show',
                     'payout_included'
                   )),
  amount_cents     integer,                  -- signed: negative for refunds; NULL for non-monetary
  currency         text not null default 'AUD',
  refund_tier      text check (refund_tier in ('gt_48h','within_48h','within_24h')),
  stripe_object_id text,                     -- charge / refund / payout id
  occurred_at      timestamptz not null default now(),
  recorded_at      timestamptz not null default now(),  -- arrival time; differs on webhook replay
  actor            text not null check (actor in (
                     'attendee','guest','merchant','admin','system','stripe_webhook'
                   )),
  metadata         jsonb not null default '{}'
);

-- Append-only enforcement. The trigger is the real guard (fires for every
-- writer including the table owner under normal session_replication_role);
-- the REVOKE is belt-and-braces for Supabase's predefined roles when present.
create or replace function deny_booking_events_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'booking_events is append-only';
end $$;

drop trigger if exists booking_events_immutable on booking_events;
create trigger booking_events_immutable
  before update or delete on booking_events
  for each row execute function deny_booking_events_mutation();

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke update, delete on booking_events from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke update, delete on booking_events from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke update, delete on booking_events from service_role';
  end if;
end $$;

-- Webhook idempotency: Stripe retries deliveries. A replay with the same
-- (stripe_object_id, event_type) becomes a no-op `on conflict do nothing`
-- insert instead of a duplicate financial event.
create unique index if not exists booking_events_stripe_idem
  on booking_events (stripe_object_id, event_type)
  where stripe_object_id is not null;

create index if not exists booking_events_merchant_time on booking_events (merchant_id, occurred_at);
create index if not exists booking_events_booking on booking_events (booking_id);
create index if not exists booking_events_event on booking_events (event_id);

-- One-time backfill (spec §2.2): synthesize one event per existing attendee row
-- from its current status, stamped backfilled. Timestamps are creation-time
-- approximations, so backfilled rows are excluded from lead-time/refund-tier
-- analytics (filter on metadata->>'backfilled') but counted in volume/revenue.
-- Guarded so re-running the migration can't double-insert.
insert into booking_events (
  booking_id, event_id, merchant_id, user_id, event_type,
  amount_cents, currency, stripe_object_id, occurred_at, recorded_at, actor, metadata
)
select
  a.id,
  a.event_id,
  e.merchant_profile_id,
  a.profile_id,
  case a.status
    when 'confirmed' then 'confirmed'
    when 'cancelled' then 'cancelled_by_attendee'
    when 'refunded'  then 'refunded_full'
    when 'pending_payment' then 'reserved'
  end as event_type,
  case
    when a.status = 'refunded' and pt.amount_cents is not null then -pt.amount_cents
    when a.status in ('confirmed','pending_payment') then pt.amount_cents
    else null
  end as amount_cents,
  coalesce(pt.currency::text, 'AUD'),
  null,
  a.created_at,
  now(),
  'system',
  jsonb_build_object('backfilled', true)
from event_attendees a
join events e on e.id = a.event_id
left join payment_transactions pt on pt.id = a.payment_transaction_id
where a.status in ('confirmed','cancelled','refunded','pending_payment')
  and not exists (select 1 from booking_events be where be.booking_id = a.id);
