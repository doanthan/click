import { auth, isAdminEmail } from "@/auth";
import { updateSession } from "@/utils/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

function redirectToLogin(request: NextRequest, target: "customer" | "merchant" = "customer") {
  // Merchant-area routes bounce to the host login surface, not the customer
  // /login. Same NextAuth backend, different UI per spec §1.
  const loginPath = target === "merchant" ? "/merchant/login" : "/login";
  const loginUrl = new URL(loginPath, request.url);
  loginUrl.searchParams.set("callbackUrl", request.nextUrl.href);
  return NextResponse.redirect(loginUrl);
}

export const proxy = auth((request) => {
  const nextRequest = request as NextRequest;
  const pathname = nextRequest.nextUrl.pathname;
  const session = request.auth;

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    if (!isAdminEmail(session?.user?.email)) {
      return redirectToLogin(nextRequest);
    }
  }

  // /merchant/login and /merchant/signup are themselves merchant routes but
  // must NOT redirect (they're the entry points). Everything else under
  // /merchant requires a session and bounces to the host login if missing.
  if (
    pathname.startsWith("/merchant") &&
    pathname !== "/merchant/login" &&
    pathname !== "/merchant/signup" &&
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
