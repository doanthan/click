import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resubmitRejectedEvent } from "@/lib/event-repository";

// POST /api/merchant/events/[eventId]/resubmit
//
// A merchant resubmits a previously REJECTED event for admin review after
// fixing it (bug board #217). `eventId` is the event slug. Flips the status back
// to pending (or live for a trusted auto-approve merchant) and re-notifies
// admins. Ownership-scoped in the repository.
type RouteContext = {
  params: Promise<{ eventId: string }>;
};

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown resubmission error." }, { status: 500 });
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
    { error: error.message || "Event resubmission failed." },
    { status: 500 },
  );
}

export async function POST(_request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();

  try {
    const result = await resubmitRejectedEvent(eventId, session);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
