import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveOnboarding } from "@/lib/event-repository";

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

  return NextResponse.json({ error: error.message || "Onboarding failed." }, { status: 500 });
}

export async function POST(request: Request) {
  const session = await auth();

  let payload: {
    displayName?: string;
    suburb?: string;
    bio?: string;
    intents?: string[];
    tags?: string[];
    birthDate?: string;
    flexibleDiscovery?: boolean;
    complete?: boolean;
  };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const result = await saveOnboarding(
      {
        displayName: payload.displayName ?? "",
        suburb: payload.suburb ?? "",
        bio: payload.bio ?? "",
        intents: Array.isArray(payload.intents) ? payload.intents : [],
        tags: Array.isArray(payload.tags) ? payload.tags : [],
        // Required - saveOnboarding rejects a missing/underage date. The 18+
        // gate is not the client's to enforce.
        birthDate: payload.birthDate ?? "",
        // No datingVisible: a client can't turn dating on (HOTFIX 2026-10-12 H1).
        flexibleDiscovery:
          typeof payload.flexibleDiscovery === "boolean" ? payload.flexibleDiscovery : undefined,
        // Finish on the form. Member status (01 §1.4) comes only from here.
        complete: payload.complete === true,
      },
      session,
    );

    return NextResponse.json({
      ok: true,
      profileId: result.profileId,
      photoUrl: result.photoUrl,
      photoStatus: result.photoStatus,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
