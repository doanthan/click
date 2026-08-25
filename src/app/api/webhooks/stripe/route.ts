import type Stripe from "stripe";
import { NextResponse } from "next/server";
import {
  attachPaymentIntent,
  markPaymentFailed,
  markPaymentSucceeded,
  processGuestSpotsForSession,
  settleRefundedBooking,
  updateMerchantConnectStatus,
} from "@/lib/event-repository";
import { getConnectedAccountStatus } from "@/lib/stripe-connect";
import {
  getStripeClient,
  getStripeWebhookSecret,
  getStripeWebhookSecretV2,
} from "@/lib/stripe";
import {
  recordDisputeAudit,
  syncTransactionFromStripe,
  upsertPayoutFromEvent,
} from "@/lib/stripe-sync";

export const runtime = "nodejs";

function paymentIdFromMetadata(metadata: Record<string, string> | null | undefined) {
  return metadata?.payment_transaction_id ?? null;
}

// session.payment_intent is a bare id, an expanded object, or null depending on
// how the session was created and whether the buyer has paid yet.
function stripePaymentIntentId(
  paymentIntent: string | Stripe.PaymentIntent | null | undefined,
) {
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

// Thin notifications from a v2 event destination are `"object": "v2.core.event"`;
// snapshot webhooks are `"object": "event"`. Parsed defensively — an unparseable
// body falls through to constructEvent, which rejects it with a signature error.
function isThinEventNotification(rawBody: string) {
  try {
    return (JSON.parse(rawBody) as { object?: string }).object === "v2.core.event";
  } catch {
    return false;
  }
}

// Event types that mean "this merchant's ability to take money or get paid may
// have changed". The two prefixes are deliberately anchored on the trailing dot
// and bracket: a bare v2.core.account prefix also swallows
// v2.core.account_person.* and v2.core.account_link.returned, whose related
// object is a person/link id, not an acct_. Feeding one of those to
// accounts.retrieve 404s, and a throw here becomes a 500 that Stripe retries.
function isConnectAccountEventType(type: string) {
  return (
    type === "account.updated" ||
    type.startsWith("v2.core.account.") ||
    type.startsWith("v2.core.account[")
  );
}

// Re-fetch the authoritative status from Stripe rather than trusting whatever
// the payload carried — thin notifications carry no object at all, and the
// snapshot shape varies by event.
async function syncConnectAccount(accountId: string) {
  const status = await getConnectedAccountStatus(accountId);
  await updateMerchantConnectStatus(accountId, status);
}

// Pulls the connected account id out of a Connect account event. v1 Connect
// events carry it on `event.account`; otherwise fall back to the object id.
function connectedAccountIdFromEvent(event: Stripe.Event): string | null {
  const connectAccount = (event as { account?: string }).account;
  if (typeof connectAccount === "string") return connectAccount;
  const obj = event.data?.object as { id?: string; object?: string } | undefined;
  if (obj && (obj.object === "account" || obj.object === "v2.core.account")) {
    return typeof obj.id === "string" ? obj.id : null;
  }
  return null;
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const secret = getStripeWebhookSecret();
  if (!stripe || !secret) {
    return NextResponse.json(
      { error: "Stripe webhooks not configured." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const rawBody = await request.text();

  // v2 event destinations post a "thin" notification: no `data.object`, just a
  // related_object pointer. constructEvent throws on these by design, and the
  // v2 destination signs with its own secret, so branch before verifying.
  if (isThinEventNotification(rawBody)) {
    const secretV2 = getStripeWebhookSecretV2();
    if (!secretV2) {
      return NextResponse.json(
        { error: "STRIPE_WEBHOOK_SECRET_V2 is not configured." },
        { status: 503 },
      );
    }

    let notification;
    try {
      notification = stripe.parseEventNotification(rawBody, signature, secretV2);
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid signature";
      return NextResponse.json(
        { error: `Signature verification failed: ${message}` },
        { status: 400 },
      );
    }

    try {
      // Not every notification in the union carries related_object (billing
      // meter ones don't), so read it structurally rather than narrowing.
      const related = (notification as { related_object?: { id?: string } | null })
        .related_object;
      const accountId = isConnectAccountEventType(notification.type)
        ? related?.id ?? null
        : null;
      if (accountId) await syncConnectAccount(accountId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "webhook handler failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid signature";
    return NextResponse.json({ error: `Signature verification failed: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (
          event.type === "checkout.session.completed" &&
          session.payment_status !== "paid"
        ) {
          break;
        }
        const id = paymentIdFromMetadata(session.metadata);
        if (id) {
          // Capture the PaymentIntent FIRST, before anything that can throw.
          // Stripe creates the PI lazily, so it is normally null when the
          // Checkout Session is created and this webhook is the first place it
          // exists. Without it stripe_payment_intent_id stays null forever -
          // and that column is the only key syncTransactionFromStripe matches
          // on, so stripe_charge_id can never backfill and issueRefund
          // dead-ends with "no captured charge to refund yet". A buyer who
          // closed the tab after paying was unrefundable by any code path,
          // including the admin console's "Sync from Stripe".
          await attachPaymentIntent(id, stripePaymentIntentId(session.payment_intent));
          const confirmed = await markPaymentSucceeded(id);
          // Name the reserved guest seats from session metadata (spec 19 §5).
          // A replayed paid Checkout Session may belong to a booking that was
          // already cancelled/refunded; in that case its guests stay cancelled.
          if (confirmed) {
            await processGuestSpotsForSession({
              paymentTransactionId: id,
              guestDetailsJson: session.metadata?.guest_details,
            });
          }
        }
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object;
        const id = paymentIdFromMetadata(session.metadata);
        // Pass the Session id: the checkout route can retire a Session and build
        // a replacement against the same transaction, and this event then names
        // a Session the buyer has already moved off. markPaymentFailed ignores it
        // unless it is still the transaction's current Session.
        if (id) await markPaymentFailed(id, session.id);
        break;
      }
      case "payment_intent.canceled": {
        // Terminal - this PaymentIntent will never be paid, so failing the
        // transaction unconditionally is correct.
        const intent = event.data.object;
        const id = paymentIdFromMetadata(intent.metadata);
        if (id) await markPaymentFailed(id);
        break;
      }
      case "payment_intent.payment_failed": {
        // Deliberately NOT handled, and it must stay that way.
        //
        // Stripe fires this on every declined card while the Checkout Session
        // stays OPEN for the buyer to retry, and a PaymentIntent carries no
        // Session id to hand markPaymentFailed - so this cancelled the
        // pending_payment seat mid-retry. The retry then succeeded against a
        // booking with no seat left, markPaymentSucceeded took the
        // newSettlementHasNoSeat branch, and the buyer was charged, force-
        // refunded, and shown "Booking unavailable". One declined card was
        // enough.
        //
        // Real abandonment is already covered twice over: checkout.session
        // .expired fails the transaction (guarded by Session id), and the
        // hold-expiry cron releases the seat once the hold lapses.
        break;
      }
      case "charge.refunded": {
        // Both partial and full refunds fire this event. We pull the latest
        // PI snapshot (refunds list + amount_refunded) and let the sync helper
        // decide the new payment_transactions.status.
        const charge = event.data.object;
        const pi =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id ?? null;
        if (pi) {
          const synced = await syncTransactionFromStripe(pi);
          // The sync only enriches the LEDGER. A refund taken in the Stripe
          // dashboard - the natural move on a support ticket, and the only
          // route while /admin/transactions is unreachable - reaches us
          // nowhere else, so the money went back while the attendee kept a
          // confirmed seat on the merchant's roster, held capacity against
          // the waitlist, stayed on the reminder list, and was told nothing.
          //
          // Full refunds only, matching issueRefund: a partial refund is a
          // policy tier or a goodwill adjustment and they are still going.
          //
          // Safe on every other refund path even though they all fire this
          // event too. settleRefundedBooking cancels the seat only when it is
          // still live, promotes the queue only when THIS call freed it, and
          // `notify: "if-released"` puts the email under the same test - so
          // the admin console, an attendee cancellation, a bulk event cancel
          // and the settled-after-cancellation branch each stay single-send.
          if (synced.status === "refunded" && synced.paymentTransactionId) {
            await settleRefundedBooking({
              paymentTransactionId: synced.paymentTransactionId,
              refundedAmountCents: synced.refundedAmountCents,
              releaseSeat: true,
              notify: "if-released",
            });
          }
        }
        break;
      }
      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed": {
        // No first-class disputes table yet — log to audit_logs so
        // /admin/audit surfaces it. Disputes table is a follow-up.
        await recordDisputeAudit(event.data.object, event.type);
        break;
      }
      case "payout.created":
      case "payout.updated":
      case "payout.paid":
      case "payout.failed":
      case "payout.canceled": {
        // Payouts always come from a connected account context.
        const accountId =
          typeof event.account === "string" ? event.account : null;
        await upsertPayoutFromEvent(event.data.object, accountId);
        break;
      }
      default: {
        // Connect: a merchant's connected account changed (capabilities,
        // requirements, bank details). Re-fetch the authoritative status and
        // cache it. Best-effort — /merchant/onboarding also syncs on return.
        if (isConnectAccountEventType(event.type)) {
          const accountId = connectedAccountIdFromEvent(event);
          if (accountId) await syncConnectAccount(accountId);
        }
        break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "webhook handler failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
