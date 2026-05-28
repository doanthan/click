import Image from "next/image";
import Link from "next/link";
import type { EventItem } from "@/lib/click-data";
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
  const flag =
    isFull && event.status !== "Waitlist"
      ? "Full"
      : event.status === "Waitlist"
        ? "Waitlist"
        : event.status === "Locked"
          ? "Locked"
          : null;

  return (
    <article className="group relative flex min-w-0 gap-4 rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] p-3 transition hover:border-[color:var(--line)] hover:hard-shadow-sm">
      <Link
        href={`/events/${event.id}`}
        className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-[color:var(--line-soft)] sm:h-32 sm:w-32"
      >
        <Image
          src={event.image}
          alt={event.imageAlt}
          fill
          sizes="128px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        {flag ? (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-[color:var(--ink)] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-[color:var(--champagne)]">
            {flag}
          </span>
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          href={`/events/${event.id}`}
          className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full bg-[color:var(--champagne)] py-0.5 pl-0.5 pr-2 text-xs font-bold text-[color:var(--ink)] transition hover:bg-[color:var(--peach)]"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--rose)] text-[0.55rem] font-black text-[color:var(--surface-deep)]">
            {initials(event.group)}
          </span>
          <span className="truncate">{event.group}</span>
          <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>

        <h3 className="mt-1.5 line-clamp-2 text-lg font-black leading-tight text-[color:var(--ink)]">
          <Link href={`/events/${event.id}`} className="hover:underline">
            {event.title}
          </Link>
        </h3>

        <p className="mt-1 truncate text-sm font-semibold text-[color:var(--mauve)]">
          {event.date} at {event.time} · {event.suburb}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="text-sm font-bold text-[color:var(--mauve)]">
            {event.attendees.toLocaleString()} interested
          </span>
          <EventBookmarkButton eventId={event.id} initiallySaved={bookmarked} variant="star" />
        </div>
      </div>
    </article>
  );
}
