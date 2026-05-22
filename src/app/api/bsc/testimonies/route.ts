import { NextResponse } from "next/server";
import { createBscTestimony } from "@/lib/bible-study";

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) return NextResponse.json({ error: "Unknown error." }, { status: 500 });
  if (error.name === "AuthRequiredError") return NextResponse.json({ error: error.message }, { status: 401 });
  if (error.name === "ProfileIncompleteError" || error.name === "AgeVerificationError") return NextResponse.json({ error: error.message }, { status: 428 });
  if (error.name === "DatabaseUnavailableError") return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ error: error.message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const testimony = await createBscTestimony({
      title: body.title,
      story: body.content || body.story,
      displayMode: body.displayMode === "anonymous" || body.displayMode === "full_name" ? body.displayMode : "first_name",
    });
    return NextResponse.json({ ok: true, testimony });
  } catch (error) {
    return errorResponse(error);
  }
}
