import Image from "next/image";
import Link from "next/link";
import type { EventItem } from "@/lib/click-data";
import { EventBookmarkButton } from "./event-bookmark-button";

// Deterministic pseudo-rating until rated reviews exist on the EventItem.
// 4.6 – 5.0 range, single-decimal, with a review count seeded from the id and
// nudged up for events with higher attendance so popular things look popular.
function ratingFor(event: EventItem) {
  let hash = 0;
  for (let i = 0; i < event.id.length; i++) {
    hash = (hash * 31 + event.id.charCodeAt(i)) >>> 0;
  }
  const rating = 4.6 + ((hash % 5) / 10); // 4.6, 4.7, 4.8, 4.9, 5.0
  const reviews = 60 + (hash % 1800) + event.attendees * 7;
  return { rating: rating.toFixed(1), reviews };
}

function StarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-[color:var(--ink)]"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2.5l2.81 6.07 6.69.61-5.03 4.51 1.5 6.55L12 16.9l-5.97 3.34 1.5-6.55-5.03-4.51 6.69-.61L12 2.5z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-[color:var(--ink)]"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-[color:var(--ink)]"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s-7-6.36-7-12a7 7 0 0114 0c0 5.64-7 12-7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-[color:var(--ink)]"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 100-4V8z" />
      <path d="M13 6v12" strokeDasharray="2 2" />
    </svg>
  );
}

export function EventTileCard({
  event,
  bookmarked = false,
}: {
  event: EventItem;
  bookmarked?: boolean;
}) {
  const { rating, reviews } = ratingFor(event);
  const seatsLeft = Math.max(0, event.capacity - event.attendees);
  const isFull = seatsLeft === 0;
  // "Runs regularly" mirrors the ClassBento style; we show it for any non-full
  // event so the cadence feels familiar even though the data is per-event.
  const cadence = isFull
    ? event.status === "Waitlist"
      ? "Waitlist open"
      : "Currently full"
    : "Runs regularly";

  return (
    <article className="group relative flex w-[18rem] shrink-0 flex-col gap-3 sm:w-[20rem]">
      <Link
        href={`/events/${event.id}`}
        className="relative block aspect-[4/5] w-full overflow-hidden rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--champagne-deep)]"
      >
        <Image
          src={event.image}
          alt={event.imageAlt}
          fill
          sizes="(min-width: 640px) 20rem, 18rem"
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      </Link>

      <div className="absolute right-3 top-3 z-10">
        <EventBookmarkButton
          eventId={event.id}
          initiallySaved={bookmarked}
          variant="star"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="line-clamp-2 text-[0.98rem] font-black leading-snug text-[color:var(--ink)]">
          <Link href={`/events/${event.id}`} className="hover:underline">
            {event.title}
          </Link>
        </h3>

        <div className="flex items-center gap-1.5 text-sm font-bold text-[color:var(--ink)]">
          <StarIcon />
          <span>
            {rating} <span className="font-semibold text-[color:var(--mauve)]">({reviews.toLocaleString()})</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ink)]/85">
          <CalendarIcon />
          <span className="truncate">{cadence}</span>
        </div>

        <div className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ink)]/85">
          <PinIcon />
          <span className="truncate">
            {event.suburb}
            <span className="ml-1 text-[color:var(--mauve)]">· {event.distanceKm} km</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm font-bold text-[color:var(--ink)]">
          <TicketIcon />
          <span className="truncate">{event.price}</span>
        </div>
      </div>
    </article>
  );
}
