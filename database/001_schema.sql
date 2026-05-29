begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

create type user_role as enum ('attendee', 'merchant', 'admin');
create type connection_intent as enum ('dating', 'friendship', 'networking', 'exploring');
create type event_status as enum ('draft', 'pending', 'live', 'featured', 'locked', 'waitlist', 'cancelled');
create type booking_model as enum ('click_managed', 'external');
create type rsvp_status as enum ('confirmed', 'cancelled', 'waitlisted', 'refunded');
create type click_status as enum ('pending', 'mutual', 'expired');
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type notification_channel as enum ('in_app', 'email');

create table profiles (
  id uuid primary key default gen_random_uuid(),
  auth_subject text unique,
  role user_role not null default 'attendee',
  email citext unique not null,
  display_name text not null,
  age integer check (age is null or age >= 18),
  gender text,
  suburb text,
  city text not null default 'Sydney',
  bio text,
  photo_url text,
  connection_intents connection_intent[] not null default '{friendship}'::connection_intent[],
  email_verified_at timestamptz,
  photo_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table merchant_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  business_name text not null,
  abn text,
  website_url text,
  contact_email citext not null,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected', 'suspended')),
  stripe_connect_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tag_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references tag_categories(id) on delete set null,
  label text not null,
  slug text not null unique,
  tag_type text not null check (tag_type in ('interest', 'life', 'music', 'vibe')),
  admin_managed boolean not null default true,
  created_at timestamptz not null default now()
);

create table user_tags (
  profile_id uuid not null references profiles(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  source text not null default 'user' check (source in ('user', 'quiz', 'music', 'system')),
  created_at timestamptz not null default now(),
  primary key (profile_id, tag_id)
);

create table click_personas (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  persona_name text not null,
  social_energy text not null check (social_energy in ('introvert', 'ambivert', 'extrovert')),
  pace text not null check (pace in ('relaxed', 'balanced', 'fast_moving')),
  openness text not null check (openness in ('cautious', 'curious', 'ready')),
  engagement_frequency text not null check (engagement_frequency in ('occasional', 'active', 'enthusiastic')),
  intent_mix jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  host_profile_id uuid references profiles(id) on delete set null,
  merchant_profile_id uuid references merchant_profiles(id) on delete set null,
  group_name text not null,
  host_name text not null,
  category text not null,
  status event_status not null default 'pending',
  booking_model booking_model not null default 'click_managed',
  external_booking_url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'Australia/Sydney',
  location_name text not null,
  address text,
  suburb text not null,
  city text not null default 'Sydney',
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  price_cents integer not null default 0 check (price_cents >= 0),
  currency char(3) not null default 'AUD',
  capacity integer not null check (capacity > 0),
  image_url text,
  image_alt text,
  relationship_goal text,
  fomo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_booking_url_required check (
    booking_model = 'click_managed' or external_booking_url is not null
  )
);

create table event_tags (
  event_id uuid not null references events(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, tag_id)
);

create table event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  status rsvp_status not null default 'confirmed',
  payment_transaction_id uuid,
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, profile_id)
);

create table event_waitlists (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  offered_until timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, profile_id)
);

create table bookmarks (
  event_id uuid not null references events(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

create table user_clicks (
  id uuid primary key default gen_random_uuid(),
  clicker_profile_id uuid not null references profiles(id) on delete cascade,
  clicked_profile_id uuid not null references profiles(id) on delete cascade,
  source_event_id uuid references events(id) on delete set null,
  status click_status not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  constraint no_self_click check (clicker_profile_id <> clicked_profile_id),
  unique (clicker_profile_id, clicked_profile_id)
);

create table mutual_clicks (
  id uuid primary key default gen_random_uuid(),
  profile_a_id uuid not null references profiles(id) on delete cascade,
  profile_b_id uuid not null references profiles(id) on delete cascade,
  suggested_event_id uuid references events(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ordered_profile_pair check (profile_a_id < profile_b_id),
  unique (profile_a_id, profile_b_id)
);

create table payment_transactions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  merchant_profile_id uuid references merchant_profiles(id) on delete set null,
  stripe_payment_intent_id text unique,
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null default 'AUD',
  status payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table event_attendees
  add constraint event_attendees_payment_transaction_fk
  foreign key (payment_transaction_id) references payment_transactions(id) on delete set null;

create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  channel notification_channel not null default 'in_app',
  title text not null,
  body text not null,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on profiles
for each row execute function set_updated_at();

create trigger set_merchant_profiles_updated_at
before update on merchant_profiles
for each row execute function set_updated_at();

create trigger set_events_updated_at
before update on events
for each row execute function set_updated_at();

create trigger set_event_attendees_updated_at
before update on event_attendees
for each row execute function set_updated_at();

create trigger set_payment_transactions_updated_at
before update on payment_transactions
for each row execute function set_updated_at();

create or replace function confirmed_attendee_count(target_event_id uuid)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from event_attendees
  where event_id = target_event_id
    and status = 'confirmed';
$$;

create or replace function ensure_event_capacity()
returns trigger
language plpgsql
as $$
declare
  event_capacity integer;
  confirmed_count integer;
begin
  if new.status <> 'confirmed' then
    return new;
  end if;

  select capacity into event_capacity
  from events
  where id = new.event_id
  for update;

  select count(*)::integer into confirmed_count
  from event_attendees
  where event_id = new.event_id
    and status = 'confirmed'
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if confirmed_count >= event_capacity then
    raise exception 'event capacity reached for %', new.event_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger ensure_event_capacity_before_attendee_write
before insert or update of status on event_attendees
for each row execute function ensure_event_capacity();

create or replace function prevent_merchant_event_overlap()
returns trigger
language plpgsql
as $$
begin
  if new.status not in ('live', 'featured', 'locked', 'waitlist') then
    return new;
  end if;

  if new.merchant_profile_id is null or new.ends_at is null then
    return new;
  end if;

  if exists (
    select 1
    from events existing
    where existing.id <> new.id
      and existing.merchant_profile_id = new.merchant_profile_id
      and existing.status in ('live', 'featured', 'locked', 'waitlist')
      and tstzrange(existing.starts_at, existing.ends_at, '[)')
        && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'merchant has an overlapping live event'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger prevent_merchant_event_overlap_before_event_write
before insert or update of starts_at, ends_at, status, merchant_profile_id on events
for each row execute function prevent_merchant_event_overlap();

create or replace function create_mutual_click()
returns trigger
language plpgsql
as $$
declare
  low_profile_id uuid;
  high_profile_id uuid;
  suggested uuid;
begin
  if exists (
    select 1
    from user_clicks reciprocal
    where reciprocal.clicker_profile_id = new.clicked_profile_id
      and reciprocal.clicked_profile_id = new.clicker_profile_id
      and reciprocal.expires_at > now()
  ) then
    low_profile_id := least(new.clicker_profile_id, new.clicked_profile_id);
    high_profile_id := greatest(new.clicker_profile_id, new.clicked_profile_id);

    select source_event_id into suggested
    from user_clicks
    where (
      clicker_profile_id = new.clicker_profile_id
      and clicked_profile_id = new.clicked_profile_id
    ) or (
      clicker_profile_id = new.clicked_profile_id
      and clicked_profile_id = new.clicker_profile_id
    )
    order by source_event_id is null, created_at desc
    limit 1;

    insert into mutual_clicks (profile_a_id, profile_b_id, suggested_event_id)
    values (low_profile_id, high_profile_id, suggested)
    on conflict (profile_a_id, profile_b_id) do nothing;

    update user_clicks
    set status = 'mutual'
    where (
      clicker_profile_id = new.clicker_profile_id
      and clicked_profile_id = new.clicked_profile_id
    ) or (
      clicker_profile_id = new.clicked_profile_id
      and clicked_profile_id = new.clicker_profile_id
    );
  end if;

  return new;
end;
$$;

create trigger create_mutual_click_after_click
after insert on user_clicks
for each row execute function create_mutual_click();

create index profiles_role_idx on profiles(role);
create index profiles_city_suburb_idx on profiles(city, suburb);
create index tags_type_slug_idx on tags(tag_type, slug);
create index user_tags_tag_id_idx on user_tags(tag_id);
create index events_status_starts_at_idx on events(status, starts_at);
create index events_suburb_idx on events(suburb);
create index events_category_idx on events(category);
create index events_lat_lng_idx on events(latitude, longitude);
create index event_tags_tag_id_idx on event_tags(tag_id);
create index event_attendees_event_status_idx on event_attendees(event_id, status);
create index event_attendees_profile_idx on event_attendees(profile_id);
create index event_waitlists_event_created_idx on event_waitlists(event_id, created_at);
create index bookmarks_profile_idx on bookmarks(profile_id);
create index user_clicks_clicked_idx on user_clicks(clicked_profile_id);
create index mutual_clicks_profile_b_idx on mutual_clicks(profile_b_id);
create index notifications_profile_read_idx on notifications(profile_id, read_at);

alter table tag_categories enable row level security;
alter table tags enable row level security;
alter table profiles enable row level security;
alter table merchant_profiles enable row level security;
alter table user_tags enable row level security;
alter table click_personas enable row level security;
alter table events enable row level security;
alter table event_tags enable row level security;
alter table event_attendees enable row level security;
alter table event_waitlists enable row level security;
alter table bookmarks enable row level security;
alter table user_clicks enable row level security;
alter table mutual_clicks enable row level security;
alter table payment_transactions enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

create policy tag_categories_public_read on tag_categories
  for select using (true);

create policy tags_public_read on tags
  for select using (true);

create policy events_public_read on events
  for select using (status in ('live', 'featured', 'locked', 'waitlist'));

create policy event_tags_public_read on event_tags
  for select using (
    exists (
      select 1
      from events
      where events.id = event_tags.event_id
        and events.status in ('live', 'featured', 'locked', 'waitlist')
    )
  );

comment on table events is 'Public and merchant-created events powering Explore, Dashboard, Click Radar, RSVP, and waitlist flows.';
comment on table user_clicks is 'Anonymous one-way Clicks. Mutual Clicks are created by trigger and unlock an event suggestion, not chat.';
comment on function ensure_event_capacity() is 'Serializes confirmed RSVP writes against the event row to prevent overbooking.';

commit;
