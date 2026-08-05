import { redirect } from "next/navigation";
import { auth, isAdminEmail } from "@/auth";
import { getProfileStatus } from "@/lib/event-repository";
import { safeNext } from "@/lib/safe-next";

export const metadata = {
  title: "Signing you in…",
};

type PostLoginPageProps = {
  searchParams?: Promise<{ next?: string; portal?: string }>;
};

export default async function PostLoginPage({ searchParams }: PostLoginPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/post-login");
  }

  const params = await searchParams;
  const explicitNext = safeNext(params?.next);

  // Admins DEFAULT to /admin, but an explicit deep link still wins. This used
  // to redirect unconditionally, which meant an admin who tapped an event link
  // in an email and signed in landed on the console with the event gone - and
  // the team dogfoods as attendees constantly. A plain sign-in (no ?next=)
  // still opens the console, which is what the rule was actually protecting.
  if (isAdminEmail(session.user.email)) {
    redirect(explicitNext ?? "/admin");
  }

  const status = await getProfileStatus(session);

  // A brand-new attendee must finish onboarding before any deep link - a fresh
  // Google signup off /discover was otherwise handed straight back to /discover
  // and never saw the form.
  //
  // Host routes are exempt, and the old exemption didn't go far enough: it let
  // through anyone who ALREADY had a merchant_profiles row, which is precisely
  // the people who no longer need it. A brand-new host has neither flag, so
  // "apply to host" put five screens of attendee profile - birth date, dating
  // intents, interest tags, photo - in front of a bar owner before they could
  // type their trading name. Nothing is lost by letting them past: the host
  // application collects its own contact details, and booking stays gated
  // server-side by assertBookingEligible whatever this page decides.
  const isHostRoute = !!explicitNext && explicitNext.startsWith("/merchant");
  if (explicitNext && (status.onboardingComplete || status.merchantProfile || isHostRoute)) {
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
    // A host-only account never fills in the attendee profile, so this branch
    // used to trap every pending, rejected and suspended host in the attendee
    // form on EVERY login - the approved-only check above let them fall right
    // into it. /merchant self-routes them to the right holding page.
    if (status.merchantProfile) {
      redirect("/merchant");
    }

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
