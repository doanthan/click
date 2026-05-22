import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { markNotificationsRead } from "@/lib/event-repository";

export async function POST(request: Request) {
  const session = await auth();
  let payload: { ids?: string[] };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const ids = Array.isArray(payload.ids) ? payload.ids.filter((id) => typeof id === "string") : [];

  try {
    const result = await markNotificationsRead(ids, session);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (!(error instanceof Error)) {
      return NextResponse.json({ error: "Unknown error." }, { status: 500 });
    }
    if (error.name === "AuthRequiredError") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.name === "DatabaseUnavailableError") {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
