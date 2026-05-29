-- Post-approval merchant onboarding + Stripe Connect.
--
-- merchant_profiles.stripe_connect_account_id already exists (001_schema.sql)
-- but was never written. This migration adds:
--   * mirror columns of the connected account's capability state, kept in sync
--     by the `account.updated` Connect webhook (src/app/api/webhooks/stripe).
--     These are a cache for gating/UI — Stripe remains the source of truth.
--   * onboarding_completed_at: marks that the merchant has been through (or
--     skipped) the one-time post-approval walkthrough at /merchant/onboarding,
--     so /merchant stops redirecting them into it.
--
-- Payout setup is skippable, so charges/payouts default false and a merchant
-- can have onboarding_completed_at set while still not payouts_enabled.

begin;

alter table merchant_profiles
  add column if not exists charges_enabled boolean not null default false,
  add column if not exists payouts_enabled boolean not null default false,
  add column if not exists details_submitted boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz;

-- Looking up a merchant by its connected account id from the webhook.
create index if not exists merchant_profiles_stripe_connect_account_id_idx
  on merchant_profiles (stripe_connect_account_id)
  where stripe_connect_account_id is not null;

commit;
