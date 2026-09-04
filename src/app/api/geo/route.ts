import { NextResponse } from "next/server";

// Geo-IP lookup proxied through our own origin.
//
// The browser used to call `https://ipapi.co/json/` directly, but that domain
// is on the block-lists baked into privacy/tracker-blocking extensions
// (uBlock, Ghostery, Brave Shields, …). Those extensions monkey-patch
// `window.fetch` and reject the request with `TypeError: Failed to fetch`,
// which popped the Next dev overlay. Fetching a same-origin path instead means
// the extension never sees a tracker domain, so the request goes through.
//
// ipapi geo-locates the *caller's* IP, so when proxying we must forward the
// real client IP (`<ip>/json/`) - otherwise ipapi would resolve our server's
// location for every visitor. When we can't determine a public client IP
// (local dev, loopback), fall back to the token-less `json/` form so ipapi
// uses the outbound connection's IP.

export const runtime = "nodejs";
// Geo varies per client IP; never cache the upstream response.
export const dynamic = "force-dynamic";

function firstPublicIp(forwarded: string | null): string | null {
  if (!forwarded) return null;
  for (const raw of forwarded.split(",")) {
    const ip = raw.trim();
    if (!ip) continue;
    // Skip loopback / private / link-local ranges - ipapi rejects them.
    if (
      ip === "::1" ||
      ip.startsWith("127.") ||
      ip.startsWith("10.") ||
      ip.startsWith("192.168.") ||
      ip.startsWith("169.254.") ||
      ip.startsWith("fc") ||
      ip.startsWith("fd") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    ) {
      continue;
    }
    return ip;
  }
  return null;
}

export async function GET(request: Request) {
  const headers = request.headers;
  const clientIp =
    firstPublicIp(headers.get("x-forwarded-for")) ??
    firstPublicIp(headers.get("x-real-ip"));

  const upstream = clientIp
    ? `https://ipapi.co/${encodeURIComponent(clientIp)}/json/`
    : "https://ipapi.co/json/";

  try {
    const res = await fetch(upstream, {
      headers: { "User-Agent": "click-event/1.0" },
      // Don't let a slow upstream hang the request indefinitely.
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: true },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const data = (await res.json()) as Record<string, unknown>;

    // ipapi signals lookup failures with `{ error: true, reason: "..." }`
    // and HTTP 200; surface that as an error so the client falls back cleanly.
    if (data.error) {
      return NextResponse.json(
        { error: true },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: true },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
