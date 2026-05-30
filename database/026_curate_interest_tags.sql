-- Curate the interest taxonomy so tags are never free-form ("click tags" only).
--
-- The onboarding interest chips (`interestTagCategories` in src/lib/click-data.ts)
-- and the merchant event-tag picker both used to mint brand-new `tags` rows with
-- `admin_managed = false` from whatever a user typed/selected. We're locking the
-- write paths (`saveOnboarding`, `createEventForMerchant`) to attach only tags
-- that already exist, matched by slug. For that to work the chips users can pick
-- must exist as real, admin-managed tags first — that's what this migration seeds.
--
-- Slugs match the runtime slugifier used by the write paths:
--   trim(both '-' from regexp_replace(lower(trim(label)), '[^a-z0-9]+', '-', 'g'))
-- Idempotent on `tags.slug`; chips that were already seeded (yoga, running,
-- pottery, brunch, volunteering) are left untouched by the on-conflict guard.

begin;

with category_lookup as (
  select id, slug from tag_categories
)
insert into tags (category_id, label, slug, tag_type, admin_managed)
select category_lookup.id, seed.label, seed.slug, 'interest', true
from (
  values
    -- Music & culture
    ('creative',  'Live Jazz',       'live-jazz'),
    ('creative',  'House',           'house'),
    ('creative',  'Karaoke',         'karaoke'),
    ('creative',  'Acoustic',        'acoustic'),
    -- Arts & making
    ('creative',  'Painting',        'painting'),
    ('creative',  'Life Drawing',    'life-drawing'),
    ('creative',  'Crafts',          'crafts'),
    -- Food
    ('food',      'Wine Tasting',    'wine-tasting'),
    ('food',      'Vegan Eats',      'vegan-eats'),
    ('food',      'Cooking Classes', 'cooking-classes'),
    -- Wellness
    ('wellness',  'Meditation',      'meditation'),
    ('wellness',  'Breathwork',      'breathwork'),
    ('wellness',  'Ice Baths',       'ice-baths'),
    -- Fitness
    ('fitness',   'Pilates',         'pilates'),
    ('fitness',   'Boxing',          'boxing'),
    ('fitness',   'Rock Climbing',   'rock-climbing'),
    -- Outdoors
    ('outdoors',  'Beach Days',      'beach-days'),
    ('outdoors',  'Hiking',          'hiking'),
    ('outdoors',  'Camping',         'camping'),
    ('outdoors',  'Kayaking',        'kayaking'),
    -- Games
    ('games',     'Trivia',          'trivia'),
    ('games',     'Board Games',     'board-games'),
    ('games',     'Escape Rooms',    'escape-rooms'),
    -- Community
    ('community', 'Dog Parks',       'dog-parks'),
    ('community', 'Cleanups',        'cleanups')
) as seed(category_slug, label, slug)
join category_lookup on category_lookup.slug = seed.category_slug
on conflict (slug) do nothing;

commit;
