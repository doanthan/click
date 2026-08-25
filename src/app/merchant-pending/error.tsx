"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-level error boundary for the host holding page. Sibling of
 * src/app/merchant/error.tsx - same shape, different exits: whoever lands here
 * has an application in the queue and no portal to be sent to, so the recovery
 * is retry, or use Click as an attendee in the meantime.
 *
 * It exists because the page now fails loudly on a degraded profile read
 * (assertProfileStatusUsable) rather than reading "we could not find out" as
 * "you never applied". The one thing an applicant must not be told by a
 * transient blip is that their application is gone, so this says the opposite
 * out loud.
 */
export default function MerchantPendingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the failure in the server/client logs for triage.
    console.error("Merchant holding page error:", error);
  }, [error]);

  return (
    <main className="paper-noise grid min-h-screen place-items-center bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto w-full max-w-xl rounded-[18px] bg-[color:var(--paper)] p-8 text-center shadow-[var(--shadow-sm)] sm:p-10">
        <span className="sticker sticker--rose inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--champagne)] pulse-ring" />
          Something didn’t click
        </span>
        <h1 className="font-display mt-6 text-4xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-5xl">
          We couldn’t <span className="text-[color:var(--purple)]">check your status</span>.
        </h1>
        <p className="mt-5 text-base font-medium leading-7 text-[color:var(--slate)]">
          Your application is exactly where you left it - we just couldn’t read it
          back this second. It’s usually a passing hiccup, so give it another go.
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
          <Link href="/dashboard" className="ck-btn ck-btn--secondary ck-btn--md">
            Use Click as an attendee
          </Link>
          <Link href="/" className="ck-btn ck-btn--ghost ck-btn--md">
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
