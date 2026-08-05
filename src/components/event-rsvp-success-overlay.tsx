"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fireBrandConfetti } from "./brand-confetti";

export type EventSuccessDetails = {
  title: string;
  dateLabel: string;
  timeLabel: string;
  location: string;
  suburb: string;
  slug: string;
  calendarUrl: string;
};

export function EventRsvpSuccessOverlay({
  details,
  onClose,
}: {
  details: EventSuccessDetails;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The 66 lines of hand-rolled canvas physics that used to live here started
    // their RAF loop unconditionally, and the global reduced-motion CSS block
    // cannot reach a JS canvas - so a user who had asked the OS for less motion
    // got a full-screen particle storm at the emotional peak of the flow.
    // fireBrandConfetti guards with window.matchMedia (brand-confetti.ts) and is
    // the same burst every other celebration in the app already uses.
    void fireBrandConfetti({ x: 0.5, y: 0.4 });

    // Focus + trap + restore. This card can now open on its own after a paid
    // return, so leaving focus behind on the page under a scroll-locked scrim
    // would strand a keyboard user outside a dialog they never opened.
    const previouslyFocused = document.activeElement;
    const raf = window.requestAnimationFrame(() => cardRef.current?.focus());

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const card = cardRef.current;
        if (!card) return;
        const focusables = Array.from(
          card.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (!card.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rsvp-success-title"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-[color:var(--surface-deep)]/70 backdrop-blur-sm" />

      {/* The card is capped and scrolls: a long venue name on a short phone
          used to push the three actions past the bottom of the screen. The cap
          stays inside the wrapper's padding box, because a centred flex child
          that outgrows its container loses its top edge with no way to reach
          it. */}
      <div
        ref={cardRef}
        tabIndex={-1}
        className="rise-soft relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[var(--radius-xl)] bg-[color:var(--paper)] p-7 text-center shadow-[var(--shadow-lg)] outline-none"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-lg text-[color:var(--slate)] hover:bg-[color:var(--lavender-100)] hover:text-[color:var(--ink)]"
        >
          ✕
        </button>

        <p className="eyebrow">Click ✷</p>
        <h2
          id="rsvp-success-title"
          className="font-display mt-2 text-4xl font-semibold leading-tight tracking-[-0.025em] text-[color:var(--ink)]"
        >
          You&apos;re in!
        </h2>

        <div className="rise-soft rise-d1 mt-5 rounded-2xl bg-[color:var(--champagne-deep)] p-5 text-left">
          <p className="font-display text-2xl font-semibold leading-tight tracking-[-0.025em] text-[color:var(--ink)]">
            {details.title}
          </p>
          <p className="mt-3 text-sm font-semibold text-[color:var(--ink)]">
            {details.dateLabel}
          </p>
          <p className="text-sm font-medium text-[color:var(--slate)]">
            {details.timeLabel}
          </p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--ink)]">
            {details.location}
          </p>
          <p className="text-sm font-medium text-[color:var(--slate)]">
            {details.suburb}
          </p>
        </div>

        <div className="rise-soft rise-d2 mt-6 grid gap-2">
          <a
            href={details.calendarUrl}
            target="_blank"
            rel="noreferrer"
            className="ck-btn ck-btn--md ck-btn--full ck-btn--primary"
          >
            Add to calendar
          </a>
          <Link
            href="/confirmed-events"
            className="ck-btn ck-btn--md ck-btn--full ck-btn--secondary"
          >
            See my confirmed events
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="ck-btn ck-btn--md ck-btn--full ck-btn--ghost"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The paid path's completion moment.
 *
 * A finished Stripe checkout returns to `?booked=1` and used to land on a quiet
 * banner, while the free RSVP - the smaller commitment - got the overlay. This
 * mounts the same celebration for the people who actually paid. It reads only
 * already-reconciled registration state: no amount, no session creation, no part
 * of the Stripe call sequence is involved.
 *
 * Fires once per checkout. The "already celebrated" flag is read in an EFFECT,
 * never in a useState initializer, because the server render cannot see
 * sessionStorage and a first client render that disagreed would be a hydration
 * mismatch.
 */
export function EventBookedCelebration({
  details,
  celebrationKey,
}: {
  details: EventSuccessDetails;
  /** Stable per checkout - the Stripe session id where there is one. */
  celebrationKey: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const key = `click:booked-celebrated:${celebrationKey}`;
    // Inside a frame callback rather than straight in the effect body: a
    // celebration is a post-paint flourish, and this is the same idiom
    // coordination-drawer.tsx uses to keep setState out of an effect body.
    const frame = window.requestAnimationFrame(() => {
      try {
        if (window.sessionStorage.getItem(key)) return;
        window.sessionStorage.setItem(key, "1");
      } catch {
        // Storage blocked (private mode, locked-down browser): celebrate anyway.
        // The cost of a repeat on refresh is far below the cost of never firing.
      }
      setOpen(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [celebrationKey]);

  if (!open) return null;
  return <EventRsvpSuccessOverlay details={details} onClose={() => setOpen(false)} />;
}
