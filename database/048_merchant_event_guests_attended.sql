-- 048_merchant_event_guests_attended.sql
-- Spec: TECH/19_GUEST_RSVP.md §9 + §11 (day-of check-in).
--
-- The merchant checks guests in by first name against the door list; check-in
-- writes guest_spots.attended, which gates the post-event celebration copy the
-- same way event_attendees.checked_in_at does for profile attendees. Surface the
-- flag on the door-list view so the merchant page can render a check-in toggle.
--
-- `attended` is appended LAST so this stays a valid `create or replace view`
-- (Postgres only allows adding new output columns at the end of an existing view).

create or replace view merchant_event_guests_v as
select
  gs.id                        as guest_id,
  gs.event_id,
  e.merchant_profile_id,
  gs.guest_first_name          as first_name,
  gs.status,
  pp.display_name              as purchased_by,
  gs.created_at,
  coalesce(gs.attended, false) as attended
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
