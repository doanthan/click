"use client";

import { useState, type ReactNode } from "react";
import { ckBtn } from "./ds";
import { ModalShell } from "./modal-shell";

type EventBookingDialogProps = {
  triggerLabel: string;
  triggerTone?: "rose" | "ink";
  title: string;
  body: ReactNode;
  children: ReactNode;
};

export function EventBookingDialog({
  triggerLabel,
  triggerTone = "rose",
  title,
  body,
  children,
}: EventBookingDialogProps) {
  const [open, setOpen] = useState(false);

  // The RSVP entry is the DS Button - radius 12, one footprint. "ink" is a
  // quieter secondary for a full/waitlist context.
  const triggerClass =
    triggerTone === "ink" ? ckBtn("secondary", "lg", { full: true }) : ckBtn("primary", "lg", { full: true });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClass}>
        <span className="ck-btn__label">{triggerLabel}</span>
      </button>

      {/* The scrim, Escape, body-scroll lock and focus move/trap/restore all come
          from ModalShell now - this file used to carry its own copy of that block,
          which is how the four copies drifted apart. Mounted only while open, so
          open/close IS mount/unmount and the shell's cleanup (focus handed back to
          the trigger, previous body overflow restored) runs at exactly the right
          moment. */}
      {open ? (
        <ModalShell
          onClose={() => setOpen(false)}
          labelledBy="booking-dialog-title"
          /* Matches the pre-migration z-[100]: above the page, below the login
             gate at z-200 that a 401 inside this dialog can raise. */
          zIndex={100}
          /* DELIBERATE, DO NOT "FIX": a scrim tap must never dismiss this one.
             The booking panel is where the buyer types guest names, dates of
             birth and emails before paying, and losing all of that to a stray
             tap beside the card is a real loss. Escape and the ✕ stay - both are
             intentional. ModalShell defaults this to true, so it has to be
             passed explicitly here. */
          closeOnScrim={false}
          /* max-h + overflow-y-auto are load-bearing, not polish: the paid panel
             grows with every named +1 (ticket buttons, up to 3 guest rows of 3
             fields, consent, refund note, pay). Body scroll is locked by the
             shell, so without a scroll container of its own a tall card overflows
             a phone off both ends and the pay button becomes literally
             unreachable.

             calc(100dvh - 2rem) rather than a flat 92vh so the card is always
             smaller than the shell's p-4 padding box: a centred flex child that
             outgrows its container has its TOP cut off unreachably, which would
             swap one unreachable end for another on a short landscape screen.
             dvh so mobile browser chrome is accounted for. */
          cardClassName="rise-soft max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[var(--radius-xl)] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-lg)]"
        >
          <div className="flex items-start justify-between gap-3">
            <h2
              id="booking-dialog-title"
              className="font-display text-[1.3rem] leading-tight font-semibold tracking-[-0.01em] text-[color:var(--ink)]"
            >
              {title}
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              // 44px and radius-12: the close on a dialog you commit money in
              // was a 36px pill - under the touch minimum, and pills belong to
              // tags and avatars, not buttons.
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--lavender-100)] text-[color:var(--slate)] transition-colors hover:text-[color:var(--ink)]"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 text-sm leading-6 text-[color:var(--ink-soft)]">{body}</div>
          <div className="mt-6">{children}</div>
        </ModalShell>
      ) : null}
    </>
  );
}
