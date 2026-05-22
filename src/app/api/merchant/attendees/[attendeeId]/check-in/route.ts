import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toggleAttendeeCheckIn } from "@/lib/event-repository";

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown check-in error." }, { status: 500 });
  }
  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error.name === "NotFoundError") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error.name === "MerchantSignupRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return NextResponse.json({ error: error.message || "Check-in failed." }, { status: 500 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attendeeId: string }> },
) {
  const { attendeeId } = await params;
  const session = await auth();
  let body: { checkedIn?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const result = await toggleAttendeeCheckIn(
      attendeeId,
      body.checkedIn ?? true,
      session,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
