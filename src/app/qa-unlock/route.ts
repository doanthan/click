import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  TEST_SWITCHER_COOKIE,
  isTestSwitcherConfigured,
  mintAdminUnlockCookie,
  testSwitcherCookieOptions,
  testSwitcherKeyMatches,
} from "@/lib/test-switcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /qa-unlock?key=<TEST_SWITCHER_KEY> - show the persona switcher on this browser.
// GET /qa-unlock                         - same, for a signed-in ADMIN_EMAILS address.
// GET /qa-unlock?lock=1                  - hide it again.
//
// Every other shape 404s - a wrong key, a deployment with no key configured,
// and a signed-out or non-admin caller alike - so the route never confirms to a
// stranger that QA mode exists here.
//
// The cookie is set on the redirect response itself rather than through
// cookies().set() + redirect(), so there is no question about whether the
// mutation survives the thrown redirect.

// `back` is an enum, never a URL. The admin entry point lives on
// /admin/system, and it would be an open redirect to let the caller name where
// they land just so that button can return there.
function destination(request: Request, back: string | null) {
  return new URL(back === "admin" ? "/admin/system" : "/", request.url);
}

function notFound() {
  // Status and logic unchanged - still a flat 404 for a wrong key, an
  // unconfigured deployment and a caller who may not be granted an unlock
  // alike, so the route still never confirms QA mode exists here.
  //
  // The BODY is new, and only because this route is now a redirect target:
  // assertTestSwitcherUnlocked sends a lapsed QA session here, and a 404 with a
  // null body renders as the browser's own network-error screen, which reads as
  // "the site is broken" rather than "that link is dead". The copy is generic
  // on purpose - it adds no information a 404 did not already carry.
  return new NextResponse(
    "<!doctype html><meta charset=utf-8><title>Not found</title>" +
      "<p style=\"font:16px system-ui;margin:3rem auto;max-width:34rem;text-align:center\">" +
      "Not found. <a href=\"/\">Go back to Click</a>.</p>",
    {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
    },
  );
}

function unlockedResponse(request: Request, back: string | null, cookieValue: string) {
  const response = NextResponse.redirect(destination(request, back));
  response.cookies.set(TEST_SWITCHER_COOKIE, cookieValue, testSwitcherCookieOptions());
  return response;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const back = params.get("back");

  if (params.get("lock")) {
    const response = NextResponse.redirect(destination(request, back));
    response.cookies.delete(TEST_SWITCHER_COOKIE);
    return response;
  }

  const key = params.get("key") ?? "";
  if (key) {
    // The cookie value IS the key, re-verified against the env var on every
    // gated request - so clearing TEST_SWITCHER_KEY in Vercel revokes every
    // cookie already issued, with no deploy and nothing to clean up in browsers.
    if (!isTestSwitcherConfigured() || !testSwitcherKeyMatches(key)) return notFound();
    return unlockedResponse(request, back, key);
  }

  // No key: an admin unlocks with the session they already hold. They can
  // already reach every surface the switcher hands out, so requiring a second
  // shared secret only delayed UAT on a shared secret being set in Vercel.
  // The cookie is a signed grant over their address, not a bare flag, and the
  // gate re-checks that address against ADMIN_EMAILS on every request.
  const session = await auth();
  const email = session?.user?.email ?? "";

  // mintAdminUnlockCookie returns "" for anyone who may not have one: not an
  // admin, a QA persona wearing an admin address (see adminMayUnlock - a
  // persona must never mint an unlock that outlives TEST_SWITCHER_KEY), or a
  // deployment whose AUTH_SECRET cannot sign. All three 404 identically.
  const grant = mintAdminUnlockCookie(email);
  if (!grant) return notFound();

  return unlockedResponse(request, back, grant);
}
