import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createUserClickForSession } from "@/lib/event-repository";

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown Click error." }, { status: 500 });
  }

  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error.name === "RateLimitedError") {
    const retryAfter = (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds ?? 60;
    return NextResponse.json(
      { error: error.message },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
      },
    );
  }
  // Deliberately NO NotFoundError branch. sendClickInner no longer raises one:
  // an unknown profile id answers with the same 400 + same string as an
  // ineligible receiver, so this endpoint can't be walked to enumerate which
  // account ids are real.
  if (error.name === "ValidationError") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  console.error("[clicks] unhandled send failure", error);
  return NextResponse.json({ error: "Click failed." }, { status: 500 });
}

export async function POST(request: Request) {
  const session = await auth();
  // Authentication is the first observable API boundary: anonymous callers
  // should not learn request-validation details or consume parsing work.
  if (!session?.user?.email) {
    return NextResponse.json({ error: "You need to log in first." }, { status: 401 });
  }
  // The send-click hourly limit moved into createUserClickForSession so it also
  // binds the two server actions, which are the paths the product actually uses.
  // Counting here as well would just halve everyone's budget.
  const body = (await request.json().catch(() => ({}))) as {
    clickedProfileId?: string;
    sourceEventId?: string;
  };

  if (!body.clickedProfileId) {
    return NextResponse.json({ error: "clickedProfileId is required." }, { status: 400 });
  }

  try {
    const result = await createUserClickForSession(
      {
        clickedProfileId: body.clickedProfileId,
        sourceEventId: body.sourceEventId,
      },
      session,
    );

    return NextResponse.json({ ok: true, click: result });
  } catch (error) {
    return errorResponse(error);
  }
}
