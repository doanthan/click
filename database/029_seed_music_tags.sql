-- Seed the music-taste genres as curated "click tags" (tag_type = 'music').
--
-- The profile-edit music picker (src/lib/click-data.ts `musicTags`) lets users
-- tag their music taste as a subtle matching signal. Like interest tags, these
-- are never free-form: the picker submits a fixed slug per genre and the save
-- path attaches only `music` tags that already exist. This migration seeds them.
--
-- Slugs MUST match `musicTags` in src/lib/click-data.ts. `jazz` and `indie`
-- already exist from database/002_seed.sql (left untouched by the conflict
-- guard); `house-music` is suffixed so it doesn't collide with the `house`
-- interest tag (slug is unique across all tags). Idempotent on `tags.slug`.

begin;

with category_lookup as (
  select id from tag_categories where slug = 'music'
)
insert into tags (category_id, label, slug, tag_type, admin_managed)
select category_lookup.id, seed.label, seed.slug, 'music', true
from category_lookup,
  (
    values
      ('Pop',        'pop'),
      ('Rock',       'rock'),
      ('Electronic', 'electronic'),
      ('House',      'house-music'),
      ('Hip Hop',    'hip-hop'),
      ('R&B',        'rnb'),
      ('Folk',       'folk'),
      ('Classical',  'classical'),
      ('Reggae',     'reggae'),
      ('Soul',       'soul'),
      ('Funk',       'funk'),
      ('Latin',      'latin')
  ) as seed(label, slug)
on conflict (slug) do nothing;

commit;
