import Link from "next/link";
import { attendeeFomoSignals } from "@/lib/attendee-fomo";
import type { EventAttendeePreviewData } from "@/lib/event-repository";
import { Avatar, AvatarStack, Icon, TagRow } from "./ds";

/**
 * "Who's going" - the DS event-detail attendee surface.
 *
 * LOCKED (not going yet): a COMPACT aggregate only - an avatar cluster + count,
 * then aggregate social-proof lines ("4 going also like Hiking") once three are
 * going - the DS floor, see attendee-fomo.ts. Never names, never photos.
 *
 * UNLOCKED (booked): the same aggregate lines, then a calm grid where the WHOLE
 * card opens the profile (a quiet chevron signals it) - first name + up to 3
 * shared interest tags, no life tags, no age. The viewer's own card leads it, and
 * a +1 their host named but who has not signed up yet sits in it as a
 * placeholder with no link. "Open to dating" is shown only under a mutual
 * opt-in, so it never appears here on a named attendee.
 */
export function EventAttendeePreview({
  preview,
  isAuthenticated,
  viewerIsAttendee,
  eventSlug,
  viewerOpenToDating = false,
}: {
  preview: EventAttendeePreviewData;
  isAuthenticated: boolean;
  viewerIsAttendee: boolean;
  eventSlug: string;
  // Dating signals are MUTUAL opt-in everywhere else in the app - a friends-only
  // viewer never sees a dating label. This aggregate was the one place that
  // leaked "N here are open to dating" to everybody.
  viewerOpenToDating?: boolean;
}) {
  const { items, totalConfirmed, viewer, guests } = preview;
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
            ? `${totalConfirmed} ${totalConfirmed === 1 ? "person is" : "people are"} going.`
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

  // The aggregate lines, for both signed-in states (bug board #236/#258): counts
  // over the whole visible room, never a name or a face.
  const signals = attendeeFomoSignals({
    confirmed: totalConfirmed,
    topSharedInterest: preview.topSharedInterest,
    datingCount: preview.datingCount,
    viewerOpenToDating,
  });
  const signalList =
    signals.length > 0 ? (
      <ul className="mt-3 flex flex-col gap-1.5">
        {signals.map((s) => (
          <li key={s} className="flex items-start gap-2 text-[13px] text-[color:var(--ink-soft)]">
            <Icon name="users" size={14} className="mt-0.5 text-[color:var(--purple)]" />
            {s}
          </li>
        ))}
      </ul>
    ) : null;

  // Signed in, not going - COMPACT aggregate only, no identities. The DS lead line
  // "A few people you might click with are going" heads it once three or more
  // share the interest.
  if (!viewerIsAttendee) {
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
          {(preview.topSharedInterest?.count ?? 0) >= 3 ? (
            <p className="mt-3 text-[13px] font-semibold text-[color:var(--ink)]">
              A few people you might click with are going
            </p>
          ) : null}
          {signalList}
        </div>
      </section>
    );
  }

  // Going (or managing it), but nobody holds a seat yet.
  if (totalConfirmed === 0 && !viewer && guests.length === 0) {
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
  const remaining = Math.max(0, totalConfirmed - items.length - guests.length - (viewer ? 1 : 0));
  const onlyViewer = viewer && items.length === 0 && guests.length === 0 && remaining === 0;
  return (
    <section>
      {heading}
      {signalList}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {viewer ? (
          <Link
            href="/profile"
            className="relative flex items-start gap-3 rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-4 pr-9 transition-colors hover:bg-[color:var(--lavender-100)]"
          >
            <Icon name="chevR" size={16} stroke={2} className="absolute top-4 right-3 text-[color:var(--ink-faint)]" />
            <Avatar name={viewer.displayName} src={viewer.photoUrl} size={44} />
            <div className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="font-display truncate text-[15px] font-semibold text-[color:var(--ink)]">
                  {viewer.displayName.split(" ")[0]}
                </span>
                <span className="shrink-0 text-[12.5px] font-medium text-[color:var(--slate)]">You</span>
              </span>
              {viewer.hiddenFromOthers ? (
                <span className="mt-1 block text-[12.5px] leading-snug text-[color:var(--slate)]">
                  Hidden from this list - only you see yourself here.
                </span>
              ) : null}
            </div>
          </Link>
        ) : null}
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
        {/* A named +1 with no account yet: nothing to open, so no link and no
            chevron. It becomes a real card once they sign up via their invite. */}
        {guests.map((g) => (
          <div
            key={g.id}
            className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-4"
          >
            <Avatar name={g.firstName} size={44} />
            <div className="min-w-0 flex-1">
              <span className="font-display block truncate text-[15px] font-semibold text-[color:var(--ink)]">
                {g.firstName}
              </span>
              <span className="mt-1 block text-[12.5px] leading-snug text-[color:var(--slate)]">
                {g.isViewersGuest
                  ? "Your guest - their card fills in once they sign up"
                  : `Guest of ${g.hostFirstName}`}
              </span>
            </div>
          </div>
        ))}
      </div>
      {remaining > 0 ? (
        <p className="mt-3 text-[13px] font-medium text-[color:var(--slate)]">
          + {remaining} more going
        </p>
      ) : null}
      {onlyViewer ? (
        <p className="mt-3 text-[13px] font-medium text-[color:var(--slate)]">
          You&apos;re the first one in. Everyone who RSVPs shows up here too.
        </p>
      ) : null}
    </section>
  );
}
