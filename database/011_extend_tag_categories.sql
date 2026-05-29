-- Extend the event-category taxonomy and split out internal-only categories.
--
-- 1. `internal_only` flag — Life + Music are matching signals (Life Quiz tags
--    and music-taste vibes), not event types a merchant hosts. They were
--    leaking into the merchant signup picker (`getMerchantCategoryOptions`)
--    and the public `/categories` page (`getEventCategories`). New flag is
--    filtered out by both queries; admins can still edit/seed tags under
--    those categories through `/admin/tags`.
--
-- 2. Eight new categories cover gaps merchants currently have nowhere to
--    file events under: Outdoors, Sports, Nightlife, Games, Learning,
--    Wellness, Family, Travel. Inserts are idempotent on `slug`.

begin;

alter table tag_categories
  add column if not exists internal_only boolean not null default false;

update tag_categories
  set internal_only = true
  where slug in ('life', 'music');

insert into tag_categories (name, slug, description) values
  ('Outdoors',  'outdoors',  'Hiking, camping, beach days, parks, and time in nature'),
  ('Sports',    'sports',    'Pickup games, run clubs, league nights, and watch parties'),
  ('Nightlife', 'nightlife', 'Bars, clubs, late-night gigs, and comedy'),
  ('Games',     'games',     'Board games, trivia nights, chess, and tabletop RPG'),
  ('Learning',  'learning',  'Workshops, classes, language exchange, and talks'),
  ('Wellness',  'wellness',  'Meditation, sauna, breathwork, and journaling circles'),
  ('Family',    'family',    'Parent meetups and kid-friendly events'),
  ('Travel',    'travel',    'Day trips and group getaways')
on conflict (slug) do nothing;

commit;
