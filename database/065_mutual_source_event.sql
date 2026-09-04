-- 065 - where a mutual came from (§B0 `mutual_click ... source_event_id NULLABLE`)
--
-- CLICK_PROCESS_RUNBOOK.md Stage 2 writes "one mutual_click row - user_a, user_b,
-- source_event_id (NULL for a discovery mutual)", and Stage 3 spends it: S3 is
-- "You clicked with Mia." plus "shared context (the event, for a post-event
-- mutual)". Without the column the reveal cannot tell a post-event mutual from a
-- discovery one, so both render the same context-free line - and the night the two
-- of them were actually at is the single most useful thing that screen could say.
--
-- The event IS technically recoverable through clicks.mutual_click_id + clicks
-- .event_id, but that costs a join on every drawer read to recover a fact the
-- forming transaction already had in hand. One nullable column instead.
--
-- on delete set null, not cascade: a deleted event must never take the mutual with
-- it. The connection happened; only its context is gone.
--
-- Additive only, safe to re-run.

alter table mutual_clicks
  add column if not exists source_event_id uuid references events(id) on delete set null;

comment on column mutual_clicks.source_event_id is
  'The event both sides were at when a post-event mutual formed (§B0). NULL for a discovery mutual, which has no event to name.';
