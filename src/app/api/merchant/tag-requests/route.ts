import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requestTagForMerchant } from "@/lib/event-repository";

// POST { label, note? } - an approved host asks for a tag the event wizard's
// picker doesn't have. It queues on /admin/tags; nothing about the event being
// built waits on it (bug board #272/#275).
function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown tag request error." }, { status: 500 });
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
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  return NextResponse.json(
    { error: error.message || "Tag request failed." },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "You need to log in first." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { label?: unknown; note?: unknown };
  if (typeof body.label !== "string") {
    return NextResponse.json({ error: "A tag name is required." }, { status: 400 });
  }

  try {
    const result = await requestTagForMerchant(
      { label: body.label, note: typeof body.note === "string" ? body.note : undefined },
      session,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
