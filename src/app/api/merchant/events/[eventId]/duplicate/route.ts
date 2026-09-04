import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMerchantEventDuplicateDraft } from "@/lib/event-repository";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown duplication error." }, { status: 500 });
  }

  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (
    error.name === "ForbiddenError" ||
    error.name === "MerchantSignupRequiredError" ||
    error.name === "MerchantApprovalRequiredError" ||
    error.name === "ValidationError"
  ) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error.name === "NotFoundError") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  return NextResponse.json(
    { error: error.message || "Event duplication failed." },
    { status: 500 },
  );
}

// GET /api/merchant/events/[eventId]/duplicate
// Returns a prefilled "draft" (the source event's details, with the date left
// blank and no "Copy of" prefix) that the client seeds into the create wizard,
// so duplicating an event becomes "create event, pre-populated" - the merchant
// picks a new date/time, tweaks anything, and publishes through the normal flow
// (so the copy actually lands in discovery). Bug board #184/#185/#191.
export async function GET(_request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();

  try {
    const draft = await getMerchantEventDuplicateDraft(eventId, session);
    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    return errorResponse(error);
  }
}
