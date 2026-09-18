begin;

-- 066_failed_refund_walkback.sql
--
-- Lets the ledger follow a refund that Stripe FAILED back down.
--
-- WHY
--   055 pinned 'refunded' and 'partially_refunded' as terminal on the premise
--   that "Stripe refunds are irreversible". That is true of a SUCCEEDED refund
--   and false of a pending one: a bank can reject the return, Stripe flips the
--   refund to `failed`, and `charge.amount_refunded` goes back down. The money
--   never left. Until now our row said 'refunded' forever, the attendee kept a
--   cancelled seat against a charge we were still holding, and the operator had
--   no screen that disagreed.
--
--   The new `charge.refund.updated` / `refund.failed` webhook branch
--   (src/app/api/webhooks/stripe/route.ts) re-syncs on that event, which
--   derives 'paid' again - and the 055 trigger raised, turning every delivery
--   into a 500 that Stripe retries until it disables the endpoint.
--
-- WHAT STAYS BLOCKED
--   Everything 055 was actually defending against. The escape hatch requires
--   the cached refunded total to DROP in the same statement, which only
--   happens when Stripe itself reports less refunded money than we had
--   recorded. A stale webhook replay, a success-URL replay or an application
--   regression writing 'paid' carries the old refunded amount (or no change to
--   it) and still hits the raise.

create or replace function prevent_terminal_payment_status_reopen()
returns trigger
language plpgsql
as $$
begin
  -- A failed refund is not a reopened refund. Only Stripe reporting less
  -- refunded money than we had cached can take this branch, and the sync
  -- writes status and refunded_amount_cents in one statement so both move
  -- together.
  if new.refunded_amount_cents < old.refunded_amount_cents then
    return new;
  end if;

  if old.status = 'refunded' and new.status <> 'refunded' then
    raise exception 'refunded payment transactions are terminal'
      using errcode = '23514';
  end if;

  if old.status = 'partially_refunded'
     and new.status not in ('partially_refunded', 'refunded') then
    raise exception 'partially refunded payment transactions cannot be reopened'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- 055 created this `before update of status`, so the trigger only fires when
-- the status column is in the UPDATE's SET list. That is still what we want -
-- but the guard now reads refunded_amount_cents, so it has to fire when that
-- column moves too, otherwise a sync that lowers the total without touching
-- the status skips the function entirely.
drop trigger if exists payment_transactions_terminal_status_guard
  on payment_transactions;

create trigger payment_transactions_terminal_status_guard
before update of status, refunded_amount_cents on payment_transactions
for each row
execute function prevent_terminal_payment_status_reopen();

commit;
