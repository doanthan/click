"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ckBtn } from "./ds";

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
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape, scroll-lock, focus move / trap / restore. Open-scoped, so the
  // cleanup that hands focus back runs exactly when the dialog closes.
  //
  // The trap is not optional here: body scrolling is locked below, so without
  // it Tab walks straight out of the card into a page the user cannot scroll,
  // and a keyboard buyer loses the pay button entirely. Same shape as the
  // proven shell in coordination-drawer.tsx.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;
    const raf = window.requestAnimationFrame(() => dialogRef.current?.focus());

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Tab") {
        const card = dialogRef.current;
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
  }, [open]);

  // The RSVP entry is the DS Button - radius 12, one footprint. "ink" is a
  // quieter secondary for a full/waitlist context.
  const triggerClass =
    triggerTone === "ink" ? ckBtn("secondary", "lg", { full: true }) : ckBtn("primary", "lg", { full: true });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClass}>
        <span className="ck-btn__label">{triggerLabel}</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-dialog-title"
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          {/* Definite Ink scrim - the white card must separate clearly from the
              cream page behind it. `fixed` rather than `absolute` so it still
              covers the viewport if the wrapper itself ever scrolls. */}
          <div className="fixed inset-0 bg-[color:var(--surface-deep)]/50" />
          {/* max-h + overflow-y-auto are load-bearing, not polish: the paid
              panel grows with every named +1 (ticket buttons, up to 3 guest
              rows of 3 fields, consent, refund note, pay). Body scroll is
              locked above, so without a scroll container of its own a tall
              card overflows a phone off both ends and the pay button becomes
              literally unreachable.

              calc(100dvh - 2rem) rather than a flat 92vh so the card is always
              smaller than the wrapper's padding box: a centred flex child that
              outgrows its container has its TOP cut off unreachably, which
              would swap one unreachable end for another on a short landscape
              screen. dvh so mobile browser chrome is accounted for. */}
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[var(--radius-xl)] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-lg)] outline-none"
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
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--lavender-100)] text-[color:var(--slate)] transition-colors hover:text-[color:var(--ink)]"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 text-sm leading-6 text-[color:var(--ink-soft)]">{body}</div>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
