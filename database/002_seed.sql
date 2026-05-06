begin;

insert into tag_categories (name, slug, description) values
  ('Social', 'social', 'Friendship, low-pressure gatherings, and local community'),
  ('Fitness', 'fitness', 'Training, movement, and accountability'),
  ('Relationships', 'relationships', 'Dating and relationship-minded social events'),
  ('Creative', 'creative', 'Making, writing, art, music, and culture'),
  ('Career', 'career', 'Career change, networking, and professional support'),
  ('Community', 'community', 'Volunteering, neighbourhood rituals, and local action'),
  ('Music', 'music', 'Music taste used as a subtle matching signal'),
  ('Life', 'life', 'Life Quiz generated tags')
on conflict (slug) do nothing;

with category_lookup as (
  select id, slug from tag_categories
)
insert into tags (category_id, label, slug, tag_type, admin_managed)
select category_lookup.id, seed.label, seed.slug, seed.tag_type, seed.admin_managed
from (
  values
    ('social', 'Friends', 'friends', 'interest', true),
    ('social', 'New to Town', 'new-to-town', 'life', false),
    ('social', 'Low Pressure', 'low-pressure', 'vibe', true),
    ('fitness', 'CrossFit', 'crossfit', 'interest', true),
    ('fitness', 'Fitness', 'fitness', 'interest', true),
    ('fitness', 'Accountability', 'accountability', 'vibe', true),
    ('relationships', 'Dating', 'dating', 'interest', true),
    ('relationships', 'Relationships', 'relationships', 'interest', true),
    ('creative', 'Creative', 'creative', 'interest', true),
    ('creative', 'Brunch', 'brunch', 'interest', true),
    ('career', 'Career Change', 'career-change', 'interest', true),
    ('career', 'Confidence', 'confidence', 'life', false),
    ('community', 'Pets', 'pets', 'interest', true),
    ('community', 'Volunteering', 'volunteering', 'interest', true),
    ('music', 'Jazz', 'jazz', 'music', true),
    ('music', 'Indie', 'indie', 'music', true),
    ('life', 'Ambivert', 'ambivert', 'life', false),
    ('life', 'Weekend', 'weekend', 'life', false)
) as seed(category_slug, label, slug, tag_type, admin_managed)
join category_lookup on category_lookup.slug = seed.category_slug
on conflict (slug) do nothing;

insert into profiles (
  auth_subject,
  role,
  email,
  display_name,
  age,
  gender,
  suburb,
  city,
  bio,
  photo_url,
  connection_intents,
  email_verified_at,
  photo_verified_at
) values
  (
    'seed:maya',
    'attendee',
    'maya@click.local',
    'Maya Chen',
    31,
    'woman',
    'Barangaroo',
    'Sydney',
    'Moved back to Sydney and wants a reliable weekend circle for picnics, walks, and easy conversation.',
    null,
    '{friendship,exploring}'::connection_intent[],
    now(),
    now()
  ),
  (
    'seed:theo',
    'merchant',
    'theo@click.local',
    'Theo Morgan',
    34,
    'man',
    'Marrickville',
    'Sydney',
    'Training for consistency, not ego. Runs scalable CrossFit sessions and coffee after class.',
    null,
    '{friendship,networking}'::connection_intent[],
    now(),
    now()
  ),
  (
    'seed:amelia',
    'merchant',
    'amelia@click.local',
    'Amelia Hart',
    36,
    'woman',
    'Surry Hills',
    'Sydney',
    'Hosts relationship-minded dinners that start with real conversation.',
    null,
    '{dating}'::connection_intent[],
    now(),
    now()
  ),
  (
    'seed:noah',
    'merchant',
    'noah@click.local',
    'Noah Singh',
    29,
    'man',
    'Newtown',
    'Sydney',
    'Wants ordinary makers around a table: sketchbooks, side projects, brunch, and accountability.',
    null,
    '{friendship,exploring}'::connection_intent[],
    now(),
    now()
  ),
  (
    'seed:priya',
    'merchant',
    'priya@click.local',
    'Priya Nair',
    38,
    'woman',
    'The Rocks',
    'Sydney',
    'Changing industries and looking for practical encouragement, not stiff networking.',
    null,
    '{networking,friendship}'::connection_intent[],
    now(),
    now()
  ),
  (
    'seed:admin',
    'admin',
    'admin@click.local',
    'Click Admin',
    null,
    null,
    'Sydney CBD',
    'Sydney',
    'Platform operator for seed data.',
    null,
    '{exploring}'::connection_intent[],
    now(),
    now()
  )
on conflict (email) do nothing;

insert into merchant_profiles (
  profile_id,
  business_name,
  abn,
  website_url,
  contact_email,
  verification_status,
  stripe_connect_account_id
)
select profile.id, merchant.business_name, merchant.abn, merchant.website_url, profile.email, 'approved', merchant.stripe_account
from (
  values
    ('theo@click.local', 'Inner West Fitness Mates', '11 111 111 111', 'https://example.com/fitness', 'acct_seed_theo'),
    ('amelia@click.local', 'Real Conversations Sydney', '22 222 222 222', 'https://example.com/conversations', 'acct_seed_amelia'),
    ('noah@click.local', 'Ordinary People Making Things', '33 333 333 333', 'https://example.com/creative', 'acct_seed_noah'),
    ('priya@click.local', 'Sydney Career Switchers', '44 444 444 444', 'https://example.com/career', 'acct_seed_priya')
) as merchant(email, business_name, abn, website_url, stripe_account)
join profiles profile on profile.email = merchant.email
on conflict (profile_id) do nothing;

with host_profiles as (
  select
    profile.id as profile_id,
    profile.display_name,
    merchant.id as merchant_id,
    merchant.business_name
  from profiles profile
  left join merchant_profiles merchant on merchant.profile_id = profile.id
),
seed_events as (
  select *
  from (
    values
      (
        'new-friends-barangaroo',
        'New Friends Picnic at Barangaroo',
        'A hosted picnic for people who want easy conversation, shared snacks, and familiar faces for the next event.',
        'maya@click.local',
        null::text,
        'Sydney First-Timers Social Club',
        'Maya Chen',
        'Social',
        'featured'::event_status,
        'click_managed'::booking_model,
        null::text,
        '2026-05-08 18:30:00+10'::timestamptz,
        '2026-05-08 20:30:00+10'::timestamptz,
        'Barangaroo Reserve, Sydney',
        'Barangaroo Reserve',
        'Barangaroo',
        -33.857000::numeric,
        151.201000::numeric,
        0,
        60,
        '/media/open-yoga.jpg',
        'People gathering outdoors in a relaxed group class',
        'Make two familiar faces before the next weekend.',
        '4 people you might Click with are already going.'
      ),
      (
        'crossfit-coffee',
        'CrossFit Skills and Coffee Crew',
        'Technique-focused partner drills, scalable workouts, and post-session coffee for people who want consistency without gym cliques.',
        'theo@click.local',
        'Inner West Fitness Mates',
        'Inner West Fitness Mates',
        'Theo Morgan',
        'Fitness',
        'live'::event_status,
        'click_managed'::booking_model,
        null::text,
        '2026-05-09 08:00:00+10'::timestamptz,
        '2026-05-09 09:30:00+10'::timestamptz,
        'Marrickville Training Yard',
        'Marrickville Training Yard',
        'Marrickville',
        -33.913000::numeric,
        151.155000::numeric,
        1200,
        32,
        '/media/yoga.jpg',
        'People training together in a group fitness session',
        'Find a fitness partner for a four-week streak.',
        'Popular with people building a four-week fitness streak.'
      ),
      (
        'slow-dating-six',
        'Slow Dating: Dinner Tables of Six',
        'Hosted dinner tables where singles meet through small-group conversation first, with private mutual interest after the event.',
        'amelia@click.local',
        'Real Conversations Sydney',
        'Real Conversations Sydney',
        'Amelia Hart',
        'Relationships',
        'waitlist'::event_status,
        'click_managed'::booking_model,
        null::text,
        '2026-05-14 19:00:00+10'::timestamptz,
        '2026-05-14 21:00:00+10'::timestamptz,
        'Surry Hills',
        'Surry Hills',
        'Surry Hills',
        -33.884000::numeric,
        151.212000::numeric,
        2900,
        42,
        '/media/networking.jpg',
        'People talking at a warm hosted dinner event',
        'Meet people through conversation before matching.',
        'Mostly relationship-minded guests who prefer small tables.'
      ),
      (
        'ordinary-creatives',
        'Creative Brunch for Ordinary People',
        'A no-status brunch for writers, designers, builders, makers, and anyone who wants a recurring community around doing real things.',
        'noah@click.local',
        'Ordinary People Making Things',
        'Ordinary People Making Things',
        'Noah Singh',
        'Creative',
        'featured'::event_status,
        'external'::booking_model,
        'https://example.com/book/creative-brunch',
        '2026-05-17 10:30:00+10'::timestamptz,
        '2026-05-17 12:30:00+10'::timestamptz,
        'Newtown Community Hall',
        'Newtown Community Hall',
        'Newtown',
        -33.897000::numeric,
        151.179000::numeric,
        1800,
        70,
        '/media/concert.jpg',
        'Crowd at a warm local music and creative event',
        'Turn a hobby into a recurring group.',
        'Strong overlap with makers, writers, and new locals.'
      ),
      (
        'career-walk',
        'Career Change Walk and Talk',
        'A walking meetup for people changing careers, building confidence, and looking for peers rather than formal networking.',
        'priya@click.local',
        'Sydney Career Switchers',
        'Sydney Career Switchers',
        'Priya Nair',
        'Career',
        'live'::event_status,
        'external'::booking_model,
        'https://example.com/book/career-walk',
        '2026-05-20 18:00:00+10'::timestamptz,
        '2026-05-20 19:30:00+10'::timestamptz,
        'Circular Quay to The Rocks',
        'Circular Quay',
        'The Rocks',
        -33.859000::numeric,
        151.209000::numeric,
        0,
        45,
        '/media/networking.jpg',
        'People talking at a community meetup',
        'Meet peers who understand the same career transition.',
        'Good fit for people rebuilding confidence around work.'
      ),
      (
        'dog-park-cleanup',
        'Dog Park Coffee and Cleanup',
        'A light volunteer morning for pet owners, locals, and people who want a natural reason to talk while doing something useful.',
        'maya@click.local',
        null::text,
        'Inner City Community Mates',
        'Jules Park',
        'Community',
        'locked'::event_status,
        'click_managed'::booking_model,
        null::text,
        '2026-05-23 09:00:00+10'::timestamptz,
        '2026-05-23 11:00:00+10'::timestamptz,
        'Camperdown Memorial Rest Park',
        'Camperdown Memorial Rest Park',
        'Camperdown',
        -33.888000::numeric,
        151.176000::numeric,
        0,
        36,
        '/media/open-yoga.jpg',
        'Outdoor community group meeting in a park',
        'Meet locals through a useful shared ritual.',
        'Popular with pet owners and people new to Camperdown.'
      )
  ) as event_seed(
    slug,
    title,
    description,
    host_email,
    merchant_business_name,
    group_name,
    host_name,
    category,
    status,
    booking_model,
    external_booking_url,
    starts_at,
    ends_at,
    location_name,
    address,
    suburb,
    latitude,
    longitude,
    price_cents,
    capacity,
    image_url,
    image_alt,
    relationship_goal,
    fomo
  )
)
insert into events (
  slug,
  title,
  description,
  host_profile_id,
  merchant_profile_id,
  group_name,
  host_name,
  category,
  status,
  booking_model,
  external_booking_url,
  starts_at,
  ends_at,
  location_name,
  address,
  suburb,
  latitude,
  longitude,
  price_cents,
  capacity,
  image_url,
  image_alt,
  relationship_goal,
  fomo
)
select
  seed_events.slug,
  seed_events.title,
  seed_events.description,
  host.profile_id,
  host.merchant_id,
  seed_events.group_name,
  seed_events.host_name,
  seed_events.category,
  seed_events.status,
  seed_events.booking_model,
  seed_events.external_booking_url,
  seed_events.starts_at,
  seed_events.ends_at,
  seed_events.location_name,
  seed_events.address,
  seed_events.suburb,
  seed_events.latitude,
  seed_events.longitude,
  seed_events.price_cents,
  seed_events.capacity,
  seed_events.image_url,
  seed_events.image_alt,
  seed_events.relationship_goal,
  seed_events.fomo
from seed_events
join profiles host_profile on host_profile.email = seed_events.host_email
left join host_profiles host on host.profile_id = host_profile.id
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  status = excluded.status,
  booking_model = excluded.booking_model,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  capacity = excluded.capacity,
  updated_at = now();

with event_tag_seed as (
  select *
  from (
    values
      ('new-friends-barangaroo', 'friends'),
      ('new-friends-barangaroo', 'new-to-town'),
      ('new-friends-barangaroo', 'low-pressure'),
      ('new-friends-barangaroo', 'weekend'),
      ('crossfit-coffee', 'crossfit'),
      ('crossfit-coffee', 'fitness'),
      ('crossfit-coffee', 'accountability'),
      ('ordinary-creatives', 'creative'),
      ('ordinary-creatives', 'brunch'),
      ('ordinary-creatives', 'friends'),
      ('slow-dating-six', 'dating'),
      ('slow-dating-six', 'relationships'),
      ('slow-dating-six', 'low-pressure'),
      ('career-walk', 'career-change'),
      ('career-walk', 'confidence'),
      ('dog-park-cleanup', 'pets'),
      ('dog-park-cleanup', 'volunteering'),
      ('dog-park-cleanup', 'friends')
  ) as values_list(event_slug, tag_slug)
)
insert into event_tags (event_id, tag_id)
select event.id, tag.id
from event_tag_seed
join events event on event.slug = event_tag_seed.event_slug
join tags tag on tag.slug = event_tag_seed.tag_slug
on conflict do nothing;

insert into profiles (
  auth_subject,
  role,
  email,
  display_name,
  suburb,
  city,
  bio,
  connection_intents,
  email_verified_at,
  photo_verified_at
)
select
  'seed:attendee:' || series.index,
  'attendee',
  ('attendee+' || series.index || '@click.local')::citext,
  'Click Member ' || series.index,
  case series.index % 6
    when 0 then 'Barangaroo'
    when 1 then 'Marrickville'
    when 2 then 'Surry Hills'
    when 3 then 'Newtown'
    when 4 then 'The Rocks'
    else 'Camperdown'
  end,
  'Sydney',
  'Seed attendee used to populate event capacity and FOMO examples.',
  '{friendship,exploring}'::connection_intent[],
  now(),
  now()
from generate_series(1, 70) as series(index)
on conflict (email) do nothing;

with attendance_targets as (
  select *
  from (
    values
      ('new-friends-barangaroo', 47),
      ('crossfit-coffee', 24),
      ('slow-dating-six', 40),
      ('ordinary-creatives', 53),
      ('career-walk', 31),
      ('dog-park-cleanup', 18)
  ) as target(event_slug, attendee_count)
),
expanded_attendance as (
  select
    target.event_slug,
    series.index
  from attendance_targets target
  cross join lateral generate_series(1, target.attendee_count) as series(index)
)
insert into event_attendees (event_id, profile_id, status)
select event.id, profile.id, 'confirmed'
from expanded_attendance attendance
join events event on event.slug = attendance.event_slug
join profiles profile on profile.email = ('attendee+' || attendance.index || '@click.local')::citext
on conflict (event_id, profile_id) do nothing;

insert into notifications (profile_id, channel, title, body, action_url)
select profile.id, 'in_app', 'Welcome to Click', 'Your event-first dashboard is ready.', '/dashboard'
from profiles profile
where profile.email in ('maya@click.local', 'theo@click.local', 'amelia@click.local')
on conflict do nothing;

commit;
