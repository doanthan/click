import { NextResponse } from "next/server";
import {
  TEST_SWITCHER_COOKIE,
  isTestSwitcherConfigured,
  testSwitcherKeyMatches,
} from "@/lib/test-switcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /qa-unlock?key=<TEST_SWITCHER_KEY> - show the persona switcher on this browser.
// GET /qa-unlock?lock=1                  - hide it again.
//
// Every other shape 404s, including a wrong key and a deployment with no key
// configured, so the route never confirms that QA mode exists here.
//
// The cookie is set on the redirect response itself rather than through
// cookies().set() + redirect(), so there is no question about whether the
// mutation survives the thrown redirect.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const home = new URL("/", request.url);

  if (params.get("lock")) {
    const response = NextResponse.redirect(home);
    response.cookies.delete(TEST_SWITCHER_COOKIE);
    return response;
  }

  const key = params.get("key") ?? "";
  if (!isTestSwitcherConfigured() || !testSwitcherKeyMatches(key)) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  // The cookie value IS the key, re-verified against the env var on every gated
  // request - so clearing TEST_SWITCHER_KEY in Vercel revokes every cookie
  // already issued, with no deploy and nothing to clean up in browsers.
  const response = NextResponse.redirect(home);
  response.cookies.set(TEST_SWITCHER_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
