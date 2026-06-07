import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateEventTagsForAdmin } from "@/lib/event-repository";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

function responseForError(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown error updating tags." }, { status: 500 });
  }

  const code = (error as { code?: string }).code;
  if (error.name === "AggregateError" || code === "ECONNREFUSED") {
    return NextResponse.json(
      { error: "Postgres is unavailable. Start the database before editing tags." },
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
  return NextResponse.json({ error: error.message || "Failed to update tags." }, { status: 500 });
}

export async function PUT(request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();

  try {
    const body = (await request.json().catch(() => null)) as { slugs?: unknown } | null;
    const slugs = Array.isArray(body?.slugs)
      ? body!.slugs.filter((s): s is string => typeof s === "string")
      : [];

    const result = await updateEventTagsForAdmin(eventId, slugs, session);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return responseForError(error);
  }
}
