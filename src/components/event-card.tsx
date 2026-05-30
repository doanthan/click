import Image from "next/image";
import Link from "next/link";
import type { EventItem } from "@/lib/click-data";
import { formatCapacity } from "@/lib/click-matching";
import { Pill } from "./click-ui";
import { EventBookmarkButton } from "./event-bookmark-button";
import { EventDetailModal } from "./event-detail-modal";
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
          {isLockedEvent ? (
            <span className="inline-flex items-center gap-1.5 text-[color:var(--ink)]">
              <span aria-hidden>🔒</span> RSVP to unlock the venue
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

        <div className="mt-5 grid grid-cols-2 gap-2">
          <EventRegistrationButton
            eventId={event.id}
            initiallyRegistered={registered}
            isWaitlist={isWaitlistEvent}
          />
          <EventDetailModal
            event={event}
            bookmarked={bookmarked}
            registered={registered}
          />
        </div>
      </div>
    </article>
  );
}
