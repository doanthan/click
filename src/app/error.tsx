"use client";

import Link from "next/link";
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
    <main className="paper-noise relative min-h-screen overflow-hidden px-4 py-20 text-[color:var(--ink)] sm:px-6">
      <section className="relative z-10 mx-auto max-w-2xl rounded-3xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-10 text-center hard-shadow">
        <span className="sticker sticker--rose tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--surface-deep)] pulse-ring" />
          Something went wrong
        </span>
        <h1 className="font-display mt-6 text-5xl font-bold leading-[0.96] tracking-[-0.025em] sm:text-6xl">
          That didn’t <span className="text-[color:var(--coral)]">click</span>.
        </h1>
        <p className="mt-5 text-base font-medium leading-7 text-[color:var(--mauve)]">
          An unexpected error got in the way. It’s not you — try again, and if it
          keeps happening, head back home and give it a moment.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Ref {error.digest}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
          >
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
