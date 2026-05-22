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

function normalizeHttpsWebsiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { url: "" };

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);

    if (parsed.protocol !== "https:") {
      return { error: "Website must start with https://." };
    }

    if (!parsed.hostname.includes(".")) {
      return { error: "Enter a valid website domain, like https://yourbusiness.com.au." };
    }

    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return { url: `${parsed.protocol}//${parsed.host}${path}${parsed.search}${parsed.hash}` };
  } catch {
    return { error: "Enter a valid website URL, like https://yourbusiness.com.au." };
  }
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

  const normalizedWebsite = normalizeHttpsWebsiteUrl(payload.websiteUrl ?? "");
  if (normalizedWebsite.error) {
    return NextResponse.json({ error: normalizedWebsite.error }, { status: 400 });
  }
  const normalizedWebsiteUrl = normalizedWebsite.url ?? "";

  try {
    const merchant = await registerMerchantProfile(
      {
        businessName: payload.businessName ?? "",
        contactEmail: payload.contactEmail ?? "",
        websiteUrl: normalizedWebsiteUrl,
        abn: payload.abn ?? "",
      },
      session,
    );

    return NextResponse.json({ ok: true, merchant });
  } catch (error) {
    return errorResponse(error);
  }
}
