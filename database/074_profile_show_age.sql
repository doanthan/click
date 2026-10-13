begin;

-- 074_profile_show_age.sql
--
-- Bug board #339: a member can hide their age. The tester's rule, kept as
-- written: hidden means hidden from everyone EXCEPT another member who is open
-- to dating when the owner is too - the same mutual opt-in the dating label
-- already follows (visibleIntentsFor / visibleAgeFor in profile-details.tsx).
--
-- Default true, so nothing changes for anyone until they switch it off in
-- Settings -> Privacy (updateAccountSetting "showAge"). Read by getOwnProfile,
-- getPublicProfileById and the Who's going crowd-age line, all fail-soft
-- (to_jsonb(...) ->> 'show_age'), so the code can deploy before this runs.
--
-- Additive and idempotent.

alter table profiles add column if not exists show_age boolean not null default true;

commit;
