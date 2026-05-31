-- 036_waitlist_offer_expiry.sql
--
-- Track when a waitlist promotion offer lapses, so the expiry cron can:
--   1. tell the user their 30-minute offer expired (they keep their place), and
--   2. deprioritise them for the NEXT auto-offer so the freed seat rolls to
--      someone who hasn't been offered yet (spec §3.4) instead of pinging the
--      same non-responsive person again.
--
-- promoteNextWaitlister() orders by (last_offer_expired_at is not null) asc so
-- never-offered waitlisters are preferred over previously-expired ones, then by
-- created_at. See src/lib/event-repository.ts.

alter table event_waitlists
  add column if not exists last_offer_expired_at timestamptz;
