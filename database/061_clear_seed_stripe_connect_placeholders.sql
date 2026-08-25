begin;

-- Applied seed migrations are immutable, but older QA databases may already
-- contain the acct_seed_* placeholders that 002_seed.sql historically wrote.
-- They are not Stripe account IDs: leaving one in place makes Connect
-- onboarding call accountLinks.create for a resource that does not exist.
-- Clearing only the QA namespace lets the onboarding route mint and persist a
-- real account on first use without touching any real merchant.
update merchant_profiles merchant
set stripe_connect_account_id = null,
    updated_at = now()
from profiles profile
where profile.id = merchant.profile_id
  and profile.email::text like '%@click.local'
  and merchant.stripe_connect_account_id like 'acct_seed_%';

commit;
