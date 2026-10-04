import { redirect } from "next/navigation";
import type { ProfileStatus } from "./event-repository";

/**
 * Bug board #328. /post-login sends a member who has not finished onboarding
 * to /onboarding once, at sign-in, and nothing after that did. Leaving the form
 * (Back, the wordmark, a typed address) and reloading landed a fresh Google
 * signup on the member pages with no postcode and no birth date. Every member
 * page now runs this on the status it already reads - getProfileStatus is
 * memoised per request, so it costs no extra query.
 *
 * The exemptions are /post-login's. A failed read (`degraded`) lets them
 * through rather than sending an established member back to step one, and a
 * host account is let past, because the attendee profile is not what they
 * signed up to fill in. Booking stays gated by assertBookingEligible either way.
 * "Finished" is step 1 saved (postcode + birth date): the screens after it are
 * optional, so nobody is sent back for skipping them.
 */
export function redirectIfNotOnboarded(status: ProfileStatus | null, here: string) {
  if (!status?.exists || status.onboardingComplete || status.degraded || status.merchantProfile) {
    return;
  }
  redirect(`/onboarding?next=${encodeURIComponent(here)}`);
}
