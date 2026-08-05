"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EventItem } from "@/lib/click-data";
import { Pill } from "./click-ui";
import { ckBtn } from "./ds";
import { EventBookmarkButton } from "./event-bookmark-button";
import { EventPaymentButton } from "./event-payment-button";
import { EventRegistrationButton } from "./event-registration-button";
import type { EventSuccessDetails } from "./event-rsvp-success-overlay";
import { EventImage } from "./event-image";
import { ModalShell } from "./modal-shell";

type EventDetailData = EventItem & {
  priceCents: number;
  address: string | null;
  endsAt: string | null;
  viewerRsvpStatus:
    | "confirmed"
    | "waitlisted"
    | "pending_payment"
    | "cancelled"
    | null;
  // ISO timestamp of a live waitlist promotion offer for the viewer, if any.
  waitlistOfferExpiresAt?: string | null;
};

function priceToCents(price: string) {
  const trimmed = price.trim().toLowerCase();
  if (!trimmed || trimmed === "free") return 0;
  const numeric = Number(trimmed.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

export function EventDetailModal({
  event,
  bookmarked = false,
  registered = false,
  bookingStatus,
  className,
}: {
  event: EventItem;
  bookmarked?: boolean;
  registered?: boolean;
  // Known booking state for the viewer. When "confirmed" we never show waitlist
  // copy and send them straight to their unlocked event page.
  bookingStatus?: "confirmed" | "waitlisted";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<EventDetailData | null>(null);
  const [loading, setLoading] = useState(false);

  // Escape, the scrim, the body-scroll lock and the focus move/trap/restore are
  // ModalShell's job now (this file's copy had no trap at all, and reset body
  // overflow to "" rather than to what it had been). What is left here is the
  // one thing that is genuinely this modal's: fetching the live record.
  useEffect(() => {
    if (!open) return;

    // Pull the live record from Supabase (falls back to static data server-side).
    let cancelled = false;
    fetch(`/api/events/${encodeURIComponent(event.id)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { event?: EventDetailData } | null) => {
        if (cancelled) return;
        if (payload?.event) setDetail(payload.event);
      })
      .catch(() => {
        /* keep the card data already on screen */
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, event.id]);

  // Show the card data immediately, then merge in the richer Supabase record.
  // The `registered` prop conflates confirmed + waitlisted (both live in the
  // dashboard's registered set). When the caller passes the real `bookingStatus`
  // we trust it; otherwise we fall back to inferring waitlist from the card's
  // full/waitlist state so a waitlisted member doesn't briefly see the confirmed
  // "Cancel RSVP" action. A confirmed viewer must NEVER be shown waitlist copy
  // just because the event is now full.
  const fallbackStatus: EventDetailData["viewerRsvpStatus"] = bookingStatus
    ? bookingStatus
    : registered
      ? event.status === "Waitlist" || event.attendees >= event.capacity
        ? "waitlisted"
        : "confirmed"
      : null;
  const data: EventDetailData =
    detail ?? {
      ...event,
      priceCents: priceToCents(event.price),
      address: null,
      endsAt: null,
      viewerRsvpStatus: fallbackStatus,
      waitlistOfferExpiresAt: null,
    };

  const seatsLeft = Math.max(0, data.capacity - data.attendees);
  const isFull = data.attendees >= data.capacity;
  const fullness = Math.min((data.attendees / data.capacity) * 100, 100);
  const isRegistered = data.viewerRsvpStatus === "confirmed";
  const isWaitlisted = data.viewerRsvpStatus === "waitlisted";
  const isWaitlistMode = data.status === "Waitlist" || isFull;
  // Venue stays private until the viewer confirms their RSVP — only the suburb
  // is shown beforehand, matching the event detail page's venue gate.
  const isLockedEvent = !isRegistered;
  const isPaid = data.priceCents > 0;

  // Handed to the RSVP button so a Discover-surface RSVP celebrates IN PLACE
  // rather than hard-navigating to /events/<id>?booked=1. Without it, someone who
  // RSVPs from a card gets a full page load as their confirmation - the one
  // moment in the flow where the app should be answering instantly.
  //
  // On the venue: this reveals data.location only AFTER the RSVP succeeds, and
  // every field here is already in this client component's payload (the card prop
  // plus /api/events/<id>, neither of which redacts location_name). So this ships
  // nothing to the browser that was not already there - unlike the event page,
  // which builds successDetails server-side and therefore has to gate it on
  // venueUnlocked before serialising it.
  const successDetails: EventSuccessDetails = {
    title: data.title,
    dateLabel: data.date,
    timeLabel: data.time,
    location: data.location,
    suburb: data.suburb,
    slug: data.id,
    // The public .ics download route rather than a hand-built Google Calendar
    // template URL: the server already owns that formatting (start/end, escaping,
    // the fallback 2-hour block for an event with no end), and an .ics works with
    // Apple and Outlook too, not just Google.
    calendarUrl: `/api/events/${encodeURIComponent(data.id)}/ics`,
  };

  // Card-level CTA label - the DS-locked vocabulary. ONE "RSVP" for every
  // event, free or paid: the price rides on the card, never in the button
  // ("RSVP · $35" and "buy a ticket" are both banned). Waitlist reads
  // "Join waitlist" → "Joined waitlist" once joined; a booked seat reads
  // "You're going".
  // A confirmed attendee gets sent straight to their unlocked event page (full
  // details + venue) rather than back into the booking modal — they've already
  // RSVP'd. Waitlisted/unregistered viewers still open the modal.
  const isConfirmedBooking = fallbackStatus === "confirmed";
  const triggerLabel = registered
    ? fallbackStatus === "waitlisted"
      ? "Joined waitlist"
      : "You're going"
    : isWaitlistMode
      ? "Join waitlist"
      : "RSVP";
  // The DS Button - radius 12, flat Deep Purple, one footprint everywhere. A
  // joined-waitlist seat wears the muted "pending" fill at the same size.
  const triggerClassName =
    className ??
    ckBtn(registered && fallbackStatus === "waitlisted" ? "pending" : "primary", "sm");

  if (isConfirmedBooking) {
    return (
      <Link href={`/events/${event.id}`} className={triggerClassName}>
        {triggerLabel}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setLoading(true);
          setOpen(true);
        }}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>

      {open ? (
        <ModalShell
          onClose={() => setOpen(false)}
          labelledBy="event-modal-title"
          /* Top-aligned on a phone (this card is tall), centred from sm up. */
          align="start"
          className="sm:items-center"
          /* Matches the pre-migration z-[100]. The checkout modal this can open
             sits above it at z-140, the login gate a 401 raises at z-200. */
          zIndex={100}
          /* A scrim tap closes this one. It is a read-only quick view - nothing
             typed, nothing lost - so the usual "tap outside to dismiss" applies,
             unlike the booking dialog where a stray tap would discard guest
             details. (The old markup meant to do this but never could: its scrim
             sat over the wrapper, so the target/currentTarget check never
             matched.) */
          cardClassName="my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-xl)] bg-[color:var(--paper)] shadow-[var(--shadow-lg)]"
        >
          <div className="relative h-52 w-full shrink-0 overflow-hidden sm:h-72">
            <EventImage
              src={data.image}
              alt={data.imageAlt}
              category={data.category}
              fill
              sizes="(min-width: 768px) 672px, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--ink)]/40 via-transparent to-transparent" />
            <span className="absolute left-4 top-4 rounded-lg bg-[color:var(--paper)] px-2.5 py-1.5 text-[12px] font-semibold text-[color:var(--ink)] shadow-[var(--shadow-xs)]">
              {data.status}
            </span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 grid size-9 place-items-center rounded-lg bg-[color:var(--paper)] text-[color:var(--ink)] shadow-[var(--shadow-sm)] hover:bg-[color:var(--lavender-100)]"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 sm:p-8">
            <p className="eyebrow">
              {data.date} · {data.time} · {data.category}
              {loading ? " · refreshing…" : ""}
            </p>
            <h2
              id="event-modal-title"
              className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.025em] text-[color:var(--ink)] sm:text-4xl"
            >
              {data.title}
            </h2>
            <p className="mt-2 text-sm font-medium text-[color:var(--slate)]">
              Hosted by {data.host} <span className="opacity-50">·</span> {data.group}
            </p>

            <p className="mt-5 text-base leading-7 text-[color:var(--ink)]">
              {data.description}
            </p>

            {data.relationshipGoal ? (
              <div className="mt-4 rounded-2xl bg-[color:var(--lav-bg)] p-4">
                <p className="eyebrow">Why this event</p>
                <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--ink)]">{data.relationshipGoal}</p>
              </div>
            ) : null}

            {data.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {data.tags.map((tag) => (
                  <Pill key={tag} href={`/events?tag=${encodeURIComponent(tag)}`}>
                    #{tag}
                  </Pill>
                ))}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="eyebrow">Location</p>
                {isLockedEvent ? (
                  <p className="mt-1 text-sm font-semibold leading-6 text-[color:var(--ink)]">
                    {data.suburb}. Venue revealed after RSVP.
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-sm font-semibold leading-6 text-[color:var(--ink)]">{data.location}</p>
                    {data.address ? (
                      <p className="text-sm font-medium text-[color:var(--slate)]">
                        {data.address}
                      </p>
                    ) : null}
                    <p className="text-sm font-medium text-[color:var(--slate)]">
                      {data.suburb}
                    </p>
                  </>
                )}
              </div>
              <div>
                <p className="eyebrow">Price</p>
                <p className="font-display mt-1 text-2xl font-semibold leading-tight tracking-[-0.025em] text-[color:var(--ink)]">
                  {data.price}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex justify-between text-[12.5px] font-semibold text-[color:var(--slate)]">
                <span>Seats</span>
                <span>{isFull ? "Full" : `${seatsLeft} of ${data.capacity} left`}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--mist)]">
                <div
                  className={`h-full rounded-full ${isFull ? "bg-[color:var(--ink)]" : "bg-[color:var(--purple)]"}`}
                  style={{ width: `${fullness}%` }}
                />
              </div>
            </div>

            <div className="mt-6 grid gap-2">
              {/* successDetails on both registration buttons: the first covers
                  accepting a waitlist promotion, the second a plain RSVP. Both
                  end in a confirmed seat, and both should celebrate here rather
                  than throw the browser at a new page. */}
              {isRegistered || isWaitlisted ? (
                <EventRegistrationButton
                  eventId={data.id}
                  initiallyRegistered
                  isWaitlist={isWaitlisted}
                  offerExpiresAt={data.waitlistOfferExpiresAt ?? null}
                  successDetails={successDetails}
                />
              ) : isPaid && !isWaitlistMode ? (
                <EventPaymentButton eventId={data.id} priceLabel={data.price} />
              ) : (
                <EventRegistrationButton
                  eventId={data.id}
                  initiallyRegistered={false}
                  isWaitlist={isWaitlistMode}
                  successDetails={successDetails}
                />
              )}

              <EventBookmarkButton eventId={data.id} initiallySaved={bookmarked} />

              <Link
                href={`/events/${data.id}`}
                className="ck-btn ck-btn--md ck-btn--full ck-btn--secondary"
              >
                View full page
              </Link>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
