import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Pill } from "@/components/click-ui";
import { ProfileSafetyControls } from "@/components/profile-safety-controls";
import { VerifiedTick } from "@/components/verified-tick";
import { formatIntent } from "@/lib/click-data";
import { getOwnProfile, getPublicProfileById, getSafetyState } from "@/lib/event-repository";

export const metadata = {
  title: "Profile | Click",
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
  const safetyState =
    session?.user && !isOwnProfile ? await getSafetyState(session, userId) : null;

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-4xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          Profile
        </span>
        <div className="mt-6 flex items-center gap-5">
          {profile.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photoUrl}
              alt={profile.displayName}
              className="size-24 shrink-0 rounded-full border-2 border-[color:var(--line)] object-cover hard-shadow-sm sm:size-28"
            />
          ) : (
            <div className="grid size-24 shrink-0 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] font-display text-4xl font-semibold text-[color:var(--surface-deep)] hard-shadow-sm sm:size-28">
              {profile.displayName
                .split(/\s+/)
                .map((w) => w[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase() || "·"}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-5xl font-bold leading-[0.96] tracking-[-0.025em] sm:text-6xl">
              {profile.displayName}
              {profile.verified ? <VerifiedTick className="ml-3 text-3xl sm:text-4xl" /> : null}
            </h1>
            <p className="mt-3 text-sm font-mono font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              {profile.suburb ?? profile.city}
            </p>
          </div>
        </div>

        {isOwnProfile ? (
          <Link
            href="/profile/edit"
            className="mt-5 inline-flex items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
          >
            Edit profile
          </Link>
        ) : null}

        {!session?.user ? (
          <p className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-4 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            Sign in to Click on this person at events you both attend.
          </p>
        ) : null}

        {safetyState ? (
          <ProfileSafetyControls profileId={userId} state={safetyState} />
        ) : null}

        <div className="mt-10 grid gap-6 md:grid-cols-[1fr_2fr]">
          <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
            <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              At a glance
            </span>
            <dl className="mt-4 space-y-3 text-sm font-semibold">
              <Row label="Suburb" value={profile.suburb ?? "—"} />
              <Row label="Age" value={profile.age?.toString() ?? "—"} />
              <Row label="Attended" value={`${profile.attendedCount} events`} />
            </dl>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
              <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                Bio
              </span>
              <p className="mt-3 text-base font-medium leading-7 text-[color:var(--ink)]">
                {profile.bio ?? "This person hasn’t written a bio yet."}
              </p>
            </div>

            {profile.prompts.map((prompt) => (
              <div
                key={prompt.id}
                className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm"
              >
                <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                  {prompt.label}…
                </span>
                <p className="mt-3 font-display text-2xl font-semibold leading-snug text-[color:var(--ink)]">
                  {prompt.answer}
                </p>
              </div>
            ))}

            <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
              <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                Looking for
              </span>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.intents.length > 0 ? (
                  profile.intents.map((intent) => (
                    <Pill key={intent} tone="peach">{formatIntent(intent)}</Pill>
                  ))
                ) : (
                  <p className="text-sm font-medium text-[color:var(--mauve)]">Not specified.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
              <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                Interests
              </span>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.interests.length > 0 ? (
                  profile.interests.map((tag) => <Pill key={tag.slug} tone="cream">{tag.label}</Pill>)
                ) : (
                  <p className="text-sm font-medium text-[color:var(--mauve)]">No tags yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {profile.galleryPhotos.length > 0 ? (
          <div className="mt-10">
            <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              Photos
            </span>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {profile.galleryPhotos.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={`Photo of ${profile.displayName}`}
                  className="aspect-[4/5] w-full rounded-2xl border-2 border-[color:var(--line)] object-cover hard-shadow-sm"
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-[color:var(--line-soft)] pb-2">
      <dt className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {label}
      </dt>
      <dd className="text-sm font-bold text-[color:var(--ink)]">{value}</dd>
    </div>
  );
}
