import Link from "next/link";
import { attendeeFomoSignals } from "@/lib/attendee-fomo";
import type { EventAttendeePreviewData } from "@/lib/event-repository";
import { AvatarStack, Icon } from "./ds";
import { PeopleCard } from "./people-card";

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
      {/* The canonical People Card in its attendee-list form (bug board #293/#297):
          the same photo, name and shared interests as every other surface you meet
          people on, the WHOLE card opening the profile. Interests only - no intent,
          no commonality line and no click, which is post-event only. */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {viewer ? (
          <PeopleCard
            person={{ ...viewer, id: viewer.profileId, sharedInterests: [] }}
            layout="grid"
            interestsOnly
            href="/profile"
            nameAside={<span className="shrink-0 text-[12.5px] font-medium text-[color:var(--slate)]">You</span>}
            footer={
              viewer.hiddenFromOthers ? (
                <span className="block text-[12.5px] leading-snug text-[color:var(--slate)]">
                  Hidden from this list - only you see yourself here.
                </span>
              ) : null
            }
          />
        ) : null}
        {items.map((p) => (
          <PeopleCard
            key={p.profileId}
            person={{ ...p, id: p.profileId }}
            layout="grid"
            interestsOnly
            href={`/profile/${p.profileId}`}
          />
        ))}
        {/* A named +1 with no account yet: nothing to open, so no link and no
            chevron. It becomes a real card once they sign up via their invite. */}
        {guests.map((g) => (
          <PeopleCard
            key={g.id}
            person={{ id: g.id, displayName: g.firstName, photoUrl: null, sharedInterests: [] }}
            layout="grid"
            interestsOnly
            footer={
              <span className="block text-[12.5px] leading-snug text-[color:var(--slate)]">
                {g.isViewersGuest
                  ? "Your guest - their card fills in once they sign up"
                  : `Guest of ${g.hostFirstName}`}
              </span>
            }
          />
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
