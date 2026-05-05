import Link from "next/link";
import type { ReactNode } from "react";

type SectionIntroProps = {
  eyebrow: string;
  title: string;
  body?: string;
  invert?: boolean;
};

export function SectionIntro({ eyebrow, title, body, invert = false }: SectionIntroProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-[0.74fr_1.26fr] lg:items-end">
      <div>
        <p
          className={`text-sm font-black uppercase tracking-[0.16em] ${
            invert ? "text-[#B1EDE8]" : "text-[#FF6978]"
          }`}
        >
          {eyebrow}
        </p>
        <h2
          className={`mt-3 font-display text-4xl font-black leading-none sm:text-6xl ${
            invert ? "text-white" : "text-[#340068]"
          }`}
        >
          {title}
        </h2>
      </div>
      {body ? (
        <p
          className={`text-base font-bold leading-7 lg:max-w-xl lg:justify-self-end ${
            invert ? "text-white/68" : "text-[#340068]/68"
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
    <section className="brand-gradient relative overflow-hidden px-4 py-14 text-white sm:px-6 lg:py-20">
      <div className="paper-grid absolute inset-0 opacity-30" />
      <div className="relative z-10 mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#B1EDE8]">
            {eyebrow}
          </p>
          <h1 className="mt-4 font-display text-5xl font-black leading-none sm:text-7xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-base font-bold leading-7 text-white/70 sm:text-lg">
            {body}
          </p>
        </div>
        {children}
      </div>
    </section>
  );
}

export function MetricCard({ label, value, tone = "aqua" }: { label: string; value: string; tone?: "aqua" | "pink" | "white" }) {
  const toneClass =
    tone === "pink" ? "bg-[#FF6978]" : tone === "white" ? "bg-white" : "bg-[#B1EDE8]";

  return (
    <article className={`rounded-lg border-2 border-[#340068] ${toneClass} p-5 shadow-[5px_5px_0_#340068]`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#340068]/58">
        {label}
      </p>
      <p className="mt-2 font-display text-4xl font-black leading-none text-[#340068]">
        {value}
      </p>
    </article>
  );
}

export function InfoCard({
  eyebrow,
  title,
  body,
  accent = "aqua",
}: {
  eyebrow?: string;
  title: string;
  body: string;
  accent?: "aqua" | "pink" | "mauve";
}) {
  const accentClass =
    accent === "pink" ? "bg-[#FF6978]" : accent === "mauve" ? "bg-[#6D435A]" : "bg-[#B1EDE8]";

  return (
    <article className="rounded-lg border-2 border-[#340068] bg-white p-5 shadow-[6px_6px_0_#340068]">
      <span className={`block h-2 w-16 rounded-full ${accentClass}`} />
      {eyebrow ? (
        <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-[#340068]/45">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="mt-3 font-display text-3xl font-black leading-none text-[#340068]">
        {title}
      </h3>
      <p className="mt-3 text-sm font-bold leading-6 text-[#340068]/65">{body}</p>
    </article>
  );
}

export function Pill({ children, tone = "white" }: { children: ReactNode; tone?: "white" | "aqua" | "pink" }) {
  const toneClass =
    tone === "pink" ? "bg-[#FF6978]" : tone === "aqua" ? "bg-[#B1EDE8]" : "bg-white";

  return (
    <span className={`rounded-full border-2 border-[#340068] ${toneClass} px-3 py-1 text-xs font-black text-[#340068]`}>
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
  variant?: "primary" | "secondary" | "light";
}) {
  const className =
    variant === "secondary"
      ? "border-2 border-[#340068] bg-white text-[#340068] shadow-[4px_4px_0_#340068]"
      : variant === "light"
        ? "border-2 border-white bg-transparent text-white shadow-[4px_4px_0_#B1EDE8]"
        : "bg-[#FF6978] text-[#340068] shadow-[4px_4px_0_#340068]";

  return (
    <Link
      href={href}
      className={`inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-black ${className}`}
    >
      {children}
    </Link>
  );
}
