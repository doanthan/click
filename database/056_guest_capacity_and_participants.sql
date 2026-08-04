-- 056_guest_capacity_and_participants.sql
--
-- Two gaps that both come from the same root cause: a seat can exist as either
-- an `event_attendees` row OR a `guest_spots` row (see 046), but two subsystems
-- only ever learned about the first kind.
--
-- 1. CAPACITY BACKSTOP. `ensure_event_capacity()` (001, rewritten in 017) is
--    attached to event_attendees only and counts only event_attendees. Guest +1
--    seats therefore face NO database-level capacity check at all - the sole
--    guard is the inline gate in createPaymentHold. That gate is correct, but it
--    means the "defense in depth under concurrency" that 017 deliberately added
--    for attendee seats simply does not exist for guest seats.
--
--    The check is a STATEMENT-level trigger with a transition table, not a row
--    trigger, because reserveUnnamedGuestSeats inserts the whole party in one
--    set-based statement (`insert ... select from generate_series`). A BEFORE
--    ROW trigger cannot see rows inserted earlier by its own command, so the
--    occupancy count would not increment across the party and a 3-seat insert
--    would pass with only 1 seat free. At AFTER STATEMENT every new row is
--    visible, so one count sees the true total.
--
--    Scope is INSERT only. Naming, claiming, releasing and "remove my details"
--    do not change the seat count, and gating them would let a full event refuse
--    a privacy action. Cancelled -> live is not a legitimate application path;
--    removeGuestDetailsByToken's missing status guard (the one way to reach it)
--    is fixed in application code alongside this migration.
--
-- 2. WHO COUNTS AS A PARTICIPANT. The click mechanic decides attendance with
--    `event_attendees.status = 'confirmed'` at four sites (the recordClick
--    eligibility gate, two roster queries, and the notification cron). Someone
--    who claimed a guest spot has no event_attendees row, so they were invisible
--    in BOTH directions: they saw no post-event prompt, and they appeared on
--    nobody else's roster. They physically attended and paid, via someone else's
--    booking. event_participants_v is the canonical roster those four sites now
--    read instead of re-deriving attendance.
--
--    This view is deliberately NOT used by any capacity path. Claiming a guest
--    spot attaches an identity to an already-counted seat; it never adds one.

begin;

-- Canonical "who was actually at this event", identity-wise.
create or replace view event_participants_v as
  select ea.event_id, ea.profile_id
  from event_attendees ea
  where ea.status = 'confirmed'
union
  -- A claimed guest seat is a real person at the event. Mirror the same
  -- liveness rule claimGuestSpotForProfile enforces at claim time: the seat
  -- only counts while the purchaser's own booking is still confirmed.
  select gs.event_id, gs.claimed_profile_id as profile_id
  from guest_spots gs
  join event_attendees ga
    on ga.payment_transaction_id = gs.payment_transaction_id
   and ga.profile_id = gs.purchaser_profile_id
  where gs.status = 'claimed'
    and gs.claimed_profile_id is not null
    and ga.status = 'confirmed';

comment on view event_participants_v is
  'Canonical per-event participant identities: confirmed event_attendees UNION claimed guest_spots (while the purchaser booking is confirmed). Read by the click mechanic''s attendance gates (recordClick eligibility, the two post-event roster queries, notifyPostEventClickPrompts). NOT a capacity source - a claimed guest names an already-counted seat. For seat counts use event_capacity_v.';

create or replace function ensure_guest_spot_capacity()
returns trigger
language plpgsql
as $$
declare
  offending uuid;
begin
  -- Serialize against concurrent bookings on the same events, matching what
  -- ensure_event_capacity() does for attendee writes.
  perform 1
  from events
  where id in (select distinct event_id from new_rows where status <> 'cancelled')
  for update;

  select touched.event_id into offending
  from (select distinct event_id from new_rows where status <> 'cancelled') touched
  join events e on e.id = touched.event_id
  where (
    -- Arm 1: confirmed RSVPs + live (unexpired) payment holds.
    (
      select count(*)
      from event_attendees ea
      where ea.event_id = touched.event_id
        and (ea.status = 'confirmed'
             or (ea.status = 'pending_payment' and ea.hold_expires_at > now()))
    )
    -- Arm 2: live guest seats, including the rows this statement just inserted.
    -- Counted only while the purchaser's booking is itself live, mirroring the
    -- attendee rule and event_capacity_v.
    + (
      select count(*)
      from guest_spots gs
      join event_attendees ga
        on ga.payment_transaction_id = gs.payment_transaction_id
       and ga.profile_id = gs.purchaser_profile_id
      where gs.event_id = touched.event_id
        and gs.status <> 'cancelled'
        and (ga.status = 'confirmed'
             or (ga.status = 'pending_payment' and ga.hold_expires_at > now()))
    )
  ) > e.capacity
  limit 1;

  -- Strictly greater: the new seats are already counted above, so equality is a
  -- perfectly full event, not an overbooked one.
  if offending is not null then
    raise exception 'event capacity reached for %', offending
      using errcode = '23514';
  end if;

  return null;
end;
$$;

drop trigger if exists ensure_guest_spot_capacity_after_insert on guest_spots;
create trigger ensure_guest_spot_capacity_after_insert
after insert on guest_spots
referencing new table as new_rows
for each statement execute function ensure_guest_spot_capacity();

commit;
