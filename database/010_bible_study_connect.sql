begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists bsc_profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  email citext unique not null,
  role text not null default 'user'
    check (role in ('user', 'group_leader', 'moderator', 'admin', 'super_admin')),
  display_name text,
  photo_url text,
  bio text,
  suburb text,
  city text,
  postcode text,
  country text not null default 'Australia',
  church text,
  denomination text,
  faith_background text,
  prayer_focus text,
  willing_to_host boolean not null default false,
  willing_to_lead boolean not null default false,
  meeting_preference text not null default 'both'
    check (meeting_preference in ('in_person', 'online', 'both')),
  privacy text not null default 'public'
    check (privacy in ('public', 'private')),
  age_verified_at timestamptz,
  banned_at timestamptz,
  suspended_until timestamptz,
  suspension_reason text,
  trusted_leader_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bsc_groups (
  id uuid primary key default gen_random_uuid(),
  leader_profile_id uuid references bsc_profiles(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text not null,
  group_type text not null default 'bible_study',
  visibility text not null default 'public'
    check (visibility in ('public', 'private')),
  meeting_type text not null default 'both'
    check (meeting_type in ('in_person', 'online', 'both')),
  suburb text,
  city text,
  postcode text,
  country text not null default 'Australia',
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  schedule text,
  day_of_week text,
  age_group text,
  denomination text,
  tags text[] not null default '{}',
  photo_url text,
  invite_code text unique,
  invite_revoked_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bsc_group_members (
  group_id uuid not null references bsc_groups(id) on delete cascade,
  profile_id uuid not null references bsc_profiles(id) on delete cascade,
  role text not null default 'member'
    check (role in ('member', 'leader')),
  joined_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create table if not exists bsc_group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references bsc_groups(id) on delete cascade,
  profile_id uuid not null references bsc_profiles(id) on delete cascade,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  decided_by_profile_id uuid references bsc_profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (group_id, profile_id)
);

create table if not exists bsc_discussion_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references bsc_groups(id) on delete cascade,
  author_profile_id uuid references bsc_profiles(id) on delete set null,
  title text not null,
  content text not null,
  category text not null default 'study',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bsc_comments (
  id uuid primary key default gen_random_uuid(),
  parent_type text not null
    check (parent_type in ('discussion', 'prayer', 'testimony')),
  parent_id uuid not null,
  author_profile_id uuid references bsc_profiles(id) on delete set null,
  content text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists bsc_group_chat_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references bsc_groups(id) on delete cascade,
  author_profile_id uuid references bsc_profiles(id) on delete set null,
  content text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists bsc_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references bsc_groups(id) on delete cascade,
  creator_profile_id uuid references bsc_profiles(id) on delete set null,
  title text not null,
  description text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location_name text,
  suburb text,
  city text,
  postcode text,
  country text not null default 'Australia',
  online_link text,
  visibility text not null default 'public'
    check (visibility in ('public', 'group')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bsc_event_rsvps (
  event_id uuid not null references bsc_events(id) on delete cascade,
  profile_id uuid not null references bsc_profiles(id) on delete cascade,
  status text not null check (status in ('going', 'not_going')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

create table if not exists bsc_prayer_posts (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid references bsc_profiles(id) on delete set null,
  group_id uuid references bsc_groups(id) on delete cascade,
  kind text not null default 'prayer'
    check (kind in ('prayer', 'praise')),
  title text not null,
  content text not null,
  visibility text not null default 'public'
    check (visibility in ('public', 'group')),
  answered_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bsc_prayer_prayed (
  prayer_id uuid not null references bsc_prayer_posts(id) on delete cascade,
  profile_id uuid not null references bsc_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (prayer_id, profile_id)
);

create table if not exists bsc_testimonies (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid references bsc_profiles(id) on delete set null,
  title text not null,
  story text not null,
  display_mode text not null default 'first_name'
    check (display_mode in ('anonymous', 'first_name', 'full_name')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bsc_testimony_likes (
  testimony_id uuid not null references bsc_testimonies(id) on delete cascade,
  profile_id uuid not null references bsc_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (testimony_id, profile_id)
);

create table if not exists bsc_waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references bsc_profiles(id) on delete cascade,
  suburb text not null,
  city text not null,
  postcode text,
  radius_km integer not null default 10,
  availability text[] not null default '{}',
  willing_to_host boolean not null default false,
  willing_to_lead boolean not null default false,
  status text not null default 'waiting'
    check (status in ('waiting', 'suggested', 'approved', 'group_created')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bsc_waitlist_matches (
  id uuid primary key default gen_random_uuid(),
  suburb text not null,
  city text not null,
  postcode text,
  status text not null default 'suggested'
    check (status in ('suggested', 'approved', 'rejected', 'group_created')),
  suggested_group_id uuid references bsc_groups(id) on delete set null,
  reviewed_by_profile_id uuid references bsc_profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists bsc_waitlist_match_entries (
  match_id uuid not null references bsc_waitlist_matches(id) on delete cascade,
  waitlist_entry_id uuid not null references bsc_waitlist_entries(id) on delete cascade,
  primary key (match_id, waitlist_entry_id)
);

create table if not exists bsc_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references bsc_profiles(id) on delete cascade,
  title text not null,
  body text not null,
  action_url text,
  read_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);

create table if not exists bsc_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid references bsc_profiles(id) on delete set null,
  reported_profile_id uuid references bsc_profiles(id) on delete set null,
  target_type text not null,
  target_id uuid,
  reason text not null,
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bsc_announcements (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid references bsc_profiles(id) on delete set null,
  title text not null,
  body text not null,
  active_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists bsc_upload_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references bsc_profiles(id) on delete cascade,
  object_key text not null,
  acl text not null default 'public'
    check (acl in ('public', 'private')),
  max_bytes integer not null default 10485760,
  expires_at timestamptz not null default now() + interval '10 minutes',
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists bsc_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references bsc_profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bsc_profiles_role_idx on bsc_profiles(role);
create index if not exists bsc_profiles_location_idx on bsc_profiles(country, city, suburb, postcode);
create index if not exists bsc_groups_public_search_idx on bsc_groups(visibility, city, suburb, postcode, day_of_week);
create index if not exists bsc_groups_tags_gin_idx on bsc_groups using gin(tags);
create index if not exists bsc_group_members_profile_idx on bsc_group_members(profile_id);
create index if not exists bsc_events_starts_idx on bsc_events(starts_at, visibility);
create index if not exists bsc_prayer_posts_created_idx on bsc_prayer_posts(created_at desc, visibility);
create index if not exists bsc_testimonies_status_idx on bsc_testimonies(status, created_at desc);
create index if not exists bsc_notifications_profile_unread_idx on bsc_notifications(profile_id, read_at, expires_at);
create index if not exists bsc_waitlist_location_idx on bsc_waitlist_entries(city, suburb, postcode, status);

commit;
