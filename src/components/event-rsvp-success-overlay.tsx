"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fireBrandConfetti } from "./brand-confetti";
import { ModalShell } from "./modal-shell";

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
  useEffect(() => {
    // The 66 lines of hand-rolled canvas physics that used to live here started
    // their RAF loop unconditionally, and the global reduced-motion CSS block
    // cannot reach a JS canvas - so a user who had asked the OS for less motion
    // got a full-screen particle storm at the emotional peak of the flow.
    // fireBrandConfetti guards with window.matchMedia (brand-confetti.ts) and is
    // the same burst every other celebration in the app already uses.
    //
    // Deliberately its OWN effect with an empty dep array. It used to share the
    // focus/scroll effect, which was keyed on [onClose] - and every caller passes
    // an inline arrow, so any re-render of the parent while this overlay was open
    // re-fired the burst. One completion, one celebration.
    void fireBrandConfetti({ x: 0.5, y: 0.4 });
  }, []);

  return (
    // Focus move/trap/restore, Escape and the body-scroll lock are ModalShell's
    // now. They matter here as much as on any other dialog: this card can open on
    // its own after a paid return, so leaving focus behind on a scroll-locked page
    // would strand a keyboard user outside a dialog they never opened.
    <ModalShell
      onClose={onClose}
      labelledBy="rsvp-success-title"
      /* Above the event quick-view / booking dialog tier (z-100) that this can
         open on top of, and matching the pre-migration z-[120]. canvas-confetti
         paints its own <canvas> on <body> at z-index 100, so the burst stays
         behind this card and in front of the page - unchanged by the portal. */
      zIndex={120}
      /* No scrim dismissal, as before: the three actions here (calendar, my
         confirmed events, Done) are the whole point of the moment, and a stray
         tap beside the card should not skip past them. Escape and ✕ still close. */
      closeOnScrim={false}
      scrimClassName="bg-[color:var(--surface-deep)]/70 backdrop-blur-sm"
      /* Capped and scrolling: a long venue name on a short phone used to push
         the three actions past the bottom of the screen. The cap stays inside
         the shell's p-4 padding box, because a centred flex child that outgrows
         its container loses its top edge with no way to reach it.

         .rise-soft is additive only - the resting state of the card is visible,
         motion never gates it. */
      cardClassName="rise-soft max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[var(--radius-xl)] bg-[color:var(--paper)] p-7 text-center shadow-[var(--shadow-lg)]"
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
    </ModalShell>
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
