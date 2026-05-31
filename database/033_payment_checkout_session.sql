-- 033_payment_checkout_session.sql
--
-- Persist the Stripe Checkout Session id on payment_transactions.
--
-- WHY
--   stripe.checkout.sessions.create() returns payment_intent = null at creation
--   time (Stripe creates the PaymentIntent lazily, on payment). So the old
--   attachPaymentIntent() call in the checkout route was effectively a no-op and
--   rows were stored with no Stripe handle at all (no PI, no charge). When the
--   `checkout.session.completed` webhook missed AND fulfill-on-return didn't
--   fire, those rows were orphaned 'pending' forever with no recovery path —
--   the admin "Sync from Stripe" backfill matches on stripe_payment_intent_id,
--   which was null.
--
--   The Checkout Session id IS available at creation, so we store it here. It
--   gives every transaction a durable Stripe handle independent of the PI, which
--   lets reconcilePendingTransactions() retrieve the session per-row and flip
--   the ledger to paid/failed even when the webhook never arrived.

alter table payment_transactions
  add column if not exists stripe_checkout_session_id text;

create index if not exists payment_transactions_checkout_session_idx
  on payment_transactions (stripe_checkout_session_id);
