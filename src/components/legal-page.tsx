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
          <span className="size-2 rounded-full bg-[color:var(--rose)]" />
          {eyebrow}
        </span>
        <h1 className="mt-6 font-display text-5xl font-light leading-[0.98] tracking-tight sm:text-6xl">
          {title}
        </h1>
        <p className="mt-3 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          Last updated {lastUpdated}
        </p>

        <div className="mt-6 rounded-2xl border-2 border-dashed border-[color:var(--rose)] bg-[color:var(--cream)] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--rose)]">
            Draft — pending legal review
          </p>
          <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            This document is a structured placeholder for the Click founding team. Sections marked
            <span className="font-bold text-[color:var(--ink)]"> [LAWYER REVIEW REQUIRED] </span>
            must be drafted or approved by a qualified Australian lawyer before launch.
          </p>
        </div>

        <p className="mt-6 text-base font-medium leading-7 text-[color:var(--ink)]">{intro}</p>

        <div className="mt-10 space-y-8">
          {sections.map((section, i) => (
            <section key={section.heading}>
              <h2 className="font-display text-2xl font-light leading-tight text-[color:var(--ink)]">
                {i + 1}. {section.heading}
              </h2>
              <div className="mt-3 space-y-3 text-sm font-medium leading-7 text-[color:var(--mauve)]">
                {section.body}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 border-t-2 border-dashed border-[color:var(--line)] pt-6 text-sm font-medium text-[color:var(--mauve)]">
          Questions? Email{" "}
          <a
            href="mailto:hello@click.com.au"
            className="font-bold text-[color:var(--ink)] underline decoration-2 underline-offset-4 hover:text-[color:var(--rose)]"
          >
            hello@click.com.au
          </a>{" "}
          or see our other policies:{" "}
          <Link href="/terms" className="font-bold underline">Terms</Link>{" · "}
          <Link href="/privacy" className="font-bold underline">Privacy</Link>{" · "}
          <Link href="/refund-policy" className="font-bold underline">Refunds</Link>{" · "}
          <Link href="/safety" className="font-bold underline">Safety</Link>
        </div>
      </article>
    </main>
  );
}

// Shorthand for a paragraph that still needs a lawyer's eyes.
export function Pending({ children }: { children: ReactNode }) {
  return (
    <p>
      <span className="font-bold text-[color:var(--rose)]">[LAWYER REVIEW REQUIRED]</span>{" "}
      {children}
    </p>
  );
}
