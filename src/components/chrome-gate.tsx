"use client";

import { usePathname } from "next/navigation";

/**
 * Hides the global site chrome (header, app nav, mobile bottom bar, footer) on
 * routes that own their whole surface.
 *
 * Two reasons, and the second one is the important one:
 *
 * 1. Every auth surface already draws its own wordmark (AuthShell, and the
 *    onboarding form's header), so the global header stacked a second logo
 *    directly above the first.
 * 2. /onboarding is a required STEP, not a page. Rendering the app nav over the
 *    top of it made it a suggestion: a brand-new signup could tap "Discover"
 *    and go book an event having never given a postcode or a birth date. The
 *    server-side gate in assertBookingEligible is the real enforcement, but a
 *    form you can visibly walk out of is a bad form regardless.
 *
 * Matching is exact-or-child so /login and /auth/email/verify are both covered
 * without swallowing unrelated siblings.
 *
 * Only routes that draw their OWN wordmark belong here. /merchant/login and
 * /forgot-password draw none, so dropping the header would leave them with no
 * branding and no way back to the site - they keep the global bar.
 */
const CHROMELESS_ROUTES = [
  "/login",
  "/register",
  // Bare redirect to /register - listed so the flash before it resolves matches.
  "/signup",
  "/onboarding",
  "/auth/email/verify",
];

export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chromeless = CHROMELESS_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (chromeless) return null;
  return <>{children}</>;
}
