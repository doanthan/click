-- Adds a 'rejected' status to the event lifecycle so admins can decline a
-- pending event submission (distinct from 'cancelled', which is for a live
-- event being called off and triggers attendee refund/notification fan-out).
--
-- Pairs with merchants now being able to submit events *before* finishing
-- Stripe Connect payout setup (the create-event payouts gate was removed):
-- admin review is the safety net, and a declined event lands here.

alter type event_status add value if not exists 'rejected';
