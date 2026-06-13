import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { duplicateEventForMerchant } from "@/lib/event-repository";

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

// POST /api/merchant/events/[eventId]/duplicate
// Clones the merchant's event into a fresh draft (no attendees, re-dated a week
// out) and returns the new event's slug so the client can route the merchant
// straight to the copy to adjust the date/details.
export async function POST(_request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();

  try {
    const result = await duplicateEventForMerchant(eventId, session);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
