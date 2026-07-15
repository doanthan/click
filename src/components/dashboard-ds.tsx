import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./ds";

/**
 * Section - the dashboard's scaffold. Sections are grouped by WHITESPACE, never
 * boxed: the dashboard is a calm activity feed, not a data dashboard, and
 * cards-inside-cards are banned. `narrow` caps a single-column section at its
 * natural reading width and lets the whitespace fall to the RIGHT - never a
 * column floating centred.
 */
export function Section({
  title,
  sub,
  actionLabel,
  actionHref,
  narrow,
  first,
  children,
}: {
  title?: string;
  sub?: string;
  actionLabel?: string;
  actionHref?: string;
  narrow?: boolean;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`${first ? "mt-6 sm:mt-7" : "mt-8 sm:mt-14"} ${narrow ? "max-w-[760px]" : ""}`}>
      {title || actionLabel ? (
        <div className="mb-3.5 flex items-baseline justify-between gap-4 sm:mb-4.5">
          <div>
            {title ? (
              <h2 className="font-display text-[1.075rem] leading-tight font-semibold tracking-[-0.01em] text-[color:var(--ink)] sm:text-[1.3rem]">
                {title}
              </h2>
            ) : null}
            {sub ? (
              <p className="mt-1.5 max-w-[520px] text-[13.5px] leading-relaxed font-medium text-[color:var(--slate)] sm:text-sm">
                {sub}
              </p>
            ) : null}
          </div>
          {actionLabel && actionHref ? (
            <Link
              href={actionHref}
              className="font-display inline-flex shrink-0 items-center gap-1.5 text-[13.5px] font-semibold whitespace-nowrap text-[color:var(--purple)] hover:underline"
            >
              {actionLabel}
              <Icon name="arrowR" size={15} stroke={2.2} />
            </Link>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * MomentBanner - ONE shell for EVERY time-sensitive moment at the top of the
 * dashboard. The post-event prompt and all the coordination states are the same
 * component; only the content changes. Same lavender wash, radius, padding and
 * structure every time: icon circle left · eyebrow → title → one subline · ONE
 * action right (stacking full-width below on mobile).
 *
 * Two rules it exists to enforce: only ONE banner shows at a time, and only
 * YOUR-MOVE states get one (never "waiting on them"). The "finish setting up"
 * card is deliberately a different, quieter white treatment - never a second
 * lavender banner.
 */
export function MomentBanner({
  icon,
  eyebrow,
  title,
  sub,
  actionLabel,
  actionHref,
  secondary,
}: {
  icon: IconName;
  eyebrow?: string;
  title: ReactNode;
  sub?: string;
  actionLabel: string;
  actionHref: string;
  secondary?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-xl)] border border-[color:var(--lavender)] bg-[color:var(--lav-bg)] p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--lavender-200)] text-[color:var(--purple-700)]">
          <Icon name={icon} size={20} stroke={2} />
        </span>
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-1.5 text-[11.5px] font-bold tracking-[0.08em] uppercase text-[color:var(--purple-700)]">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="font-display text-[1.11rem] leading-tight font-semibold tracking-[-0.01em] text-[color:var(--purple-800)] sm:text-[1.3rem]">
            {title}
          </h2>
          {sub ? (
            <p className="mt-1.5 max-w-[460px] text-[13.5px] leading-relaxed text-[color:var(--purple-800)]/80 sm:text-sm">
              {sub}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <Link href={actionHref} className="ck-btn ck-btn--sm ck-btn--primary">
          <span className="ck-btn__label">{actionLabel}</span>
        </Link>
        {secondary}
      </div>
    </div>
  );
}
