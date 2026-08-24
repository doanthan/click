import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Avatar, ButtonLink, Icon, Tag } from "@/components/ds";
import { ProfileClickButton } from "@/components/profile-click-button";
import { ProfileSafetyControls } from "@/components/profile-safety-controls";
import { VerifiedTick } from "@/components/verified-tick";
import { formatIntent } from "@/lib/click-data";
import {
  getOwnProfile,
  getPublicProfileById,
  getSafetyState,
  getViewerClickState,
} from "@/lib/event-repository";

export const metadata = {
  title: "Profile",
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
  const [profile, ownProfile] = await Promise.all([
    getPublicProfileById(userId),
    session?.user ? getOwnProfile(session) : Promise.resolve(null),
  ]);

  if (!profile) {
    notFound();
  }

  const isOwnProfile = ownProfile?.id === userId;
  const [safetyState, clickState] =
    session?.user && !isOwnProfile
      ? await Promise.all([getSafetyState(session, userId), getViewerClickState(session, userId)])
      : [null, null];

  // "Open to dating" is mutual opt-in (CLICK_LANGUAGE v14): the dating intent
  // renders only when the owner has dating mode on AND the viewer is also open
  // to dating. A friends-only or signed-out viewer never sees a dating label.
  const viewerOpenToDating = ownProfile?.datingVisible === true;
  const visibleIntents = profile.intents.filter(
    (intent) => intent !== "dating" || (profile.datingVisible && viewerOpenToDating),
  );

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page pt-8">
        <div className="max-w-[660px]">
          <article className="rounded-[18px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
            <header className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4 sm:gap-[18px]">
                <Avatar name={profile.displayName} src={profile.photoUrl} size={72} ring />
                <div className="min-w-0">
                  <h1 className="font-display text-[length:var(--text-h1)] font-semibold leading-tight tracking-[-0.02em]">
                    {profile.displayName}
                    {profile.age ? ` · ${profile.age}` : ""}
                    {profile.verified ? <VerifiedTick className="ml-2.5 text-[0.8em]" /> : null}
                  </h1>
                  <p className="mt-1.5 flex items-center gap-1.5 truncate text-[13.5px] font-medium text-[color:var(--slate)]">
                    <Icon name="pin" size={14} />
                    {profile.suburb ?? profile.city}
                    {" · "}
                    <span className="font-semibold text-[color:var(--purple)]">
                      been to {profile.attendedCount} event{profile.attendedCount === 1 ? "" : "s"}
                    </span>
                  </p>
                </div>
              </div>
              {isOwnProfile ? (
                <ButtonLink href="/profile/edit" size="sm" className="shrink-0">
                  Edit profile
                </ButtonLink>
              ) : null}
            </header>

            <Rule />

            <Section label="Bio">
              <p className="text-[16px] leading-[1.6] text-[color:var(--ink)]">
                {profile.bio ?? "No bio yet."}
              </p>
            </Section>

            <Section label="Here for">
              {visibleIntents.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {visibleIntents.map((intent) => (
                    <IntentChip key={intent}>{formatIntent(intent)}</IntentChip>
                  ))}
                </div>
              ) : (
                <Hint>Not specified.</Hint>
              )}
            </Section>

            <Section label="Into">
              {profile.interests.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((tag) => (
                    <Tag key={tag.slug}>{tag.label}</Tag>
                  ))}
                </div>
              ) : (
                <Hint>No interest tags yet.</Hint>
              )}
            </Section>

            {profile.prompts.length > 0 ? (
              <Section label="In their words">
                <div className="grid gap-4">
                  {profile.prompts.map((prompt) => (
                    <div key={prompt.id}>
                      <p className="text-[12.5px] font-semibold text-[color:var(--slate)]">
                        {prompt.label}…
                      </p>
                      <p className="font-display mt-1 text-[length:var(--text-h3)] font-semibold leading-snug tracking-[-0.01em]">
                        {prompt.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}

            {profile.galleryPhotos.length > 0 ? (
              <div>
                <p className="eyebrow mb-3">Photos</p>
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                  {profile.galleryPhotos.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt={`Photo of ${profile.displayName}`}
                      className="aspect-square w-full rounded-[12px] object-cover"
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </article>

          {clickState?.isMutual ? (
            // Already mutual: clicking again is meaningless, so the surface hands
            // over to the thing that IS still to be done - agreeing on a plan.
            <div className="mt-5">
              <ButtonLink href="/proposals" size="md">
                See your click with {profile.displayName.split(/\s+/)[0]} →
              </ButtonLink>
            </div>
          ) : clickState && !safetyState?.isBlocked ? (
            <ProfileClickButton
              profileId={userId}
              firstName={profile.displayName.split(/\s+/)[0]}
              alreadyClicked={clickState.alreadyClicked}
            />
          ) : null}

          {!session?.user ? (
            <p className="mt-5 text-[13px] leading-6 text-[color:var(--slate)]">
              Sign in to click with people at the events you both go to.
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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="eyebrow mb-3">{label}</p>
      {children}
    </div>
  );
}

function Rule() {
  return <div className="my-6 h-px bg-[color:var(--mist)]" />;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] leading-6 text-[color:var(--slate)]">{children}</p>;
}

function IntentChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center whitespace-nowrap rounded-full border border-[color:var(--lavender)] bg-[color:var(--lav-bg)] px-3 text-[13px] font-semibold leading-none text-[color:var(--ink)]">
      {children}
    </span>
  );
}
