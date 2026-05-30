-- 024_seed_remaining_events.sql
--
-- Seeds the 40 events that previously existed ONLY in the static
-- src/lib/click-data.ts fallback and were never inserted into Postgres.
-- Without these rows, their detail pages rendered from the fallback but
-- Save (bookmark), RSVP, and the attendee preview all failed with
-- "Event not found" because those paths query events by slug in the DB.
-- Idempotent: every insert is ON CONFLICT DO NOTHING.

begin;

-- 1. Host profiles for the 7 hosts that did not already exist.
insert into profiles (auth_subject, role, email, display_name, suburb, city, bio, connection_intents, email_verified_at, photo_verified_at)
values
  ('seed:host:dylan-reyes', 'attendee', 'host-dylan-reyes@click.local', 'Dylan Reyes', 'Newtown', 'Sydney', 'Seed host profile for click-managed community events.', '{friendship,exploring}'::connection_intent[], now(), now()),
  ('seed:host:priya-shah', 'attendee', 'host-priya-shah@click.local', 'Priya Shah', 'Surry Hills', 'Sydney', 'Seed host profile for click-managed community events.', '{friendship,exploring}'::connection_intent[], now(), now()),
  ('seed:host:marcus-lim', 'attendee', 'host-marcus-lim@click.local', 'Marcus Lim', 'Marrickville', 'Sydney', 'Seed host profile for click-managed community events.', '{friendship,exploring}'::connection_intent[], now(), now()),
  ('seed:host:eliza-fontaine', 'attendee', 'host-eliza-fontaine@click.local', 'Eliza Fontaine', 'Bondi Beach', 'Sydney', 'Seed host profile for click-managed community events.', '{friendship,exploring}'::connection_intent[], now(), now()),
  ('seed:host:noah-whitfield', 'attendee', 'host-noah-whitfield@click.local', 'Noah Whitfield', 'Camperdown', 'Sydney', 'Seed host profile for click-managed community events.', '{friendship,exploring}'::connection_intent[], now(), now()),
  ('seed:host:sofia-marchetti', 'attendee', 'host-sofia-marchetti@click.local', 'Sofia Marchetti', 'Glebe', 'Sydney', 'Seed host profile for click-managed community events.', '{friendship,exploring}'::connection_intent[], now(), now()),
  ('seed:host:hana-watanabe', 'attendee', 'host-hana-watanabe@click.local', 'Hana Watanabe', 'Redfern', 'Sydney', 'Seed host profile for click-managed community events.', '{friendship,exploring}'::connection_intent[], now(), now())
on conflict (email) do nothing;

-- 2. The 40 events. host_profile_id resolved via host email join.
with seed_events as (
  select * from (values
    ('sunrise-run-club-bay-run-loop', 'Sunrise Run Club: Bay Run Loop', 'Inner West Pacers hosts sunrise run club: bay run loop in Annandale. Find a steady running partner who shows up.', 'host-dylan-reyes@click.local', 'Inner West Pacers', 'Dylan Reyes', 'Fitness', 'live', 'click_managed', null::text, '2026-05-28T20:30:00.000Z', '2026-05-28T22:30:00.000Z', 'Bay Run Boatshed', null::text, 'Annandale', -33.8825, 151.17, 0, 40, '/media/open-yoga.jpg', 'People gathering outdoors in a relaxed group class', 'Find a steady running partner who shows up.', 'Most runners come back three weeks straight.'),
    ('vinyasa-flow-in-the-park', 'Vinyasa Flow in the Park', 'Slow Sundays Yoga hosts vinyasa flow in the park in Glebe. Start the week grounded with new faces.', 'host-priya-shah@click.local', 'Slow Sundays Yoga', 'Priya Shah', 'Fitness', 'live', 'click_managed', null::text, '2026-05-29T23:00:00.000Z', '2026-05-30T01:00:00.000Z', 'Bicentennial Park', null::text, 'Glebe', -33.877, 151.1845, 1500, 30, '/media/yoga.jpg', 'People training together in a group fitness session', 'Start the week grounded with new faces.', 'A calm crowd that lingers for tea after.'),
    ('board-games-buds-night', 'Board Games & Buds Night', 'Tabletop Tuesdays hosts board games & buds night in Newtown. Turn one games night into a regular crew.', 'host-marcus-lim@click.local', 'Tabletop Tuesdays', 'Marcus Lim', 'Social', 'live', 'click_managed', null::text, '2026-05-31T08:30:00.000Z', '2026-05-31T10:30:00.000Z', 'The Gamesmiths', null::text, 'Newtown', -33.899, 151.1785, 800, 24, '/media/networking.jpg', 'People talking and sharing food at a hosted event', 'Turn one games night into a regular crew.', 'Beginners welcome — rules taught at every table.'),
    ('wine-watercolour-social', 'Wine & Watercolour Social', 'Brushes After Dark hosts wine & watercolour social in Bondi Beach. Make something with your hands and meet makers.', 'host-eliza-fontaine@click.local', 'Brushes After Dark', 'Eliza Fontaine', 'Creative', 'featured', 'click_managed', null::text, '2026-06-01T09:00:00.000Z', '2026-06-01T11:00:00.000Z', 'Bondi Pavilion Studio', null::text, 'Bondi Beach', -33.8908, 151.2748, 4200, 20, '/media/concert.jpg', 'A crowd enjoying live music together', 'Make something with your hands and meet makers.', 'Sells out most fortnights — grab a seat early.'),
    ('founders-coffee-early-stage', 'Founders Coffee: Early Stage', 'Sydney Builders hosts founders coffee: early stage in Chippendale. Find a co-founder or a sounding board.', 'host-noah-whitfield@click.local', 'Sydney Builders', 'Noah Whitfield', 'Career', 'live', 'click_managed', null::text, '2026-06-01T22:00:00.000Z', '2026-06-02T00:00:00.000Z', 'Brickfields Bakery', null::text, 'Chippendale', -33.887, 151.201, 0, 30, '/media/networking.jpg', 'People talking and sharing food at a hosted event', 'Find a co-founder or a sounding board.', 'Half the room is pre-seed and shipping.'),
    ('dumpling-crawl-chinatown', 'Dumpling Crawl: Marrickville', 'Sydney Table Friends hosts dumpling crawl: chinatown in Marrickville. Make dinner the easiest first plan with strangers.', 'lena@click.local', 'Sydney Table Friends', 'Lena Ortiz', 'Food', 'waitlist', 'click_managed', null::text, '2026-06-03T08:30:00.000Z', '2026-06-03T10:30:00.000Z', 'Marrickville Road Eats', null::text, 'Marrickville', -33.9115, 151.156, 3500, 12, '/media/networking.jpg', 'People talking and sharing food at a hosted event', 'Make dinner the easiest first plan with strangers.', 'One seat left at a famously chatty table.'),
    ('sunset-sketch-jam', 'Sunset Sketch Jam', 'Rooftop Makers hosts sunset sketch jam in Tamarama. Draw beside people who love making things.', 'host-eliza-fontaine@click.local', 'Rooftop Makers', 'Eliza Fontaine', 'Creative', 'featured', 'click_managed', null::text, '2026-06-04T07:30:00.000Z', '2026-06-04T09:30:00.000Z', 'Marks Park', null::text, 'Tamarama', -33.8987, 151.2705, 1800, 25, '/media/concert.jpg', 'A crowd enjoying live music together', 'Draw beside people who love making things.', 'Golden hour over the harbour, every time.'),
    ('beginner-bouldering-meet', 'Beginner Bouldering Meet', 'Send It Social hosts beginner bouldering meet in Alexandria. Find a climbing partner without the gym cliques.', 'theo@click.local', 'Send It Social', 'Theo Morgan', 'Fitness', 'live', 'click_managed', null::text, '2026-06-05T08:00:00.000Z', '2026-06-05T10:00:00.000Z', 'BlocHaus Alexandria', null::text, 'Alexandria', -33.911, 151.198, 2500, 20, '/media/yoga.jpg', 'People training together in a group fitness session', 'Find a climbing partner without the gym cliques.', 'Coaches pair first-timers with regulars.'),
    ('slow-dating-walk-talk', 'Slow Dating: Walk & Talk', 'Real Conversations Sydney hosts slow dating: walk & talk in Bondi Beach. Meet through a shared walk before matching.', 'amelia@click.local', 'Real Conversations Sydney', 'Amelia Hart', 'Relationships', 'waitlist', 'click_managed', null::text, '2026-06-06T06:00:00.000Z', '2026-06-06T08:00:00.000Z', 'Bondi to Bronte Coastal Walk', null::text, 'Bondi Beach', -33.8948, 151.2743, 2900, 24, '/media/open-yoga.jpg', 'People gathering outdoors in a relaxed group class', 'Meet through a shared walk before matching.', 'Mostly relationship-minded singles, small group.'),
    ('jazz-negronis', 'Jazz & Negronis', 'After Hours Listening Club hosts jazz & negronis in Bondi Junction. Use music taste as a gentle matching signal.', 'host-sofia-marchetti@click.local', 'After Hours Listening Club', 'Sofia Marchetti', 'Music', 'live', 'click_managed', null::text, '2026-06-07T10:00:00.000Z', '2026-06-07T12:00:00.000Z', 'The Eastern', null::text, 'Bondi Junction', -33.8918, 151.2508, 3200, 40, '/media/concert.jpg', 'A crowd enjoying live music together', 'Use music taste as a gentle matching signal.', 'Shared tables make it easy to talk between sets.'),
    ('new-in-town-mixer', 'New In Town Mixer', 'Sydney First-Timers Social Club hosts new in town mixer in Newtown. Leave with two people to text next week.', 'maya@click.local', 'Sydney First-Timers Social Club', 'Maya Chen', 'Social', 'featured', 'click_managed', null::text, '2026-06-08T08:00:00.000Z', '2026-06-08T10:00:00.000Z', 'The Bank Hotel', null::text, 'Newtown', -33.8985, 151.1782, 1000, 50, '/media/networking.jpg', 'People talking and sharing food at a hosted event', 'Leave with two people to text next week.', 'Built for people who moved here in the last year.'),
    ('parkrun-pancakes', 'Parkrun + Pancakes', 'Weekend Wanderers hosts parkrun + pancakes in St Peters. Make Saturday mornings a social ritual.', 'host-dylan-reyes@click.local', 'Weekend Wanderers', 'Dylan Reyes', 'Fitness', 'live', 'click_managed', null::text, '2026-06-09T21:00:00.000Z', '2026-06-09T23:00:00.000Z', 'Sydney Park parkrun', null::text, 'St Peters', -33.91, 151.185, 0, 60, '/media/open-yoga.jpg', 'People gathering outdoors in a relaxed group class', 'Make Saturday mornings a social ritual.', 'Free 5k then pancakes — no pace pressure.'),
    ('pottery-for-total-beginners', 'Pottery for Total Beginners', 'Mud & Mates hosts pottery for total beginners in Marrickville. Get your hands messy beside friendly strangers.', 'host-hana-watanabe@click.local', 'Mud & Mates', 'Hana Watanabe', 'Creative', 'waitlist', 'click_managed', null::text, '2026-06-11T01:00:00.000Z', '2026-06-11T03:00:00.000Z', 'Clay Studio Marrickville', null::text, 'Marrickville', -33.9105, 151.1568, 5500, 14, '/media/concert.jpg', 'A crowd enjoying live music together', 'Get your hands messy beside friendly strangers.', 'Two wheels left — everything else is booked.'),
    ('long-lunch-shared-plates', 'Long Lunch: Shared Plates', 'Sydney Table Friends hosts long lunch: shared plates in North Bondi. Turn a long lunch into a new friend group.', 'lena@click.local', 'Sydney Table Friends', 'Lena Ortiz', 'Food', 'live', 'click_managed', null::text, '2026-06-12T02:30:00.000Z', '2026-06-12T04:30:00.000Z', 'North Bondi RSL', null::text, 'North Bondi', -33.889, 151.281, 4800, 10, '/media/networking.jpg', 'People talking and sharing food at a hosted event', 'Turn a long lunch into a new friend group.', 'Hosted seating so no one eats alone.'),
    ('women-in-tech-coffee-career', 'Women in Tech: Coffee & Career', 'Sydney Builders hosts women in tech: coffee & career in Chippendale. Find a peer or mentor for your next move.', 'host-noah-whitfield@click.local', 'Sydney Builders', 'Noah Whitfield', 'Career', 'live', 'click_managed', null::text, '2026-06-12T22:30:00.000Z', '2026-06-13T00:30:00.000Z', 'Spice Alley', null::text, 'Chippendale', -33.8855, 151.1985, 0, 35, '/media/networking.jpg', 'People talking and sharing food at a hosted event', 'Find a peer or mentor for your next move.', 'Mentors and switchers share the same table.'),
    ('harbour-sunset-picnic', 'Coastal Sunset Picnic', 'Sydney First-Timers Social Club hosts harbour sunset picnic in Tamarama. Make familiar faces before the next weekend.', 'maya@click.local', 'Sydney First-Timers Social Club', 'Maya Chen', 'Social', 'featured', 'click_managed', null::text, '2026-06-14T07:00:00.000Z', '2026-06-14T09:00:00.000Z', 'Tamarama Beach Reserve', null::text, 'Tamarama', -33.899, 151.27, 0, 45, '/media/open-yoga.jpg', 'People gathering outdoors in a relaxed group class', 'Make familiar faces before the next weekend.', 'BYO blanket — host brings the icebreakers.'),
    ('crossfit-skills-partner-drills', 'CrossFit Skills: Partner Drills', 'Inner West Fitness Mates hosts crossfit skills: partner drills in Leichhardt. Find a training partner for a four-week streak.', 'theo@click.local', 'Inner West Fitness Mates', 'Theo Morgan', 'Fitness', 'live', 'click_managed', null::text, '2026-06-15T21:30:00.000Z', '2026-06-15T23:30:00.000Z', 'Norton Street Box', null::text, 'Leichhardt', -33.884, 151.1575, 1200, 28, '/media/yoga.jpg', 'People training together in a group fitness session', 'Find a training partner for a four-week streak.', 'Scalable for every level, coffee after.'),
    ('open-mic-acoustic-night', 'Open Mic & Acoustic Night', 'After Hours Listening Club hosts open mic & acoustic night in Enmore. Bond over shared taste between songs.', 'host-sofia-marchetti@click.local', 'After Hours Listening Club', 'Sofia Marchetti', 'Music', 'live', 'click_managed', null::text, '2026-06-17T09:30:00.000Z', '2026-06-17T11:30:00.000Z', 'The Duke of Enmore', null::text, 'Enmore', -33.8987, 151.17, 1500, 50, '/media/concert.jpg', 'A crowd enjoying live music together', 'Bond over shared taste between songs.', 'Perform or just listen — both welcome.'),
    ('speed-friending-inner-west', 'Speed Friending: Inner West', 'Tabletop Tuesdays hosts speed friending: inner west in Eveleigh. Leave with a handful of new numbers.', 'host-marcus-lim@click.local', 'Tabletop Tuesdays', 'Marcus Lim', 'Social', 'featured', 'click_managed', null::text, '2026-06-18T08:00:00.000Z', '2026-06-18T10:00:00.000Z', 'Carriageworks', null::text, 'Eveleigh', -33.893, 151.188, 1500, 40, '/media/networking.jpg', 'People talking and sharing food at a hosted event', 'Leave with a handful of new numbers.', 'Rotating chats so you meet everyone once.'),
    ('saturday-surf-school', 'Saturday Surf School', 'Send It Social hosts saturday surf school in Bondi Beach. Try something new beside an encouraging crew.', 'host-dylan-reyes@click.local', 'Send It Social', 'Dylan Reyes', 'Fitness', 'waitlist', 'click_managed', null::text, '2026-06-18T22:00:00.000Z', '2026-06-19T00:00:00.000Z', 'Let''s Go Surfing', null::text, 'Bondi Beach', -33.89, 151.28, 4500, 16, '/media/open-yoga.jpg', 'People gathering outdoors in a relaxed group class', 'Try something new beside an encouraging crew.', 'Boards and wetsuits included for first-timers.'),
    ('cheese-natural-wine-101', 'Cheese & Natural Wine 101', 'Brushes After Dark hosts cheese & natural wine 101 in Bondi. Discover a new favourite next to new people.', 'host-eliza-fontaine@click.local', 'Brushes After Dark', 'Eliza Fontaine', 'Food', 'live', 'click_managed', null::text, '2026-06-21T08:00:00.000Z', '2026-06-21T10:00:00.000Z', 'Bondi Wine Merchants', null::text, 'Bondi', -33.892, 151.262, 5200, 18, '/media/networking.jpg', 'People talking and sharing food at a hosted event', 'Discover a new favourite next to new people.', 'Guided tasting keeps conversation flowing.'),
    ('mindful-morning-breath-walk', 'Mindful Morning: Breath & Walk', 'Slow Sundays Yoga hosts mindful morning: breath & walk in Coogee. Trade hellos with a calm weekend crowd.', 'host-priya-shah@click.local', 'Slow Sundays Yoga', 'Priya Shah', 'Fitness', 'live', 'click_managed', null::text, '2026-06-21T21:00:00.000Z', '2026-06-21T23:00:00.000Z', 'Coogee Beach', null::text, 'Coogee', -33.9215, 151.2585, 0, 30, '/media/open-yoga.jpg', 'People gathering outdoors in a relaxed group class', 'Trade hellos with a calm weekend crowd.', 'A gentle start with a coffee debrief after.'),
    ('indie-film-club-screening-night', 'Indie Film Club: Screening Night', 'After Hours Listening Club hosts indie film club: screening night in Chippendale. Meet people through what you both love watching.', 'host-sofia-marchetti@click.local', 'After Hours Listening Club', 'Sofia Marchetti', 'Creative', 'featured', 'click_managed', null::text, '2026-06-23T09:00:00.000Z', '2026-06-23T11:00:00.000Z', 'Chippendale Hall', null::text, 'Chippendale', -33.888, 151.1995, 2400, 35, '/media/concert.jpg', 'A crowd enjoying live music together', 'Meet people through what you both love watching.', 'Discussion over a drink after the credits.'),
    ('volunteer-garden-working-bee', 'Volunteer Garden Working Bee', 'Neighbourhood Roots hosts volunteer garden working bee in Erskineville. Meet neighbours while doing something good.', 'host-hana-watanabe@click.local', 'Neighbourhood Roots', 'Hana Watanabe', 'Community', 'live', 'click_managed', null::text, '2026-06-23T23:00:00.000Z', '2026-06-24T01:00:00.000Z', 'Erskineville Community Garden', null::text, 'Erskineville', -33.902, 151.185, 0, 25, '/media/open-yoga.jpg', 'People gathering outdoors in a relaxed group class', 'Meet neighbours while doing something good.', 'Hands-on, low pressure, plenty of chatting.'),
    ('dog-owners-social-walk', 'Dog Owners'' Social Walk', 'Neighbourhood Roots hosts dog owners'' social walk in Glebe. Find regulars for your weekend dog walks.', 'host-marcus-lim@click.local', 'Neighbourhood Roots', 'Marcus Lim', 'Community', 'live', 'click_managed', null::text, '2026-06-25T06:30:00.000Z', '2026-06-25T08:30:00.000Z', 'Jubilee Park', null::text, 'Glebe', -33.8755, 151.183, 0, 30, '/media/open-yoga.jpg', 'People gathering outdoors in a relaxed group class', 'Find regulars for your weekend dog walks.', 'Dogs break the ice so you don''t have to.'),
    ('founders-dinner-table-of-ten', 'Founders Dinner: Table of Ten', 'Sydney Builders hosts founders dinner: table of ten in Newtown. Swap honest stories over a long dinner.', 'host-noah-whitfield@click.local', 'Sydney Builders', 'Noah Whitfield', 'Career', 'waitlist', 'click_managed', null::text, '2026-06-27T09:00:00.000Z', '2026-06-27T11:00:00.000Z', 'Continental Deli', null::text, 'Newtown', -33.8978, 151.1795, 6500, 10, '/media/networking.jpg', 'People talking and sharing food at a hosted event', 'Swap honest stories over a long dinner.', 'One seat left at a candid founders'' table.'),
    ('bouldering-tacos', 'Bouldering + Tacos', 'Send It Social hosts bouldering + tacos in Waterloo. Find a regular climbing partner.', 'theo@click.local', 'Send It Social', 'Theo Morgan', 'Fitness', 'live', 'click_managed', null::text, '2026-06-28T08:30:00.000Z', '2026-06-28T10:30:00.000Z', 'Sydney Indoor Climbing Gym', null::text, 'Waterloo', -33.9015, 151.2055, 2800, 22, '/media/yoga.jpg', 'People training together in a group fitness session', 'Find a regular climbing partner.', 'Climb at your level, tacos after for everyone.'),
    ('latte-art-throwdown', 'Latte Art Throwdown', 'Sydney Table Friends hosts latte art throwdown in Marrickville. Caffeinate and connect with locals.', 'lena@click.local', 'Sydney Table Friends', 'Lena Ortiz', 'Food', 'live', 'click_managed', null::text, '2026-06-29T00:00:00.000Z', '2026-06-29T02:00:00.000Z', 'Coffee Alchemy', null::text, 'Marrickville', -33.9075, 151.162, 1800, 24, '/media/networking.jpg', 'People talking and sharing food at a hosted event', 'Caffeinate and connect with locals.', 'Watch baristas battle, then try it yourself.'),
    ('sunset-rooftop-sketch-jam', 'Sunset Rooftop Sketch Jam', 'Rooftop Makers hosts sunset rooftop sketch jam in Ultimo. Make art beside fellow makers at golden hour.', 'host-eliza-fontaine@click.local', 'Rooftop Makers', 'Eliza Fontaine', 'Creative', 'featured', 'click_managed', null::text, '2026-06-30T07:00:00.000Z', '2026-06-30T09:00:00.000Z', 'UTS Broadway Rooftop', null::text, 'Ultimo', -33.8835, 151.199, 2000, 25, '/media/concert.jpg', 'A crowd enjoying live music together', 'Make art beside fellow makers at golden hour.', 'City skyline backdrop, all skill levels.'),
    ('singles-hike-spit-to-manly', 'Singles Hike: Bondi to Coogee', 'Real Conversations Sydney hosts singles hike: spit to manly in Bondi Beach. Meet someone over a shared 10k walk.', 'amelia@click.local', 'Real Conversations Sydney', 'Amelia Hart', 'Relationships', 'waitlist', 'click_managed', null::text, '2026-06-30T23:00:00.000Z', '2026-07-01T01:00:00.000Z', 'Bondi to Coogee Coastal Walk', null::text, 'Bondi Beach', -33.895, 151.2745, 2500, 26, '/media/open-yoga.jpg', 'People gathering outdoors in a relaxed group class', 'Meet someone over a shared 10k walk.', 'Pairs rotate so you talk to everyone.'),
    ('trivia-tap-takeover', 'Trivia & Tap Takeover', 'Tabletop Tuesdays hosts trivia & tap takeover in Balmain. Join a team and leave with new mates.', 'host-marcus-lim@click.local', 'Tabletop Tuesdays', 'Marcus Lim', 'Social', 'live', 'click_managed', null::text, '2026-07-02T09:00:00.000Z', '2026-07-02T11:00:00.000Z', 'The Riverview Hotel', null::text, 'Balmain', -33.8565, 151.18, 1000, 48, '/media/networking.jpg', 'People talking and sharing food at a hosted event', 'Join a team and leave with new mates.', 'Solo players get placed on a friendly team.'),
    ('morning-sea-swim-squad', 'Morning Sea Swim Squad', 'Slow Sundays Yoga hosts morning sea swim squad in Bondi Beach. Find a brave morning-swim crew.', 'host-priya-shah@click.local', 'Slow Sundays Yoga', 'Priya Shah', 'Fitness', 'live', 'click_managed', null::text, '2026-07-02T20:45:00.000Z', '2026-07-02T22:45:00.000Z', 'Bondi Icebergs', null::text, 'Bondi Beach', -33.8917, 151.2768, 0, 30, '/media/open-yoga.jpg', 'People gathering outdoors in a relaxed group class', 'Find a brave morning-swim crew.', 'Coffee debrief after every swim.'),
    ('career-pivot-roundtable', 'Career Pivot Roundtable', 'Sydney Builders hosts career pivot roundtable in St Peters. Get unstuck with people mid-pivot too.', 'host-noah-whitfield@click.local', 'Sydney Builders', 'Noah Whitfield', 'Career', 'live', 'click_managed', null::text, '2026-07-05T08:00:00.000Z', '2026-07-05T10:00:00.000Z', 'Precinct 75', null::text, 'St Peters', -33.9085, 151.182, 0, 30, '/media/networking.jpg', 'People talking and sharing food at a hosted event', 'Get unstuck with people mid-pivot too.', 'Bring one question, leave with five answers.'),
    ('ramen-records', 'Ramen & Records', 'After Hours Listening Club hosts ramen & records in Newtown. Bond over noodles and a shared playlist.', 'host-sofia-marchetti@click.local', 'After Hours Listening Club', 'Sofia Marchetti', 'Food', 'waitlist', 'click_managed', null::text, '2026-07-07T08:30:00.000Z', '2026-07-07T10:30:00.000Z', 'Rising Sun Workshop', null::text, 'Newtown', -33.8995, 151.18, 3800, 16, '/media/networking.jpg', 'People talking and sharing food at a hosted event', 'Bond over noodles and a shared playlist.', 'Vinyl spinning while you slurp — easy chats.'),
    ('beginner-salsa-social', 'Beginner Salsa Social', 'Brushes After Dark hosts beginner salsa social in Newtown. Learn steps beside other first-timers.', 'host-sofia-marchetti@click.local', 'Brushes After Dark', 'Sofia Marchetti', 'Creative', 'live', 'click_managed', null::text, '2026-07-09T09:30:00.000Z', '2026-07-09T11:30:00.000Z', 'The Vanguard', null::text, 'Newtown', -33.8992, 151.1786, 2200, 36, '/media/concert.jpg', 'A crowd enjoying live music together', 'Learn steps beside other first-timers.', 'No partner needed — everyone rotates.'),
    ('coastal-cleanup-crew', 'Coastal Cleanup Crew', 'Neighbourhood Roots hosts coastal cleanup crew in Coogee. Do good and meet locals who care.', 'host-hana-watanabe@click.local', 'Neighbourhood Roots', 'Hana Watanabe', 'Community', 'featured', 'click_managed', null::text, '2026-07-10T23:30:00.000Z', '2026-07-11T01:30:00.000Z', 'Gordons Bay', null::text, 'Coogee', -33.918, 151.262, 0, 40, '/media/open-yoga.jpg', 'People gathering outdoors in a relaxed group class', 'Do good and meet locals who care.', 'An hour of cleanup, then a beach picnic.'),
    ('sunday-roast-for-strangers', 'Sunday Roast for Strangers', 'Sydney Table Friends hosts sunday roast for strangers in Redfern. Make Sunday lunch a social default.', 'lena@click.local', 'Sydney Table Friends', 'Lena Ortiz', 'Food', 'live', 'click_managed', null::text, '2026-07-12T03:00:00.000Z', '2026-07-12T05:00:00.000Z', 'The Bearded Tit', null::text, 'Redfern', -33.893, 151.201, 4200, 12, '/media/networking.jpg', 'People talking and sharing food at a hosted event', 'Make Sunday lunch a social default.', 'One long table, hosted introductions.'),
    ('photo-walk-laneways-light', 'Photo Walk: Laneways & Light', 'Rooftop Makers hosts photo walk: laneways & light in Chippendale. Shoot beside people who love the same frames.', 'host-eliza-fontaine@click.local', 'Rooftop Makers', 'Eliza Fontaine', 'Creative', 'live', 'click_managed', null::text, '2026-07-14T06:00:00.000Z', '2026-07-14T08:00:00.000Z', 'Spice Alley', null::text, 'Chippendale', -33.8858, 151.1988, 0, 20, '/media/concert.jpg', 'A crowd enjoying live music together', 'Shoot beside people who love the same frames.', 'All cameras welcome, phones included.'),
    ('run-brunch-centennial', 'Run & Brunch: Centennial', 'Inner West Pacers hosts run & brunch: centennial in Queens Park. Lock in a weekend running ritual.', 'host-dylan-reyes@click.local', 'Inner West Pacers', 'Dylan Reyes', 'Fitness', 'live', 'click_managed', null::text, '2026-07-15T22:00:00.000Z', '2026-07-16T00:00:00.000Z', 'Queens Park', null::text, 'Queens Park', -33.897, 151.254, 0, 50, '/media/open-yoga.jpg', 'People gathering outdoors in a relaxed group class', 'Lock in a weekend running ritual.', 'Easy 5k loop then a long brunch.'),
    ('singles-cooking-class', 'Singles Cooking Class', 'Real Conversations Sydney hosts singles cooking class in Camperdown. Meet someone over a shared recipe.', 'amelia@click.local', 'Real Conversations Sydney', 'Amelia Hart', 'Relationships', 'waitlist', 'click_managed', null::text, '2026-07-19T08:00:00.000Z', '2026-07-19T10:00:00.000Z', 'Sydney Cooking School', null::text, 'Camperdown', -33.889, 151.177, 5900, 16, '/media/networking.jpg', 'People talking and sharing food at a hosted event', 'Meet someone over a shared recipe.', 'Cook in pairs, taste as a group.')
  ) as e(slug, title, description, host_email, group_name, host_name, category, status, booking_model, external_booking_url, starts_at, ends_at, location_name, address, suburb, latitude, longitude, price_cents, capacity, image_url, image_alt, relationship_goal, fomo)
)
insert into events (slug, title, description, host_profile_id, group_name, host_name, category, status, booking_model, external_booking_url, starts_at, ends_at, location_name, address, suburb, latitude, longitude, price_cents, capacity, image_url, image_alt, relationship_goal, fomo)
select e.slug, e.title, e.description, host.id, e.group_name, e.host_name, e.category, e.status::event_status, e.booking_model::booking_model, e.external_booking_url, e.starts_at::timestamptz, e.ends_at::timestamptz, e.location_name, e.address, e.suburb, e.latitude::numeric, e.longitude::numeric, e.price_cents, e.capacity, e.image_url, e.image_alt, e.relationship_goal, e.fomo
from seed_events e
join profiles host on host.email = e.host_email::citext
on conflict (slug) do nothing;

-- 3. Event tags (only slugs that already exist in tags).
with event_tag_seed(event_slug, tag_slug) as (values
  ('sunrise-run-club-bay-run-loop', 'running'),
  ('sunrise-run-club-bay-run-loop', 'fitness'),
  ('sunrise-run-club-bay-run-loop', 'morning'),
  ('sunrise-run-club-bay-run-loop', 'outdoors'),
  ('sunrise-run-club-bay-run-loop', 'accountability'),
  ('vinyasa-flow-in-the-park', 'yoga'),
  ('vinyasa-flow-in-the-park', 'wellness'),
  ('vinyasa-flow-in-the-park', 'outdoors'),
  ('vinyasa-flow-in-the-park', 'morning'),
  ('vinyasa-flow-in-the-park', 'low-pressure'),
  ('board-games-buds-night', 'games'),
  ('board-games-buds-night', 'friends'),
  ('board-games-buds-night', 'low-pressure'),
  ('board-games-buds-night', 'new-to-town'),
  ('board-games-buds-night', 'ambivert'),
  ('wine-watercolour-social', 'creative'),
  ('founders-coffee-early-stage', 'founders'),
  ('founders-coffee-early-stage', 'career-change'),
  ('founders-coffee-early-stage', 'morning'),
  ('dumpling-crawl-chinatown', 'food'),
  ('dumpling-crawl-chinatown', 'dumplings'),
  ('dumpling-crawl-chinatown', 'dinner'),
  ('sunset-sketch-jam', 'creative'),
  ('sunset-sketch-jam', 'photography'),
  ('sunset-sketch-jam', 'weekend'),
  ('beginner-bouldering-meet', 'fitness'),
  ('beginner-bouldering-meet', 'accountability'),
  ('slow-dating-walk-talk', 'dating'),
  ('slow-dating-walk-talk', 'relationships'),
  ('slow-dating-walk-talk', 'outdoors'),
  ('slow-dating-walk-talk', 'weekend'),
  ('jazz-negronis', 'jazz'),
  ('jazz-negronis', 'live-music'),
  ('new-in-town-mixer', 'friends'),
  ('new-in-town-mixer', 'new-to-town'),
  ('new-in-town-mixer', 'low-pressure'),
  ('new-in-town-mixer', 'ambivert'),
  ('parkrun-pancakes', 'running'),
  ('parkrun-pancakes', 'fitness'),
  ('parkrun-pancakes', 'morning'),
  ('parkrun-pancakes', 'weekend'),
  ('parkrun-pancakes', 'outdoors'),
  ('pottery-for-total-beginners', 'pottery'),
  ('pottery-for-total-beginners', 'creative'),
  ('pottery-for-total-beginners', 'weekend'),
  ('long-lunch-shared-plates', 'food'),
  ('long-lunch-shared-plates', 'dinner'),
  ('long-lunch-shared-plates', 'restaurant'),
  ('women-in-tech-coffee-career', 'women'),
  ('women-in-tech-coffee-career', 'career-change'),
  ('women-in-tech-coffee-career', 'confidence'),
  ('women-in-tech-coffee-career', 'morning'),
  ('harbour-sunset-picnic', 'friends'),
  ('harbour-sunset-picnic', 'outdoors'),
  ('harbour-sunset-picnic', 'weekend'),
  ('harbour-sunset-picnic', 'low-pressure'),
  ('harbour-sunset-picnic', 'ambivert'),
  ('crossfit-skills-partner-drills', 'crossfit'),
  ('crossfit-skills-partner-drills', 'fitness'),
  ('crossfit-skills-partner-drills', 'accountability'),
  ('crossfit-skills-partner-drills', 'morning'),
  ('open-mic-acoustic-night', 'live-music'),
  ('open-mic-acoustic-night', 'indie'),
  ('speed-friending-inner-west', 'friends'),
  ('speed-friending-inner-west', 'new-to-town'),
  ('speed-friending-inner-west', 'low-pressure'),
  ('speed-friending-inner-west', 'ambivert'),
  ('saturday-surf-school', 'fitness'),
  ('saturday-surf-school', 'outdoors'),
  ('saturday-surf-school', 'weekend'),
  ('cheese-natural-wine-101', 'food'),
  ('mindful-morning-breath-walk', 'wellness'),
  ('mindful-morning-breath-walk', 'outdoors'),
  ('mindful-morning-breath-walk', 'morning'),
  ('mindful-morning-breath-walk', 'low-pressure'),
  ('indie-film-club-screening-night', 'creative'),
  ('volunteer-garden-working-bee', 'community'),
  ('volunteer-garden-working-bee', 'volunteering'),
  ('volunteer-garden-working-bee', 'outdoors'),
  ('volunteer-garden-working-bee', 'weekend'),
  ('dog-owners-social-walk', 'pets'),
  ('dog-owners-social-walk', 'community'),
  ('dog-owners-social-walk', 'outdoors'),
  ('dog-owners-social-walk', 'weekend'),
  ('dog-owners-social-walk', 'low-pressure'),
  ('founders-dinner-table-of-ten', 'founders'),
  ('founders-dinner-table-of-ten', 'dinner'),
  ('founders-dinner-table-of-ten', 'career-change'),
  ('bouldering-tacos', 'fitness'),
  ('bouldering-tacos', 'accountability'),
  ('latte-art-throwdown', 'food'),
  ('latte-art-throwdown', 'weekend'),
  ('sunset-rooftop-sketch-jam', 'creative'),
  ('sunset-rooftop-sketch-jam', 'photography'),
  ('sunset-rooftop-sketch-jam', 'weekend'),
  ('singles-hike-spit-to-manly', 'dating'),
  ('singles-hike-spit-to-manly', 'relationships'),
  ('singles-hike-spit-to-manly', 'outdoors'),
  ('singles-hike-spit-to-manly', 'weekend'),
  ('trivia-tap-takeover', 'games'),
  ('trivia-tap-takeover', 'friends'),
  ('trivia-tap-takeover', 'low-pressure'),
  ('trivia-tap-takeover', 'ambivert'),
  ('morning-sea-swim-squad', 'swimming'),
  ('morning-sea-swim-squad', 'fitness'),
  ('morning-sea-swim-squad', 'outdoors'),
  ('morning-sea-swim-squad', 'morning'),
  ('morning-sea-swim-squad', 'wellness'),
  ('career-pivot-roundtable', 'career-change'),
  ('career-pivot-roundtable', 'confidence'),
  ('ramen-records', 'food'),
  ('ramen-records', 'dinner'),
  ('ramen-records', 'jazz'),
  ('beginner-salsa-social', 'creative'),
  ('coastal-cleanup-crew', 'community'),
  ('coastal-cleanup-crew', 'volunteering'),
  ('coastal-cleanup-crew', 'outdoors'),
  ('coastal-cleanup-crew', 'weekend'),
  ('sunday-roast-for-strangers', 'food'),
  ('sunday-roast-for-strangers', 'dinner'),
  ('sunday-roast-for-strangers', 'weekend'),
  ('sunday-roast-for-strangers', 'ambivert'),
  ('photo-walk-laneways-light', 'photography'),
  ('photo-walk-laneways-light', 'creative'),
  ('photo-walk-laneways-light', 'weekend'),
  ('photo-walk-laneways-light', 'outdoors'),
  ('run-brunch-centennial', 'running'),
  ('run-brunch-centennial', 'fitness'),
  ('run-brunch-centennial', 'morning'),
  ('run-brunch-centennial', 'weekend'),
  ('singles-cooking-class', 'dating'),
  ('singles-cooking-class', 'relationships'),
  ('singles-cooking-class', 'food')
)
insert into event_tags (event_id, tag_id)
select e.id, t.id from event_tag_seed s
join events e on e.slug = s.event_slug
join tags t on t.slug = s.tag_slug
on conflict do nothing;

-- 4. Confirmed attendance using the existing attendee+N@click.local seed members.
with attendance_targets(event_slug, attendee_count) as (values
  ('sunrise-run-club-bay-run-loop', 31),
  ('vinyasa-flow-in-the-park', 18),
  ('board-games-buds-night', 19),
  ('wine-watercolour-social', 17),
  ('founders-coffee-early-stage', 22),
  ('dumpling-crawl-chinatown', 11),
  ('sunset-sketch-jam', 20),
  ('beginner-bouldering-meet', 14),
  ('slow-dating-walk-talk', 21),
  ('jazz-negronis', 33),
  ('new-in-town-mixer', 38),
  ('parkrun-pancakes', 41),
  ('pottery-for-total-beginners', 12),
  ('long-lunch-shared-plates', 7),
  ('women-in-tech-coffee-career', 27),
  ('harbour-sunset-picnic', 29),
  ('crossfit-skills-partner-drills', 20),
  ('open-mic-acoustic-night', 35),
  ('speed-friending-inner-west', 30),
  ('saturday-surf-school', 13),
  ('cheese-natural-wine-101', 15),
  ('mindful-morning-breath-walk', 16),
  ('indie-film-club-screening-night', 28),
  ('volunteer-garden-working-bee', 14),
  ('dog-owners-social-walk', 22),
  ('founders-dinner-table-of-ten', 8),
  ('bouldering-tacos', 15),
  ('latte-art-throwdown', 18),
  ('sunset-rooftop-sketch-jam', 19),
  ('singles-hike-spit-to-manly', 23),
  ('trivia-tap-takeover', 36),
  ('morning-sea-swim-squad', 19),
  ('career-pivot-roundtable', 21),
  ('ramen-records', 12),
  ('beginner-salsa-social', 27),
  ('coastal-cleanup-crew', 25),
  ('sunday-roast-for-strangers', 9),
  ('photo-walk-laneways-light', 13),
  ('run-brunch-centennial', 34),
  ('singles-cooking-class', 14)
),
expanded as (
  select t.event_slug, gs.i from attendance_targets t
  cross join lateral generate_series(1, t.attendee_count) as gs(i)
)
insert into event_attendees (event_id, profile_id, status)
select e.id, p.id, 'confirmed'::rsvp_status
from expanded x
join events e on e.slug = x.event_slug
join profiles p on p.email = ('attendee+' || x.i || '@click.local')::citext
on conflict (event_id, profile_id) do nothing;

commit;
