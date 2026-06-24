"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Admin content-column error boundary.
 *
 * Scoped to a single admin route segment, so it renders INSIDE the admin
 * layout's content slot — the <AdminSidebar> is still painted around it. That
 * means NO `min-h-screen` and NO sidebar here; just the branded paper-noise
 * recovery card filling the content column. Visual modelled on `not-found.tsx`.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the digest in the console so it's correlatable with server logs.
    console.error("Admin route error:", error);
  }, [error]);

  return (
    <section className="paper-noise relative overflow-hidden rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-6 py-16 text-center text-[color:var(--ink)] hard-shadow sm:px-10">
      <div className="relative z-10 mx-auto max-w-xl">
        <span className="sticker sticker--rose tilt-r-1 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--surface-deep)]" />
          Something broke
        </span>
        <h1 className="font-display mt-6 text-4xl font-bold leading-[0.96] tracking-[-0.025em] sm:text-5xl">
          This panel didn’t <span className="text-[color:var(--coral)]">click</span>.
        </h1>
        <p className="mt-5 text-base font-medium leading-7 text-[color:var(--mauve)]">
          An error interrupted this admin view. The rest of the portal is fine —
          try the panel again, or head back to the dashboard.
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
            href="/admin"
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
          >
            Admin dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
