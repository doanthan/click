import Link from "next/link";
import type { ReactNode } from "react";

type SectionIntroProps = {
  eyebrow: string;
  title: ReactNode;
  body?: string;
  invert?: boolean;
};

export function SectionIntro({ eyebrow, title, body, invert = false }: SectionIntroProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
      <div>
        <p className={`eyebrow ${invert ? "!text-[color:var(--peach)]" : ""}`}>{eyebrow}</p>
        <h2
          className={`font-display mt-3 text-5xl font-light leading-[0.95] tracking-tight sm:text-6xl ${
            invert ? "text-[color:var(--champagne)]" : "text-[color:var(--ink)]"
          }`}
        >
          {title}
        </h2>
      </div>
      {body ? (
        <p
          className={`text-base font-medium leading-7 lg:max-w-xl lg:justify-self-end ${
            invert ? "text-[color:var(--champagne)]/72" : "text-[color:var(--mauve)]"
          }`}
        >
          {body}
        </p>
      ) : null}
    </div>
  );
}

type PageHeroProps = {
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
};

export function PageHero({ eyebrow, title, body, children }: PageHeroProps) {
  // Tight by default — most pages just need a labelled title above content,
  // not a full-screen marquee. Side content (children) gets equal weight on
  // wide screens; without it, the text column stays narrow and readable.
  return (
    <section className="relative overflow-hidden border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="paper-noise pointer-events-none absolute inset-0 opacity-80" />
      <div
        className={`relative z-10 mx-auto grid max-w-7xl gap-6 ${
          children ? "lg:grid-cols-[0.9fr_1.1fr] lg:items-end" : ""
        }`}
      >
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="font-display mt-2 text-3xl font-light italic leading-[0.98] tracking-tight text-[color:var(--ink)] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[color:var(--mauve)] sm:text-base">
            {body}
          </p>
        </div>
        {children}
      </div>
    </section>
  );
}

type MetricTone = "peach" | "rose" | "cream" | "ink" | "aqua" | "pink" | "white";

export function MetricCard({ label, value, tone = "peach" }: { label: string; value: string; tone?: MetricTone }) {
  // legacy aliases → new palette
  const t = tone === "aqua" ? "peach" : tone === "pink" ? "rose" : tone === "white" ? "cream" : tone;
  const palette =
    t === "rose"
      ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)] border-[color:var(--line)]"
      : t === "cream"
        ? "bg-[color:var(--cream)] text-[color:var(--ink)] border-[color:var(--line)]"
        : t === "ink"
          ? "bg-[color:var(--ink)] text-[color:var(--champagne)] border-[color:var(--line)]"
          : "bg-[color:var(--peach)] text-[color:var(--surface-deep)] border-[color:var(--line)]";

  return (
    <article className={`rounded-2xl border ${palette} hard-shadow-sm p-5`}>
      <p className="font-condensed text-[0.72rem] font-semibold uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="font-display mt-2 text-5xl font-light leading-none tracking-[-0.02em] tabular-nums">{value}</p>
    </article>
  );
}

type InfoAccent = "peach" | "rose" | "ink" | "cream" | "aqua" | "pink" | "mauve";

export function InfoCard({
  eyebrow,
  title,
  body,
  accent = "peach",
}: {
  eyebrow?: string;
  title: string;
  body: string;
  accent?: InfoAccent;
}) {
  // legacy aliases → new palette
  const a = accent === "aqua" ? "peach" : accent === "pink" ? "rose" : accent === "mauve" ? "ink" : accent;
  const accentBar =
    a === "rose"
      ? "bg-[color:var(--rose)]"
      : a === "ink"
        ? "bg-[color:var(--ink)]"
        : a === "cream"
          ? "bg-[color:var(--punch)]"
          : "bg-[color:var(--peach)]";

  return (
    <article className="group relative rounded-2xl border border-[color:var(--line)] bg-[color:var(--cream)] p-6 transition-all duration-300 hover:-translate-y-1 hard-shadow-sm hover:hard-shadow">
      <span className={`block h-1.5 w-12 rounded-full ${accentBar}`} />
      {eyebrow ? <p className="eyebrow mt-5">{eyebrow}</p> : null}
      <h3 className="font-display mt-3 text-3xl font-light leading-[1.04] tracking-[-0.02em] text-[color:var(--ink)]">
        {title}
      </h3>
      <p className="mt-3 text-[0.95rem] leading-7 text-[color:var(--mauve)]">{body}</p>
    </article>
  );
}

type PillTone = "cream" | "peach" | "rose" | "ink" | "aqua" | "pink" | "white";

export function Pill({
  children,
  tone = "cream",
  href,
}: {
  children: ReactNode;
  tone?: PillTone;
  href?: string;
}) {
  // legacy aliases → new palette
  const t = tone === "aqua" ? "peach" : tone === "pink" ? "rose" : tone === "white" ? "cream" : tone;
  const palette =
    t === "rose"
      ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
      : t === "ink"
        ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
        : t === "peach"
          ? "bg-[color:var(--peach)] text-[color:var(--surface-deep)]"
          : "bg-[color:var(--cream)] text-[color:var(--ink)]";

  const base = `inline-flex max-w-full min-w-0 items-center whitespace-normal break-words rounded-full border border-[color:var(--line)] ${palette} px-3.5 py-1.5 text-left font-condensed text-[0.72rem] font-semibold uppercase tracking-[0.12em]`;

  if (href) {
    return (
      <Link
        href={href}
        className={`${base} transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--ink)] active:translate-y-0 active:brightness-[0.97]`}
      >
        {children}
      </Link>
    );
  }

  return <span className={base}>{children}</span>;
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "light" | "ink";
}) {
  // River button voice: solid near-black primary, ghost secondary, electric
  // lime as the "pop" CTA (great on dark bands). Sentence-case, soft lift.
  const className =
    variant === "secondary"
      ? "border border-[color:var(--line-strong)] bg-transparent text-[color:var(--ink)] hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)] hover:border-transparent"
      : variant === "light"
        ? "bg-[color:var(--peach)] text-[color:var(--surface-deep)] hover:brightness-95 shadow-[0_1px_2px_rgba(22,24,29,0.06)]"
        : variant === "ink"
          ? "bg-[color:var(--surface-deep)] text-[color:var(--on-deep)] hover:bg-black shadow-[0_1px_2px_rgba(22,24,29,0.06)]"
          : "bg-[color:var(--surface-deep)] text-[color:var(--on-deep)] hover:bg-black shadow-[0_1px_2px_rgba(22,24,29,0.06)]";

  return (
    <Link
      href={href}
      className={`group/btn inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[0.95rem] font-semibold tracking-[-0.005em] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:brightness-[0.97] ${className}`}
    >
      {children}
      <span aria-hidden className="inline-block text-base transition-transform duration-300 group-hover/btn:translate-x-1">→</span>
    </Link>
  );
}
