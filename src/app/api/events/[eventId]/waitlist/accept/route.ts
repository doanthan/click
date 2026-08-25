import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { acceptWaitlistOffer } from "@/lib/event-repository";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

function responseForError(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown waitlist error." }, { status: 500 });
  }

  const code = (error as { code?: string }).code;
  if (error.name === "AggregateError" || code === "ECONNREFUSED") {
    return NextResponse.json(
      { error: "Postgres is unavailable. Start the database before confirming your spot." },
      { status: 503 },
    );
  }

  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  // Paid events can't be confirmed without payment — route the buyer to checkout.
  if (error.name === "PaymentRequiredError") {
    const slug = (error as Error & { eventSlug?: string }).eventSlug;
    return NextResponse.json(
      {
        error: error.message,
        redirectTo: slug ? `/events/${slug}` : undefined,
      },
      { status: 402 },
    );
  }

  if (error.name === "NotFoundError") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // Offer expired, already accepted, or the event filled up.
  if (error.name === "ConflictError") {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  // A banned or suspended account accepting a promotion - same 403 the RSVP and
  // checkout routes give. Without this branch the refusal fell through to the
  // catch-all below and read as a 500, i.e. "Click is broken", not "not you".
  if (error.name === "ForbiddenError") {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  // The profile has no suburb / birth date, so the 18+ gate was never passed.
  if (error.name === "OnboardingRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  return NextResponse.json({ error: error.message || "Could not confirm spot." }, { status: 500 });
}

export async function POST(_request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();

  try {
    const registration = await acceptWaitlistOffer(eventId, session);
    return NextResponse.json({ ok: true, registration });
  } catch (error) {
    return responseForError(error);
  }
}
