import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createEventForMerchant, type CreateEventInput } from "@/lib/event-repository";

function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
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

  return NextResponse.json({ error: error.message || "Event creation failed." }, { status: 500 });
}

export async function POST(request: Request) {
  const session = await auth();
  const formData = await request.formData();

  const input: CreateEventInput = {
    title: getString(formData.get("title")),
    groupName: getString(formData.get("groupName")),
    category: getString(formData.get("category")),
    startsAt: getString(formData.get("startsAt")),
    locationName: getString(formData.get("locationName")),
    suburb: getString(formData.get("suburb")),
    price: getString(formData.get("price")),
    capacity: Number.parseInt(getString(formData.get("capacity")), 10) || 0,
    description: getString(formData.get("description")),
    relationshipGoal: getString(formData.get("relationshipGoal")),
    tags: getString(formData.get("tags")),
    imageUrl: getString(formData.get("imageUrl")) || undefined,
    imageAlt: getString(formData.get("imageAlt")) || undefined,
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
