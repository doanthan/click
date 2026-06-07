import Link from "next/link";
import Image from "next/image";
import type { EventAttendeePreviewRow } from "@/lib/event-repository";

export function EventAttendeePreview({
  items,
  totalConfirmed,
  isAuthenticated,
  viewerIsAttendee,
  eventSlug,
}: {
  items: EventAttendeePreviewRow[];
  totalConfirmed: number;
  isAuthenticated: boolean;
  viewerIsAttendee: boolean;
  eventSlug: string;
}) {
  // Who's-clicked-in is an attendees-only signal — anonymous visitors get a
  // count + sign-in nudge rather than the actual people.
  if (!isAuthenticated) {
    return (
      <section className="mt-6 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-5">
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          Who&apos;s clicked in
        </p>
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          {totalConfirmed > 0
            ? `${totalConfirmed} ${totalConfirmed === 1 ? "person has" : "people have"} clicked into this event.`
            : "No one has clicked in yet."}{" "}
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(`/events/${eventSlug}`)}`}
            className="font-bold text-[color:var(--ink)] underline hover:text-[color:var(--mauve)]"
          >
            Log in
          </Link>{" "}
          or{" "}
          <Link
            href={`/signup?callbackUrl=${encodeURIComponent(`/events/${eventSlug}`)}`}
            className="font-bold text-[color:var(--ink)] underline hover:text-[color:var(--mauve)]"
          >
            sign up
          </Link>{" "}
          to see who&apos;s going.
        </p>
      </section>
    );
  }

  // Signed in but not going yet — the roster (identities) is reserved for people
  // who've actually clicked in, but we DO surface anonymous FOMO signals
  // (shared interests + dating-minded counts) to entice an RSVP without outing
  // anyone. Derived from the per-attendee overlap already computed vs the viewer.
  if (!viewerIsAttendee) {
    // Tally how many of the shown attendees share each interest with the viewer.
    const interestCounts = new Map<string, number>();
    let datingCount = 0;
    for (const p of items) {
      if (p.datingMinded) datingCount += 1;
      for (const interest of p.sharedInterests) {
        interestCounts.set(interest, (interestCounts.get(interest) ?? 0) + 1);
      }
    }
    const topShared = Array.from(interestCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const hasSignals = topShared.length > 0 || datingCount > 0;

    return (
      <section className="mt-6 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-5">
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          Who&apos;s clicked in
        </p>
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          {totalConfirmed > 0
            ? `${totalConfirmed} ${totalConfirmed === 1 ? "person has" : "people have"} clicked into this event. RSVP to see who's going.`
            : "No one has clicked in yet. RSVP to be the first."}
        </p>
        {hasSignals ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {topShared.map(([interest, count]) => (
              <li
                key={interest}
                className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-3 py-1 text-[0.72rem] font-bold text-[color:var(--surface-deep)]"
              >
                ✷ {count} {count === 1 ? "person" : "people"} going also like{" "}
                {interest}
              </li>
            ))}
            {datingCount > 0 ? (
              <li className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-3 py-1 text-[0.72rem] font-bold text-[color:var(--surface-deep)]">
                ✷ {datingCount} {datingCount === 1 ? "person" : "people"} here open
                to dating
              </li>
            ) : null}
          </ul>
        ) : null}
      </section>
    );
  }

  if (totalConfirmed === 0) {
    return (
      <section className="mt-6 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-5">
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          Who&apos;s clicked in
        </p>
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Be the first to RSVP. The people who&apos;ve clicked into this event
          show up here once a couple are in.
        </p>
      </section>
    );
  }

  const remaining = Math.max(0, totalConfirmed - items.length);

  return (
    <section className="mt-6 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
      <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        Who&apos;s clicked in · {totalConfirmed}
      </p>
      <ul className="mt-3 flex flex-wrap items-center gap-3">
        {items.map((p) => {
          const initials = p.displayName
            .split(/\s+/)
            .map((s) => s[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase();
          return (
            <li
              key={p.profileId}
              className="flex flex-col gap-2 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-3 hard-shadow-sm"
            >
              <Link
                href={`/profile/${p.profileId}`}
                className="group flex items-center gap-2 text-xs font-bold text-[color:var(--ink)]"
                title={p.displayName}
              >
                {p.photoUrl ? (
                  <Image
                    src={p.photoUrl}
                    alt=""
                    width={28}
                    height={28}
                    className="size-7 rounded-full border-2 border-[color:var(--line)] object-cover"
                  />
                ) : (
                  <span className="grid size-7 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] text-[0.65rem] font-bold text-[color:var(--surface-deep)]">
                    {initials || "·"}
                  </span>
                )}
                <span className="font-mono text-[0.7rem] uppercase tracking-wide group-hover:underline">
                  {p.displayName.split(" ")[0]}
                </span>
                {p.datingMinded ? (
                  <span
                    title="Open to dating"
                    className="ml-auto rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-[color:var(--surface-deep)]"
                  >
                    ✷ Dating
                  </span>
                ) : null}
              </Link>
              {p.sharedInterests.length > 0 ? (
                <p className="text-[0.7rem] font-semibold leading-4 text-[color:var(--mauve)]">
                  <span className="font-mono uppercase tracking-wide text-[color:var(--rose)]">
                    Shared·{" "}
                  </span>
                  {p.sharedInterests.slice(0, 4).join(" · ")}
                </p>
              ) : null}
            </li>
          );
        })}
        {remaining > 0 ? (
          <li className="grid size-12 place-items-center rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] text-xs font-bold text-[color:var(--mauve)]">
            +{remaining}
          </li>
        ) : null}
      </ul>
    </section>
  );
}
