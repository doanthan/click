import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cancelEventForAdmin } from "@/lib/event-repository";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

function responseForError(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown cancellation error." }, { status: 500 });
  }

  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error.name === "ForbiddenError") {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error.name === "ValidationError") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error.name === "NotFoundError") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  return NextResponse.json(
    { error: error.message || "Event cancellation failed." },
    { status: 500 },
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();
  const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
  const reason = typeof body.reason === "string" ? body.reason : "";

  try {
    const result = await cancelEventForAdmin(eventId, reason, session);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return responseForError(error);
  }
}
