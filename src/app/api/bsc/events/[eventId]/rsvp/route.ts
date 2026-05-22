import { NextResponse } from "next/server";
import { rsvpBscEvent } from "@/lib/bible-study";

type RouteContext = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { status?: string };
  try {
    const result = await rsvpBscEvent(eventId, body.status === "not_going" ? "not_going" : "going");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (!(error instanceof Error)) return NextResponse.json({ error: "Unknown error." }, { status: 500 });
    if (error.name === "AuthRequiredError") return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.name === "ProfileIncompleteError" || error.name === "AgeVerificationError") return NextResponse.json({ error: error.message }, { status: 428 });
    if (error.name === "DatabaseUnavailableError") return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
