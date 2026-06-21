// Stripe → Postgres synchronisation for the admin transactions ledger.
//
// Three modes feed `payment_transactions`, `payment_refunds` and
// `merchant_payouts`:
//   1. The "Sync from Stripe" admin button (this file's `sync*` exports) does
//      bounded backfills against the Stripe REST API — used to recover from
//      missed webhook deliveries and to populate enrichment columns when the
//      feature ships against existing data.
//   2. The extended `/api/webhooks/stripe` handler calls
//      `syncTransactionFromStripe(paymentIntentId)` whenever `charge.refunded`
//      fires (and `upsertPayoutFromEvent` for `payout.*`).
//   3. `issueRefund(...)` is the admin-initiated refund action — it calls
//      Stripe and then mirrors the response into the local tables in one txn,
//      writing an `audit_logs` row attributable to the admin.
//
// All upserts are idempotent. We never insert a refund/payout twice on the
// same Stripe id; `last_synced_at` is bumped on every touch.
//
// We use the v1 REST surface (`stripe.charges.list`, `stripe.payouts.list`,
// `stripe.refunds.*`). Connect account capability state already lives in
// `src/lib/stripe-connect.ts` (`getConnectedAccountStatus`) — `syncConnectAll`
// just calls it for every merchant we know about.

import type Stripe from "stripe";
import { getStripeClient } from "./stripe";
import { getPostgresPool } from "./postgres";
import {
  getConnectedAccountStatus,
  type ConnectAccountStatus,
} from "./stripe-connect";
import {
  attachPaymentIntent,
  ensureProfileForSession,
  getMerchantProfile,
  markPaymentFailed,
  markPaymentSucceeded,
  processGuestSpotsForSession,
  updateMerchantConnectStatus,
} from "./event-repository";
import { writeAuditLog } from "@/utils/admin/audit-logger";
import type { Session } from "next-auth";

type RefundReason = "duplicate" | "fraudulent" | "requested_by_customer";

function stripeNotConfigured(): never {
  const error = new Error("Stripe is not configured (missing STRIPE_SECRET_KEY).");
  error.name = "ValidationError";
  throw error;
}

function databaseUnavailable(): never {
  const error = new Error("Postgres is not configured or unavailable for this action.");
  error.name = "DatabaseUnavailableError";
  throw error;
}

function notFound(message: string): never {
  const error = new Error(message);
  error.name = "NotFoundError";
  throw error;
}

function invalid(message: string): never {
  const error = new Error(message);
  error.name = "ValidationError";
  throw error;
}

// ---------------------------------------------------------------------------
// Single-PI sync (used by webhook + admin detail refresh)
// ---------------------------------------------------------------------------

// Reduces a list of Stripe refunds for a single charge to our DB shape. Status
// + refunded total are recomputed from the live Stripe data so a partial →
// full refund correctly flips `payment_transactions.status`.
function summariseRefunds(refunds: Stripe.Refund[]) {
  const totalRefundedCents = refunds
    .filter((r) => r.status === "succeeded")
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);
  return { totalRefundedCents, refunds };
}

function chargeFromPi(pi: Stripe.PaymentIntent): Stripe.Charge | null {
  const latest = pi.latest_charge;
  if (!latest) return null;
  return typeof latest === "string" ? null : (latest as Stripe.Charge);
}

function refundsFromCharge(charge: Stripe.Charge): Stripe.Refund[] {
  const refunds = charge.refunds;
  if (!refunds || typeof refunds === "string") return [];
  return refunds.data ?? [];
}

function transferFromCharge(charge: Stripe.Charge): Stripe.Transfer | null {
  const transfer = charge.transfer;
  if (!transfer) return null;
  return typeof transfer === "string" ? null : (transfer as Stripe.Transfer);
}

// Pulls a single Stripe PI (charge + refunds + transfer) and mirrors it into
// our tables. Idempotent — safe to invoke from a webhook retry.
export async function syncTransactionFromStripe(
  paymentIntentId: string,
): Promise<{ updated: boolean; refundsUpserted: number }> {
  const stripe = getStripeClient();
  if (!stripe) stripeNotConfigured();
  const pool = getPostgresPool();
  if (!pool) databaseUnavailable();

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge", "latest_charge.refunds", "latest_charge.transfer"],
  });

  const charge = chargeFromPi(pi);
  if (!charge) {
    // No charge attached yet (still pending / cancelled before capture).
    return { updated: false, refundsUpserted: 0 };
  }

  const refunds = refundsFromCharge(charge);
  const { totalRefundedCents } = summariseRefunds(refunds);
  const transfer = transferFromCharge(charge);

  // Derive the new `payment_status`. `charge.refunded` true means the full
  // amount has been refunded; otherwise we use the summed refund total.
  const amountCaptured = charge.amount_captured ?? charge.amount ?? 0;
  let derivedStatus: "paid" | "partially_refunded" | "refunded" | null = null;
  if (charge.refunded || (amountCaptured > 0 && totalRefundedCents >= amountCaptured)) {
    derivedStatus = "refunded";
  } else if (totalRefundedCents > 0) {
    derivedStatus = "partially_refunded";
  } else if (charge.status === "succeeded") {
    derivedStatus = "paid";
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    // Upsert enrichment + status onto payment_transactions. Match on PI id (the
    // existing FK we have to Stripe). Status only flips forward on success.
    const updated = await client.query(
      `
        update payment_transactions
        set stripe_charge_id = $2,
            application_fee_cents = $3,
            transfer_amount_cents = $4,
            stripe_transfer_id = $5,
            refunded_amount_cents = $6,
            status = coalesce($7::payment_status, status),
            last_synced_at = now(),
            updated_at = now()
        where stripe_payment_intent_id = $1
        returning id::text
      `,
      [
        paymentIntentId,
        charge.id,
        charge.application_fee_amount ?? null,
        transfer?.amount ?? null,
        transfer?.id ?? null,
        totalRefundedCents,
        derivedStatus,
      ],
    );

    const txnId = updated.rows[0]?.id ?? null;
    if (!txnId) {
      // No local row — likely a Stripe-side test charge we don't track. Roll
      // back so the partial commit doesn't leave inconsistent refunds rows.
      await client.query("rollback");
      return { updated: false, refundsUpserted: 0 };
    }

    let refundsUpserted = 0;
    for (const refund of refunds) {
      await client.query(
        `
          insert into payment_refunds (
            payment_transaction_id,
            stripe_refund_id,
            amount_cents,
            currency,
            status,
            reason,
            failure_reason
          ) values ($1::uuid, $2, $3, $4, $5, $6, $7)
          on conflict (stripe_refund_id) do update
          set status = excluded.status,
              amount_cents = excluded.amount_cents,
              failure_reason = excluded.failure_reason,
              updated_at = now()
        `,
        [
          txnId,
          refund.id,
          refund.amount ?? 0,
          (refund.currency ?? "aud").toUpperCase(),
          refund.status ?? "pending",
          refund.reason ?? null,
          refund.failure_reason ?? null,
        ],
      );
      refundsUpserted += 1;
    }

    await client.query("commit");

    // If this charge is a clean success, make sure the seat is promoted too.
    // syncTransactionFromStripe only enriches the ledger row; on its own it
    // would leave a buyer's `event_attendees` stuck on 'pending_payment' when
    // the original `checkout.session.completed` webhook was missed (the case
    // the admin "Sync from Stripe" button exists to recover). markPaymentSucceeded
    // is idempotent — it no-ops the email/notification when nothing actually
    // flipped — so calling it for every already-confirmed paid charge is safe.
    if (derivedStatus === "paid") {
      try {
        await markPaymentSucceeded(txnId);
      } catch (error) {
        if (process.env.CLICK_DB_DEBUG === "true") {
          console.warn(`seat promotion failed for txn ${txnId}`, error);
        }
      }
    }

    return { updated: true, refundsUpserted };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Fulfill-on-return reconciliation (used by the checkout success landing)
// ---------------------------------------------------------------------------

// The Stripe webhook (`checkout.session.completed`) is the primary path that
// flips `payment_transactions` → 'paid' and the attendee row → 'confirmed'. But
// in any environment where the webhook isn't delivered — local dev without
// `stripe listen`, a delayed delivery, or a missed event — the buyer lands back
// on the app with their seat still 'pending_payment': the event keeps prompting
// for payment, the seat count stays 0, and it never reaches the dashboard or
// calendar. The checkout `success_url` carries the Checkout Session id, so here
// we retrieve the session and, if Stripe reports it paid, run the SAME
// `markPaymentSucceeded` the webhook would have. Idempotent — that function
// no-ops once the txn is already 'paid', so a later webhook delivery (or a page
// refresh) is harmless.
export async function reconcileCheckoutSession(
  sessionId: string,
): Promise<{ confirmed: boolean }> {
  const stripe = getStripeClient();
  if (!stripe) return { confirmed: false };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    // Unknown / foreign session id in the query string — ignore quietly.
    return { confirmed: false };
  }

  if (session.payment_status !== "paid") return { confirmed: false };

  const paymentTransactionId = session.metadata?.payment_transaction_id ?? null;
  if (!paymentTransactionId) return { confirmed: false };

  // Backfill the PaymentIntent (null at session creation) so the PI-keyed
  // refund/admin sync paths can find this row later. No-op if already set.
  if (typeof session.payment_intent === "string") {
    await attachPaymentIntent(paymentTransactionId, session.payment_intent);
  }
  await markPaymentSucceeded(paymentTransactionId);
  // Name any reserved guest seats from session metadata — covers the case where
  // the webhook was missed and the buyer's return / cron reconcile confirms.
  await processGuestSpotsForSession({
    paymentTransactionId,
    guestDetailsJson:
      typeof session.metadata?.guest_details === "string"
        ? session.metadata.guest_details
        : null,
  });
  return { confirmed: true };
}

// Per-merchant self-heal used by the Finances tab. The webhook
// (`checkout.session.completed`) is the primary path that flips a transaction to
// 'paid'/'failed'; this is the backstop for when it never arrives. Rather than
// scan every recent Stripe session (what reconcilePendingPayments does for the
// admin button), it retrieves only THIS merchant's pending rows by the
// `stripe_checkout_session_id` we now stamp at checkout — a handful of cheap
// per-row retrieves — and flips each to paid (session paid) or failed (session
// expired). markPaymentSucceeded / markPaymentFailed are idempotent, so this is
// safe to run on every page load and races harmlessly with the webhook.
export async function reconcilePendingTransactionsForMerchant(
  session: Session | null,
  { limit = 25 }: { limit?: number } = {},
): Promise<{ checked: number; paid: number; failed: number }> {
  const stripe = getStripeClient();
  const pool = getPostgresPool();
  if (!stripe || !pool || !session) return { checked: 0, paid: 0, failed: 0 };

  let merchantId: string;
  try {
    const profile = await ensureProfileForSession(session);
    const merchant = await getMerchantProfile(pool, profile.id);
    if (!merchant) return { checked: 0, paid: 0, failed: 0 };
    merchantId = merchant.id;
  } catch {
    return { checked: 0, paid: 0, failed: 0 };
  }

  const pending = await pool.query<{ id: string; session_id: string }>(
    `
      select id::text, stripe_checkout_session_id as session_id
      from payment_transactions
      where merchant_profile_id = $1::uuid
        and status = 'pending'
        and stripe_checkout_session_id is not null
      order by created_at desc
      limit $2
    `,
    [merchantId, limit],
  );

  let checked = 0;
  let paid = 0;
  let failed = 0;
  for (const row of pending.rows) {
    checked += 1;
    try {
      const s = await stripe.checkout.sessions.retrieve(row.session_id);
      if (s.payment_status === "paid") {
        if (typeof s.payment_intent === "string") {
          await attachPaymentIntent(row.id, s.payment_intent);
        }
        await markPaymentSucceeded(row.id);
        // Name reserved guest seats too (see reconcilePendingPayments / #192) —
        // this self-heal path must invite guests just like the webhook does.
        await processGuestSpotsForSession({
          paymentTransactionId: row.id,
          guestDetailsJson:
            typeof s.metadata?.guest_details === "string"
              ? s.metadata.guest_details
              : null,
        });
        paid += 1;
      } else if (s.status === "expired") {
        await markPaymentFailed(row.id);
        failed += 1;
      }
    } catch (error) {
      if (process.env.CLICK_DB_DEBUG === "true") {
        console.warn(`reconcile failed for txn ${row.id}`, error);
      }
    }
  }

  return { checked, paid, failed };
}

// Server-side backstop sweep for paid-but-stuck bookings. Where
// `reconcileCheckoutSession` depends on the buyer landing back on the success
// URL (browser-driven, fragile), this walks recent Checkout Sessions Stripe
// reports as `paid` and promotes any whose seat never confirmed — covering
// missed webhooks AND closed-tab returns. It keys off the
// `payment_transaction_id` we stamp into the session metadata in the checkout
// route, so it recovers rows that have no `stripe_payment_intent_id` yet (which
// `syncTransactionFromStripe`, being PI-keyed, cannot match). markPaymentSucceeded
// is idempotent, so already-confirmed sessions are cheap no-ops.
export async function reconcilePendingPayments(
  { sinceHours = 72 }: { sinceHours?: number } = {},
): Promise<{ sessionsScanned: number; reconciled: number }> {
  const stripe = getStripeClient();
  if (!stripe) stripeNotConfigured();
  const pool = getPostgresPool();
  if (!pool) databaseUnavailable();

  const gte = Math.floor((Date.now() - sinceHours * HOUR_MS) / 1000);
  let sessionsScanned = 0;
  let reconciled = 0;

  for await (const session of stripe.checkout.sessions.list({
    limit: 100,
    created: { gte },
  })) {
    sessionsScanned += 1;
    if (session.payment_status !== "paid") continue;
    const paymentTransactionId = session.metadata?.payment_transaction_id ?? null;
    if (!paymentTransactionId) continue;
    try {
      await markPaymentSucceeded(paymentTransactionId);
      // Name any reserved guest seats from the session metadata. The webhook and
      // success-URL return already do this; the cron backstop must too, or a
      // guest invited on a missed-webhook booking that only the cron reconciles
      // is never emailed / added to the roster, and the seats they paid for sit
      // unnamed (bug board #192).
      await processGuestSpotsForSession({
        paymentTransactionId,
        guestDetailsJson:
          typeof session.metadata?.guest_details === "string"
            ? session.metadata.guest_details
            : null,
      });
      reconciled += 1;
    } catch (error) {
      if (process.env.CLICK_DB_DEBUG === "true") {
        console.warn(`reconcile failed for txn ${paymentTransactionId}`, error);
      }
    }
  }

  return { sessionsScanned, reconciled };
}

// ---------------------------------------------------------------------------
// Bulk backfill (used by the "Sync from Stripe" button)
// ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Iterates Stripe charges since `sinceDays` ago and applies the same
// enrichment as `syncTransactionFromStripe` but using the listing payload to
// avoid one round-trip per row.
export async function syncRecentCharges(
  { sinceDays = 7 }: { sinceDays?: number } = {},
): Promise<{ chargesSeen: number; transactionsUpdated: number; refundsUpserted: number }> {
  const stripe = getStripeClient();
  if (!stripe) stripeNotConfigured();
  const pool = getPostgresPool();
  if (!pool) databaseUnavailable();

  const gte = Math.floor((Date.now() - sinceDays * DAY_MS) / 1000);
  let chargesSeen = 0;
  let transactionsUpdated = 0;
  let refundsUpserted = 0;

  // Stripe's auto-paginator does all the pagination cursor-wrangling for us.
  for await (const charge of stripe.charges.list({
    limit: 100,
    created: { gte },
    expand: ["data.refunds", "data.transfer"],
  })) {
    chargesSeen += 1;
    const pi = charge.payment_intent;
    if (!pi || typeof pi !== "string") continue;

    // Delegate to the per-PI sync. Slightly redundant (we already have the
    // charge) but keeps a single code path for status derivation + refunds.
    const result = await syncTransactionFromStripe(pi).catch(() => null);
    if (result?.updated) transactionsUpdated += 1;
    refundsUpserted += result?.refundsUpserted ?? 0;
  }

  return { chargesSeen, transactionsUpdated, refundsUpserted };
}

// ---------------------------------------------------------------------------
// Payouts (per connected account)
// ---------------------------------------------------------------------------

function payoutStatusToDb(
  status: string,
): "pending" | "in_transit" | "paid" | "failed" | "canceled" {
  switch (status) {
    case "in_transit":
      return "in_transit";
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    default:
      return "pending";
  }
}

// Upserts one Stripe payout for a known connected account. Used by both the
// bulk backfill and the `payout.*` webhook handler.
async function upsertPayout(
  payout: Stripe.Payout,
  stripeAccountId: string,
): Promise<boolean> {
  const pool = getPostgresPool();
  if (!pool) databaseUnavailable();

  const merchantRow = await pool.query<{ id: string }>(
    `
      select id::text
      from merchant_profiles
      where stripe_connect_account_id = $1
      limit 1
    `,
    [stripeAccountId],
  );
  const merchantProfileId = merchantRow.rows[0]?.id ?? null;
  if (!merchantProfileId) {
    // Stripe knows about an account we don't (deleted merchant, dev env).
    return false;
  }

  // Stripe encodes arrival_date as unix seconds. destination might be a string
  // (bank_account id) or an expanded object — only the expanded form carries
  // last4. The bulk sync doesn't expand it, so this stays null in that path.
  const arrivalDate = payout.arrival_date
    ? new Date(payout.arrival_date * 1000).toISOString()
    : null;
  const destination = payout.destination as Stripe.BankAccount | string | null;
  const bankLast4 =
    destination && typeof destination !== "string" && "last4" in destination
      ? destination.last4 ?? null
      : null;

  await pool.query(
    `
      insert into merchant_payouts (
        merchant_profile_id,
        stripe_connect_account_id,
        stripe_payout_id,
        amount_cents,
        currency,
        status,
        arrival_date,
        bank_last4,
        failure_message
      ) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
      on conflict (stripe_connect_account_id, stripe_payout_id) do update
      set status = excluded.status,
          arrival_date = coalesce(excluded.arrival_date, merchant_payouts.arrival_date),
          bank_last4 = coalesce(excluded.bank_last4, merchant_payouts.bank_last4),
          failure_message = excluded.failure_message,
          updated_at = now()
    `,
    [
      merchantProfileId,
      stripeAccountId,
      payout.id,
      payout.amount ?? 0,
      (payout.currency ?? "aud").toUpperCase(),
      payoutStatusToDb(payout.status ?? "pending"),
      arrivalDate,
      bankLast4,
      payout.failure_message ?? null,
    ],
  );
  return true;
}

export async function upsertPayoutFromEvent(
  payout: Stripe.Payout,
  stripeAccountId: string | null,
): Promise<void> {
  if (!stripeAccountId) return;
  await upsertPayout(payout, stripeAccountId);
}

// Walks every merchant with a Stripe Connect account and pulls their recent
// payouts. One Stripe call per merchant (paginated by Stripe's auto-pager).
export async function syncPayoutsForAllMerchants(
  { sinceDays = 30 }: { sinceDays?: number } = {},
): Promise<{ accountsScanned: number; payoutsUpserted: number }> {
  const stripe = getStripeClient();
  if (!stripe) stripeNotConfigured();
  const pool = getPostgresPool();
  if (!pool) databaseUnavailable();

  const merchants = await pool.query<{
    stripe_connect_account_id: string;
  }>(
    `
      select stripe_connect_account_id
      from merchant_profiles
      where stripe_connect_account_id is not null
    `,
  );

  const gte = Math.floor((Date.now() - sinceDays * DAY_MS) / 1000);
  let payoutsUpserted = 0;

  for (const row of merchants.rows) {
    const accountId = row.stripe_connect_account_id;
    try {
      for await (const payout of stripe.payouts.list(
        { limit: 100, created: { gte } },
        { stripeAccount: accountId },
      )) {
        const ok = await upsertPayout(payout, accountId);
        if (ok) payoutsUpserted += 1;
      }
    } catch (error) {
      if (process.env.CLICK_DB_DEBUG === "true") {
        console.warn(`payout sync failed for ${accountId}`, error);
      }
    }
  }

  return { accountsScanned: merchants.rows.length, payoutsUpserted };
}

// ---------------------------------------------------------------------------
// Connect account capability state
// ---------------------------------------------------------------------------

// Refreshes the cached capability booleans for every merchant we know about.
// Reuses `getConnectedAccountStatus` from stripe-connect (v2 accounts API) and
// `updateMerchantConnectStatus` from event-repository (the same writer the
// `account.updated` webhook calls), so the source of truth is consistent.
export async function syncAllConnectAccounts(): Promise<{
  accountsScanned: number;
  accountsUpdated: number;
}> {
  const stripe = getStripeClient();
  if (!stripe) stripeNotConfigured();
  const pool = getPostgresPool();
  if (!pool) databaseUnavailable();

  const merchants = await pool.query<{ stripe_connect_account_id: string }>(
    `
      select stripe_connect_account_id
      from merchant_profiles
      where stripe_connect_account_id is not null
    `,
  );

  let accountsUpdated = 0;
  for (const row of merchants.rows) {
    try {
      const status: ConnectAccountStatus = await getConnectedAccountStatus(
        row.stripe_connect_account_id,
      );
      const wrote = await updateMerchantConnectStatus(
        row.stripe_connect_account_id,
        status,
      );
      if (wrote) accountsUpdated += 1;
    } catch (error) {
      if (process.env.CLICK_DB_DEBUG === "true") {
        console.warn(
          `connect account sync failed for ${row.stripe_connect_account_id}`,
          error,
        );
      }
    }
  }

  return { accountsScanned: merchants.rows.length, accountsUpdated };
}

// ---------------------------------------------------------------------------
// Admin-issued refund
// ---------------------------------------------------------------------------

export type IssueRefundInput = {
  paymentTransactionId: string;
  amountCents?: number; // omit for full remaining
  reason?: RefundReason;
  adminProfileId: string | null;
};

export type IssueRefundResult = {
  refundId: string;
  stripeRefundId: string;
  amountCents: number;
  status: string;
  refundedAmountCents: number;
  newStatus: string;
};

export async function issueRefund(
  input: IssueRefundInput,
): Promise<IssueRefundResult> {
  const stripe = getStripeClient();
  if (!stripe) stripeNotConfigured();
  const pool = getPostgresPool();
  if (!pool) databaseUnavailable();

  // Load the txn to validate and find the charge id.
  const txnQ = await pool.query<{
    id: string;
    amount_cents: number;
    refunded_amount_cents: number;
    currency: string;
    status: string;
    stripe_charge_id: string | null;
    stripe_payment_intent_id: string | null;
    merchant_profile_id: string | null;
  }>(
    `
      select id::text,
             amount_cents,
             refunded_amount_cents,
             currency,
             status::text,
             stripe_charge_id,
             stripe_payment_intent_id,
             merchant_profile_id::text
      from payment_transactions
      where id = $1::uuid
      limit 1
    `,
    [input.paymentTransactionId],
  );
  const txn = txnQ.rows[0];
  if (!txn) notFound("Payment transaction not found.");

  if (!["paid", "partially_refunded"].includes(txn.status)) {
    invalid(`Cannot refund a transaction in status '${txn.status}'.`);
  }

  // If we somehow haven't synced the charge id yet, do a single-PI sync first
  // to discover it. Refunds need either a charge id or a payment_intent id;
  // Stripe accepts payment_intent on `refunds.create`, but we still need the
  // charge id to attribute the refund correctly in our DB.
  let chargeId = txn.stripe_charge_id;
  if (!chargeId && txn.stripe_payment_intent_id) {
    await syncTransactionFromStripe(txn.stripe_payment_intent_id).catch(() => null);
    const reread = await pool.query<{ stripe_charge_id: string | null }>(
      `select stripe_charge_id from payment_transactions where id = $1::uuid`,
      [input.paymentTransactionId],
    );
    chargeId = reread.rows[0]?.stripe_charge_id ?? null;
  }
  if (!chargeId) {
    invalid("This transaction has no captured charge to refund yet.");
  }

  const remaining = txn.amount_cents - txn.refunded_amount_cents;
  const requestedAmount = input.amountCents ?? remaining;
  if (requestedAmount <= 0) invalid("Refund amount must be positive.");
  if (requestedAmount > remaining) {
    invalid(
      `Refund amount $${(requestedAmount / 100).toFixed(2)} exceeds the remaining refundable balance $${(remaining / 100).toFixed(2)}.`,
    );
  }

  // Hit Stripe. Merchant-hosted events are destination charges (transfer_data +
  // application_fee_amount set at checkout). For those we MUST pull the refund
  // back from the parties that received the money: `reverse_transfer` reverses
  // the merchant's transfer (proportionally for partial refunds) and
  // `refund_application_fee` returns the platform's fee. Without these the
  // refund is funded entirely from the platform balance while the merchant
  // keeps their cut — the platform eats every cancellation. Platform-owned
  // events have no connected account / transfer, so the flags don't apply (and
  // `reverse_transfer` would error with no transfer to reverse).
  const isDestinationCharge = txn.merchant_profile_id != null;
  const stripeRefund = await stripe.refunds.create({
    charge: chargeId,
    amount: requestedAmount,
    reason: input.reason,
    ...(isDestinationCharge
      ? { reverse_transfer: true, refund_application_fee: true }
      : {}),
    metadata: {
      payment_transaction_id: txn.id,
      initiated_by_profile_id: input.adminProfileId ?? "",
      source: "admin_dashboard",
    },
  });

  // Mirror locally in a transaction so refunded_amount_cents stays consistent
  // with the refunds row. The DB constraint `refunded_le_amount` will throw if
  // a webhook race somehow inflated the amount above the charge total.
  const client = await pool.connect();
  let newStatus: string = txn.status;
  let refundedAmountCents = txn.refunded_amount_cents;
  let localRefundId: string;
  try {
    await client.query("begin");

    const inserted = await client.query<{ id: string }>(
      `
        insert into payment_refunds (
          payment_transaction_id,
          stripe_refund_id,
          amount_cents,
          currency,
          status,
          reason,
          initiated_by_profile_id
        ) values ($1::uuid, $2, $3, $4, $5, $6, $7::uuid)
        on conflict (stripe_refund_id) do update
        set amount_cents = excluded.amount_cents,
            status = excluded.status,
            reason = excluded.reason,
            updated_at = now()
        returning id::text
      `,
      [
        txn.id,
        stripeRefund.id,
        stripeRefund.amount ?? requestedAmount,
        (stripeRefund.currency ?? txn.currency).toUpperCase(),
        stripeRefund.status ?? "pending",
        stripeRefund.reason ?? input.reason ?? null,
        input.adminProfileId,
      ],
    );
    localRefundId = inserted.rows[0].id;

    // Recompute the cached total from succeeded refunds rather than naively
    // adding, so a retried sync doesn't double-count.
    const sum = await client.query<{ total: string }>(
      `
        select coalesce(sum(amount_cents), 0)::text as total
        from payment_refunds
        where payment_transaction_id = $1::uuid
          and status in ('succeeded', 'pending')
      `,
      [txn.id],
    );
    refundedAmountCents = Number(sum.rows[0]?.total ?? 0);

    if (refundedAmountCents >= txn.amount_cents) {
      newStatus = "refunded";
    } else if (refundedAmountCents > 0) {
      newStatus = "partially_refunded";
    }

    await client.query(
      `
        update payment_transactions
        set refunded_amount_cents = $2,
            status = $3::payment_status,
            last_synced_at = now(),
            updated_at = now()
        where id = $1::uuid
      `,
      [txn.id, refundedAmountCents, newStatus],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  // Audit log outside the txn so a logger hiccup can't roll the refund back.
  await writeAuditLog({
    actorProfileId: input.adminProfileId,
    action: "refund.issued",
    entityTable: "payment_transactions",
    entityId: txn.id,
    metadata: {
      stripe_refund_id: stripeRefund.id,
      amount_cents: requestedAmount,
      reason: input.reason ?? null,
      new_status: newStatus,
    },
  });

  return {
    refundId: localRefundId,
    stripeRefundId: stripeRefund.id,
    amountCents: stripeRefund.amount ?? requestedAmount,
    status: stripeRefund.status ?? "pending",
    refundedAmountCents,
    newStatus,
  };
}

// ---------------------------------------------------------------------------
// Dispute audit (no first-class table yet — we just log)
// ---------------------------------------------------------------------------

export async function recordDisputeAudit(
  dispute: Stripe.Dispute,
  eventType: string,
): Promise<void> {
  const pool = getPostgresPool();
  if (!pool) return;

  // Find the local payment_transactions row from the charge id.
  const charge = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  if (!charge) return;
  const row = await pool.query<{ id: string }>(
    `select id::text from payment_transactions where stripe_charge_id = $1 limit 1`,
    [charge],
  );
  const entityId = row.rows[0]?.id ?? null;

  await writeAuditLog({
    actorProfileId: null,
    action: `stripe.${eventType}`,
    entityTable: "payment_transactions",
    entityId,
    metadata: {
      dispute_id: dispute.id,
      reason: dispute.reason,
      status: dispute.status,
      amount: dispute.amount,
      charge_id: charge,
    },
  });
}
