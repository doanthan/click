-- The Life quiz's "Creative / hands-on" answer used to carry the slug
-- `creative`, which 002_seed.sql already owns as an admin-managed `interest`
-- tag. saveLifeQuizTags upserts tags by slug, so the answer linked the profile
-- to that interest tag instead of creating a 'life' one. Two consequences:
-- the user grew a "Creative" interest chip they never picked, and retaking the
-- quiz could never remove it, because that delete is guarded on tag_type='life'.
--
-- src/lib/life-quiz-sections.ts now emits `creative-hands-on`. This re-points
-- any answer already recorded under the old slug.
--
-- Verified read-only before writing this: production held 0 user_tags rows, so
-- on the current database every statement below is a no-op. It exists so the
-- fix is complete whenever it ships, and is idempotent either way.

insert into tags (label, slug, tag_type, admin_managed)
values ('Creative Hands On', 'creative-hands-on', 'life', false)
on conflict (slug) do nothing;

-- Only source='quiz' links move. A 'creative' interest picked during onboarding
-- or from the interests picker is a real choice and stays exactly where it is.
update user_tags ut
   set tag_id = (select id from tags where slug = 'creative-hands-on')
  from tags t
 where t.id = ut.tag_id
   and t.slug = 'creative'
   and t.tag_type = 'interest'
   and ut.source = 'quiz'
   -- Skip anyone who already holds the new tag; the composite key would clash.
   and not exists (
     select 1
       from user_tags existing
       join tags nt on nt.id = existing.tag_id
      where existing.profile_id = ut.profile_id
        and nt.slug = 'creative-hands-on'
   );

-- Anyone caught by that exists-guard held both rows; the old one is now redundant.
delete from user_tags ut
 using tags t
 where t.id = ut.tag_id
   and t.slug = 'creative'
   and t.tag_type = 'interest'
   and ut.source = 'quiz';
