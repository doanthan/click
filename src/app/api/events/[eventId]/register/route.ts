import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cancelRegistration, registerForEvent } from "@/lib/event-repository";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

function responseForError(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown RSVP error." }, { status: 500 });
  }

  const code = (error as { code?: string }).code;
  if (error.name === "AggregateError" || code === "ECONNREFUSED") {
    return NextResponse.json(
      { error: "Postgres is unavailable. Start the database before registering for events." },
      { status: 503 },
    );
  }

  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

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

  if (error.name === "ValidationError") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error.name === "ConflictError") {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  return NextResponse.json({ error: error.message || "RSVP failed." }, { status: 500 });
}

export async function POST(_request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();

  try {
    const registration = await registerForEvent(eventId, session);

    return NextResponse.json({
      ok: true,
      registration,
    });
  } catch (error) {
    return responseForError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();

  try {
    const result = await cancelRegistration(eventId, session);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return responseForError(error);
  }
}
