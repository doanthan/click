import Image from "next/image";
import Link from "next/link";
import { type EventItem, formatEventTimeRange } from "@/lib/click-data";
import { EventBookmarkButton } from "./event-bookmark-button";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function EventListCard({
  event,
  bookmarked = false,
}: {
  event: EventItem;
  bookmarked?: boolean;
}) {
  const seatsLeft = Math.max(0, event.capacity - event.attendees);
  const isFull = seatsLeft === 0;
  const fillRatio = event.capacity > 0 ? event.attendees / event.capacity : 0;
  const almostFull = !isFull && fillRatio >= 0.8;
  const flag =
    isFull && event.status !== "Waitlist"
      ? "Full"
      : event.status === "Waitlist"
        ? "Waitlist"
        : event.status === "Locked"
          ? "Locked"
          : null;

  return (
    <article className="group relative flex min-w-0 flex-col gap-4 rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] p-3 transition hover:border-[color:var(--line)] hover:hard-shadow-sm sm:flex-row sm:p-4">
      <Link
        href={`/events/${event.id}`}
        className="relative h-44 w-full shrink-0 self-stretch overflow-hidden rounded-xl border border-[color:var(--line-soft)] sm:h-auto sm:w-52"
      >
        <Image
          src={event.image}
          alt={event.imageAlt}
          fill
          sizes="(min-width: 640px) 208px, 100vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        {flag ? (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-[color:var(--ink)] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-[color:var(--champagne)]">
            {flag}
          </span>
        ) : null}
        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[color:var(--champagne)] px-2.5 py-0.5 text-xs font-black text-[color:var(--ink)] shadow-sm">
          {event.price}
        </span>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/events/${event.id}`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[color:var(--champagne)] py-0.5 pl-0.5 pr-2 text-xs font-bold text-[color:var(--ink)] transition hover:bg-[color:var(--peach)]"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--rose)] text-[0.55rem] font-black text-[color:var(--surface-deep)]">
              {initials(event.group)}
            </span>
            <span className="truncate">{event.group}</span>
          </Link>
          <span className="rounded-full border border-[color:var(--line-soft)] bg-[color:var(--peach)] px-2.5 py-0.5 text-[0.6rem] font-black uppercase tracking-wider text-[color:var(--surface-deep)]">
            {event.category}
          </span>
          <span className="text-xs font-bold text-[color:var(--mauve)]">
            {event.distanceKm} km away
          </span>
        </div>

        <h3 className="mt-2 line-clamp-2 text-xl font-black leading-tight text-[color:var(--ink)]">
          <Link href={`/events/${event.id}`} className="hover:underline">
            {event.title}
          </Link>
        </h3>

        <p className="mt-1 truncate text-sm font-semibold text-[color:var(--mauve)]">
          {event.date} at {formatEventTimeRange(event)} · {event.suburb}
        </p>

        <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-[color:var(--ink)]/80">
          {event.description}
        </p>

        {event.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {event.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[color:var(--line-soft)] bg-[color:var(--champagne)] px-2.5 py-0.5 text-[0.65rem] font-bold text-[color:var(--mauve)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-[color:var(--mauve)]">
            <span>{event.attendees.toLocaleString()} going</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                isFull
                  ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
                  : almostFull
                    ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                    : "bg-[color:var(--champagne)] text-[color:var(--ink)]"
              }`}
            >
              {isFull
                ? "Full"
                : almostFull
                  ? `Only ${seatsLeft} left`
                  : `${seatsLeft} spots open`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/events/${event.id}`}
              className="rounded-full bg-[color:var(--surface-deep)] px-4 py-2 text-sm font-black text-[color:var(--on-deep)] transition hover:opacity-90"
            >
              View event
            </Link>
            <EventBookmarkButton eventId={event.id} initiallySaved={bookmarked} variant="star" />
          </div>
        </div>
      </div>
    </article>
  );
}
