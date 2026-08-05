"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Branded replacement for window.confirm / window.prompt.
 *
 * Why: native dialogs are an off-brand, jarring break in the warm surface and
 * can't carry a reason field cleanly. This is a controlled modal - drive it
 * with local state - that covers both a plain confirm and a "prompt" (reject
 * reason) in one component, styled on the Click DS (white card, soft shadow,
 * eyebrow header, ck-btn actions).
 *
 * Usage (confirm):
 *   const [open, setOpen] = useState(false);
 *   <ConfirmDialog
 *     open={open}
 *     title="Delete this tag?"
 *     description="It will be removed from every event and member."
 *     confirmLabel="Delete tag"
 *     tone="rose"
 *     onConfirm={() => { setOpen(false); doDelete(); }}
 *     onCancel={() => setOpen(false)}
 *   />
 *
 * Usage (prompt - collects a reason, passed to onConfirm):
 *   <ConfirmDialog open={open} title="Reject this event?"
 *     promptLabel="Reason (shared with the merchant)" promptRequired
 *     confirmLabel="Reject event" tone="rose"
 *     onConfirm={(reason) => reject(reason)} onCancel={() => setOpen(false)} />
 */
/**
 * READ THIS BEFORE PICKING A TONE - the three strings are historic palette
 * names and two of them now say the opposite of what they paint:
 *
 *   "rose"  -> DESTRUCTIVE. Renders .ck-btn--danger (--danger #B5362F).
 *              The token --rose itself resolves to Deep Purple these days; the
 *              tone string does NOT reach for it. This is the default.
 *   "ink"   -> neutral. Renders the one flat Deep Purple .ck-btn--primary.
 *   "peach" -> affirmative. ALSO .ck-btn--primary, identical to "ink" - it only
 *              changes the default header eyebrow to "Heads up". The token
 *              --peach resolves to Lavender, and there is no coral CTA in the
 *              DS, so nothing here is ever a status colour.
 *
 * The strings are kept rather than renamed because ~a dozen call sites pass
 * them. If they are ever renamed, "danger" | "neutral" | "affirmative" is the
 * honest vocabulary.
 */
type Tone = "rose" | "ink" | "peach";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Confirm-button tone - see the Tone doc above; the names are historic. */
  tone?: Tone;
  /** Disables the buttons + shows a working state (e.g. during the await). */
  busy?: boolean;
  /** Small eyebrow label in the header; defaults from tone. */
  badge?: string;
  /** When set, renders an input/textarea and passes its value to onConfirm. */
  promptLabel?: string;
  promptPlaceholder?: string;
  promptRequired?: boolean;
  promptMultiline?: boolean;
  promptDefaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export function ConfirmDialog(props: ConfirmDialogProps) {
  // Gate on `open` at the wrapper so the body MOUNTS FRESH each time it opens  - 
  // that resets the prompt field via useState init (no setState-in-effect), and
  // scopes the focus/scroll-lock effects to exactly the open lifetime. These
  // dialogs are always user-triggered, so `open` is false during SSR/hydration
  // and the portal is purely client-side once shown.
  if (!props.open || typeof document === "undefined") return null;
  return <ConfirmDialogBody {...props} />;
}

function ConfirmDialogBody({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "rose",
  busy = false,
  badge,
  promptLabel,
  promptPlaceholder,
  promptRequired = false,
  promptMultiline = true,
  promptDefaultValue = "",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [value, setValue] = useState(promptDefaultValue);
  const titleId = useId();
  const descId = useId();
  const initialFocusRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Keep the latest busy/onCancel for the mount-scoped key handler without
  // re-running the focus effect (which would steal focus on every keystroke).
  // Synced in an effect - never mutated during render.
  const latest = useRef({ busy, onCancel });
  useEffect(() => {
    latest.current = { busy, onCancel };
  });

  // Focus the first control on open, lock body scroll, wire Escape, and restore
  // focus to the trigger on close. Mount-scoped, so no setState in an effect.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const raf = window.requestAnimationFrame(() => initialFocusRef.current?.focus());

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !latest.current.busy) {
        e.preventDefault();
        latest.current.onCancel();
        return;
      }
      // Focus trap: keep Tab/Shift+Tab cycling inside the dialog so focus can't
      // wander to the (inert) page behind the aria-modal surface.
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
  }, []);

  const confirmDisabled = busy || (Boolean(promptLabel) && promptRequired && value.trim() === "");

  function submit() {
    if (confirmDisabled) return;
    onConfirm(value.trim());
  }

  const headerBadge = badge ?? (tone === "peach" ? "Heads up" : "Confirm");

  // rose = destructive -> danger red; ink/peach = neutral/affirmative -> the
  // one Deep Purple primary. Status colours never land on a CTA.
  const confirmClasses = tone === "rose" ? "ck-btn--danger" : "ck-btn--primary";

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cancel"
        tabIndex={-1}
        onClick={() => !busy && onCancel()}
        className="absolute inset-0 cursor-default bg-[color:var(--surface-deep)]/45 backdrop-blur-[2px]"
      />
      <div
        ref={cardRef}
        className="step-enter-fwd relative z-10 w-full max-w-md rounded-[20px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-lg)] sm:p-7"
      >
        <span className="eyebrow">{headerBadge}</span>
        <h2
          id={titleId}
          className="font-display mt-4 text-2xl font-semibold leading-tight tracking-[-0.025em] text-[color:var(--ink)] sm:text-3xl"
        >
          {title}
        </h2>
        {description ? (
          <p id={descId} className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            {description}
          </p>
        ) : null}

        {promptLabel ? (
          <label className="mt-5 block">
            <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
              {promptLabel}
            </span>
            {promptMultiline ? (
              <textarea
                ref={(el) => {
                  initialFocusRef.current = el;
                }}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={promptPlaceholder}
                rows={3}
                disabled={busy}
                className="mt-2 w-full resize-none rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-4 py-3 text-base leading-6 text-[color:var(--ink)] placeholder:text-[color:var(--ink-faint)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)] disabled:opacity-60"
              />
            ) : (
              <input
                ref={(el) => {
                  initialFocusRef.current = el;
                }}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={promptPlaceholder}
                disabled={busy}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="mt-2 w-full rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-4 py-3 text-base text-[color:var(--ink)] placeholder:text-[color:var(--ink-faint)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)] disabled:opacity-60"
              />
            )}
          </label>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            ref={
              promptLabel
                ? undefined
                : (el) => {
                    initialFocusRef.current = el;
                  }
            }
            type="button"
            onClick={() => !busy && onCancel()}
            disabled={busy}
            className="ck-btn ck-btn--secondary ck-btn--md"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={confirmDisabled}
            className={`ck-btn ck-btn--md ${confirmClasses}`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
