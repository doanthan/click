"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { EventItem } from "@/lib/click-data";
import { Pill } from "./click-ui";
import { EventBookmarkButton } from "./event-bookmark-button";
import { EventPaymentButton } from "./event-payment-button";
import { EventRegistrationButton } from "./event-registration-button";

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
  className,
}: {
  event: EventItem;
  bookmarked?: boolean;
  registered?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<EventDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portals need a DOM target, so wait until we're on the client.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    // Pull the live record from Supabase (falls back to static data server-side).
    const controller = new AbortController();
    fetch(`/api/events/${encodeURIComponent(event.id)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { event?: EventDetailData } | null) => {
        if (payload?.event) setDetail(payload.event);
      })
      .catch(() => {
        /* keep the card data already on screen */
      })
      .finally(() => setLoading(false));

    return () => {
      controller.abort();
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, event.id]);

  // Show the card data immediately, then merge in the richer Supabase record.
  const data: EventDetailData =
    detail ?? {
      ...event,
      priceCents: priceToCents(event.price),
      address: null,
      endsAt: null,
      viewerRsvpStatus: registered ? "confirmed" : null,
    };

  const seatsLeft = Math.max(0, data.capacity - data.attendees);
  const isFull = data.attendees >= data.capacity;
  const fullness = Math.min((data.attendees / data.capacity) * 100, 100);
  const isRegistered = data.viewerRsvpStatus === "confirmed";
  const isWaitlisted = data.viewerRsvpStatus === "waitlisted";
  const isWaitlistMode = data.status === "Waitlist" || isFull;
  const isLockedEvent = data.status === "Locked" && !isRegistered;
  const isPaid = data.priceCents > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setLoading(true);
          setOpen(true);
        }}
        className={
          className ??
          "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-center text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)] hover:text-[color:var(--surface-deep)]"
        }
      >
        Details
      </button>

      {open && mounted
        ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-modal-title"
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow">
            <div className="relative h-52 w-full shrink-0 overflow-hidden border-b-2 border-[color:var(--line)] sm:h-72">
              <Image
                src={data.image}
                alt={data.imageAlt}
                fill
                sizes="(min-width: 768px) 672px, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--ink)]/40 via-transparent to-transparent" />
              <span className="absolute left-4 top-4 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-wider text-[color:var(--surface-deep)] hard-shadow-sm">
                {data.status}
              </span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 sm:p-8">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                {data.date} · {data.time} · {data.category}
                {loading ? " · refreshing…" : ""}
              </p>
              <h2
                id="event-modal-title"
                className="font-display mt-2 text-3xl font-light leading-tight sm:text-4xl"
              >
                {data.title}
              </h2>
              <p className="mt-2 text-sm font-semibold text-[color:var(--mauve)]">
                Hosted by {data.host} <span className="opacity-50">·</span> {data.group}
              </p>

              <p className="mt-5 text-base leading-7 text-[color:var(--ink)]">
                {data.description}
              </p>

              {data.relationshipGoal ? (
                <div className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-4">
                  <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                    Why this event ✷
                  </p>
                  <p className="mt-1 text-sm font-bold leading-6">{data.relationshipGoal}</p>
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
                  <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                    Location
                  </p>
                  {isLockedEvent ? (
                    <p className="mt-1 text-sm font-bold leading-6">
                      🔒 {data.suburb} — venue revealed after RSVP.
                    </p>
                  ) : (
                    <>
                      <p className="mt-1 text-sm font-bold leading-6">{data.location}</p>
                      {data.address ? (
                        <p className="text-sm font-medium text-[color:var(--mauve)]">
                          {data.address}
                        </p>
                      ) : null}
                      <p className="text-sm font-medium text-[color:var(--mauve)]">
                        {data.suburb}
                      </p>
                    </>
                  )}
                </div>
                <div>
                  <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                    Price
                  </p>
                  <p className="font-display mt-1 text-2xl font-light leading-tight">
                    {data.price}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex justify-between text-xs font-bold text-[color:var(--mauve)]">
                  <span>Seats</span>
                  <span>{isFull ? "Full" : `${seatsLeft} of ${data.capacity} left`}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)]">
                  <div
                    className={`h-full rounded-full ${isFull ? "bg-[color:var(--ink)]" : "bg-[color:var(--rose)]"}`}
                    style={{ width: `${fullness}%` }}
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-2">
                {isRegistered || isWaitlisted ? (
                  <EventRegistrationButton
                    eventId={data.id}
                    initiallyRegistered
                    isWaitlist={isWaitlisted}
                  />
                ) : isPaid && !isWaitlistMode ? (
                  <EventPaymentButton eventId={data.id} priceLabel={data.price} />
                ) : (
                  <EventRegistrationButton
                    eventId={data.id}
                    initiallyRegistered={false}
                    isWaitlist={isWaitlistMode}
                  />
                )}

                <EventBookmarkButton eventId={data.id} initiallySaved={bookmarked} />

                <Link
                  href={`/events/${data.id}`}
                  className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-center text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)] hover:text-[color:var(--surface-deep)]"
                >
                  View full page
                </Link>
              </div>
            </div>
          </div>
        </div>,
            document.body,
          )
        : null}
    </>
  );
}
