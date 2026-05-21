-- Adds a "hold" status so a paid event seat can be reserved for the duration
-- of a Stripe Checkout session without being double-sold to another buyer.
-- The Stripe checkout API insert this row before redirecting; the webhook
-- promotes it to 'confirmed' on success and back to 'cancelled' on failure
-- or expiry.

alter type rsvp_status add value if not exists 'pending_payment';
