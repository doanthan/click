-- Account settings persistence.
--
-- The /account-settings Notifications + Privacy tabs shipped with disabled,
-- non-persisting checkboxes ("toggle persistence ships with a later migration").
-- This is that migration. Notification toggles live in one jsonb blob (they're
-- delivery preferences, read together when we send). The privacy switches that
-- gate what other users see (suburb + attendance count on the public profile,
-- and whether RSVPd merchants may message) are individual booleans so the
-- read-side queries can filter on them cheaply.

alter table profiles
  add column if not exists notification_prefs jsonb not null
    default '{"eventReminders":true,"waitlistOffers":true,"mutualClick":true,"weeklyRecap":false,"productUpdates":false}'::jsonb,
  add column if not exists show_suburb boolean not null default true,
  add column if not exists show_attendance_count boolean not null default true,
  add column if not exists allow_merchant_messages boolean not null default false;
