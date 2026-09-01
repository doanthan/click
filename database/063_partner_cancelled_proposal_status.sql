-- 063 - §B5.6 "partner cancels their booking during confirmed_together"
--
-- TECH/21_CLICK_MECHANIC.md §B5.6 (added 2026-07-05, marked launch-blocking) and
-- UIUX/CLICK_COORDINATION_SCREENS.md S18. Neither was implemented in any form: no
-- RSVP-cancel path touched mutual_clicks or click_proposals, so a survivor kept a
-- "you're both going" plan pointing at a partner who had cancelled - the dishonest
-- ghost-plan §B0 exists to prevent - and the CANCELLER kept being prompted to
-- re-book the event they had just left.
--
-- The teardown needs a durable signal so the drawer can render S18 instead of the
-- peak, and so the survivor's notification can name the event. The retired proposal
-- row already carries suggested_event_id, so one new terminal status on the existing
-- enum is the whole schema change - a sibling of 'event_full' and 'event_cancelled',
-- which are the same shape of "this attempt ended for a reason that is nobody's
-- fault". No new table, no new column, no backfill.
--
-- Safe to re-run.

alter type click_proposal_status add value if not exists 'partner_cancelled';

comment on type click_proposal_status is
  'A single proposal''s lifecycle (§B2a). Terminal rows are frozen history - the live coordination axis is mutual_clicks.coord_state. partner_cancelled (§B5.6): the agreed plan ended because one side cancelled their booking; the mutual itself is UNTOUCHED and returns to coord_state=open.';
