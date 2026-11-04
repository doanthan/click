begin;

-- 078_merchant_payout_readiness.sql
--
-- The merchant + Stripe audit (context/MERCHANT_STRIPE_AUDIT_FOR_CINDY.md,
-- 2026-11-03) fixes that need a column. Additive only - nothing is rewritten or
-- dropped except an index this file replaces with a stricter one.
--
-- 1. events.review_approved_at (decision D4). An admin can approve a host's
--    paid event before the host has finished Stripe. The event stays 'pending'
--    with this set, and goes live by itself the moment payouts are ready
--    (publishEventsHeldForPayouts). It used to be refused until Stripe was on,
--    and nobody was told when it came on.
--
-- 2. merchant_profiles.payouts_held_at (fix 3b). Hosts are paid after their
--    event, so every connected account must be on manual payouts. Setting that
--    was best effort, and an account that missed it kept Stripe's automatic
--    schedule - ticket money could reach the bank before the event ran. Set
--    when Stripe confirms the manual schedule; a paid event cannot publish
--    while it is null.
--
-- 3. merchant_profiles.stripe_requirements / stripe_requirements_due_at
--    (fix 4). What Stripe still wants, and by when, so the payouts page can
--    say "Stripe needs your ID by 12 Dec" instead of "you're ready". Each
--    entry is { description, awaiting: 'user' | 'stripe', status, errors[] },
--    written by updateMerchantConnectStatus from the account read.
--
-- 4. One Stripe account per host (fix 3). A double tap on "Connect payouts"
--    could create two accounts, and the last write won. The connect route now
--    locks the row and sends an idempotency key; this makes a second host
--    sharing one account impossible too. Refuses to build if production
--    already has a duplicate, naming it, rather than failing with a bare
--    unique violation.
--
-- 5. merchant_payouts.sent_notified_at / failed_notified_at (fix 26). The
--    "earnings sent" and "payout failed" emails fire once per payout, however
--    many payout.* webhooks Stripe sends for it.
--
-- 6. payment_disputes.reserve_released_at (Codex review of the fix pass). A
--    dispute Click LOSES has already come out of Click's balance - Stripe
--    debits the platform for destination-charge disputes - and the host's
--    balance is where it gets recovered from. So the disputed amount stays
--    held from the host's payouts while a dispute is open AND after it is
--    lost, until an admin releases it from /admin/transactions (having
--    reversed the transfer, or decided Click absorbs it).
--
-- 7. stripe_connect_attempts (fix 3, Codex review). The account create is
--    keyed per attempt, and the attempt's details are saved BEFORE Stripe is
--    called, outside the row-lock transaction. If Stripe creates the account
--    and the save then fails, the retry sends the same details under the same
--    key and gets the same account back, however the host's details changed
--    in between. No foreign key on purpose: the insert runs while the
--    merchant row is locked FOR UPDATE, and a foreign key's KEY SHARE lock on
--    that row would wait on it.
--
-- 8. Payouts already on file count as notified, so the first sync after this
--    ships does not email hosts about payouts from weeks ago.
--
-- Idempotent - safe to re-run.

alter table events
  add column if not exists review_approved_at timestamptz;

alter table merchant_profiles
  add column if not exists payouts_held_at timestamptz,
  add column if not exists stripe_requirements jsonb not null default '[]'::jsonb,
  add column if not exists stripe_requirements_due_at timestamptz;

do $$
declare
  duplicate text;
begin
  select stripe_connect_account_id into duplicate
  from merchant_profiles
  where stripe_connect_account_id is not null
  group by stripe_connect_account_id
  having count(*) > 1
  limit 1;
  if duplicate is not null then
    raise exception 'Two merchant_profiles rows share Stripe account %. Decide which host keeps it, clear the other, then re-run 078.', duplicate;
  end if;
end
$$;

create unique index if not exists merchant_profiles_stripe_connect_account_id_key
  on merchant_profiles (stripe_connect_account_id)
  where stripe_connect_account_id is not null;

-- Superseded by the unique index above, which serves the same lookups.
drop index if exists merchant_profiles_stripe_connect_account_id_idx;

alter table merchant_payouts
  add column if not exists sent_notified_at timestamptz,
  add column if not exists failed_notified_at timestamptz;

update merchant_payouts
set sent_notified_at = coalesce(sent_notified_at, created_at)
where status in ('pending', 'in_transit', 'paid') and sent_notified_at is null;

update merchant_payouts
set failed_notified_at = coalesce(failed_notified_at, updated_at)
where status = 'failed' and failed_notified_at is null;

alter table payment_disputes
  add column if not exists reserve_released_at timestamptz;

create table if not exists stripe_connect_attempts (
  merchant_profile_id uuid primary key,
  attempt_id uuid not null default gen_random_uuid(),
  details jsonb not null,
  created_at timestamptz not null default now()
);

alter table stripe_connect_attempts enable row level security;

commit;
