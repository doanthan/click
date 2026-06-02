import { NextResponse } from "next/server";

import { getScreenshotUrl } from "@/lib/support-repository";

export const runtime = "nodejs";

// GET /api/support/ticket/<ticketRef>/screenshot
// Public redirect → the stored (already public) screenshot. Gives the Google
// Sheet a stable letsclick.app link instead of exposing the raw storage URL.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticketRef: string }> },
) {
  const { ticketRef } = await params;
  try {
    const url = await getScreenshotUrl(ticketRef);
    if (!url) {
      return NextResponse.json({ error: "No screenshot for this ticket." }, { status: 404 });
    }
    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.error("[support] screenshot redirect failed:", error);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
}
