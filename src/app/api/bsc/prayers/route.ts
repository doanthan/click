import { NextResponse } from "next/server";
import { createBscPrayer } from "@/lib/bible-study";

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
    const prayer = await createBscPrayer({
      kind: body.kind === "praise" ? "praise" : "prayer",
      title: body.title,
      content: body.content,
      groupId: body.groupId || undefined,
    });
    return NextResponse.json({ ok: true, prayer });
  } catch (error) {
    return errorResponse(error);
  }
}
