-- Booking hold expiry - closes the capacity race / ghost-seat bug.
--
-- A paid checkout reserves a seat with an `event_attendees` row in
-- status 'pending_payment' (see 003_stripe_hold.sql). Previously such a hold
-- had no expiry, so an abandoned Stripe Checkout permanently consumed a seat:
-- the event read as "full" forever even though nobody paid. And the capacity
-- trigger only enforced on 'confirmed' writes, so it never counted live holds.
--
-- Fix (no background reaper):
--   1. `hold_expires_at` stamps each hold; checkout sets it to now()+30min to
--      match Stripe's minimum Checkout Session lifetime (so the seat and the
--      payment window expire together).
--   2. Every occupancy count treats a hold as occupying ONLY while
--      hold_expires_at > now(). An expired hold stops counting, so the seat is
--      reclaimable by the next booker without any cleanup job.
--   3. The capacity trigger now also fires on 'pending_payment' inserts and
--      counts confirmed + live holds, so the database is the source of truth
--      under concurrency (defense in depth on top of `for update of event`).

begin;

alter table event_attendees
  add column if not exists hold_expires_at timestamptz;

-- Fast occupancy scans for the capacity count + trigger.
create index if not exists event_attendees_occupancy_idx
  on event_attendees (event_id, status, hold_expires_at);

create or replace function ensure_event_capacity()
returns trigger
language plpgsql
as $$
declare
  event_capacity integer;
  occupied_count integer;
begin
  -- Only seat-occupying writes need the capacity gate.
  if new.status not in ('confirmed', 'pending_payment') then
    return new;
  end if;

  -- An already-expired hold occupies nothing; let it through.
  if new.status = 'pending_payment'
     and new.hold_expires_at is not null
     and new.hold_expires_at <= now() then
    return new;
  end if;

  select capacity into event_capacity
  from events
  where id = new.event_id
  for update;

  select count(*)::integer into occupied_count
  from event_attendees
  where event_id = new.event_id
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and (
      status = 'confirmed'
      or (status = 'pending_payment' and hold_expires_at > now())
    );

  if occupied_count >= event_capacity then
    raise exception 'event capacity reached for %', new.event_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

commit;
