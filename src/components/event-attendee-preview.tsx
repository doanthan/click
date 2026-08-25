import Link from "next/link";
import type { EventAttendeePreviewRow } from "@/lib/event-repository";
import { Avatar, AvatarStack, Icon, TagRow } from "./ds";

/**
 * "Who's going" - the DS event-detail attendee surface.
 *
 * LOCKED (not going yet): a COMPACT aggregate only - an avatar cluster + count,
 * then aggregate social-proof lines that lead with "A few people you might click
 * with are going". Never names, never photos, a floor of 3 so no line can
 * identify anyone.
 *
 * UNLOCKED (booked): a calm grid where the WHOLE card opens the profile (a quiet
 * chevron signals it) - first name + up to 3 shared interest tags, no life tags,
 * no age. "Open to dating" is shown only under a mutual opt-in, so it never
 * appears here on a named attendee.
 */
export function EventAttendeePreview({
  items,
  totalConfirmed,
  isAuthenticated,
  viewerIsAttendee,
  eventSlug,
  viewerOpenToDating = false,
}: {
  items: EventAttendeePreviewRow[];
  totalConfirmed: number;
  isAuthenticated: boolean;
  viewerIsAttendee: boolean;
  eventSlug: string;
  // Dating signals are MUTUAL opt-in everywhere else in the app - a friends-only
  // viewer never sees a dating label. This aggregate was the one place that
  // leaked "N here are open to dating" to everybody.
  viewerOpenToDating?: boolean;
}) {
  const heading = (
    <h2 className="font-display text-[1.075rem] font-semibold tracking-[-0.01em] text-[color:var(--ink)] sm:text-[1.15rem]">
      Who&apos;s going
    </h2>
  );

  // Not signed in - a count and a quiet sign-in nudge, no identities.
  if (!isAuthenticated) {
    return (
      <section>
        {heading}
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--slate)]">
          {totalConfirmed > 0
            ? `${totalConfirmed} ${totalConfirmed === 1 ? "person has" : "people have"} RSVP'd.`
            : "No one has RSVP'd yet."}{" "}
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(`/events/${eventSlug}`)}`}
            className="font-semibold text-[color:var(--purple)] hover:underline"
          >
            Log in
          </Link>{" "}
          or{" "}
          <Link
            href={`/signup?callbackUrl=${encodeURIComponent(`/events/${eventSlug}`)}`}
            className="font-semibold text-[color:var(--purple)] hover:underline"
          >
            sign up
          </Link>{" "}
          to see who&apos;s going.
        </p>
      </section>
    );
  }

  // Signed in, not going - COMPACT aggregate FOMO only (≥3 floor), no identities.
  if (!viewerIsAttendee) {
    const interestCounts = new Map<string, number>();
    let datingCount = 0;
    for (const p of items) {
      if (p.datingMinded) datingCount += 1;
      for (const interest of p.sharedInterests) {
        interestCounts.set(interest, (interestCounts.get(interest) ?? 0) + 1);
      }
    }
    const signals: string[] = [];
    const topShared = Array.from(interestCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topShared && topShared[1] >= 3) {
      signals.push(
        `A few people you might click with are going - at least ${topShared[1]} also like ${topShared[0]}`,
      );
    }
    if (viewerOpenToDating && datingCount >= 3) {
      signals.push(`At least ${datingCount} here are open to dating`);
    }

    return (
      <section>
        {heading}
        <div className="mt-3 rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-4">
          {totalConfirmed >= 3 && items.length > 0 ? (
            <AvatarStack
              people={items.slice(0, 5).map(() => ({}))}
              max={5}
              size={30}
              label={`${totalConfirmed} going`}
            />
          ) : (
            <p className="text-sm text-[color:var(--slate)]">
              {totalConfirmed > 0
                ? `${totalConfirmed} ${totalConfirmed === 1 ? "person is" : "people are"} going. RSVP to see who.`
                : "Be the first to RSVP."}
            </p>
          )}
          {signals.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {signals.map((s) => (
                <li key={s} className="flex items-start gap-2 text-[13px] text-[color:var(--ink-soft)]">
                  <Icon name="users" size={14} className="mt-0.5 text-[color:var(--purple)]" />
                  {s}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-[color:var(--slate)]">
          <Icon name="lock" size={13} className="mt-0.5" />
          Clicking is anonymous - we&apos;ll only show you if it&apos;s mutual.
        </p>
      </section>
    );
  }

  // Going, but empty roster.
  if (totalConfirmed === 0) {
    return (
      <section>
        {heading}
        <div className="mt-3 rounded-[var(--radius-lg)] bg-[color:var(--lav-bg)] px-5 py-6 text-center">
          <p className="text-sm leading-relaxed text-[color:var(--ink-soft)]">
            Be the first in. Everyone who RSVPs shows up here once a couple are going.
          </p>
        </div>
      </section>
    );
  }

  // Going - the unlocked attendee grid. Whole card opens the profile.
  const remaining = Math.max(0, totalConfirmed - items.length);
  return (
    <section>
      {heading}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((p) => (
          <Link
            key={p.profileId}
            href={`/profile/${p.profileId}`}
            className="relative flex items-start gap-3 rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-4 pr-9 transition-colors hover:bg-[color:var(--lavender-100)]"
          >
            <Icon name="chevR" size={16} stroke={2} className="absolute top-4 right-3 text-[color:var(--ink-faint)]" />
            <Avatar name={p.displayName} src={p.photoUrl} size={44} />
            <div className="min-w-0 flex-1">
              <span className="font-display block truncate text-[15px] font-semibold text-[color:var(--ink)]">
                {p.displayName.split(" ")[0]}
              </span>
              {p.sharedInterests.length > 0 ? (
                <div className="mt-1.5">
                  <TagRow tags={p.sharedInterests} max={3} budget={200} />
                </div>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
      {remaining > 0 ? (
        <p className="mt-3 text-[13px] font-medium text-[color:var(--slate)]">
          + {remaining} more going
        </p>
      ) : null}
    </section>
  );
}
