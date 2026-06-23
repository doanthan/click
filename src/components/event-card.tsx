import Image from "next/image";
import Link from "next/link";
import { type EventItem, formatEventTimeRange } from "@/lib/click-data";
import { formatCapacity } from "@/lib/click-matching";
import { Pill } from "./click-ui";
import { EventBookmarkButton } from "./event-bookmark-button";
import { EventDetailModal } from "./event-detail-modal";

export function EventCard({
  event,
  compact = false,
  bookmarked = false,
  registered = false,
  bookingStatus,
}: {
  event: EventItem;
  compact?: boolean;
  bookmarked?: boolean;
  registered?: boolean;
  // The viewer's actual booking state for this event, when known. Lets the
  // card/modal show "View your booking" (confirmed) vs the waitlist state
  // accurately instead of guessing from whether the event is full.
  bookingStatus?: "confirmed" | "waitlisted";
}) {
  const seatsLeft = Math.max(0, event.capacity - event.attendees);
  const isFull = seatsLeft === 0;
  const isWaitlistEvent = event.status === "Waitlist" || isFull;
  // Venue is private until the viewer RSVPs — show only the suburb otherwise
  // (the precise venue name lives behind the RSVP, same gate as the address +
  // map on the event detail page).
  const venueHidden = !registered;
  const statusLabel = isFull && event.status === "Live" ? "Full" : event.status;
  const availabilityLabel = isFull
    ? "Sold out"
    : seatsLeft <= 3
      ? `${seatsLeft} spots left`
      : seatsLeft <= 8
        ? "Almost full"
        : `${seatsLeft} seats left`;
  // Tone reads as a traffic light: peach = open, rose = limited/waitlist/full,
  // ink = locked. A sold-out "Full" event must never wear the positive peach.
  const statusTone =
    isWaitlistEvent
      ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
      : event.status === "Locked"
        ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
        : "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";

  return (
    <article className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-lg border-2 border-[color:var(--line)] bg-[color:var(--champagne)] transition-transform duration-300 hover:-translate-y-1 hard-shadow-sm hover:[box-shadow:8px_8px_0_0_var(--shadow-ink)]">
      <Link
        href={`/events/${event.id}`}
        className={`relative block overflow-hidden border-b-2 border-[color:var(--line)] ${compact ? "h-44" : "h-60"}`}
      >
        <Image
          src={event.image}
          alt={event.imageAlt}
          fill
          sizes="(min-width: 1024px) 32vw, 100vw"
          className="object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--ink)]/30 via-transparent to-transparent" />
        <span
          className={`absolute left-3 top-3 rounded-full border-2 border-[color:var(--line)] ${statusTone} px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-wider hard-shadow-sm`}
        >
          {statusLabel}
        </span>
        <span className="absolute bottom-3 left-3 rounded-md border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-2 text-[0.72rem] font-black uppercase leading-tight tracking-[0.14em] text-[color:var(--ink)] hard-shadow-sm">
          {event.date}
          <span className="block font-mono text-[0.62rem] text-[color:var(--mauve)]">{formatEventTimeRange(event)}</span>
        </span>
        <span className="absolute bottom-3 right-3 max-w-[8rem] truncate rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-2.5 py-1.5 text-[0.62rem] font-bold uppercase tracking-wider text-[color:var(--ink)] hard-shadow-sm sm:max-w-none sm:px-3 sm:text-[0.68rem]">
          {availabilityLabel}
        </span>
      </Link>
      <div className="absolute right-3 top-3 z-10">
        <EventBookmarkButton eventId={event.id} initiallySaved={bookmarked} compact />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="font-mono break-words text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
          {event.suburb} · {event.category} · {event.price}
        </p>
        <h3 className="font-display mt-2 line-clamp-2 text-[1.65rem] font-semibold leading-[1.04] tracking-[-0.025em] text-[color:var(--ink)]">
          <Link href={`/events/${event.id}`} className="hover:underline">
            {event.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm font-semibold text-[color:var(--mauve)]">
          {venueHidden ? (
            <span className="inline-flex items-center gap-1.5 text-[color:var(--ink)]">
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 018 0v3" />
              </svg>
              {event.suburb} · RSVP to unlock venue
            </span>
          ) : (
            event.location
          )}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {event.tags.slice(0, compact ? 2 : 3).map((tag) => (
            <Pill key={tag} href={`/events?tag=${encodeURIComponent(tag)}`}>
              {tag}
            </Pill>
          ))}
        </div>
        <p className="sr-only">{formatCapacity(event)}</p>

        {event.attendees > 2 && (event.attendeeAvatars?.length ?? 0) > 0 ? (
          <div className="mt-4 flex items-center gap-2">
            <div className="flex -space-x-2">
              {event.attendeeAvatars!.slice(0, 3).map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${url}-${i}`}
                  src={url}
                  alt=""
                  className="h-7 w-7 rounded-full border-2 border-[color:var(--champagne)] object-cover hard-shadow-sm"
                />
              ))}
            </div>
            <span className="text-xs font-bold text-[color:var(--mauve)]">
              {event.attendees} going
            </span>
          </div>
        ) : null}

        <div className="mt-auto pt-5">
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
