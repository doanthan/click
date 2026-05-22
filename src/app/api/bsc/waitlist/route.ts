import { NextResponse } from "next/server";
import { joinBscWaitlist } from "@/lib/bible-study";

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
    const entry = await joinBscWaitlist({
      suburb: body.suburb,
      city: body.city,
      postcode: body.postcode || "",
      radiusKm: Number(body.radiusKm || 10),
      availability: String(body.availability || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      willingToHost: !!body.willingToHost,
      willingToLead: !!body.willingToLead,
    });
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    return errorResponse(error);
  }
}
