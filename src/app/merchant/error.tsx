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
      <section className="relative z-10 mx-auto max-w-2xl rounded-3xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-10 text-center hard-shadow">
        <span className="sticker sticker--rose tilt-l-1 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--ink)] pulse-ring" />
          Something didn’t click
        </span>
        <h1 className="font-display mt-6 text-5xl font-bold leading-[0.96] tracking-[-0.025em] sm:text-6xl">
          Your portal hit a <span className="text-[color:var(--coral)]">snag</span>.
        </h1>
        <p className="mt-5 text-base font-medium leading-7 text-[color:var(--mauve)]">
          We couldn’t load this part of the merchant portal. It’s usually a
          passing hiccup - give it another go, or head back to your dashboard.
        </p>
        {error.digest ? (
          <p className="mt-4 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Ref · {error.digest}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-full border-2 border-[color:var(--surface-deep)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm transition hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)] active:translate-y-px"
          >
            Try again
          </button>
          <Link
            href="/merchant"
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
          >
            Merchant dashboard
          </Link>
          <Link
            href="/"
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--cream)]"
          >
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
