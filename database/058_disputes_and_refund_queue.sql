begin;

-- 058_disputes_and_refund_queue.sql
--
-- Gives the admin console the two money queues it was missing.
--
-- WHY
--   1. `refund_failures` (035) has five insert sites and two auto-resolve
--      paths, an index built for the operator query, and a header promising it
--      is "surfaced in the admin portal, and resolved manually". Nothing ever
--      selected from it. An attendee whose refund failed was owed money on a
--      LIVE Stripe key with no screen showing it. Adding a resolution note and
--      pinning the vocabulary is what lets an operator clear an entry that was
--      settled outside Stripe rather than leaving it pending forever.
--
--   2. Disputes arrived as `charge.dispute.*` webhooks and were written to
--      audit_logs and nowhere else - one immutable row per webhook, no current
--      state, no evidence deadline, no way to ask "what is open right now".
--      Stripe deadlines are hard: miss `evidence_details.due_by` and the
--      dispute is lost by default. This table is the current state per
--      dispute, upserted by recordDisputeAudit in src/lib/stripe-sync.ts. The
--      audit_logs row is still written - that stays the immutable history.
--
--   Evidence is still submitted in the Stripe Dashboard; we cannot accept it
--   here. So the console's job is to know a dispute exists, show the deadline,
--   and deep-link out. That is what this table is shaped for.

-- ---------------------------------------------------------------------------
-- 1. refund_failures: a note, and a pinned resolution vocabulary.
-- ---------------------------------------------------------------------------

alter table refund_failures
  add column if not exists resolution_note text;

-- 'resolved'  - the money actually moved (a retry succeeded, or the two
--               auto-resolve paths in stripe-sync.ts observed the refund).
-- 'dismissed' - an operator settled it another way, or wrote it off. The note
--               says which. Deliberately NOT 'resolved': the auto-resolve
--               queries key on `resolution = 'pending'`, and a dismissed row
--               must never be silently reclassified as a completed refund.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'refund_failures_resolution_check'
  ) then
    alter table refund_failures
      add constraint refund_failures_resolution_check
      check (resolution in ('pending', 'resolved', 'dismissed'));
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. payment_disputes: current state, one row per Stripe dispute.
-- ---------------------------------------------------------------------------

create table if not exists payment_disputes (
  -- Stripe's own id is the natural key - the webhook can fire repeatedly for
  -- one dispute (created, updated, closed) and each must land on one row.
  stripe_dispute_id text primary key,
  payment_transaction_id uuid references payment_transactions(id) on delete set null,
  stripe_charge_id text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null default 'AUD',
  -- Stripe's dispute.reason, e.g. 'fraudulent', 'product_not_received'.
  reason text,
  -- Stripe's dispute.status. See the generated is_open below for the terminal set.
  status text not null,
  -- dispute.evidence_details.due_by. Null once the dispute is closed.
  evidence_due_by timestamptz,
  -- Derived, never written by the app, so a stale webhook cannot reopen a
  -- closed dispute by writing the wrong flag. `won` / `lost` / `warning_closed`
  -- are Stripe's terminal states; everything else still needs an operator.
  is_open boolean not null generated always as (
    status not in ('won', 'lost', 'warning_closed')
  ) stored,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The dispute object as Stripe sent it, for anything this schema does not model.
  raw jsonb not null default '{}'::jsonb
);

-- The operator query: open disputes, soonest deadline first.
create index if not exists payment_disputes_open_idx
  on payment_disputes (is_open, evidence_due_by nulls last);

create index if not exists payment_disputes_transaction_idx
  on payment_disputes (payment_transaction_id);

commit;
