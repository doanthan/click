begin;

-- 081_host_waitlist.sql
--
-- The host waitlist on the homepage ("For hosts" section, HostWaitlistForm).
-- A business or person who wants to host on Click leaves their details and we
-- get in touch before bookings open. Additive only.
--
-- One row per address that asked. These people may have no profile, and a row
-- grants nothing: it is not a merchant_profiles row, not an application, and
-- not the instant-access signup at /merchant/signup (that stays where it is).
-- Written only by joinHostWaitlist (src/lib/host-waitlist.ts), read by
-- /admin/host-waitlist and its CSV export.
--
-- Why not merchant_location_waitlist (043): that table is one row per signed-in
-- merchant's out-of-pilot location, keyed on merchant_profile_id NOT NULL. A
-- homepage visitor has no merchant profile, so it can't hold them.
--
-- Only email and business_name are required. Every other column is whatever
-- the person chose to tell us, trimmed, or null.

create table if not exists host_waitlist (
  id            uuid primary key default gen_random_uuid(),
  email         citext not null unique,
  business_name text not null check (char_length(business_name) between 1 and 120),
  contact_name  text check (contact_name is null or char_length(contact_name) between 1 and 80),
  -- Digits with an optional leading +, spaces and punctuation stripped.
  phone         text check (phone is null or phone ~ '^\+?[0-9]{8,15}$'),
  -- What they typed for where they host: a suburb name or a postcode.
  place         text check (place is null or char_length(place) between 1 and 80),
  -- Same buckets as launch_waitlist.area (waitlistAreaFor): 'pilot' = Sydney,
  -- 'outside' = a real place beyond it, 'unknown' = a name the postcode table
  -- has never seen. Null exactly when no place was given.
  area          text check (area is null or area in ('pilot', 'outside', 'unknown')),
  -- Keys from the canonical categories (CATEGORIES in src/components/ds.tsx,
  -- Dating excluded). Checked in the app, not here, so a category rename is a
  -- code change and never a failed insert.
  event_types   text[] not null default '{}' check (cardinality(event_types) <= 16),
  -- A website or an Instagram handle, as typed. Shown as text, linked only
  -- when it is an http(s) URL.
  website       text check (website is null or char_length(website) between 1 and 200),
  created_at    timestamptz not null default now(),
  constraint host_waitlist_place_area check ((place is null) = (area is null))
);

-- RLS parity: the service-role pooler bypasses it; enabled to match the
-- 001 / 019 / 049 / 072 convention so PostgREST never exposes a list of emails.
alter table host_waitlist enable row level security;

comment on table host_waitlist is
  'Homepage host waitlist. Not merchants. Written only by joinHostWaitlist; read by /admin/host-waitlist.';

commit;
