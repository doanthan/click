-- 051_event_capacity_view.sql
-- Spec: TECH/05_BOOKING_LIFECYCLE.md §2.5 (canonical seat-count) + 21 §B3.4/§B5.
-- START_HERE Step 2.3 - Capacity & guest +1s.
--
-- (Supersedes the mis-numbered 050_event_capacity_view.sql, which collided with
--  050_event_rejection_reason.sql AND was missing the waitlist-offer seat arm below.)
--
-- CAP-3: there was NO capacity view; seat-count was computed inline at 6+ sites with
-- TWO divergent formulas - the booking/headcount paths (CAP-6) correctly net seats, but
-- the click suggestion/proposal paths used a guest-blind count (CAP-2) and only guarded
-- `< capacity` i.e. >= 1 free seat (CAP-1), so a one-seat / guest-full event was still
-- suggested to a PAIR and stranded one of them.
--
-- This view is the single source of truth. It reproduces EXACTLY the THREE-arm CAP-6
-- reference formula used by the write-path capacity gates (createPaymentHold ~9235-9279,
-- registerForEvent ~3160-3183) so there is one canonical seat count:
--   seats_taken = confirmed/held event_attendees                     (arm 1)
--               + paid guest +1 seats (live guest_spots)             (arm 2)
--               + live waitlist offers (a freed seat re-offered to    (arm 3)
--                 the next person, reserved for its 30-min window)
-- The booking gates additionally subtract the CURRENT buyer's own seat/offer
-- (`profile_id <> $buyer`); the view has no buyer context and counts ALL live seats as
-- taken - the correct conservative behaviour for the pair-suggestion gates (so a plan is
-- never suggested/confirmed into a seat the booking layer would then refuse).
--
-- It's a VIEW (not a table) - always live, no cron, no row migration. now() makes the
-- hold + offer arms time-sensitive, exactly like the inline booking gate.

create or replace view event_capacity_v as
select
  e.id as event_id,
  e.capacity,
  taken.seats_taken,
  greatest(e.capacity - taken.seats_taken, 0) as available
from events e
cross join lateral (
  select (
    -- Arm 1: confirmed RSVPs + live (unexpired) payment holds.
    coalesce((
      select count(*)
      from event_attendees ea
      where ea.event_id = e.id
        and (ea.status = 'confirmed'
             or (ea.status = 'pending_payment' and ea.hold_expires_at > now()))
    ), 0)
    -- Arm 2: paid guest +1 seats (spec 19) - each non-cancelled guest_spots row is a held
    -- seat while the buyer's payment transaction still has a confirmed/held attendee row.
    + coalesce((
      select count(*)
      from guest_spots gs
      join event_attendees ga on ga.payment_transaction_id = gs.payment_transaction_id
      where gs.event_id = e.id
        and gs.status <> 'cancelled'
        and (ga.status = 'confirmed'
             or (ga.status = 'pending_payment' and ga.hold_expires_at > now()))
    ), 0)
    -- Arm 3: live waitlist offers - a seat freed by a cancellation and re-offered to the
    -- next person in line is reserved for them for the 30-min `offered_until` window
    -- (bug board #114). Counted as taken until accepted or the window lapses, exactly as
    -- the booking gate does, so the click layer can't hand the same seat to a pair.
    + coalesce((
      select count(*)
      from event_waitlists w
      join event_attendees wa
        on wa.event_id = w.event_id
       and wa.profile_id = w.profile_id
       and wa.status = 'waitlisted'
      where w.event_id = e.id
        and w.accepted_at is null
        and w.offered_until > now()
    ), 0)
  )::int as seats_taken
) taken;

comment on view event_capacity_v is
  'Canonical per-event seat count (05 §2.5). seats_taken = confirmed/held attendees + live guest_spots + live waitlist offers (the exact 3-arm CAP-6 booking-gate formula, minus the buyer-scoped exclusions which do not apply view-side). available = capacity - seats_taken (floored at 0). Single source of truth for the click suggestion/proposal capacity gates (21 §B3.4/§B5); the booking paths keep their own inline gate. Repoint here, never re-derive capacity.';
