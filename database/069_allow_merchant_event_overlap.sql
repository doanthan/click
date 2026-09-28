begin;

-- 069_allow_merchant_event_overlap.sql
--
-- A host may now run two of their own events at the same time.
--
-- prevent_merchant_event_overlap (001_schema.sql) refused any insert or update
-- that left one merchant with two overlapping live/featured/locked/waitlist
-- events. The product owner ruled that an overlap is fine (bug board #223,
-- #273, #278): a venue with two rooms, or a weekly event whose duplicate lands
-- on next week's session, is a real case, not an error. What it did in
-- practice:
--
--   * a duplicated event "would not let me create" it (#223) - the copy is
--     re-dated a week out, which is exactly where a weekly series already
--     has its next session;
--   * an admin could not approve a pending event over a live one (#273/#278);
--   * one overlapping event made publishEventsHeldForPayouts' single UPDATE
--     fail, which kept every other held event pending with it.
--
-- The block becomes a heads-up in the app instead: createEventForMerchant
-- tells the host which of their events it overlaps, and the admin queue flags
-- the overlap and asks for a confirm before approving.
--
-- Idempotent - safe to re-run. Nothing else reads the function.

drop trigger if exists prevent_merchant_event_overlap_before_event_write on events;
drop function if exists prevent_merchant_event_overlap();

commit;
