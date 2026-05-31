import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  attachPaymentIntent,
  createPaymentHold,
  markPaymentFailed,
} from "@/lib/event-repository";
import { getAppUrl, getStripeClient } from "@/lib/stripe";
import { calculateApplicationFee } from "@/lib/stripe-connect";

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
  // Merchant hasn't finished Connect onboarding — the listing shouldn't have
  // been live, but we still block at the buyer's checkout as a backstop.
  if (error.name === "PayoutsNotReadyError") {
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
        // Booking fee as its own line so it shows distinctly on the Stripe page
        // and the card statement. Omitted entirely when the fee is disabled (0).
        ...(hold.bookingFeeCents > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: hold.currency.toLowerCase(),
                  unit_amount: hold.bookingFeeCents,
                  product_data: {
                    name: "Booking fee",
                    description: "Click platform booking fee",
                  },
                },
              },
            ]
          : []),
      ],
      // `{CHECKOUT_SESSION_ID}` is a Stripe template literal it substitutes on
      // redirect — leave the braces unencoded. The landing page uses it to
      // reconcile the payment (fulfill-on-return) so confirmation doesn't depend
      // solely on webhook delivery. See reconcileCheckoutSession in stripe-sync.
      success_url: `${appUrl}/dashboard/calendar?booked=${encodeURIComponent(hold.eventSlug)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/events/${encodeURIComponent(hold.eventSlug)}?canceled=1`,
      // Matches the `hold_expires_at` set in createPaymentHold so the reserved
      // seat and the Stripe session expire together — no ghost seats, and no
      // chance of a payment landing after the seat was freed and resold.
      // 30 min is Stripe's minimum allowed session lifetime; without a reaper
      // to expire the session early we hold the seat for the same window.
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
        // Merchant-hosted events: destination charge with `on_behalf_of` so
        // the charge settles in the merchant's AU/AUD scope (correct tax
        // receipt + statement descriptor) while the platform remains merchant
        // of record for dispute/refund routing. application_fee_amount is the
        // platform's cut (0 by default; flip PLATFORM_FEE_BPS env to enable).
        // Funds then flow through to the merchant's connected balance and
        // Stripe pays them out on the schedule set when the account was
        // created in src/lib/stripe-connect.ts.
        // The platform's cut = its % take on the ticket PLUS the whole booking
        // fee (the fee is the platform's, not the merchant's). The merchant
        // receives ticket − platform%; the booking fee never reaches their
        // connected balance. application_fee_amount is taken off the total charge
        // (ticket + booking fee), which is why we add the fee back in here.
        ...(hold.merchantStripeAccountId
          ? {
              transfer_data: { destination: hold.merchantStripeAccountId },
              on_behalf_of: hold.merchantStripeAccountId,
              application_fee_amount:
                calculateApplicationFee(hold.priceCents) + hold.bookingFeeCents,
            }
          : {}),
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
