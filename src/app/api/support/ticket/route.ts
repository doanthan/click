import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  createSupportTicket,
  listOpenBugsForUrl,
  type Annotation,
  type ConsoleEntry,
  type NetworkEntry,
} from "@/lib/support-repository";
import { keepOwnOriginUrl } from "@/lib/support-url";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { canTriageSupportTickets } from "@/lib/support-access";

export const runtime = "nodejs";
const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
const SCREENSHOT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : null;
}

function safeParse<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// POST /api/support/ticket — file a bug (multipart FormData from SupportPanel).
export async function POST(request: Request) {
  // Pre-launch this is open to signed-out visitors; they file as the guest
  // reporter (see resolveReporter) and are rate-limited per IP instead of
  // per account.
  const session = await auth();
  const limit = await checkRateLimit({
    scope: "support-ticket",
    identity: `${session?.user?.email ?? "guest"}:${getClientIp(request)}`,
    limit: 20,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const message = (form.get("message") as string | null)?.trim() ?? "";
  if (!message) {
    return NextResponse.json({ error: "Describe the bug first." }, { status: 400 });
  }
  const expected = (form.get("expected") as string | null)?.trim() || null;

  // Page URL: prefer the explicit field from the client, fall back to referer.
  // Both are reporter-supplied and both become an =HYPERLINK on the operators'
  // triage board, so both go through keepOwnOriginUrl - a URL on someone else's
  // host is reduced to its path rather than left as a link off our own board.
  const metadata = safeParse<Record<string, unknown>>(form.get("client_metadata"), {});
  const requestHost = request.headers.get("host");
  const url = keepOwnOriginUrl(
    (typeof metadata.url === "string" && metadata.url) || request.headers.get("referer"),
    requestHost,
  );
  if (typeof metadata.url !== "string" && url) metadata.url = url;
  // Absolute URL (incl. origin) for the clickable Sheet link.
  const fullUrl =
    keepOwnOriginUrl(
      (typeof metadata.fullUrl === "string" && metadata.fullUrl) ||
        request.headers.get("referer"),
      requestHost,
    ) || url;

  const screenshotEntry = form.get("screenshot");
  let screenshot: Buffer | null = null;
  if (screenshotEntry && typeof screenshotEntry !== "string") {
    if (!SCREENSHOT_TYPES.has(screenshotEntry.type)) {
      return NextResponse.json(
        { error: "Screenshot must be a JPG, PNG, or WEBP image." },
        { status: 400 },
      );
    }
    if (screenshotEntry.size > SCREENSHOT_MAX_BYTES) {
      return NextResponse.json(
        { error: "Screenshot must be 5 MB or smaller." },
        { status: 400 },
      );
    }
    const ab = await screenshotEntry.arrayBuffer();
    screenshot = Buffer.from(ab);
  }

  try {
    const result = await createSupportTicket(
      {
        message,
        expected,
        url,
        fullUrl,
        screenshot,
        consoleLogs: safeParse<ConsoleEntry[]>(form.get("console_logs"), []),
        networkErrors: safeParse<NetworkEntry[]>(form.get("network_errors"), []),
        annotations: safeParse<Annotation[]>(form.get("annotations"), []),
        clientMetadata: metadata,
        ipAddress: clientIp(request),
      },
      session,
    );
    return NextResponse.json({ success: true, ticketId: result.ticketRef });
  } catch (error) {
    console.error("[support] create ticket failed:", error);
    return NextResponse.json({ error: "Couldn't save the report." }, { status: 500 });
  }
}

// GET /api/support/ticket?url=<pathname> — open bugs for a page (the checklist).
export async function GET(request: Request) {
  // Operators only. A ticket carries the reporter's name and their free-text
  // account of what broke; this used to answer any anonymous caller. Reporting
  // (POST) stays open on purpose - see canTriageSupportTickets.
  if (!(await canTriageSupportTickets())) {
    return NextResponse.json({ bugs: [] }, { status: 403 });
  }

  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ bugs: [] });
  }

  try {
    const bugs = await listOpenBugsForUrl(url);
    return NextResponse.json({ bugs });
  } catch (error) {
    console.error("[support] list bugs failed:", error);
    return NextResponse.json({ error: "Couldn't load bugs." }, { status: 500 });
  }
}
