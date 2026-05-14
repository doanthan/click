import { auth, isAdminEmail } from "@/auth";
import { updateSession } from "@/utils/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
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

  if (pathname.startsWith("/merchant") && !session?.user) {
    return redirectToLogin(nextRequest);
  }

  return updateSession(nextRequest);
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
