begin;

-- Stripe refunds are irreversible. Treat their local ledger states the same
-- way at the database boundary so a stale webhook deployment, success-URL
-- replay, or future application regression cannot reopen refunded money and
-- re-confirm its attendee in the surrounding transaction.
create or replace function prevent_terminal_payment_status_reopen()
returns trigger
language plpgsql
as $$
begin
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

drop trigger if exists payment_transactions_terminal_status_guard
  on payment_transactions;

create trigger payment_transactions_terminal_status_guard
before update of status on payment_transactions
for each row
execute function prevent_terminal_payment_status_reopen();

commit;
