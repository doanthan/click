import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cancelMerchantEvent } from "@/lib/event-repository";

// Past the commit this fans out a Stripe refund and an email per attendee, four
// at a time (mapWithConcurrency). It is one of the few requests here whose work
// is proportional to how full the event was, and the only one where being cut
// off mid-flight leaves refunds unissued - cancelEvent's post-commit catch
// exists precisely because that half-finished state cannot be retried safely.
// 300 matches the ceiling the two /api/generate routes already run at.
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown cancellation error." }, { status: 500 });
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
    { error: error.message || "Event cancellation failed." },
    { status: 500 },
  );
}

export async function POST(_request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();

  try {
    const result = await cancelMerchantEvent(eventId, session);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
