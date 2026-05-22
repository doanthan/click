import Link from "next/link";
import { EventCard } from "@/components/event-card";
import { Pill } from "@/components/click-ui";
import type { PublicProfile } from "@/lib/event-repository";

export function ProfileView({ profile }: { profile: PublicProfile }) {
  const firstInitial = (profile.displayName?.[0] ?? "·").toUpperCase();

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-5xl">
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div
            aria-hidden
            className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] font-display text-5xl font-light text-[color:var(--surface-deep)] hard-shadow-sm sm:h-32 sm:w-32"
          >
            {firstInitial}
          </div>
          <div>
            <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              {profile.isOwn ? "Your profile" : "Click member"}
            </p>
            <h1 className="font-display mt-2 text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
              {profile.displayName}
            </h1>
            <p className="mt-3 text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              {profile.suburb ? `${profile.suburb}, ${profile.city}` : profile.city}
            </p>
            {profile.isOwn ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/account-settings?tab=account"
                  className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-4 py-2 text-xs font-bold text-[color:var(--champagne)] hard-shadow-sm"
                >
                  Edit profile
                </Link>
                <Link
                  href="/account-settings?tab=privacy"
                  className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-xs font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                >
                  Privacy settings
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        {profile.bio ? (
          <p className="font-display mt-8 text-3xl font-light italic leading-[1.15] text-[color:var(--ink)]">
            &ldquo;{profile.bio}&rdquo;
          </p>
        ) : null}

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <article className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
            <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              Intents
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.intents.length > 0 ? (
                profile.intents.map((intent) => (
                  <Pill key={intent} tone="peach">
                    {intent}
                  </Pill>
                ))
              ) : (
                <span className="text-sm font-semibold text-[color:var(--mauve)]">
                  Not set
                </span>
              )}
            </div>
          </article>
          <article className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
            <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              Interests
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.tags.length > 0 ? (
                profile.tags.slice(0, 12).map((tag) => (
                  <Pill key={tag} tone="rose">
                    {tag}
                  </Pill>
                ))
              ) : (
                <span className="text-sm font-semibold text-[color:var(--mauve)]">
                  No tags yet
                </span>
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-5xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              {profile.isOwn ? "You went to" : "They went to"}
            </p>
            <h2 className="font-display mt-2 text-3xl font-light leading-tight">
              Recent events.
            </h2>
          </div>
          <Pill tone="cream">{profile.attendedEvents.length}</Pill>
        </div>

        {profile.attendedEvents.length > 0 ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {profile.attendedEvents.map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6">
            <p className="text-base font-bold">No events attended yet.</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
              {profile.isOwn
                ? "RSVP to anything on Events and it'll show up here."
                : "This member hasn't attended a Click event yet."}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
