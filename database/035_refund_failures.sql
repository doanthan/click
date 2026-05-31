-- 035_refund_failures.sql
--
-- Admin queue for refunds that failed to initiate during a cancellation.
--
-- WHY
--   When a user (or a merchant cancelling a whole event) cancels a paid booking,
--   we call Stripe to issue the policy refund. If that Stripe call throws (card
--   closed, network blip, API error), the cancellation itself still proceeds —
--   the attendee row is already cancelled and we must NOT roll that back. The
--   failed refund is logged here instead, surfaced in the admin portal, and
--   resolved manually (retry or discretionary refund).
--
--   See cancelRegistration / cancelMerchantEvent (src/lib/event-repository.ts)
--   for the trigger sites and 04_BOOKING doc §5 ("What if a refund fails").

create table if not exists refund_failures (
  id uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid references payment_transactions(id) on delete set null,
  event_id uuid references events(id) on delete set null,
  profile_id uuid references profiles(id) on delete set null,
  -- The refund amount we attempted (cents), so an admin knows what's owed.
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null default 'AUD',
  -- Stripe / app error message captured at failure time.
  error_message text,
  -- 'pending' until an admin retries or issues a discretionary refund.
  resolution text not null default 'pending',
  resolved_by_profile_id uuid references profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists refund_failures_resolution_idx
  on refund_failures (resolution, created_at desc);

create index if not exists refund_failures_profile_idx
  on refund_failures (profile_id);
