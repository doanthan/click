import Link from "next/link";
import type { ReactNode } from "react";

type SectionIntroProps = {
  // Optional: many sections read cleaner with the headline carrying itself.
  // The taste rule of thumb is roughly one eyebrow per three sections, so most
  // intros should omit this.
  eyebrow?: string;
  title: ReactNode;
  body?: string;
  invert?: boolean;
};

export function SectionIntro({ eyebrow, title, body, invert = false }: SectionIntroProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
      <div>
        {eyebrow ? (
          <p className={`eyebrow ${invert ? "!text-[color:var(--lavender)]" : ""}`}>{eyebrow}</p>
        ) : null}
        <h2
          className={`font-display mt-4 text-[2.4rem] font-semibold leading-[1.04] tracking-[-0.025em] sm:text-[3rem] ${
            invert ? "text-[color:var(--on-deep)]" : "text-[color:var(--ink)]"
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
  // Tight by default - most pages just need a labelled title above content,
  // not a full-screen marquee. Side content (children) gets equal weight on
  // wide screens; without it, the text column stays narrow and readable.
  return (
    <section className="relative overflow-hidden border-b border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-7 sm:px-6 sm:py-10">
      <div
        className={`relative z-10 mx-auto grid max-w-7xl gap-6 ${
          children ? "lg:grid-cols-[0.9fr_1.1fr] lg:items-end" : ""
        }`}
      >
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="font-display mt-3 text-[2rem] font-semibold leading-[1.02] tracking-[-0.025em] text-[color:var(--ink)] sm:text-[2.6rem]">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--mauve)] sm:text-base">
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
  // legacy aliases → new palette (purple fills take cream text - never dark-on-purple)
  const t = tone === "aqua" ? "peach" : tone === "pink" ? "rose" : tone === "white" ? "cream" : tone;
  const palette =
    t === "rose"
      ? "bg-[color:var(--purple)] text-[color:var(--champagne)]"
      : t === "cream"
        ? "bg-[color:var(--paper)] text-[color:var(--ink)]"
        : t === "ink"
          ? "bg-[color:var(--surface-deep)] text-[color:var(--on-deep)]"
          : "bg-[color:var(--lavender-100)] text-[color:var(--ink)]";

  return (
    <article className={`rounded-2xl ${palette} p-5 shadow-[var(--shadow-sm)]`}>
      <p className="text-[12.5px] font-semibold opacity-70">{label}</p>
      <p className="font-display mt-2 text-5xl font-semibold leading-none tracking-[-0.03em] tabular-nums">{value}</p>
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
    <article className="group relative rounded-2xl bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]">
      <span className={`block h-1.5 w-12 rounded-full ${accentBar}`} />
      {eyebrow ? <p className="eyebrow mt-5">{eyebrow}</p> : null}
      <h3 className="font-display mt-3 text-[1.7rem] font-semibold leading-[1.08] tracking-[-0.025em] text-[color:var(--ink)]">
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
  // legacy aliases → new palette. The DS tag voice: white fill, mist hairline,
  // ink text; the "selected"/accent tone is a flat purple fill with cream text.
  const t = tone === "aqua" ? "peach" : tone === "pink" ? "rose" : tone === "white" ? "cream" : tone;
  const palette =
    t === "rose"
      ? "border-transparent bg-[color:var(--purple)] text-[color:var(--champagne)]"
      : t === "ink"
        ? "border-transparent bg-[color:var(--ink)] text-[color:var(--champagne)]"
        : t === "peach"
          ? "border-transparent bg-[color:var(--lavender-100)] text-[color:var(--purple-700)]"
          : "border-[color:var(--mist-strong)] bg-[color:var(--paper)] text-[color:var(--ink)]";

  const base = `inline-flex max-w-full min-w-0 items-center whitespace-normal break-words rounded-full border ${palette} px-3 py-1 text-left text-[12px] font-medium`;

  if (href) {
    return (
      <Link
        href={href}
        className={`${base} transition-colors duration-150 ${
          t === "cream" ? "hover:border-[color:var(--slate)] hover:bg-[color:var(--lavender-100)]" : ""
        }`}
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
  // Click DS button voice via the canonical .ck-btn classes: flat Deep-Purple
  // primary, white + hairline secondary, and cream "light" (onPurple) for the
  // deep aubergine bands. Radius 12 built in - never a pill. The legacy "ink"
  // variant folds into primary: Deep Purple is the ONE primary-action colour.
  const variantClass =
    variant === "secondary"
      ? "ck-btn--secondary"
      : variant === "light"
        ? "ck-btn--onPurple"
        : "ck-btn--primary";

  return (
    <Link href={href} className={`ck-btn ck-btn--lg ${variantClass} group/btn`}>
      {children}
      <span aria-hidden className="inline-block text-base transition-transform duration-300 group-hover/btn:translate-x-1">→</span>
    </Link>
  );
}
