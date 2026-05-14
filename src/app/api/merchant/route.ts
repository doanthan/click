import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { registerMerchantProfile } from "@/lib/event-repository";

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown error." }, { status: 500 });
  }

  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error.name === "ValidationError") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  return NextResponse.json({ error: error.message || "Merchant signup failed." }, { status: 500 });
}

export async function POST(request: Request) {
  const session = await auth();

  let payload: {
    businessName?: string;
    contactEmail?: string;
    websiteUrl?: string;
    abn?: string;
  };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const merchant = await registerMerchantProfile(
      {
        businessName: payload.businessName ?? "",
        contactEmail: payload.contactEmail ?? "",
        websiteUrl: payload.websiteUrl ?? "",
        abn: payload.abn ?? "",
      },
      session,
    );

    return NextResponse.json({ ok: true, merchant });
  } catch (error) {
    return errorResponse(error);
  }
}
