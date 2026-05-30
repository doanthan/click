-- Merchant social handle.
--
-- Adds a free-text Facebook/Instagram handle (or profile URL) collected on
-- Step 2 of the merchant signup wizard (/merchant/signup/contact). Useful for
-- verification — many small hosts have a social presence but no documents.
--
-- Idempotent — safe to re-run.

begin;

alter table merchant_profiles
  add column if not exists social_handle text;

commit;
