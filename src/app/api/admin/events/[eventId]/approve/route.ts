import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { approveEventForAdmin } from "@/lib/event-repository";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

function responseForError(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown approval error." }, { status: 500 });
  }

  const code = (error as { code?: string }).code;
  if (error.name === "AggregateError" || code === "ECONNREFUSED") {
    return NextResponse.json(
      { error: "Postgres is unavailable. Start the database before approving events." },
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

  if (error.name === "ValidationError") {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }

  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  return NextResponse.json({ error: error.message || "Approval failed." }, { status: 500 });
}

export async function POST(_request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();

  try {
    const event = await approveEventForAdmin(eventId, session);

    return NextResponse.json({
      ok: true,
      event,
    });
  } catch (error) {
    return responseForError(error);
  }
}
