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

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
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
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          {/* Definite Ink scrim - the white card must separate clearly from the
              cream page behind it. */}
          <div className="absolute inset-0 bg-[rgba(28,24,48,0.5)]" />
          <div
            ref={dialogRef}
            className="relative w-full max-w-md rounded-[var(--radius-xl)] bg-[color:var(--paper)] p-6 shadow-[0_12px_32px_rgba(28,24,48,0.14),0_2px_6px_rgba(28,24,48,0.08)]"
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
