import type Stripe from "stripe";
import { NextResponse } from "next/server";
import {
  markPaymentFailed,
  markPaymentSucceeded,
  processGuestSpotsForSession,
  updateMerchantConnectStatus,
} from "@/lib/event-repository";
import { getConnectedAccountStatus } from "@/lib/stripe-connect";
import {
  getStripeClient,
  getStripeWebhookSecret,
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
        const id = paymentIdFromMetadata(session.metadata);
        if (id) {
          await markPaymentSucceeded(id);
          // Name the reserved guest seats from session metadata (spec 19 §5).
          await processGuestSpotsForSession({
            paymentTransactionId: id,
            guestDetailsJson: session.metadata?.guest_details,
          });
        }
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object;
        const id = paymentIdFromMetadata(session.metadata);
        if (id) await markPaymentFailed(id);
        break;
      }
      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        const intent = event.data.object;
        const id = paymentIdFromMetadata(intent.metadata);
        if (id) await markPaymentFailed(id);
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
        if (pi) await syncTransactionFromStripe(pi);
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
        if (event.type === "account.updated" || event.type.startsWith("v2.core.account")) {
          const accountId = connectedAccountIdFromEvent(event);
          if (accountId) {
            const status = await getConnectedAccountStatus(accountId);
            await updateMerchantConnectStatus(accountId, status);
          }
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
