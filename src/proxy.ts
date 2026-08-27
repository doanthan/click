import { auth } from "@/auth";
import { updateSession } from "@/utils/supabase/middleware";
import { isInternalRoute, isProductionDeployment } from "@/lib/runtime-mode";
import { TEST_SWITCHER_COOKIE, testSwitcherCookieHolds } from "@/lib/test-switcher";
import { NextResponse, type NextRequest } from "next/server";

function redirectToLogin(request: NextRequest, target: "customer" | "merchant" = "customer") {
  // Merchant-area routes bounce to the host login surface, not the customer
  // /login. Same NextAuth backend, different UI per spec §1.
  const loginPath = target === "merchant" ? "/merchant/login" : "/login";
  const loginUrl = new URL(loginPath, request.url);
  // Path-relative, not .href. Every consumer of ?callbackUrl runs it through a
  // safeCallbackUrl/isSafeRelative guard that requires a leading "/" and rejects
  // "//" (login/page.tsx, register/page.tsx, login/actions.ts, auth/page.tsx),
  // so an absolute https://… URL failed the guard and silently became
  // /post-login - every deep link into a guarded route was dropped at sign-in.
  loginUrl.searchParams.set(
    "callbackUrl",
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.redirect(loginUrl);
}

export const proxy = auth((request) => {
  const nextRequest = request as NextRequest;
  const pathname = nextRequest.nextUrl.pathname;
  const session = request.auth;

  // Test harnesses and database inspection tools are never public product.
  // /test is the one production UAT exception, but only for a request carrying
  // the same live QA grant that its page and actions verify again. Do this in
  // the proxy as well: a Server Component notFound() may stream a 404 shell
  // under an already-committed HTTP 200, which leaks the route's existence and
  // fails the launch smoke contract even though it hides the workspace body.
  if (isProductionDeployment() && isInternalRoute(pathname)) {
    const qaCookie = nextRequest.cookies.get(TEST_SWITCHER_COOKIE)?.value ?? "";
    const isUnlockedWorkspace = pathname === "/test" && testSwitcherCookieHolds(qaCookie);
    if (!isUnlockedWorkspace) {
      return new NextResponse(null, {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      });
    }
  }

  // /dashboard and /admin only require a signed-in session here. Admin-specific
  // authorization is enforced in src/app/admin/layout.tsx, which renders an
  // inline "Access denied" page for logged-in non-admins instead of bouncing
  // them back to /login in a loop.
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    if (!session?.user) {
      return redirectToLogin(nextRequest);
    }
  }

  // /merchant/login and the entire /merchant/signup flow are entry points and
  // must NOT redirect to login (the signup wizard steps live under
  // /merchant/signup/{business,contact,documents} and handle their own session
  // redirect back to /merchant/signup). Everything else under /merchant
  // requires a session and bounces to the host login if missing.
  if (
    pathname.startsWith("/merchant") &&
    pathname !== "/merchant/login" &&
    !pathname.startsWith("/merchant/signup") &&
    !session?.user
  ) {
    return redirectToLogin(nextRequest, "merchant");
  }

  return updateSession(nextRequest);
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
