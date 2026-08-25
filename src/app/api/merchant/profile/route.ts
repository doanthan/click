import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateMerchantContactDetails } from "@/lib/event-repository";

// Merchant self-service for the contactable half of a business profile.
//
// It is deliberately NOT a general merchant_profiles writer: business_name,
// trading_name, abn, acn and the address state/postcode are what an admin
// verified at approval (and what decides the launch-pilot gate), so they are
// not accepted here at all - not gated, not present. A request carrying them
// changes nothing. See updateMerchantContactDetails for the reasoning.

const SOCIAL_KEYS = ["instagram", "tiktok", "facebook", "youtube", "x"] as const;

function responseForError(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown error updating your details." }, { status: 500 });
  }
  const code = (error as { code?: string }).code;
  if (error.name === "AggregateError" || code === "ECONNREFUSED") {
    return NextResponse.json(
      { error: "We couldn't reach the database. Try again in a moment." },
      { status: 503 },
    );
  }
  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error.name === "NotFoundError") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error.name === "ValidationError") {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  return NextResponse.json(
    { error: error.message || "Failed to update your details." },
    { status: 500 },
  );
}

export async function PUT(request: Request) {
  const session = await auth();

  try {
    const body = (await request.json().catch(() => null)) as {
      contactEmail?: unknown;
      phone?: unknown;
      websiteUrl?: unknown;
      addressStreet?: unknown;
      socials?: unknown;
    } | null;

    const stringOrUndefined = (v: unknown) => (typeof v === "string" ? v : undefined);

    // Only the five known platforms, only string values. Anything else is
    // dropped rather than persisted into the jsonb column.
    let socials:
      | Partial<Record<(typeof SOCIAL_KEYS)[number], string>>
      | undefined;
    if (body?.socials && typeof body.socials === "object" && !Array.isArray(body.socials)) {
      const raw = body.socials as Record<string, unknown>;
      socials = {};
      for (const key of SOCIAL_KEYS) {
        const value = raw[key];
        if (typeof value === "string" && value.trim()) socials[key] = value.trim();
      }
    }

    const merchant = await updateMerchantContactDetails(
      {
        contactEmail: stringOrUndefined(body?.contactEmail),
        phone: stringOrUndefined(body?.phone),
        websiteUrl: stringOrUndefined(body?.websiteUrl),
        addressStreet: stringOrUndefined(body?.addressStreet),
        socials,
      },
      session,
    );
    return NextResponse.json({ ok: true, merchant });
  } catch (error) {
    return responseForError(error);
  }
}
