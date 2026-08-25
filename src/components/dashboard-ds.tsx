import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./ds";
import { Reveal } from "./reveal";

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
        // Headers ride the same scroll-reveal as the home page, so the feed
        // settles in section by section instead of arriving as one wall.
        <Reveal>
          <div className="mb-3.5 flex items-baseline justify-between gap-4 sm:mb-4.5">
            <div>
              {title ? (
                <h2 className="font-display text-[1.075rem] leading-tight font-semibold tracking-[-0.01em] text-balance text-[color:var(--ink)] sm:text-[1.3rem]">
                  {title}
                </h2>
              ) : null}
              {sub ? (
                <p className="mt-1.5 max-w-[520px] text-[13.5px] leading-relaxed font-medium text-pretty text-[color:var(--slate)] sm:text-sm">
                  {sub}
                </p>
              ) : null}
            </div>
            {actionLabel && actionHref ? (
              /* The label is 13.5px, so the natural box is ~20px tall - the smallest
                 target on the page, and the only way into each list. The padding
                 grows the HIT box to the 44px floor and the equal negative margin
                 takes that growth back out of the layout, so the link sits exactly
                 where it did. */
              <Link
                href={actionHref}
                className="font-display -my-3 -mr-2 inline-flex shrink-0 items-center gap-1.5 py-3 pr-2 text-[13.5px] font-semibold whitespace-nowrap text-[color:var(--purple)] hover:underline"
              >
                {actionLabel}
                <span className="nudge-arrow inline-flex">
                  <Icon name="arrowR" size={15} stroke={2.2} />
                </span>
              </Link>
            ) : null}
          </div>
        </Reveal>
      ) : null}
      {children}
    </section>
  );
}

/**
 * CardRail - the DS mobile treatment for an EVENT STRIP.
 *
 * "One card system, varied by section: scroll-rows on mobile; tidy grids on
 * desktop" - and, at 375: "horizontal scroll-row with a partial next-card PEEK
 * (~88-90% width + 16px gap), not a cramped clipping 2-up grid". Three sections
 * of three cards stacked 1-up is the "wall of identical cards" the dashboard
 * prompt names as the biggest failure mode; it also ran the phone page to four
 * and a bit screens of scroll.
 *
 * Same track the home page already uses, so the two surfaces swipe identically.
 *
 * ONE card gets the plain grid instead: a lone card has nothing to sit beside,
 * so a scroll container buys nothing and the equal-height reservations inside
 * EventCard (which key off .ckRail) would just open a hole under the title.
 */
const RAIL_TRACK =
  "ckRail -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3";
// reveal--rail: below sm these are visible from the start, so the next-card peek
// is actually on screen. From sm the track is a grid and the stagger comes back.
const RAIL_ITEM =
  "reveal--rail w-[84vw] max-w-[340px] shrink-0 snap-center sm:w-auto sm:max-w-none sm:min-w-0";
const PLAIN_GRID = "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";

export function CardRail<T extends { id: string }>({
  items,
  children,
}: {
  items: T[];
  children: (item: T, index: number) => ReactNode;
}) {
  const rail = items.length > 1;
  return (
    <div className={rail ? RAIL_TRACK : PLAIN_GRID}>
      {items.map((item, i) => (
        <Reveal key={item.id} delay={i * 70} className={rail ? RAIL_ITEM : "min-w-0"}>
          {children(item, i)}
        </Reveal>
      ))}
    </div>
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
          <h2 className="font-display text-[1.11rem] leading-tight font-semibold tracking-[-0.01em] text-balance text-[color:var(--purple-800)] sm:text-[1.3rem]">
            {title}
          </h2>
          {sub ? (
            <p className="mt-1.5 max-w-[460px] text-[13.5px] leading-relaxed text-pretty text-[color:var(--purple-800)]/80 sm:text-sm">
              {sub}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex w-full shrink-0 flex-wrap items-center gap-2.5 sm:w-auto">
        <Link href={actionHref} className="ck-btn ck-btn--sm ck-btn--primary w-full sm:w-auto">
          <span className="ck-btn__label">{actionLabel}</span>
        </Link>
        {secondary}
      </div>
    </div>
  );
}
