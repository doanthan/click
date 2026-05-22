import { NextResponse } from "next/server";
import { createBscEvent } from "@/lib/bible-study";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const event = await createBscEvent({
      title: body.title,
      description: body.description,
      startsAt: body.startsAt,
      locationName: body.locationName,
      onlineLink: body.onlineLink,
      groupId: body.groupId,
    });
    return NextResponse.json({ ok: true, event });
  } catch (error) {
    if (!(error instanceof Error)) return NextResponse.json({ error: "Unknown error." }, { status: 500 });
    if (error.name === "AuthRequiredError") return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.name === "ProfileIncompleteError" || error.name === "AgeVerificationError") return NextResponse.json({ error: error.message }, { status: 428 });
    if (error.name === "DatabaseUnavailableError") return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
