"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-level error boundary for the merchant portal. Branded like the global
 * not-found page (confetti field, champagne card, sticker eyebrow, display
 * headline) but with a `reset()` retry as the primary action — most portal
 * errors are a transient DB/Stripe read that succeeds on a second attempt.
 */
export default function MerchantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the failure in the server/client logs for triage.
    console.error("Merchant portal error:", error);
  }, [error]);

  return (
    <main className="paper-noise relative min-h-screen overflow-hidden px-4 py-20 text-[color:var(--ink)] sm:px-6">
      <section className="relative z-10 mx-auto max-w-2xl rounded-[18px] bg-[color:var(--paper)] p-10 text-center shadow-[var(--shadow-sm)]">
        <span className="sticker sticker--rose inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--champagne)] pulse-ring" />
          Something didn’t click
        </span>
        <h1 className="font-display mt-6 text-5xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-6xl">
          Your portal hit a <span className="text-[color:var(--purple)]">snag</span>.
        </h1>
        <p className="mt-5 text-base font-medium leading-7 text-[color:var(--slate)]">
          We couldn’t load this part of the merchant portal. It’s usually a
          passing hiccup - give it another go, or head back to your dashboard.
        </p>
        {error.digest ? (
          <p className="mt-4 text-xs font-semibold tracking-wide text-[color:var(--slate)]">
            Ref · {error.digest}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="ck-btn ck-btn--primary ck-btn--md"
          >
            Try again
          </button>
          <Link href="/merchant" className="ck-btn ck-btn--secondary ck-btn--md">
            Merchant dashboard
          </Link>
          <Link href="/" className="ck-btn ck-btn--ghost ck-btn--md">
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
