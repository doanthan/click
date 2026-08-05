import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  attachCheckoutSession,
  attachPaymentIntent,
  createPaymentHold,
  markPaymentFailed,
} from "@/lib/event-repository";
import { getAppUrl, getStripeClient } from "@/lib/stripe";
import { calculateApplicationFee } from "@/lib/stripe-connect";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

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
  // Same 18+ / onboarding gate the free RSVP path enforces - checkout must not
  // be the way around it.
  if (error.name === "OnboardingRequiredError") {
    return NextResponse.json(
      { error: error.message, redirectTo: "/onboarding" },
      { status: 403 },
    );
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

export async function POST(request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "You need to log in first." }, { status: 401 });
  }
  const limit = await checkRateLimit({
    scope: "event-checkout",
    identity: session.user.email,
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured on this server." },
      { status: 503 },
    );
  }

  // Optional body: { tickets?: 1-4, guests?: [{firstName,email,dob}] } for group
  // (guest-spot) bookings. A bare POST (no body) keeps the solo-booking behaviour.
  let seatCount = 1;
  let guests: { firstName: string; email: string; dob: string }[] = [];
  try {
    const body = await request.json();
    if (body && typeof body === "object") {
      if (Number.isFinite(body.tickets)) seatCount = Math.trunc(body.tickets);
      if (Array.isArray(body.guests)) {
        guests = body.guests.map((g: Record<string, unknown>) => ({
          firstName: String(g?.firstName ?? ""),
          email: String(g?.email ?? ""),
          dob: String(g?.dob ?? ""),
        }));
      }
    }
  } catch {
    // No/invalid JSON body — treat as a solo booking.
  }

  let hold: Awaited<ReturnType<typeof createPaymentHold>> | null = null;

  try {
    hold = await createPaymentHold(eventId, session, { seatCount, guests });

    const appUrl = getAppUrl();
    const returnPath = `/events/${encodeURIComponent(hold.eventSlug)}`;

    // Embedded Checkout renders Stripe's payment form in a modal on the event
    // page instead of redirecting away. It needs a publishable key on the
    // client, so we only use it when NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is set;
    // otherwise we fall back to the hosted full-page redirect. Both reconcile
    // through the same `?booked=1&session_id=` return — `{CHECKOUT_SESSION_ID}`
    // is a Stripe template literal substituted on return (leave the braces raw).
    const useEmbedded = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
    const uiModeParams = useEmbedded
      ? {
          // This pinned Stripe API version (2026-05-27.dahlia) names the
          // on-page mode "embedded_page" (was "embedded" in older versions);
          // its client_secret initializes Stripe.js embedded checkout.
          ui_mode: "embedded_page" as const,
          return_url: `${appUrl}${returnPath}?booked=1&session_id={CHECKOUT_SESSION_ID}`,
        }
      : {
          success_url: `${appUrl}${returnPath}?booked=1&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}${returnPath}?canceled=1`,
        };

    // A duplicate request that arrives after the first request attached its
    // Session should return that exact Checkout instead of issuing another
    // create call. This is the common double-click/lost-response retry path.
    if (hold.stripeCheckoutSessionId) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        hold.stripeCheckoutSessionId,
      );
      if (existingSession.status === "open") {
        if (useEmbedded && existingSession.client_secret) {
          return NextResponse.json({ clientSecret: existingSession.client_secret });
        }
        if (!useEmbedded && existingSession.url) {
          return NextResponse.json({ url: existingSession.url });
        }
      }
      const error = new Error(
        existingSession.payment_status === "paid"
          ? "This checkout is already paid. Refresh the event to see your booking."
          : "This checkout is no longer open. Refresh the event to start again.",
      );
      error.name = "ConflictError";
      throw error;
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: hold.profileEmail,
      line_items: [
        {
          // One unit per seat (purchaser + guests). The purchaser pays for all.
          quantity: hold.seatCount,
          price_data: {
            currency: hold.currency.toLowerCase(),
            unit_amount: hold.priceCents,
            product_data: {
              name: hold.eventTitle,
              description:
                hold.seatCount > 1
                  ? `Click event reservation (${hold.seatCount} seats)`
                  : `Click event reservation`,
            },
          },
        },
        // Booking fee as its own line so it shows distinctly on the Stripe page
        // and the card statement. Omitted entirely when the fee is disabled (0).
        ...(hold.bookingFeeCents > 0
          ? [
              {
                // One booking fee per seat.
                quantity: hold.seatCount,
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
      // Hosted vs embedded redirect/return URLs (see uiModeParams above). The
      // landing page reconciles the payment on return (fulfill-on-return) so
      // confirmation doesn't depend solely on webhook delivery. See
      // reconcileCheckoutSession in stripe-sync.
      ...uiModeParams,
      // Matches the `hold_expires_at` set in createPaymentHold so the reserved
      // seat and the Stripe session expire together. The DB uses 31 minutes to
      // leave headroom above Stripe's 30-minute minimum while the request runs.
      expires_at: Math.floor(hold.holdExpiresAt.getTime() / 1000),
      metadata: {
        payment_transaction_id: hold.paymentTransactionId,
        event_uuid: hold.eventUuid,
        event_slug: hold.eventSlug,
        // Named guests ride here only (never persisted as PII until the webhook
        // confirms payment — an abandoned checkout leaves zero guest data). The
        // webhook reads this to name the reserved seats. Spec 19 §4.4/§13.
        ...(hold.guests.length > 0
          ? { guest_details: JSON.stringify(hold.guests) }
          : {}),
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
              application_fee_amount: hold.applicationFeeCents ??
                (calculateApplicationFee(hold.priceCents) + hold.bookingFeeCents) *
                  hold.seatCount,
            }
          : {}),
      },
    }, { idempotencyKey: `click-checkout-${hold.paymentTransactionId}` });

    // The session id is always present at creation and is our durable Stripe
    // handle for reconciliation. The PaymentIntent is usually null here (Stripe
    // creates it lazily on payment), so attach it only when present — the
    // webhook / reconcile path backfills it once the buyer pays.
    await attachCheckoutSession(hold.paymentTransactionId, checkoutSession.id);
    if (typeof checkoutSession.payment_intent === "string") {
      await attachPaymentIntent(hold.paymentTransactionId, checkoutSession.payment_intent);
    }

    if (useEmbedded) {
      if (!checkoutSession.client_secret) {
        throw new Error("Stripe did not return a client secret for embedded checkout.");
      }
      return NextResponse.json({ clientSecret: checkoutSession.client_secret });
    }

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    if (hold && !hold.reused) {
      try {
        await markPaymentFailed(hold.paymentTransactionId);
      } catch {
        // best-effort cleanup
      }
    }
    return errorResponse(error);
  }
}
