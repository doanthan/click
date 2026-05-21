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
  if (error.name === "NotFoundError") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error.name === "ValidationError") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  return NextResponse.json({ error: error.message || "Click failed." }, { status: 500 });
}

export async function POST(request: Request) {
  const session = await auth();
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
