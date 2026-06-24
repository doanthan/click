import Link from "next/link";
import type { ReactNode } from "react";

export type LegalSection = {
  heading: string;
  body: ReactNode;
};

export function LegalPage({
  eyebrow,
  title,
  intro,
  lastUpdated,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  lastUpdated: string;
  sections: LegalSection[];
}) {
  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-14 text-[color:var(--ink)] sm:px-6">
      <article className="mx-auto max-w-3xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--coral)]" />
          {eyebrow}
        </span>
        <h1 className="mt-6 font-display text-5xl font-bold leading-[0.98] tracking-[-0.025em] sm:text-6xl">
          {title}
        </h1>
        <p className="mt-3 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          Last updated {lastUpdated}
        </p>

        <p className="mt-6 text-base font-medium leading-7 text-[color:var(--ink)]">{intro}</p>

        {/* In-page contents — quick jump for long policies. */}
        <nav
          aria-label="Contents"
          className="mt-8 rounded-2xl border border-[color:var(--line)] bg-[color:var(--cream)] p-4"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--mauve)]">
            On this page
          </p>
          <ol className="mt-2 grid gap-x-6 gap-y-1 text-sm font-semibold text-[color:var(--ink)] sm:grid-cols-2">
            {sections.map((section, i) => (
              <li key={section.heading}>
                <a
                  href={`#section-${i + 1}`}
                  className="underline decoration-[color:var(--lavender)] decoration-2 underline-offset-4 hover:text-[color:var(--coral)]"
                >
                  {i + 1}. {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-8">
          {sections.map((section, i) => (
            <section key={section.heading} id={`section-${i + 1}`} className="scroll-mt-24">
              <h2 className="font-display text-2xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
                {i + 1}. {section.heading}
              </h2>
              <div className="mt-3 space-y-3 text-sm font-medium leading-7 text-[color:var(--mauve)]">
                {section.body}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 border-t border-[color:var(--line)] pt-6 text-sm font-medium text-[color:var(--mauve)]">
          <p>
            Questions? Email{" "}
            <a
              href="mailto:hello@letsclick.app"
              className="font-bold text-[color:var(--ink)] underline decoration-2 underline-offset-4 hover:text-[color:var(--coral)]"
            >
              hello@letsclick.app
            </a>{" "}
            or see our other policies:{" "}
            <Link href="/terms" className="font-bold underline">Terms</Link>{" · "}
            <Link href="/privacy" className="font-bold underline">Privacy</Link>{" · "}
            <Link href="/security" className="font-bold underline">Security</Link>{" · "}
            <Link href="/refund-policy" className="font-bold underline">Refunds</Link>{" · "}
            <Link href="/safety" className="font-bold underline">Safety</Link>
          </p>
          <p className="mt-4 text-xs leading-6 text-[color:var(--mauve)]/80">
            This page describes how Click works and is provided for general information only. It is
            not legal advice. Click is operated from Sydney, Australia and is intended for residents
            of Australia.
          </p>
        </div>
      </article>
    </main>
  );
}

// Inline placeholder for a hard business fact that must be filled in before launch
// (e.g. the registered operating entity and ABN). Renders as a clearly-marked,
// fill-in token rather than free-flowing prose.
export function Fill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-[color:var(--lavender)]/40 px-1.5 py-0.5 font-mono text-[0.85em] font-bold text-[color:var(--ink)]">
      {children}
    </span>
  );
}

// Retained for backwards compatibility with any older callers. Prefer writing
// finished copy (or using <Fill> for a genuine fill-in) over leaving this in.
export function Pending({ children }: { children: ReactNode }) {
  return (
    <p>
      <span className="font-bold text-[color:var(--coral)]">[LAWYER REVIEW REQUIRED]</span>{" "}
      {children}
    </p>
  );
}
