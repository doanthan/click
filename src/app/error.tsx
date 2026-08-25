"use client";

import Link from "next/link";
import { SUPPORT_EMAIL_DEFAULT } from "@/lib/email-templates/tokens";
import { useEffect } from "react";

/**
 * Global route error boundary.
 *
 * This is the root-segment `error.tsx`, so it still renders inside the root
 * layout (the site header + footer stay painted) and stands in for any page or
 * nested layout that throws. Full-page branded recovery card modelled on
 * `not-found.tsx`, with `reset()` to retry and a link home.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled route error:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-20 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-2xl rounded-[var(--radius-xl)] bg-[color:var(--paper)] p-10 text-center shadow-[var(--shadow-sm)]">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="font-display mt-5 text-[length:var(--text-h1)] font-semibold leading-tight tracking-[-0.02em]">
          That didn&rsquo;t <span className="text-[color:var(--purple)]">click</span>.
        </h1>
        <p className="mt-4 text-base leading-7 text-[color:var(--slate)]">
          An unexpected error got in the way. It&rsquo;s not you - try again, and if it
          keeps happening, head back home and give it a moment.
        </p>
        {error.digest ? (
          <p className="mt-3 text-[12.5px] font-medium text-[color:var(--slate)]">
            {/* A reference is only worth printing if it can be sent somewhere.
                It used to sit here alone, so the one person who bothered to
                copy it had nowhere to put it. */}
            Ref <span className="font-semibold">{error.digest}</span> - send it to{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL_DEFAULT}?subject=${encodeURIComponent(
                `Error ref ${error.digest}`,
              )}`}
              className="font-semibold text-[color:var(--purple)] underline underline-offset-2"
            >
              {SUPPORT_EMAIL_DEFAULT}
            </a>{" "}
            and we will take a look.
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="ck-btn ck-btn--primary ck-btn--md">
            Try again
          </button>
          <Link href="/" className="ck-btn ck-btn--secondary ck-btn--md">
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
