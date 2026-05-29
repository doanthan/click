-- Stripe-synced admin transactions ledger.
--
-- Today `payment_transactions` only stores the bare minimum needed to bridge a
-- Checkout Session through the webhook (PI id, amount, status). Stripe is the
-- source of truth for everything else: the captured charge, our platform's
-- application fee + destination transfer split (once destination charges are
-- wired), refunds, payouts, and Connect capability state.
--
-- This migration:
--   * Extends payment_transactions with charge/fee/transfer/refunded mirror
--     columns + a last_synced_at marker. They stay null until either the
--     "Sync from Stripe" admin button or the extended webhook fills them.
--   * Adds 'partially_refunded' to the payment_status enum (paid → partially
--     → refunded). 'failed' and 'pending' unchanged.
--   * payment_refunds: one row per Stripe refund, attributable to the admin
--     who issued it (null if backfilled from webhook).
--   * merchant_payouts: one row per Stripe payout on a connected account.
--     Keyed by (connect_account_id, payout_id) since payout ids are unique
--     within an account but not across the platform.
--
-- Connect capability mirror columns (charges_enabled / payouts_enabled /
-- details_submitted) already exist on merchant_profiles from migration 013
-- and are written by the existing `account.updated` webhook handler.
--
-- No audit table: we reuse the shared `audit_logs` table from 001_schema.sql
-- (entity_table = 'payment_transactions' or 'payment_refunds').

begin;

-- 1. Extend payment_transactions ----------------------------------------------

alter table payment_transactions
  add column if not exists stripe_charge_id text,
  add column if not exists application_fee_cents integer,
  add column if not exists transfer_amount_cents integer,
  add column if not exists stripe_transfer_id text,
  add column if not exists refunded_amount_cents integer not null default 0,
  add column if not exists last_synced_at timestamptz;

-- Use a uniqueness constraint that allows backfilling rows that don't yet have
-- a charge id without conflicting. Partial unique index on non-null only.
create unique index if not exists payment_transactions_stripe_charge_id_uq
  on payment_transactions (stripe_charge_id)
  where stripe_charge_id is not null;

-- charge id lookup from charge.refunded / charge.dispute.* webhook payloads.
create index if not exists payment_transactions_stripe_charge_id_idx
  on payment_transactions (stripe_charge_id)
  where stripe_charge_id is not null;

alter table payment_transactions
  add constraint payment_transactions_refunded_amount_nonneg
  check (refunded_amount_cents >= 0);

alter table payment_transactions
  add constraint payment_transactions_refunded_le_amount
  check (refunded_amount_cents <= amount_cents);

-- 2. payment_status enum: add 'partially_refunded' ---------------------------
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block on older
-- Postgres, but Supabase runs PG15+ which supports it from within a tx.

alter type payment_status add value if not exists 'partially_refunded' after 'paid';

-- 3. payment_refunds ----------------------------------------------------------

create table if not exists payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid not null references payment_transactions(id) on delete cascade,
  stripe_refund_id text unique not null,
  amount_cents integer not null check (amount_cents > 0),
  currency char(3) not null,
  status text not null check (status in ('pending', 'succeeded', 'failed', 'canceled')),
  reason text,
  failure_reason text,
  initiated_by_profile_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_refunds_payment_transaction_id_idx
  on payment_refunds (payment_transaction_id);

create index if not exists payment_refunds_created_at_idx
  on payment_refunds (created_at desc);

create trigger set_payment_refunds_updated_at
  before update on payment_refunds
  for each row execute function set_updated_at();

-- 4. merchant_payouts ---------------------------------------------------------

create table if not exists merchant_payouts (
  id uuid primary key default gen_random_uuid(),
  merchant_profile_id uuid not null references merchant_profiles(id) on delete cascade,
  stripe_connect_account_id text not null,
  stripe_payout_id text not null,
  amount_cents integer not null,
  currency char(3) not null,
  status text not null check (status in ('pending', 'in_transit', 'paid', 'failed', 'canceled')),
  arrival_date timestamptz,
  bank_last4 text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stripe_connect_account_id, stripe_payout_id)
);

create index if not exists merchant_payouts_merchant_profile_id_idx
  on merchant_payouts (merchant_profile_id);

create index if not exists merchant_payouts_created_at_idx
  on merchant_payouts (created_at desc);

create trigger set_merchant_payouts_updated_at
  before update on merchant_payouts
  for each row execute function set_updated_at();

-- 5. RLS ----------------------------------------------------------------------
-- Service-role writes from the server bypass RLS, but enabling it matches the
-- convention set by 001_schema.sql so anon/authenticated cannot read directly.

alter table payment_refunds enable row level security;
alter table merchant_payouts enable row level security;

commit;
