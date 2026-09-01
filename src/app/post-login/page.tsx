import { redirect } from "next/navigation";
import { auth, isAdminEmail } from "@/auth";
import { backfillAvatarForSession, getProfileStatus } from "@/lib/event-repository";
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

  // Rehost the OAuth provider photo, once, on the way through. This runs HERE and
  // nowhere else because it needs sharp, and sharp needs libvips, which is only
  // traced into this route and the upload/support APIs (next.config.ts). Awaiting
  // is cheap - the fetch/encode/upload is handed to after() inside the helper, so
  // it settles behind the redirect instead of delaying it. Must stay above every
  // redirect() below, since redirect() throws and would skip it.
  await backfillAvatarForSession(session);

  const params = await searchParams;
  const explicitNext = safeNext(params?.next);

  const status = await getProfileStatus(session);

  // A failed profile read reports onboardingComplete: false, and this page read
  // that as "brand-new attendee" - so a transient blip on the profiles query
  // took an existing member who has been on Click for months and dropped them
  // back at step one of the five-step wizard, on top of the profile they
  // already have. `degraded` exists precisely to tell "they have not onboarded"
  // apart from "we could not find out"; the host gates already honour it via
  // assertProfileStatusUsable, and this one did not. When we do not know, we do
  // not send anyone to onboarding: nothing is lost by letting them through for
  // one navigation, because the next clean read offers the form again and
  // booking stays gated server-side by assertBookingEligible either way.
  const needsOnboarding = !status.onboardingComplete && !status.degraded;

  // Admins DEFAULT to /admin, but an explicit deep link still wins. This used
  // to redirect unconditionally, which meant an admin who tapped an event link
  // in an email and signed in landed on the console with the event gone - and
  // the team dogfoods as attendees constantly. A plain sign-in (no ?next=)
  // still opens the console, which is what the rule was actually protecting.
  //
  // It also used to run ABOVE the profile read, which meant an ADMIN_EMAILS
  // address never once reached the onboarding branch below - and /onboarding is
  // the only writer of profiles.birth_date and profiles.age. So every admin sat
  // at age NULL forever, which sendClickInner reads directly ((age ?? 0) < 18):
  // every click they sent was refused with "add your date of birth", pointing at
  // a field no page they could reach collects. assertBookingEligible wanted the
  // same two columns, so they could not RSVP either. Being staff is not a reason
  // to hold no birth date - it is the one profile field the 18+ rule is built on.
  if (isAdminEmail(session.user.email)) {
    if (needsOnboarding) {
      // No ?next=/admin: safeNext rejects the portal roots by design, so it would
      // be stripped anyway and the form falls through to /dashboard - which is
      // the right landing for someone who just filled in an attendee profile.
      redirect(explicitNext ? `/onboarding?next=${encodeURIComponent(explicitNext)}` : "/onboarding");
    }
    redirect(explicitNext ?? "/admin");
  }

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
  if (explicitNext && (!needsOnboarding || status.merchantProfile || isHostRoute)) {
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

  if (needsOnboarding) {
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
