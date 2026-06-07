"use client";

import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { useEffect } from "react";

// Loaded once per page. The publishable key is inlined at build time for the
// client; when it's missing the button never opens this modal (it falls back to
// a hosted redirect), so the non-null assertion is safe at the call site.
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

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
        className="relative w-full max-w-xl rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4 hard-shadow sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="grid gap-2">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-wider text-[color:var(--surface-deep)] hard-shadow-sm">
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
            <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              Card details go straight to Stripe — never our servers
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
          >
            ✕
          </button>
        </div>
        {stripePromise ? (
          <div className="overflow-hidden rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-2 sm:p-3">
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ clientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        ) : (
          <p className="p-4 text-sm font-bold text-[color:var(--rose)]">
            Payments aren&apos;t configured in this environment.
          </p>
        )}
        <p className="mt-3 text-center font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          Powered by Stripe · Press Esc to cancel
        </p>
      </div>
    </div>
  );
}
