-- Per-platform social handles for merchants.
--
-- Supersedes the single social_platform/social_handle pair (022 + 030): the
-- merchant signup wizard now collects a handle for each network (Instagram,
-- TikTok, Facebook, YouTube, X) instead of forcing the host to pick just one.
-- New writes go to this JSONB map of { platform: handle }; empty handles are
-- omitted, so '{}' means "none given". The legacy columns are left in place
-- for backwards compatibility but are no longer written by the wizard.

alter table merchant_profiles
  add column if not exists socials jsonb not null default '{}'::jsonb;

-- Backfill the new map from the legacy single platform/handle pair so existing
-- merchants keep their social link.
update merchant_profiles
set socials = jsonb_build_object(social_platform, btrim(social_handle))
where socials = '{}'::jsonb
  and social_platform is not null
  and nullif(btrim(social_handle), '') is not null;
