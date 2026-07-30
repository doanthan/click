import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createEventForMerchant, type CreateEventInput } from "@/lib/event-repository";

function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

// Parse a lat/lng FormData entry to a finite number within range, or null when
// missing/invalid — the wizard sends these only when the user picks a Mapbox
// suggestion.
function getCoord(value: FormDataEntryValue | null, min: number, max: number) {
  const raw = getString(value);
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function responseForError(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown event creation error." }, { status: 500 });
  }

  const code = (error as { code?: string }).code;
  if (error.name === "AggregateError" || code === "ECONNREFUSED") {
    return NextResponse.json(
      { error: "Postgres is unavailable. Start the database before creating events." },
      { status: 503 },
    );
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

  if (error.name === "MerchantSignupRequiredError") {
    return NextResponse.json(
      { error: error.message, redirect: "/merchant/signup" },
      { status: 403 },
    );
  }

  if (error.name === "MerchantApprovalRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  // Note: event creation no longer gates on Stripe Connect. Merchants can
  // submit paid events before payout setup; admin review (+ the checkout-time
  // PayoutsNotReadyError gate) is the safety net. See createEventForMerchant.

  return NextResponse.json({ error: error.message || "Event creation failed." }, { status: 500 });
}

export async function POST(request: Request) {
  const session = await auth();
  // Reject anonymous callers before parsing multipart data. Besides being the
  // correct boundary, this prevents a malformed/incorrect Content-Type from
  // turning an unauthenticated request into a framework-level 500.
  if (!session?.user?.email) {
    return NextResponse.json({ error: "You need to log in first." }, { status: 401 });
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid event form submission." },
      { status: 400 },
    );
  }

  const input: CreateEventInput = {
    title: getString(formData.get("title")),
    groupName: getString(formData.get("groupName")),
    category: getString(formData.get("category")),
    startsAt: getString(formData.get("startsAt")),
    durationMinutes:
      Number.parseInt(getString(formData.get("durationMinutes")), 10) || undefined,
    locationName: getString(formData.get("locationName")),
    suburb: getString(formData.get("suburb")),
    address: getString(formData.get("address")) || undefined,
    latitude: getCoord(formData.get("latitude"), -90, 90),
    longitude: getCoord(formData.get("longitude"), -180, 180),
    price: getString(formData.get("price")),
    capacity: Number.parseInt(getString(formData.get("capacity")), 10) || 0,
    description: getString(formData.get("description")),
    relationshipGoal: getString(formData.get("relationshipGoal")),
    tags: getString(formData.get("tags")),
    imageUrl: getString(formData.get("imageUrl")) || undefined,
    imageAlt: getString(formData.get("imageAlt")) || undefined,
    // Multi-photo gallery from the wizard's Media step. The client appends one
    // `imageUrls` entry per uploaded photo, in display order.
    imageUrls: formData
      .getAll("imageUrls")
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean),
  };

  try {
    const event = await createEventForMerchant(input, session);

    return NextResponse.json({
      ok: true,
      event,
    });
  } catch (error) {
    return responseForError(error);
  }
}
