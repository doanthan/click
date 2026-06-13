-- 044_event_pending_address.sql
--
-- Address changes that need admin review. A street-address edit on an event that
-- already has attendees materially affects people who've booked (they may have
-- planned travel around it), so instead of going live immediately the proposed
-- new address is parked in events.pending_address and an admin approves or
-- rejects it from /admin/events. On approval the value is copied into `address`
-- and this column is cleared; on rejection it's just cleared. Events with no
-- attendees still self-edit their address immediately (nothing to disrupt).

alter table events
  add column if not exists pending_address text;
