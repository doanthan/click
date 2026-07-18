"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Reveal - marks its children with .is-in once they scroll into view, driving
 * the .reveal transition in globals.css. Progressive enhancement only: the
 * hidden state lives behind `(scripting: enabled) and (prefers-reduced-motion:
 * no-preference)`, so no-JS and reduced-motion visitors always see content.
 *
 * `delay` (ms) staggers siblings that enter together, e.g. cards in a row.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Cancels the CSS reveal-fallback safety valve now that JS is live.
    el.classList.add("js-live");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={["reveal", className].filter(Boolean).join(" ")}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
