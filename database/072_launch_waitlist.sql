begin;

-- 072_launch_waitlist.sql
--
-- The pre-launch waitlist behind /waitlist ("Request an invite"). Canon: the
-- Landing prompt's STATE A (context/Click Design System/uploads/
-- Click_Design_Prompt_Landing-dfcf27fc.md) - email + suburb/postcode only, and
-- an out-of-area request is never refused.
--
-- One row per address that asked. These people have no profile, and a row
-- grants nothing: it is the list launch invites are sent from. Written only by
-- joinLaunchWaitlist (src/lib/launch-waitlist.ts), read by /admin/launch-waitlist
-- and its CSV export.
--
-- referral_code is the person's own share link (/i/<code>, which redirects to
-- /waitlist?ref=<code>). referred_by is whoever's link they came in on. The
-- admin view orders by how many people each row brought in, which is how the
-- success screen's "every one moves you up" is kept.

create table if not exists launch_waitlist (
  id            uuid primary key default gen_random_uuid(),
  email         citext not null unique,
  -- What they typed, trimmed: a suburb name or a postcode.
  place         text not null check (char_length(place) between 1 and 80),
  -- 'pilot' = inside the attendee pilot (regionFromPostcode says Sydney, the
  -- same test onboarding uses); 'outside' = a real place beyond it; 'unknown' =
  -- a name or code the postcode table has never seen. Kept either way.
  area          text not null check (area in ('pilot', 'outside', 'unknown')),
  referral_code text not null unique,
  referred_by   uuid references launch_waitlist(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists launch_waitlist_referred_by_idx
  on launch_waitlist (referred_by)
  where referred_by is not null;

-- RLS parity: the service-role pooler bypasses it; enabled to match the
-- 001 / 019 / 049 convention so PostgREST never exposes a list of emails.
alter table launch_waitlist enable row level security;

comment on table launch_waitlist is
  'Pre-launch invite requests from /waitlist. Not members. Written only by joinLaunchWaitlist; read by /admin/launch-waitlist.';

commit;
