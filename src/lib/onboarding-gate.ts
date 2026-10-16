import { redirect } from "next/navigation";
import type { ProfileStatus } from "./event-repository";

// The user-mode homes: where the header's Attendee switch lands (/dashboard) and
// the Click page. 01 §1.4: switching into user mode without finishing user
// onboarding routes to /onboarding, whatever other role the account holds.
const USER_MODE_HOMES = new Set(["/dashboard", "/people"]);

/**
 * Bug board #328. /post-login sends a member who has not finished onboarding
 * to /onboarding once, at sign-in, and nothing after that did. Leaving the form
 * (Back, the wordmark, a typed address) and reloading landed a fresh Google
 * signup on the member pages with no postcode and no birth date. Every member
 * page now runs this on the status it already reads - getProfileStatus is
 * memoised per request, so it costs no extra query.
 *
 * "Finished" is member_onboarded_at (01 §1.4): the flow was completed, not just
 * step 1 saved. A failed read (`degraded`) lets them through rather than sending
 * an established member back to step one. A host account is let past on the
 * browse pages - the attendee profile is not what they signed up to fill in -
 * but not on the user-mode homes, which is where switching to user mode lands.
 * Booking stays gated by assertBookingEligible either way.
 */
export function redirectIfNotOnboarded(status: ProfileStatus | null, here: string) {
  if (!status?.exists || status.onboardingComplete || status.degraded) return;
  if (status.merchantProfile && !USER_MODE_HOMES.has(here)) return;
  redirect(`/onboarding?next=${encodeURIComponent(here)}`);
}
