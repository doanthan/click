-- Profile gallery + prompts (Hinge-style attendee profiles).
--
--  - `gallery_photos`: up to 5 extra photo URLs per profile, ordered. Objects
--    live in the public `avatars` bucket under a `gallery/<profileId>/` prefix
--    (the avatar itself stays on `photo_url`). The 5-photo cap is enforced by
--    the upload route (`POST /api/upload/gallery`), not a constraint, so a
--    future limit change is config-only.
--  - `prompts`: up to 3 answered profile prompts as jsonb
--    `[{"id":"two-truths-and-a-lie","answer":"…"}]`. The catalogue of valid
--    prompt ids lives in `src/lib/profile-prompts.ts`; unknown ids are dropped
--    on read so retiring a prompt never breaks a profile.
--
-- The verification tick reuses the existing `profiles.photo_verified_at`
-- column from 001 — admins stamp/clear it from /admin/members.

alter table profiles
  add column if not exists gallery_photos text[] not null default '{}',
  add column if not exists prompts jsonb not null default '[]'::jsonb;
