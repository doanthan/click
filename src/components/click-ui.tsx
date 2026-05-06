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
  return (
    <section className="relative overflow-hidden border-b-2 border-[color:var(--ink)] bg-[color:var(--champagne)] px-4 py-14 sm:px-6 lg:py-20">
      <div className="paper-noise pointer-events-none absolute inset-0 opacity-80" />
      <div className="relative z-10 mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="font-display mt-4 text-5xl font-light italic leading-[0.92] tracking-tight text-[color:var(--ink)] sm:text-7xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-[color:var(--mauve)] sm:text-lg">
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
      ? "bg-[color:var(--rose)] text-[color:var(--champagne)] border-[color:var(--ink)]"
      : t === "cream"
        ? "bg-[color:var(--cream)] text-[color:var(--ink)] border-[color:var(--ink)]"
        : t === "ink"
          ? "bg-[color:var(--ink)] text-[color:var(--champagne)] border-[color:var(--ink)]"
          : "bg-[color:var(--peach)] text-[color:var(--ink)] border-[color:var(--ink)]";

  return (
    <article className={`rounded-2xl border-2 ${palette} hard-shadow-sm p-5`}>
      <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="font-display mt-2 text-5xl font-light leading-none">{value}</p>
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
    <article className="group relative rounded-2xl border-2 border-[color:var(--ink)] bg-[color:var(--champagne)] p-6 transition-transform duration-300 hover:-translate-y-1 hover:rotate-[-0.6deg] hard-shadow-sm hover:hard-shadow">
      <span className={`block h-2 w-14 rounded-full ${accentBar}`} />
      {eyebrow ? <p className="eyebrow mt-5">{eyebrow}</p> : null}
      <h3 className="font-display mt-3 text-3xl font-light leading-[1.04] text-[color:var(--ink)]">
        {title}
      </h3>
      <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">{body}</p>
    </article>
  );
}

type PillTone = "cream" | "peach" | "rose" | "ink" | "aqua" | "pink" | "white";

export function Pill({
  children,
  tone = "cream",
}: {
  children: ReactNode;
  tone?: PillTone;
}) {
  // legacy aliases → new palette
  const t = tone === "aqua" ? "peach" : tone === "pink" ? "rose" : tone === "white" ? "cream" : tone;
  const palette =
    t === "rose"
      ? "bg-[color:var(--rose)] text-[color:var(--champagne)]"
      : t === "ink"
        ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
        : t === "peach"
          ? "bg-[color:var(--peach)] text-[color:var(--ink)]"
          : "bg-[color:var(--cream)] text-[color:var(--ink)]";

  return (
    <span
      className={`inline-flex items-center rounded-full border-2 border-[color:var(--ink)] ${palette} px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wider`}
    >
      {children}
    </span>
  );
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
  const className =
    variant === "secondary"
      ? "border-2 border-[color:var(--ink)] bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
      : variant === "light"
        ? "border-2 border-[color:var(--ink)] bg-[color:var(--peach)] text-[color:var(--ink)] hover:bg-[color:var(--peach-soft)]"
        : variant === "ink"
          ? "border-2 border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--champagne)] hover:bg-[color:var(--ink-deep)]"
          : "border-2 border-[color:var(--ink)] bg-[color:var(--rose)] text-[color:var(--champagne)] hover:bg-[color:var(--ink)]";

  return (
    <Link
      href={href}
      className={`group/btn inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-bold tracking-wide hard-shadow-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:[box-shadow:5px_5px_0_0_var(--ink)] ${className}`}
    >
      {children}
      <span aria-hidden className="inline-block text-base transition-transform duration-300 group-hover/btn:translate-x-1">→</span>
    </Link>
  );
}
