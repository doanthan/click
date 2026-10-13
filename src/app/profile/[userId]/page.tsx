import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ButtonLink } from "@/components/ds";
import { ProfileDetails, visibleAgeFor, visibleIntentsFor } from "@/components/profile-details";
import { ProfileSafetyControls } from "@/components/profile-safety-controls";
import {
  getOwnProfile,
  getProfileStatus,
  getPublicProfileById,
  getSafetyState,
  getViewerClickState,
} from "@/lib/event-repository";
import { redirectIfNotOnboarded } from "@/lib/onboarding-gate";

export const metadata = {
  title: "Profile",
  // robots.ts disallows /profile, but a Disallow only asks a crawler not to
  // FETCH - a page linked from elsewhere can still be indexed URL-only. These
  // pages carry a real person's name, face, suburb and dating intent, so the
  // page-level noindex is the half that actually binds.
  robots: { index: false, follow: false },
};

type PublicProfilePageProps = {
  params: Promise<{ userId: string }>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { userId } = await params;
  if (!UUID_RE.test(userId)) {
    notFound();
  }

  const session = await auth();
  const [profile, ownProfile, profileStatus] = await Promise.all([
    getPublicProfileById(userId, session),
    session?.user ? getOwnProfile(session) : Promise.resolve(null),
    session?.user ? getProfileStatus(session) : null,
  ]);

  if (!profile) {
    notFound();
  }
  redirectIfNotOnboarded(profileStatus, `/profile/${userId}`);

  const isOwnProfile = ownProfile?.id === userId;
  const [safetyState, clickState] =
    session?.user && !isOwnProfile
      ? await Promise.all([getSafetyState(session, userId), getViewerClickState(session, userId)])
      : [null, null];

  // "Open to dating" renders only for a romantically compatible viewer (the one
  // dating rule, HOTFIX 2026-10-12 H1 - getPublicProfileById computes it for
  // this session). A signed-out viewer never sees a dating label.
  const visibleIntents = visibleIntentsFor(profile);
  // "Show my age" (bug board #339): same exception; the owner always sees their
  // own.
  const visibleAge = isOwnProfile ? profile.age : visibleAgeFor(profile);

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page pt-8">
        <div className="max-w-[660px]">
          <article className="rounded-[18px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
            <ProfileDetails
              profile={{ ...profile, intents: visibleIntents, age: visibleAge }}
              headerAction={
                isOwnProfile ? (
                  <ButtonLink href="/profile/edit" size="sm" className="shrink-0">
                    Edit profile
                  </ButtonLink>
                ) : null
              }
            />
          </article>

          {/* This PAGE is read-only - no click button, ever. It is where a link
              lands from anywhere: the event page's attendee list, Your clicks, a
              shared URL. The click lives on the three click surfaces - the daily
              picks on the Click page and the dashboard, and who was there - whose
              "View profile" opens the same profile as a modal over the card, with
              that card's own click at the bottom (CHANGE BRIEF 2026-09-30 §2.4).
              The one control that stays here is the mutual hand-off below:
              nothing left to click, only a plan left to agree on. */}
          {clickState?.isMutual ? (
            <div className="mt-5">
              <ButtonLink href="/proposals" size="md">
                See your click with {profile.displayName.split(/\s+/)[0]} →
              </ButtonLink>
            </div>
          ) : null}

          {!session?.user ? (
            <p className="mt-5 text-[13px] leading-6 text-[color:var(--slate)]">
              Sign in to see who you might click with.
            </p>
          ) : null}

          {safetyState ? (
            <ProfileSafetyControls profileId={userId} state={safetyState} />
          ) : null}
        </div>
      </div>
    </main>
  );
}
