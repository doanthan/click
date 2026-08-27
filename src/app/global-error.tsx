"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * The last-resort boundary, and the one this app was missing.
 *
 * `src/app/error.tsx` is a ROOT-SEGMENT boundary: Next wraps it around the root
 * layout's `children` slot only. Everything the root layout renders BESIDE
 * children - the site header and its account menu, the footer, the notices band
 * - sits outside it. So a server action fired from the avatar menu (the QA
 * persona switcher, sign out) had no boundary of ours at all, and a throw there
 * rendered Next's built-in "This page couldn't load" page: unbranded, no route
 * home, and no hint about what to do next.
 *
 * This file also covers the root layout itself throwing, which `error.tsx` can
 * never catch - it renders inside that layout.
 *
 * It must declare its own <html> and <body>: it REPLACES the root layout rather
 * than rendering inside it, so nothing above it is available - not the font
 * variables, not the header, not the footer. Only globals.css is imported, for
 * the design tokens.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body
        className="min-h-full"
        style={{
          background: "var(--champagne)",
          color: "var(--ink)",
          margin: 0,
          fontFamily: "var(--font-click-body, system-ui, -apple-system, sans-serif)",
        }}
      >
        <main className="min-h-screen px-4 py-20 sm:px-6">
          <section
            className="mx-auto max-w-2xl p-10 text-center"
            style={{
              background: "var(--paper)",
              borderRadius: "var(--radius-xl)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <p className="eyebrow">Something went wrong</p>
            <h1
              className="mt-5 text-[length:var(--text-h1)] font-semibold leading-tight tracking-[-0.02em]"
              style={{ fontFamily: "var(--font-click-display, inherit)" }}
            >
              That didn&rsquo;t <span style={{ color: "var(--purple)" }}>click</span>.
            </h1>
            <p className="mt-4 text-base leading-7" style={{ color: "var(--slate)" }}>
              The page stopped before it could finish loading. Try again - it usually
              works second time. If you were switching test accounts, your QA session
              may simply have run out.
            </p>
            {error.digest ? (
              <p className="mt-3 text-[12.5px] font-medium" style={{ color: "var(--slate)" }}>
                Ref <span className="font-semibold">{error.digest}</span>
              </p>
            ) : null}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={reset} className="ck-btn ck-btn--primary ck-btn--md">
                Try again
              </button>
              {/* A plain anchor, not next/link, and the lint rule is wrong for
                  this one file: this boundary stands in for a root layout that
                  failed to render, so the router is part of what may be broken.
                  A soft navigation would try to reuse it; a full document load
                  is the only exit that cannot fail the same way. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className="ck-btn ck-btn--secondary ck-btn--md">
                Home
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
