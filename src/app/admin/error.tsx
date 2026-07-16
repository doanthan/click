"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Admin content-column error boundary.
 *
 * Scoped to a single admin route segment, so it renders INSIDE the admin
 * layout's content slot - the <AdminSidebar> is still painted around it. That
 * means NO `min-h-screen` and NO sidebar here; just the branded recovery card
 * filling the content column. Visual modelled on `not-found.tsx`.
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
    <section className="relative overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] px-6 py-16 text-center text-[color:var(--ink)] sm:px-10">
      <div className="relative z-10 mx-auto max-w-xl">
        <span className="eyebrow">Something broke</span>
        <h1 className="font-display mt-6 text-4xl font-semibold leading-tight tracking-[-0.025em] sm:text-5xl">
          This panel didn’t <span className="text-[color:var(--purple)]">click</span>.
        </h1>
        <p className="mt-5 text-base leading-7 text-[color:var(--slate)]">
          An error interrupted this admin view. The rest of the portal is fine -
          try the panel again, or head back to the dashboard.
        </p>
        {error.digest ? (
          <p className="mt-3 text-xs font-semibold text-[color:var(--slate)]">
            Ref {error.digest}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="ck-btn ck-btn--primary ck-btn--md">
            Try again
          </button>
          <Link href="/admin" className="ck-btn ck-btn--secondary ck-btn--md">
            Admin dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
