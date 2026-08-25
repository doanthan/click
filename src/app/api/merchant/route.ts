import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { registerMerchantWizardSubmit, type MerchantWizardInput } from "@/lib/event-repository";
import { normalizeWebsiteUrl } from "@/lib/website-url";

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown error." }, { status: 500 });
  }

  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error.name === "ValidationError") {
    // `field` rides along so the wizard can mark the offending input and route
    // the host back to the step that owns it - a bare sentence on the Documents
    // step is a rejection with nowhere to land.
    const field = (error as Error & { field?: string }).field;
    return NextResponse.json({ error: error.message, field }, { status: 400 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  return NextResponse.json({ error: error.message || "Merchant signup failed." }, { status: 500 });
}

const ALLOWED_SOCIAL_PLATFORMS = [
  "instagram",
  "tiktok",
  "facebook",
  "youtube",
  "x",
] as const;

// Keep only known platforms that carry a non-empty handle.
function sanitizeSocials(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null) return {};
  const source = value as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const platform of ALLOWED_SOCIAL_PLATFORMS) {
    const handle = source[platform];
    if (typeof handle === "string" && handle.trim()) {
      out[platform] = handle.trim();
    }
  }
  return out;
}

/**
 * This endpoint accepts exactly ONE shape: the signup wizard's mode:"wizard"
 * payload. It used to fall through to a laxer branch for a single-page form
 * that no longer exists, and that fallback was a live trap - it called
 * registerMerchantProfile, which skips the wizard's validation AND the
 * merchant-application-received email, so a hand-rolled POST could create a
 * merchant that never got its confirmation. Anything else is now a 400.
 *
 * We discriminate on the explicit `mode` marker rather than sniffing field
 * presence, so a partially-filled wizard payload fails validation with a real
 * message instead of being mistaken for some other shape.
 */
function isWizardPayload(payload: unknown): payload is MerchantWizardInput {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { mode?: unknown }).mode === "wizard"
  );
}

export async function POST(request: Request) {
  const session = await auth();

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isWizardPayload(payload)) {
    return NextResponse.json(
      { error: "Unsupported merchant signup payload." },
      { status: 400 },
    );
  }

  const normalizedWebsite = normalizeWebsiteUrl(
    typeof payload.websiteUrl === "string" ? payload.websiteUrl : "",
  );
  if (normalizedWebsite.error) {
    return NextResponse.json(
      { error: normalizedWebsite.error, field: "websiteUrl" },
      { status: 400 },
    );
  }
  const normalizedWebsiteUrl = normalizedWebsite.url ?? "";

  // merchant_profiles.business_type carries a check constraint
  // (database/009_merchant_full_signup.sql), so an unrecognised value would come
  // back as a constraint violation rather than a usable message. Null is allowed
  // and means "leave it alone" - the upsert coalesces it.
  const rawBusinessType = payload.businessType as unknown;
  const businessType =
    typeof rawBusinessType === "string" && rawBusinessType ? rawBusinessType : null;
  if (
    businessType !== null &&
    !["sole_trader", "company", "partnership", "trust"].includes(businessType)
  ) {
    return NextResponse.json(
      { error: "Pick how the business is set up.", field: "businessType" },
      { status: 400 },
    );
  }

  try {
    const merchant = await registerMerchantWizardSubmit(
      {
        businessName: stringField(payload.businessName),
        tradingName: stringField(payload.tradingName),
        abn: stringField(payload.abn),
        acn: stringField(payload.acn),
        businessType: businessType as MerchantWizardInput["businessType"],
        eventCategoryIds: Array.isArray(payload.eventCategoryIds)
          ? (payload.eventCategoryIds as unknown[]).map(String)
          : [],
        contactEmail: stringField(payload.contactEmail),
        phone: stringField(payload.phone),
        websiteUrl: normalizedWebsiteUrl,
        socials: sanitizeSocials(payload.socials),
        addressStreet: stringField(payload.addressStreet),
        addressSuburb: stringField(payload.addressSuburb),
        addressState: payload.addressState as MerchantWizardInput["addressState"],
        addressPostcode: stringField(payload.addressPostcode),
      },
      session,
    );
    return NextResponse.json({ ok: true, merchant });
  } catch (error) {
    return errorResponse(error);
  }
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}
