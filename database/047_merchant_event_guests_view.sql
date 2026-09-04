-- 047_merchant_event_guests_view.sql
-- Spec: TECH/19_GUEST_RSVP.md §11 (Merchant View / day-of door list).
--
-- The merchant's door list: the NAMED guest spots ('invited' / 'claimed') for an
-- event, exposing FIRST NAME + STATUS + who purchased the seat - and nothing else.
-- No email, no DOB: "First name + status only" is the entire merchant-visible
-- footprint of a guest (spec §9 + §11). Unnamed +1s are deliberately absent here;
-- they exist only in the seat headcount (counted separately in query code), exactly
-- as the spec keeps them out of the door list while still counting their seat.
--
-- ADAPTATION (spec/code divergence, same basis recorded in 046_guest_spots.sql):
-- the spec joins `bookings b on b.id = gs.booking_id and b.status = 'confirmed'`
-- and reads `p.full_name` off `b.user_id`. This codebase has no `bookings` table -
-- the purchaser's "confirmed booking" is their confirmed `event_attendees` row,
-- matched to the seat through `payment_transactions` (guest_spots.payment_transaction_id),
-- and the purchaser's identity is `guest_spots.purchaser_profile_id`. We surface
-- `profiles.display_name` (our name column) as `purchased_by`. exists() (not a join
-- onto event_attendees) so a seat can't fan out across attendee rows.
--
-- No RLS: like every table here we reach Postgres via the service-role pooler and
-- scope access in query code. The view exposes `merchant_profile_id` so callers
-- enforce merchant ownership with a one-line `where merchant_profile_id = $n`.

create or replace view merchant_event_guests_v as
select
  gs.id                   as guest_id,
  gs.event_id,
  e.merchant_profile_id,
  gs.guest_first_name     as first_name,
  gs.status,
  pp.display_name         as purchased_by,
  gs.created_at
from guest_spots gs
join events e on e.id = gs.event_id
join profiles pp on pp.id = gs.purchaser_profile_id
where gs.status in ('invited', 'claimed')
  and exists (
    select 1
    from event_attendees ea
    where ea.payment_transaction_id = gs.payment_transaction_id
      and ea.status = 'confirmed'
  );
