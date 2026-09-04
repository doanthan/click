-- 064 - the post-event click window's "answered" bit (§B0 click_window.answered)
--
-- TECH/implementation/CLICK_PROCESS_RUNBOOK.md Part B B0 asks for a click_window
-- table (id, user_id, event_id, opened_at, closes_at, answered). The open/closed
-- half of that row is already correct here and needs no storage: every roster
-- query derives the window arithmetically from the event clock (event_end + 2h
-- until event_end + 48h), so a stored opened_at/closes_at would be a second copy
-- of a fact the events table already holds - and B5.1 wants closes_at nowhere
-- near a payload anyway.
--
-- What genuinely has nowhere to live is "answered". Stage 0.5: "Answered = the
-- user clicked at least one person, or explicitly tapped `No one this time`.
-- Answering hides the banner permanently for that event." Today a viewer who
-- clicks one of five co-attendees sees the same card on every dashboard visit
-- until the window runs out. So this migration stores only that bit, keyed by
-- the pair the runbook's UNIQUE(user_id, event_id) names.
--
-- kind records WHICH answer it was (C4.13 distinguishes them; `Maybe later` is
-- not an answer and stays client-only), so the two cases stay separable later.
--
-- Additive only: one new table, no drops and no alters. Safe to re-run.

create table if not exists post_event_click_answers (
  profile_id  uuid not null references profiles(id) on delete cascade,
  event_id    uuid not null references events(id) on delete cascade,
  kind        text not null check (kind in ('clicked', 'none')),
  answered_at timestamptz not null default now(),
  primary key (profile_id, event_id)
);

comment on table post_event_click_answers is
  'Runbook B0 click_window.answered, stored per (viewer, event). A row here permanently retires that event''s post-event click surface for that viewer - kind=clicked when they clicked at least one co-attendee, kind=none when they tapped "No one this time" or the pool was empty when they looked. The open/closed half of the window is still derived from the event clock.';
