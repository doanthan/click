import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cancelGuestSeatForPurchaser } from "@/lib/event-repository";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ guestSpotId: string }> };

// Purchaser cancels ONE of their +1 seats (spec 19 §10.1). Ownership + money
// handling live in cancelGuestSeatForPurchaser; this just authenticates and maps
// errors. The refund (if any) follows the standard cancellation policy window.
export async function POST(_request: Request, context: RouteContext) {
  const { guestSpotId } = await context.params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to manage your booking." }, { status: 401 });
  }

  try {
    const result = await cancelGuestSeatForPurchaser(guestSpotId, session);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cancel the seat.";
    const name = (error as Error)?.name;
    const status =
      name === "NotFoundError"
        ? 404
        : name === "ValidationError"
          ? 400
          : name === "DatabaseUnavailableError"
            ? 503
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
