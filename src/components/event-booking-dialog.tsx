"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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

  const triggerClass =
    triggerTone === "ink"
      ? "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--on-deep)] hard-shadow-sm hover:bg-[color:var(--surface-deep)]"
      : "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClass}>
        {triggerLabel}
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
          <div className="absolute inset-0 bg-[color:var(--surface-deep)]/60 backdrop-blur-sm" />
          <div
            ref={dialogRef}
            className="relative w-full max-w-md rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                  Click ✷
                </p>
                <h2
                  id="booking-dialog-title"
                  className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.025em]"
                >
                  {title}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="grid size-9 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 text-sm font-medium leading-6 text-[color:var(--mauve)]">
              {body}
            </div>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
