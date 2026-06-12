-- 043_merchant_location_waitlist.sql
--
-- Sydney-only pilot gate: when a merchant tries to create an event outside the
-- greater-Sydney pilot area, we offer to add them to a location waitlist instead
-- and notify them when Click launches in their city. Each row is one
-- expression of interest for a non-Sydney location; the admin Location Waitlist
-- page reads from here.

create table if not exists merchant_location_waitlist (
  id                  uuid primary key default gen_random_uuid(),
  merchant_profile_id uuid not null references merchant_profiles(id) on delete cascade,
  address             text,
  suburb              text,
  latitude            double precision,
  longitude           double precision,
  -- Bucketed region at submit time ("Melbourne" / "Other"); handy for grouping
  -- demand by city in the admin view without re-deriving from coords.
  region              text,
  note                text,
  created_at          timestamptz not null default now()
);

create index if not exists merchant_location_waitlist_region_idx
  on merchant_location_waitlist (region, created_at desc);

create index if not exists merchant_location_waitlist_merchant_idx
  on merchant_location_waitlist (merchant_profile_id, created_at desc);
