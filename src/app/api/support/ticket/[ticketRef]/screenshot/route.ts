import { NextResponse } from "next/server";

import { auth, isAdminEmail } from "@/auth";
import { getScreenshotUrl } from "@/lib/support-repository";
import { createSignedScreenshotUrl } from "@/lib/support-storage";

export const runtime = "nodejs";

// GET /api/support/ticket/<ticketRef>/screenshot
//
// This link lives in the Google Sheet triage board. It requires an authenticated
// Click admin and redirects to a 60-second signed private-storage URL.
//
// Every other path therefore renders a small, readable HTML page that explains
// what happened, rather than a raw JSON blob that looks broken in a browser.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticketRef: string }> },
) {
  const { ticketRef } = await params;
  const session = await auth();
  if (!session?.user) {
    const login = new URL("/login", request.url);
    login.searchParams.set(
      "callbackUrl",
      `/api/support/ticket/${encodeURIComponent(ticketRef)}/screenshot`,
    );
    return NextResponse.redirect(login);
  }
  if (!isAdminEmail(session.user.email)) {
    return htmlPage({
      status: 403,
      title: "Admin access required",
      body: "This screenshot is private to the Click support team.",
    });
  }

  try {
    const url = await getScreenshotUrl(ticketRef);
    if (url) {
      const destination = url.startsWith("https://")
        ? url
        : await createSignedScreenshotUrl(url);
      if (destination) return NextResponse.redirect(destination, 302);
    }
    return htmlPage({
      status: 404,
      title: "No screenshot for this ticket",
      body: `Ticket <code>${escapeHtml(ticketRef)}</code> exists in the queue but didn't include a screenshot - the reporter either skipped capture or it failed to upload.`,
    });
  } catch (error) {
    console.error("[support] screenshot redirect failed:", error);
    return htmlPage({
      status: 500,
      title: "Couldn't load that screenshot",
      body: `Something went wrong looking up ticket <code>${escapeHtml(ticketRef)}</code>. Try again in a moment.`,
    });
  }
}

function htmlPage({ status, title, body }: { status: number; title: string; body: string }) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} · Click support</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0b0b0f; color: #e7e7ea; padding: 24px;
  }
  .card {
    max-width: 420px; width: 100%; text-align: center;
    background: #16161d; border: 1px solid #26262e; border-radius: 16px;
    padding: 40px 32px; box-shadow: 0 20px 60px rgba(0,0,0,.4);
  }
  .badge {
    display: inline-block; font-size: 12px; font-weight: 600; letter-spacing: .04em;
    color: #a1a1aa; text-transform: uppercase; margin-bottom: 12px;
  }
  h1 { font-size: 20px; margin: 0 0 12px; }
  p { margin: 0; color: #b4b4bd; }
  code { background: #26262e; padding: 2px 6px; border-radius: 6px; font-size: 13px; }
</style>
</head>
<body>
  <div class="card">
    <div class="badge">Click · Support ${status}</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${body}</p>
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
