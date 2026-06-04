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
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Secure checkout
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
          >
            Close
          </button>
        </div>
        {stripePromise ? (
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ clientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        ) : (
          <p className="p-4 text-sm font-bold text-[color:var(--rose)]">
            Payments aren&apos;t configured in this environment.
          </p>
        )}
      </div>
    </div>
  );
}
