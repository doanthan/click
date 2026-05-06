import { auth } from "@/auth";
import { updateSession } from "@/utils/supabase/middleware";
import type { NextRequest } from "next/server";

export const proxy = auth((request) => updateSession(request as NextRequest));

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
