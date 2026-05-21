import { NextResponse } from "next/server";
import {
  markPaymentFailed,
  markPaymentSucceeded,
} from "@/lib/event-repository";
import {
  getStripeClient,
  getStripeWebhookSecret,
} from "@/lib/stripe";

export const runtime = "nodejs";

function paymentIdFromMetadata(metadata: Record<string, string> | null | undefined) {
  return metadata?.payment_transaction_id ?? null;
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
        if (id) await markPaymentSucceeded(id);
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
      default:
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "webhook handler failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
