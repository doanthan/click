begin;

-- 079_payment_booking_fee.sql
--
-- payment_transactions.booking_fee_cents: the buyer booking fee inside a
-- charge, across all its seats (audit fixes 23 and 24).
--
-- application_fee_cents holds Click's commission PLUS the booking fee, and
-- amount_cents holds the ticket price PLUS the booking fee, so Finances could
-- not separate the host's ticket sales from a fee the host never receives:
-- its headline "Collected" included the booking fee, and every row showed the
-- buyer's gross ($10.29) against a $10 ticket. createPaymentHold now writes the
-- fee here at hold time, from the same snapshot it charges.
--
-- Backfill for existing charges: the ticket price is fixed once anyone has
-- booked (updateMerchantEventDetails' termsEditable), and every seat on a
-- booking has its own guest_spots row (cancelled ones included), so
--   booking fee = amount - price x (1 + guest seats),
-- clamped to what the application fee can hold. Platform-owned events (no
-- application fee) get 0.
--
-- Idempotent - safe to re-run; the backfill only touches rows still null.

alter table payment_transactions
  add column if not exists booking_fee_cents integer
    check (booking_fee_cents is null or booking_fee_cents >= 0);

update payment_transactions pt
set booking_fee_cents = case
      when pt.application_fee_cents is null then 0
      else least(
        pt.application_fee_cents,
        greatest(
          0,
          pt.amount_cents - e.price_cents * (
            1 + (select count(*) from guest_spots gs where gs.payment_transaction_id = pt.id)
          )
        )
      )
    end
from events e
where e.id = pt.event_id
  and pt.booking_fee_cents is null;

commit;
