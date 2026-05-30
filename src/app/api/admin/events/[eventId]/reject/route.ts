import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rejectEventForAdmin } from "@/lib/event-repository";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

function responseForError(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown rejection error." }, { status: 500 });
  }

  const code = (error as { code?: string }).code;
  if (error.name === "AggregateError" || code === "ECONNREFUSED") {
    return NextResponse.json(
      { error: "Postgres is unavailable. Start the database before rejecting events." },
      { status: 503 },
    );
  }

  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (error.name === "ForbiddenError") {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  if (error.name === "NotFoundError") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  return NextResponse.json({ error: error.message || "Rejection failed." }, { status: 500 });
}

export async function POST(request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();

  // The admin's free-text reason rides through to the event-rejected-merchant
  // email + audit log. Optional — the repository falls back to a generic line.
  const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
  const reason = typeof body.reason === "string" ? body.reason : "";

  try {
    const event = await rejectEventForAdmin(eventId, reason, session);

    return NextResponse.json({
      ok: true,
      event,
    });
  } catch (error) {
    return responseForError(error);
  }
}
