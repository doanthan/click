import { redirect } from "next/navigation";
import { auth, isAdminEmail } from "@/auth";
import { getProfileStatus } from "@/lib/event-repository";
import { safeNext } from "@/lib/safe-next";

export const metadata = {
  title: "Signing you in… | Click",
};

type PostLoginPageProps = {
  searchParams?: Promise<{ next?: string; portal?: string }>;
};

export default async function PostLoginPage({ searchParams }: PostLoginPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/post-login");
  }

  // Admins always go to /admin, even if a deep-link callback (?next=…) tried
  // to send them somewhere else. This runs before the explicit-next branch so
  // an admin who clicked a "Log in" link off, say, /events/foo still lands on
  // the admin console.
  if (isAdminEmail(session.user.email)) {
    redirect("/admin");
  }

  const params = await searchParams;
  const status = await getProfileStatus(session);

  // A brand-new attendee must finish onboarding before any deep link - a fresh
  // Google signup off /discover was otherwise handed straight back to /discover
  // and never saw the form. Merchants keep their deep links: merchant signup
  // never writes profiles.suburb, so onboardingComplete is false for every
  // host-only account and gating them here would trap them in the attendee flow.
  const explicitNext = safeNext(params?.next);
  if (explicitNext && (status.onboardingComplete || status.merchantProfile)) {
    redirect(explicitNext);
  }

  // Logins that started on the merchant surface (/merchant/login passes
  // ?portal=merchant) land on the host portal - /merchant itself gates
  // pending/non-merchants onto the right holding page.
  if (params?.portal === "merchant") {
    redirect("/merchant");
  }

  // Role-aware default (bug board #138): a user whose MAIN role is host - i.e.
  // they hold an approved merchant profile - defaults straight to the host
  // dashboard. /merchant runs its own onboarding/payout gating from there, and
  // dual-role users can still switch to the attendee side from the header menu.
  // Everyone else (attendees, and pending/rejected merchants who aren't active
  // hosts yet) lands on the attendee dashboard after onboarding.
  if (status.merchantProfile?.verification_status === "approved") {
    redirect("/merchant");
  }

  if (!status.onboardingComplete) {
    // Carry the deep link THROUGH onboarding rather than dropping it. A visitor
    // who tapped RSVP on an event, signed up, and finished the form used to land
    // on /dashboard with no RSVP and no way back to the event that brought them.
    redirect(
      explicitNext
        ? `/onboarding?next=${encodeURIComponent(explicitNext)}`
        : "/onboarding",
    );
  }

  redirect("/dashboard");
}
