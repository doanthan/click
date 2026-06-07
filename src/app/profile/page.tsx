import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LinkButton, Pill } from "@/components/click-ui";
import { getConfirmedEvents, getOwnProfile } from "@/lib/event-repository";

export const metadata = {
  title: "Your profile | Click",
};

export default async function OwnProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/profile");
  }

  const [profile, confirmed] = await Promise.all([
    getOwnProfile(session),
    getConfirmedEvents(session),
  ]);

  if (!profile) {
    redirect("/onboarding");
  }

  const pastEvents = confirmed.past;

  const initials = profile.displayName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Fall back to the OAuth provider photo (same source the header uses) when we
  // haven't rehosted an avatar yet — otherwise a user with a Google/Facebook
  // picture sees initials here while the header shows their real photo.
  const avatarUrl = profile.photoUrl ?? session.user.image ?? null;

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-5">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={profile.displayName}
                width={96}
                height={96}
                className="size-20 shrink-0 rounded-2xl border-2 border-[color:var(--line)] object-cover hard-shadow-sm sm:size-24"
              />
            ) : (
              <span className="grid size-20 shrink-0 place-items-center rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--peach)] font-display text-2xl font-bold text-[color:var(--surface-deep)] hard-shadow-sm sm:size-24">
                {initials || "·"}
              </span>
            )}
            <div>
              <span className="sticker sticker--peach tilt-l-2 inline-flex">
                <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
                Your profile
              </span>
              <h1 className="mt-6 font-display text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
                {profile.displayName}
              </h1>
            </div>
          </div>
          <LinkButton href="/profile/edit">Edit profile</LinkButton>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-[1fr_2fr]">
          <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
            <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              Details
            </span>
            <dl className="mt-4 space-y-3 text-sm font-semibold text-[color:var(--ink)]">
              <Row label="Suburb" value={profile.suburb ?? "—"} />
              <Row label="City" value={profile.city} />
              <Row label="Age" value={profile.age?.toString() ?? "—"} />
              <Row label="Attended" value={`${profile.attendedCount} events`} />
            </dl>
          </div>

          <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm md:col-start-1">
            <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              Privacy
            </span>
            <p className="mt-2 text-xs font-semibold leading-5 text-[color:var(--mauve)]">
              Control what other Click members can see about you — suburb,
              attendance count and more — from{" "}
              <Link
                href="/account-settings?tab=privacy"
                className="font-bold text-[color:var(--ink)] underline decoration-2 underline-offset-4 hover:text-[color:var(--rose)]"
              >
                Privacy settings
              </Link>
              .
            </p>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
              <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                Bio
              </span>
              <p className="mt-3 text-base font-medium leading-7 text-[color:var(--ink)]">
                {profile.bio ?? "No bio yet — tell others why you’re on Click."}
              </p>
            </div>

            <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
              <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                Intents
              </span>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.intents.length > 0 ? (
                  profile.intents.map((intent) => <Pill key={intent} tone="peach">{intent}</Pill>)
                ) : (
                  <p className="text-sm font-medium text-[color:var(--mauve)]">
                    No intents selected. Update from{" "}
                    <Link
                      href="/profile/edit"
                      className="font-bold text-[color:var(--ink)] underline decoration-2 underline-offset-4 hover:text-[color:var(--rose)]"
                    >
                      Edit profile
                    </Link>
                    .
                  </p>
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
                  <p className="text-sm font-medium text-[color:var(--mauve)]">
                    No interest tags yet. Add some from{" "}
                    <Link
                      href="/onboarding"
                      className="font-bold text-[color:var(--ink)] underline decoration-2 underline-offset-4 hover:text-[color:var(--rose)]"
                    >
                      Onboarding
                    </Link>
                    .
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
            Event history
          </span>
          <h2 className="mt-2 font-display text-3xl font-light leading-tight">
            Events you’ve been to.
          </h2>
          {pastEvents.length > 0 ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {pastEvents.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4 hard-shadow-sm hover:bg-[color:var(--peach)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-display text-xl font-light leading-tight text-[color:var(--ink)]">
                        {event.title}
                      </span>
                      <span className="mt-1 block font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                        {event.date} · {event.suburb ?? event.location}
                      </span>
                    </span>
                    <Pill tone="cream">Attended</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6 text-sm font-medium leading-6 text-[color:var(--mauve)]">
              No past events yet. Once you’ve been to a Click event it’ll show up
              here as part of your history.
            </p>
          )}
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
