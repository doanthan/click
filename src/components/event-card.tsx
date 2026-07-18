import Image from "next/image";
import Link from "next/link";
import { type EventItem, formatEventTimeRange } from "@/lib/click-data";
import { formatCapacity } from "@/lib/click-matching";
import { AvatarStack, Icon, StatusBadge, TagRow, type EventStatus } from "./ds";
import { EventBookmarkButton } from "./event-bookmark-button";
import { EventDetailModal } from "./event-detail-modal";

/**
 * The Event Card - the heart of the product, and the ONE card used identically
 * on every surface (discovery, dashboard, landing, my-events, category pages).
 * It is never restyled per page and never resized per page.
 *
 * Anatomy is locked by the DS (README §4):
 *   cover 16:9 - ONE status badge (top-left) + Save (top-right), nothing else
 *   16px body, grouped rhythm - NOT a stretched flex void before the footer:
 *     Block 1 {date → title → location}  tight
 *     12px
 *     Block 2 {tags → going row}
 *     16px
 *     footer: 1px Mist hairline + 12px · price LEFT · CTA RIGHT
 * Equal height across a row comes from the 16:9 cover + the title RESERVING two
 * lines (min-height 48px), never from `flex:1` on the meta - hence align-self:
 * start. Every non-title row is exactly ONE line and truncates; `min-w-0` on the
 * flex children is what stops a long title or tag from forcing the card wider.
 *
 * ALL states (locked / booked / waitlist / saved) share this spacing and footer.
 * They change ONLY the badge, the CTA label, and whether the venue is revealed.
 */
export function EventCard({
  event,
  bookmarked = false,
  registered = false,
  bookingStatus,
  priority = false,
}: {
  event: EventItem;
  bookmarked?: boolean;
  registered?: boolean;
  // Set on the card most likely to be the page's LCP element (e.g. first card
  // of the landing strip) so its cover loads eagerly.
  priority?: boolean;
  // The viewer's actual booking state for this event, when known. Lets the
  // card/modal show "You're going" (confirmed) vs the waitlist state accurately
  // instead of guessing from whether the event is full.
  bookingStatus?: "confirmed" | "waitlisted";
}) {
  const seatsLeft = Math.max(0, event.capacity - event.attendees);
  const isFull = seatsLeft === 0;
  const isConfirmed = registered && bookingStatus !== "waitlisted";

  // Venue privacy: the venue name is revealed only once the viewer has a
  // confirmed seat. Until then the card shows suburb · distance + a lock glyph.
  const venueRevealed = isConfirmed;

  // ONE status badge, resolved by priority. Status colour appears NOWHERE else
  // on the card - not on the CTA, not on a tag, not on the cover.
  const status: EventStatus | null = isConfirmed
    ? "going"
    : isFull
      ? "waitlist"
      : seatsLeft <= 3
        ? "spots"
        : seatsLeft <= 8
          ? "almostfull"
          : event.status === "Featured"
            ? "trending"
            : isFreeEvent(event)
              ? "free"
              : null;

  const goingCount = event.attendees;
  const goingFaces = (event.attendeeAvatars ?? []).map((src) => ({ src }));

  return (
    <article className="group flex min-w-0 flex-col self-start overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] shadow-[var(--shadow-sm)] transition duration-200 hover:-translate-y-[3px] hover:shadow-[var(--shadow-lg)]">
      {/* Cover - 16:9 everywhere, so cards in a row are equal height */}
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-[color:var(--champagne-deep)]">
        <Link href={`/events/${event.id}`} aria-label={event.title} className="relative block h-full w-full">
          <Image
            src={event.image}
            alt={event.imageAlt}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-200 ease-out group-hover:scale-[1.04]"
          />
        </Link>
        {status ? (
          <span className="absolute left-3 top-3">
            <StatusBadge status={status} spotsLeft={seatsLeft} />
          </span>
        ) : null}
        <span className="absolute right-3 top-3">
          <EventBookmarkButton eventId={event.id} initiallySaved={bookmarked} variant="star" />
        </span>
      </div>

      <div className="flex flex-col p-4">
        {/* Block 1 - date · title · location, tight */}
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-semibold text-[color:var(--slate)]">
            <Icon name="calendar" size={13} stroke={2.1} />
            {event.date} · {formatEventTimeRange(event)}
          </p>
          <h3 className="font-display mt-1 line-clamp-2 min-h-12 min-w-0 text-[length:var(--card-title)] font-semibold leading-6 tracking-[-0.01em] text-[color:var(--ink)]">
            <Link href={`/events/${event.id}`} className="hover:underline">
              {event.title}
            </Link>
          </h3>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-[13.5px] font-medium text-[color:var(--slate)]">
            <Icon name="pin" size={13} stroke={2.1} />
            {venueRevealed ? (
              <span className="truncate">{event.location}</span>
            ) : (
              <>
                <span className="truncate">
                  {event.suburb}
                  {event.distanceKm ? ` · ${event.distanceKm}km` : ""}
                </span>
                <Icon
                  name="lock"
                  size={12}
                  stroke={2.2}
                  className="text-[color:var(--ink-faint)]"
                  style={{ flex: "none" }}
                />
                <span className="sr-only">Venue shown when you RSVP</span>
              </>
            )}
          </p>
        </div>

        {/* Block 2 - tags, then the going row. The tag row RESERVES its height
            even when an event has no tags, so cards in a row keep their footers
            on one line (the DS gets equal height by reserving, never by
            stretching a flex gap). */}
        <div className="mt-3 min-w-0">
          <TagRow tags={event.tags} max={3} reserveHeight />
          <div className="mt-2">
            {goingCount >= 3 && goingFaces.length > 0 ? (
              <AvatarStack people={goingFaces} max={4} size={26} label={`${goingCount} going`} />
            ) : (
              <span className="text-[13px] font-medium text-[color:var(--slate)]">Be one of the first</span>
            )}
          </div>
          <p className="sr-only">{formatCapacity(event)}</p>
        </div>

        {/* Footer - hairline, then price left / CTA right */}
        <div className="mt-4 flex items-center justify-between gap-2.5 border-t border-[color:var(--mist)] pt-3">
          <span
            className={`font-display text-base font-semibold ${
              isFreeEvent(event) ? "text-[color:var(--sage)]" : "text-[color:var(--ink)]"
            }`}
          >
            {isFreeEvent(event) ? "Free" : event.price}
          </span>
          <EventDetailModal
            event={event}
            bookmarked={bookmarked}
            registered={registered}
            bookingStatus={bookingStatus}
          />
        </div>
      </div>
    </article>
  );
}

function isFreeEvent(event: EventItem) {
  const p = (event.price ?? "").trim().toLowerCase();
  return !p || p === "free" || p === "$0";
}
