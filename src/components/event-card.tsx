import Image from "next/image";
import Link from "next/link";
import type { EventItem } from "@/lib/click-data";
import { formatCapacity } from "@/lib/click-matching";
import { Pill } from "./click-ui";
import { EventBookmarkButton } from "./event-bookmark-button";
import { EventRegistrationButton } from "./event-registration-button";

export function EventCard({
  event,
  compact = false,
  bookmarked = false,
  registered = false,
}: {
  event: EventItem;
  compact?: boolean;
  bookmarked?: boolean;
  registered?: boolean;
}) {
  const seatsLeft = Math.max(0, event.capacity - event.attendees);
  const isFull = seatsLeft === 0;
  const isWaitlistEvent = event.status === "Waitlist" || isFull;
  const isLockedEvent = event.status === "Locked" && !registered;
  const fullness = Math.min((event.attendees / event.capacity) * 100, 100);
  const statusLabel = isFull && event.status === "Live" ? "Full" : event.status;
  const availabilityLabel = isFull
    ? "Sold out"
    : seatsLeft <= 3
      ? `${seatsLeft} spots left`
      : seatsLeft <= 8
        ? "Almost full"
        : `${seatsLeft} seats left`;
  const statusTone =
    isWaitlistEvent
      ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
      : event.status === "Locked"
        ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
        : "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";

  return (
    <article className="group relative min-w-0 overflow-hidden rounded-lg border-2 border-[color:var(--line)] bg-[color:var(--champagne)] transition-transform duration-300 hover:-translate-y-1 hard-shadow-sm hover:[box-shadow:8px_8px_0_0_var(--shadow-ink)]">
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
          <span className="block font-mono text-[0.62rem] text-[color:var(--mauve)]">{event.time}</span>
        </span>
        <span className="absolute bottom-3 right-3 max-w-[8rem] truncate rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-2.5 py-1.5 text-[0.62rem] font-bold uppercase tracking-wider text-[color:var(--ink)] hard-shadow-sm sm:max-w-none sm:px-3 sm:text-[0.68rem]">
          {availabilityLabel}
        </span>
      </Link>
      <div className="absolute right-3 top-3 z-10">
        <EventBookmarkButton eventId={event.id} initiallySaved={bookmarked} compact />
      </div>
      <div className="p-5">
        <p className="font-mono break-words text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
          {event.suburb} · {event.category} · {event.price}
        </p>
        <h3 className="font-display mt-2 text-[1.65rem] font-light leading-[1.04] text-[color:var(--ink)]">
          <Link href={`/events/${event.id}`} className="hover:underline">
            {event.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm font-semibold text-[color:var(--mauve)]">
          Hosted by {event.host} <span className="opacity-50">·</span> {event.group}
        </p>
        <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          {event.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {event.tags.slice(0, compact ? 3 : 5).map((tag) => (
            <Pill key={tag}>{tag}</Pill>
          ))}
        </div>

        <div className="mt-5 rounded-lg border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-3">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            social signal
          </p>
          <p className="mt-1 text-sm font-bold leading-5 text-[color:var(--ink)]">{event.fomo}</p>
        </div>

        <div className="mt-5">
          <div className="flex justify-between gap-4 text-xs font-bold text-[color:var(--mauve)]">
            <span>
              {isLockedEvent ? (
                <span className="inline-flex items-center gap-1.5 text-[color:var(--ink)]">
                  <span aria-hidden>🔒</span>
                  RSVP to unlock the venue
                </span>
              ) : (
                event.location
              )}
            </span>
            <span>
              {isFull
                ? "Full — join waitlist"
                : `${seatsLeft} of ${event.capacity} seats left`}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)]">
            <div
              className={`h-full rounded-full ${isFull ? "bg-[color:var(--ink)]" : "bg-[color:var(--rose)]"}`}
              style={{ width: `${fullness}%` }}
            />
          </div>
          <p className="sr-only">{formatCapacity(event)}</p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <EventRegistrationButton
            eventId={event.id}
            initiallyRegistered={registered}
            isWaitlist={isWaitlistEvent}
          />
          <Link
            href={`/events/${event.id}`}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-center text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)] hover:text-[color:var(--surface-deep)]"
          >
            Details
          </Link>
        </div>
      </div>
    </article>
  );
}
