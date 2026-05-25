-- Admin moderation + system settings.
-- - profiles.suspended_at lets admins soft-suspend accounts (auth still works,
--   but the UI shows a banner / can be expanded to gate routes).
-- - system_settings is a tiny KV table for runtime flags (maintenance mode,
--   commission rate, etc.) we want admins to flip without a redeploy.

begin;

alter table profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;

create index if not exists profiles_suspended_idx on profiles(suspended_at);

create table if not exists system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by_profile_id uuid references profiles(id) on delete set null
);

alter table system_settings enable row level security;

insert into system_settings (key, value)
values
  ('maintenance_mode', 'false'::jsonb),
  ('commission_rate_bps', '290'::jsonb),
  ('marketing_banner', '""'::jsonb)
on conflict (key) do nothing;

commit;
