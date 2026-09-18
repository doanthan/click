import { NextResponse } from "next/server";
import { sendEventReminders } from "@/lib/event-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One email row per attendee across every event starting tomorrow, four at a
// time. A truncated run is safe - sendEventReminders dedupes against
// email_events, so the next run picks up whoever was missed - but it is still
// silent under-delivery, so give it room to finish in one pass.
export const maxDuration = 300;

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await sendEventReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reminder run failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
