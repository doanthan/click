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
    age?: string;
    bio?: string;
    intents?: string[];
    tags?: string[];
    birthDate?: string;
    datingVisible?: boolean;
    flexibleDiscovery?: boolean;
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
        age: payload.age ?? "",
        bio: payload.bio ?? "",
        intents: Array.isArray(payload.intents) ? payload.intents : [],
        tags: Array.isArray(payload.tags) ? payload.tags : [],
        birthDate: payload.birthDate,
        datingVisible:
          typeof payload.datingVisible === "boolean" ? payload.datingVisible : undefined,
        flexibleDiscovery:
          typeof payload.flexibleDiscovery === "boolean" ? payload.flexibleDiscovery : undefined,
      },
      session,
    );

    return NextResponse.json({ ok: true, profileId: result.profileId });
  } catch (error) {
    return errorResponse(error);
  }
}
