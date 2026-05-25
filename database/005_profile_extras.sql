-- Profile-level fields driven by onboarding + privacy controls:
--   birth_date     : exact DOB; the existing `age` column stays for backwards compat
--   dating_visible : whether dating-intent users can see this profile
--   flexible_discovery : whether to surface cross-intent events to this user
-- All three are nullable / default-on so existing rows stay valid.

begin;

alter table profiles
  add column if not exists birth_date date,
  add column if not exists dating_visible boolean not null default true,
  add column if not exists flexible_discovery boolean not null default true;

create index if not exists profiles_birth_date_idx on profiles(birth_date);

commit;
