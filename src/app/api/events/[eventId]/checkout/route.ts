import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  attachPaymentIntent,
  createPaymentHold,
  markPaymentFailed,
} from "@/lib/event-repository";
import { getAppUrl, getStripeClient } from "@/lib/stripe";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown checkout error." }, { status: 500 });
  }

  const code = (error as { code?: string }).code;
  if (error.name === "AggregateError" || code === "ECONNREFUSED") {
    return NextResponse.json(
      { error: "Postgres is unavailable. Start the database before paying for events." },
      { status: 503 },
    );
  }

  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error.name === "NotFoundError") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error.name === "ConflictError") {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error.name === "ValidationError") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  return NextResponse.json({ error: error.message || "Checkout failed." }, { status: 500 });
}

export async function POST(_request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured on this server." },
      { status: 503 },
    );
  }

  let hold: Awaited<ReturnType<typeof createPaymentHold>> | null = null;

  try {
    hold = await createPaymentHold(eventId, session);

    const appUrl = getAppUrl();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: hold.profileEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: hold.currency.toLowerCase(),
            unit_amount: hold.priceCents,
            product_data: {
              name: hold.eventTitle,
              description: `Click event reservation`,
            },
          },
        },
      ],
      success_url: `${appUrl}/dashboard/calendar?booked=${encodeURIComponent(hold.eventSlug)}`,
      cancel_url: `${appUrl}/events/${encodeURIComponent(hold.eventSlug)}?canceled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      metadata: {
        payment_transaction_id: hold.paymentTransactionId,
        event_uuid: hold.eventUuid,
        event_slug: hold.eventSlug,
      },
      payment_intent_data: {
        metadata: {
          payment_transaction_id: hold.paymentTransactionId,
          event_uuid: hold.eventUuid,
          event_slug: hold.eventSlug,
        },
      },
    });

    if (typeof checkoutSession.payment_intent === "string") {
      await attachPaymentIntent(hold.paymentTransactionId, checkoutSession.payment_intent);
    }

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    if (hold) {
      try {
        await markPaymentFailed(hold.paymentTransactionId);
      } catch {
        // best-effort cleanup
      }
    }
    return errorResponse(error);
  }
}
