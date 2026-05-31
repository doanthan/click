import Image from "next/image";
import Link from "next/link";
import { type EventItem, formatEventTimeRange } from "@/lib/click-data";
import { EventBookmarkButton } from "./event-bookmark-button";

// Compact "SAT, 14 JUN" date label, formatted in Sydney time so it lines up
// with the server-rendered time string already on the item.
const dateBadgeFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Australia/Sydney",
});

function formatDateBadge(event: EventItem) {
  const start = new Date(event.startsAt);
  if (Number.isNaN(start.getTime())) return event.date;
  return dateBadgeFormatter.format(start).toUpperCase();
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-[color:var(--mauve)]"
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
      className="h-4 w-4 shrink-0 text-[color:var(--mauve)]"
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

function UsersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-[color:var(--mauve)]"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

export function EventTileCard({
  event,
  bookmarked = false,
  fluid = false,
}: {
  event: EventItem;
  bookmarked?: boolean;
  // Fluid cards fill their grid cell; the default fixed width is for the
  // horizontal scroll rails on /discover where cards peek off-screen.
  fluid?: boolean;
}) {
  const seatsLeft = Math.max(0, event.capacity - event.attendees);
  const isFull = seatsLeft === 0;
  const isWaitlist = event.status === "Waitlist";

  // Honest availability signal — no invented ratings. Drives the corner badge
  // on the image, mirroring how Meetup/ClassBento surface urgency + capacity.
  const availability = isFull
    ? { label: isWaitlist ? "Waitlist open" : "Sold out", tone: "full" as const }
    : seatsLeft <= 3
      ? { label: `${seatsLeft} spot${seatsLeft === 1 ? "" : "s"} left`, tone: "low" as const }
      : seatsLeft <= 8
        ? { label: "Almost full", tone: "low" as const }
        : null;

  const availabilityClass =
    availability?.tone === "full"
      ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
      : "bg-[color:var(--rose)] text-[color:var(--on-deep)]";

  return (
    <article
      className={`group relative flex shrink-0 flex-col gap-3 ${
        fluid ? "w-full" : "w-[18rem] sm:w-[20rem]"
      }`}
    >
      <Link
        href={`/events/${event.id}`}
        className="relative block aspect-[4/5] w-full overflow-hidden rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--champagne-deep)]"
      >
        <Image
          src={event.image}
          alt={event.imageAlt}
          fill
          sizes={fluid ? "(min-width: 1024px) 24rem, (min-width: 640px) 45vw, 90vw" : "(min-width: 640px) 20rem, 18rem"}
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--ink)]/35 via-transparent to-transparent" />

        {/* Date chip — the single most-scanned datum on an event card. */}
        <span className="absolute left-3 top-3 rounded-full bg-[color:var(--champagne)]/95 px-3 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[color:var(--ink)] shadow-sm backdrop-blur">
          {formatDateBadge(event)}
        </span>

        {availability ? (
          <span
            className={`absolute bottom-3 left-3 rounded-full px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.1em] shadow-sm ${availabilityClass}`}
          >
            {availability.label}
          </span>
        ) : null}
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

        <div className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ink)]/85">
          <CalendarIcon />
          <span className="truncate">
            {formatDateBadge(event)} · {formatEventTimeRange(event)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ink)]/85">
          <PinIcon />
          <span className="truncate">
            {event.suburb}
            <span className="ml-1 text-[color:var(--mauve)]">· {event.distanceKm} km</span>
          </span>
        </div>

        {/* Price + real "going" count — the two numbers people decide on. */}
        <div className="mt-0.5 flex items-center justify-between gap-2 text-sm">
          <span className="font-black text-[color:var(--ink)]">{event.price}</span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-[color:var(--mauve)]">
            <UsersIcon />
            {event.attendees} going
          </span>
        </div>
      </div>
    </article>
  );
}
