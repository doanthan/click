-- Merchant social platform.
--
-- The merchant signup wizard (/merchant/signup/contact) used to collect a
-- single free-text handle without recording which network it belonged to.
-- This adds the platform alongside the existing `social_handle` so admins can
-- tell an Instagram handle from a TikTok or Facebook one during verification.
--
-- Constrained to the three networks offered by the wizard's platform picker.
-- Nullable — the handle (and therefore the platform) stays optional.
--
-- Idempotent — safe to re-run.

begin;

alter table merchant_profiles
  add column if not exists social_platform text
    check (social_platform in ('instagram', 'tiktok', 'facebook'));

commit;
