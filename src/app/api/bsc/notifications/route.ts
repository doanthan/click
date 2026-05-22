import { NextResponse } from "next/server";
import { clearBscNotifications, markBscNotificationsRead } from "@/lib/bible-study";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    ids?: string[];
    all?: boolean;
    clear?: boolean;
  };
  try {
    const result = body.clear
      ? await clearBscNotifications()
      : await markBscNotificationsRead(body.all ? "all" : body.ids ?? []);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (!(error instanceof Error)) return NextResponse.json({ error: "Unknown error." }, { status: 500 });
    if (error.name === "AuthRequiredError") return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.name === "DatabaseUnavailableError") return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
