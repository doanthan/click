import { NextResponse } from "next/server";
import { updateBscProfile } from "@/lib/bible-study";

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown error." }, { status: 500 });
  }
  if (error.name === "AuthRequiredError") return NextResponse.json({ error: error.message }, { status: 401 });
  if (error.name === "DatabaseUnavailableError") return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ error: error.message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const profile = await updateBscProfile(body);
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return errorResponse(error);
  }
}
