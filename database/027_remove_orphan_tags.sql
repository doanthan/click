-- Remove orphaned free-form tags left behind by the old write paths.
--
-- Before tags became "click tags" (see database/026_curate_interest_tags.sql),
-- `saveOnboarding` and `createEventForMerchant` minted new `tags` rows from
-- whatever a user typed/selected, always with `tag_type = 'interest'` and
-- `admin_managed = false`. This deletes the leftovers that nothing points to.
--
-- Scope is deliberately narrow:
--   * admin_managed = false      -> never touch the curated/admin-created tags
--   * tag_type = 'interest'      -> the only type those free-form paths produced;
--                                   protects seeded 'life' / 'music' / 'vibe' tags
--   * zero references            -> orphans only. event_tags.tag_id and
--                                   user_tags.tag_id are ON DELETE CASCADE, so a
--                                   referenced tag would take real associations
--                                   down with it — those are left in place.
--
-- Idempotent: a second run finds nothing left to delete.

begin;

delete from tags t
where t.admin_managed = false
  and t.tag_type = 'interest'
  and not exists (select 1 from event_tags et where et.tag_id = t.id)
  and not exists (select 1 from user_tags ut where ut.tag_id = t.id);

commit;
