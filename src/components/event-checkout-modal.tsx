"use client";

import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { useEffect } from "react";

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
// to the session's return_url on completion, so there's no onComplete handler —
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

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[color:var(--ink)]/70 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Secure checkout"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rounded-[var(--radius-xl)] bg-[color:var(--paper)] p-4 shadow-[var(--shadow-lg)] sm:p-6"
        onClick={(event) => event.stopPropagation()}
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
          <div className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-2 sm:p-3">
            <EmbeddedCheckoutProvider
              stripe={stripe}
              options={{ clientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        ) : (
          <p className="p-4 text-sm font-medium text-[color:var(--danger)]">
            Payments aren&apos;t configured in this environment.
          </p>
        )}
        <p className="mt-3 text-center text-xs font-medium text-[color:var(--slate)]">
          Powered by Stripe · Press Esc to cancel
        </p>
      </div>
    </div>
  );
}
