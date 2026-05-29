import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Pill } from "@/components/click-ui";
import { getOwnProfile, getPublicProfileById } from "@/lib/event-repository";

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

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-4xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          Profile
        </span>
        <h1 className="mt-6 font-display text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
          {profile.displayName}
        </h1>
        <p className="mt-3 text-sm font-mono font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          {profile.suburb ?? profile.city}
        </p>

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

            <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
              <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                Looking for
              </span>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.intents.length > 0 ? (
                  profile.intents.map((intent) => <Pill key={intent} tone="peach">{intent}</Pill>)
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
