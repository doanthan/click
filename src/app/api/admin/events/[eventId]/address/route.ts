import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  approveEventAddressChange,
  rejectEventAddressChange,
} from "@/lib/event-repository";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

function responseForError(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown error." }, { status: 500 });
  }
  const code = (error as { code?: string }).code;
  if (error.name === "AggregateError" || code === "ECONNREFUSED") {
    return NextResponse.json(
      { error: "Postgres is unavailable. Start the database first." },
      { status: 503 },
    );
  }
  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error.name === "ForbiddenError") {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error.name === "NotFoundError") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  return NextResponse.json(
    { error: error.message || "Failed to update address change." },
    { status: 500 },
  );
}

// POST /api/admin/events/[eventId]/address
// Body: { decision: "approve" | "reject" }
// Approve copies the queued pending_address onto the live address; reject
// discards it. Either way the merchant is notified.
export async function POST(request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();

  try {
    const body = (await request.json().catch(() => null)) as {
      decision?: unknown;
    } | null;
    const decision = body?.decision;

    if (decision === "approve") {
      const result = await approveEventAddressChange(eventId, session);
      return NextResponse.json({ ok: true, ...result });
    }
    if (decision === "reject") {
      const result = await rejectEventAddressChange(eventId, session);
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json(
      { error: 'decision must be "approve" or "reject".' },
      { status: 422 },
    );
  } catch (error) {
    return responseForError(error);
  }
}
