import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { nameGuestSeatForPurchaser } from "@/lib/event-repository";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ guestSpotId: string }> };

// Purchaser names or renames ONE of their +1 seats after booking (bug board
// #228). Body: { firstName, email?, dob? }. Ownership, the checkout naming rules
// and the invite email live in nameGuestSeatForPurchaser; this authenticates,
// reads the body and maps errors, like its sibling cancel route.
export async function POST(request: Request, context: RouteContext) {
  const { guestSpotId } = await context.params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to manage your booking." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    firstName?: unknown;
    email?: unknown;
    dob?: unknown;
  } | null;
  const text = (value: unknown) => (typeof value === "string" ? value : "");

  try {
    const seat = await nameGuestSeatForPurchaser(
      guestSpotId,
      { firstName: text(body?.firstName), email: text(body?.email), dob: text(body?.dob) },
      session,
    );
    return NextResponse.json({ ok: true, seat });
  } catch (error) {
    const name = (error as Error)?.name;
    const status =
      name === "NotFoundError"
        ? 404
        : name === "ValidationError"
          ? 400
          : name === "DatabaseUnavailableError"
            ? 503
            : 500;
    // Our own validation copy is written for the buyer; anything else is not.
    const message =
      status !== 500 && error instanceof Error ? error.message : "Could not update the seat.";
    if (status === 500) console.error("[guest-seats/name] failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}
