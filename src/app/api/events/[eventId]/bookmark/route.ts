import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toggleBookmark } from "@/lib/event-repository";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    console.error("[bookmark] non-Error thrown:", error);
    return NextResponse.json({ error: "Unknown bookmark error." }, { status: 500 });
  }

  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error.name === "NotFoundError") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  // Unexpected error — surface it in the server console so we can debug.
  console.error("[bookmark] unexpected error:", error);
  return NextResponse.json({ error: error.message || "Bookmark failed." }, { status: 500 });
}

export async function POST(_request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();

  try {
    const result = await toggleBookmark(eventId, session, true);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();

  try {
    const result = await toggleBookmark(eventId, session, false);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
