"use client";

import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { ModalShell } from "./modal-shell";

// The publishable key is inlined at build time for the client; when it's
// missing the button never opens this modal (it falls back to a hosted
// redirect), so the null branch below is the "not configured" state.
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// Stripe.js is fetched on FIRST CHECKOUT, not on module evaluation. Calling
// loadStripe() at the top level made merely importing this file (EventCard →
// EventDetailModal → EventPaymentButton) pull js.stripe.com plus Stripe's
// m.stripe.network fingerprinting frame on every browse page. Memoised so
// re-renders and a second modal reuse the one promise.
let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripe() {
  if (!publishableKey) return null;
  stripePromise ??= loadStripe(publishableKey);
  return stripePromise;
}

// On-page Stripe Embedded Checkout in a modal. Stripe redirects the top window
// to the session's return_url on completion, so there's no onComplete handler -
// the event page reconciles via `?booked=1&session_id=`. The shopper closes the
// modal (or presses Escape) to back out; the held seat expires on its own.
export function EventCheckoutModal({
  clientSecret,
  onClose,
}: {
  clientSecret: string;
  onClose: () => void;
}) {
  const stripe = getStripe();

  return (
    // Escape, the scrim and the body-scroll lock come from ModalShell now. The
    // local copy this replaced restored body overflow to "" rather than to what
    // it had been, so backing out of checkout that was opened from inside the
    // event quick-view unlocked the page behind a modal that was still open.
    <ModalShell
      onClose={onClose}
      label="Secure checkout"
      /* Pinned to the top: the Stripe frame is tall and grows as the buyer moves
         between payment methods, and a vertically centred card that outgrows the
         viewport loses its top edge with no way to scroll back to it. */
      align="start"
      /* Above the event quick-view (z-100) that can open this, and below the
         login gate (z-200) a 401 raises. Before the shell this modal was a DOM
         descendant of the quick-view and inherited its stacking context; now it
         portals to <body> and has to out-rank it explicitly. */
      zIndex={140}
      /* The focus trap walks the card's own focusable nodes, and its selector
         cannot see inside a cross-origin iframe. Leaving the trap on would fence
         the buyer OUT of the Stripe card fields - the trap would keep yanking
         focus back to the ✕. Stripe's own frame manages focus internally. */
      trapFocus={false}
      scrimClassName="bg-[color:var(--ink)]/70 backdrop-blur-sm"
      /* my-4 on the CARD, not py-8 on the wrapper: the shell already sets p-4
         there, and stacking a py-* on top of a p-* would leave the result up to
         utility ordering. 1rem of shell padding + 1rem of margin is the same 2rem
         of breathing room this modal had before. */
      cardClassName="my-4 w-full max-w-xl rounded-[var(--radius-xl)] bg-[color:var(--paper)] p-4 shadow-[var(--shadow-lg)] sm:p-6"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="grid gap-2">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-[color:var(--lavender-100)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--purple-700)]">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Secure checkout
          </span>
          <p className="text-xs font-medium text-[color:var(--slate)]">
            Card details go straight to Stripe - never our servers
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-[color:var(--slate)] hover:bg-[color:var(--lavender-100)] hover:text-[color:var(--ink)]"
        >
          ✕
        </button>
      </div>
      {stripe ? (
        // The skeleton sits BEHIND the provider and the min-height holds the
        // box open, because Stripe's iframe starts at zero height while it
        // boots - so this used to be a collapsed empty rectangle for the
        // seconds right after a payment tap. Presentation only: the provider
        // and its mount order are untouched, the placeholder is just painted
        // underneath and covered when the iframe arrives.
        <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-2 sm:p-3">
          <div className="skeleton absolute inset-2 rounded-xl sm:inset-3" aria-hidden />
          <div className="relative">
            <EmbeddedCheckoutProvider
              stripe={stripe}
              options={{ clientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        </div>
      ) : (
        <p className="p-4 text-sm font-medium text-[color:var(--danger)]">
          Payments aren&apos;t configured in this environment.
        </p>
      )}
      <p className="mt-3 text-center text-xs font-medium text-[color:var(--slate)]">
        Powered by Stripe · Press Esc to cancel
      </p>
    </ModalShell>
  );
}
