-- Promote the surviving free-form interest tags to curated "click tags".
--
-- After database/027_remove_orphan_tags.sql deletes the unreferenced leftovers,
-- the only `admin_managed = false` / `tag_type = 'interest'` rows still standing
-- are ones a real event or profile points at. Those are legitimate in-use tags —
-- promote them into the curated taxonomy so they're treated like any other click
-- tag (and won't be caught by a future admin_managed = false sweep). The
-- associations are untouched; this only flips the flag.
--
-- Scope mirrors 026/027: admin_managed = false + tag_type = 'interest' only, so
-- seeded 'life' / 'music' / 'vibe' tags keep their original flags. Idempotent.

begin;

update tags
set admin_managed = true
where admin_managed = false
  and tag_type = 'interest';

commit;
