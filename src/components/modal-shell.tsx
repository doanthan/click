"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * ModalShell - the scrim, the focus trap, the Escape key and the body-scroll
 * lock, once.
 *
 * That block had been copy-pasted FOUR times (event-booking-dialog,
 * event-checkout-modal, event-rsvp-success-overlay, confirm-dialog) and the
 * copies had already drifted apart: one restored body overflow to "" instead of
 * whatever it was before, one never moved focus into the dialog, one never
 * handed focus back to the trigger. Every one of those is a keyboard user
 * stranded behind a scrim they cannot scroll.
 *
 * Deliberately headless-ish: the shell owns behaviour and the scrim, the CALLER
 * owns the card markup. `cardClassName` is the caller's card, `children` is the
 * caller's content. Nothing here paints inside the card.
 *
 * MOUNT IT ONLY WHILE THE MODAL IS OPEN - `{open ? <ModalShell …/> : null}` -
 * exactly as ConfirmDialog gates its own body today. Every effect below is
 * mount-scoped, so open/close IS mount/unmount: the focus and scroll-lock
 * cleanup then runs at precisely the moment the dialog goes away, and the card
 * remounts fresh each time (which resets any uncontrolled field inside it
 * through useState init, with no setState in an effect).
 *
 * MOTION: the shell ships NO entrance animation on purpose. Its resting state is
 * visible the instant it mounts, and a caller that wants a rise puts .rise-soft
 * or .step-enter-fwd on its own card - additively, never as the thing that makes
 * the card visible. Reduced motion is handled globally in globals.css; there is
 * no per-component media query here and there must not be one.
 *
 * Usage:
 *   const cancelRef = useRef<HTMLButtonElement>(null);
 *   {open ? (
 *     <ModalShell
 *       onClose={() => setOpen(false)}
 *       labelledBy={titleId}
 *       initialFocusRef={cancelRef}
 *       cardClassName="w-full max-w-md rounded-[var(--radius-xl)] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-lg)]"
 *     >
 *       …your card…
 *     </ModalShell>
 *   ) : null}
 */

/* The exact selector all four copies already used. `iframe` is NOT in it, which
   is why a dialog hosting a third-party frame (Stripe Embedded Checkout) has to
   pass trapFocus={false} - a trap that cannot see the frame would fence the
   buyer out of the card fields entirely. */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ALIGN = {
  /** Vertically centred - the default for a dialog that fits the viewport. */
  center: "items-center",
  /** Pinned to the top - for a tall panel that will scroll the wrapper. */
  start: "items-start",
  /** Bottom sheet on phones, centred from sm up. */
  sheet: "items-end sm:items-center",
} as const;

export type ModalShellProps = {
  /** Escape and a scrim tap both route here. Never called while dismissible is false. */
  onClose: () => void;
  /** Accessible name when there is no visible heading to point at. */
  label?: string;
  /** id of the visible heading - prefer this over `label`. */
  labelledBy?: string;
  /** id of the descriptive paragraph, when there is one. */
  describedBy?: string;
  align?: keyof typeof ALIGN;
  /** Applied as an inline style so it always beats a utility class. */
  zIndex?: number;
  /**
   * false while an action is in flight, so Escape and a stray scrim tap cannot
   * close the dialog out from under a request the user already committed to.
   */
  dismissible?: boolean;
  /** Set false when only an explicit button may close the dialog. */
  closeOnScrim?: boolean;
  /** Set false ONLY for a dialog whose content is a third-party iframe. */
  trapFocus?: boolean;
  /** What to focus on open. Defaults to the card itself. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /**
   * Portal to <body>. On by default and you almost never want it off: a
   * `position: fixed` overlay rendered inside a transformed or filtered ancestor
   * is positioned against THAT ancestor, not the viewport, which is the classic
   * "modal is stuck inside the card" bug.
   */
  portal?: boolean;
  /** Scrim treatment. Ink-tinted by default so a white card separates cleanly. */
  scrimClassName?: string;
  /** Extra classes on the positioning wrapper, e.g. "py-8" or "sm:p-8". */
  className?: string;
  /**
   * The caller's card. Give it a max height plus its own scroll container
   * (`max-h-[calc(100dvh-2rem)] overflow-y-auto`) whenever it can grow taller
   * than a phone - body scroll is locked, so a card with no scroll of its own
   * puts its bottom actions somewhere the user physically cannot reach.
   */
  cardClassName?: string;
  children: ReactNode;
};

export function ModalShell(props: ModalShellProps) {
  // Guard before any hook so the hook order can never change: a portal needs a
  // document, and this component is only ever reached on the client anyway.
  if (props.portal !== false && typeof document === "undefined") return null;
  return <ModalShellBody {...props} />;
}

function ModalShellBody({
  onClose,
  label,
  labelledBy,
  describedBy,
  align = "center",
  zIndex = 120,
  dismissible = true,
  closeOnScrim = true,
  trapFocus = true,
  initialFocusRef,
  portal = true,
  scrimClassName = "bg-[color:var(--surface-deep)]/50",
  className = "",
  cardClassName = "",
  children,
}: ModalShellProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  /* The key handler below is mount-scoped, so it would otherwise close over the
     first render's props forever. Mirroring them into a ref - synced in an
     effect, never mutated during render - keeps it reading the CURRENT values
     without re-running the focus/scroll-lock effect on every keystroke, which
     would re-steal focus mid-typing. */
  const latest = useRef({ onClose, dismissible, trapFocus });
  useEffect(() => {
    latest.current = { onClose, dismissible, trapFocus };
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement;

    /* rAF, not a straight call: focus has to land after the browser has laid the
       dialog out, or focusing a node that is still zero-sized silently no-ops. */
    const raf = window.requestAnimationFrame(() => {
      (initialFocusRef?.current ?? cardRef.current)?.focus();
    });

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && latest.current.dismissible) {
        event.preventDefault();
        latest.current.onClose();
        return;
      }

      /* The trap is not polish. Body scroll is locked below, so without it Tab
         walks straight out of the card and onto a page the user cannot scroll -
         and the dialog's own buttons become unreachable. */
      if (event.key === "Tab" && latest.current.trapFocus) {
        const card = cardRef.current;
        if (!card) return;
        const focusables = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
          // offsetParent is null for a hidden node - and for a fixed-position
          // one, hence the activeElement escape hatch so whatever currently
          // holds focus always stays in the cycle.
          (el) => el.offsetParent !== null || el === document.activeElement,
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (!card.contains(active)) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);

    // Restore whatever was there rather than hard-setting "" - a page that was
    // already scroll-locked (a drawer under this dialog) must stay locked.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      // Hand focus back to whatever opened this, so closing does not dump the
      // user at the top of the document.
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
    // initialFocusRef is a useRef object and so stable for the caller's lifetime;
    // listing it satisfies the deps rule without ever actually re-running.
  }, [initialFocusRef]);

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      style={{ zIndex }}
      className={`fixed inset-0 flex justify-center overflow-y-auto p-4 ${ALIGN[align]} ${className}`}
    >
      {/* `fixed`, not `absolute`: the wrapper above can scroll, and an absolute
          scrim would scroll away with it and leave the page bare at the edges. */}
      {closeOnScrim ? (
        <button
          type="button"
          aria-label="Close"
          tabIndex={-1}
          onClick={() => {
            if (dismissible) onClose();
          }}
          className={`fixed inset-0 cursor-default ${scrimClassName}`}
        />
      ) : (
        <div aria-hidden className={`fixed inset-0 ${scrimClassName}`} />
      )}

      {/* tabIndex -1 so the card can receive focus on open without ever landing
          in the Tab order itself. */}
      <div ref={cardRef} tabIndex={-1} className={`relative z-10 outline-none ${cardClassName}`}>
        {children}
      </div>
    </div>
  );

  return portal ? createPortal(content, document.body) : content;
}
