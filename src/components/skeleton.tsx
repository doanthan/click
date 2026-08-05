import type { CSSProperties } from "react";

/**
 * Brand loading skeletons.
 *
 * These are NOT generic spinners - each composed skeleton mirrors the geometry
 * of the real component it stands in for (same radius, border, padding, grid
 * columns), rendered in the warm `.skeleton` shimmer (champagne-deep base with
 * a soft cream light-sweep). The sweep auto-freezes to a flat surface under
 * `prefers-reduced-motion` via the global block in globals.css.
 *
 * Used by route-level `loading.tsx` files (which also render the real, static
 * sidebar/header so the shell paints instantly) and by `<Suspense>` fallbacks.
 */

/** Base shimmer block. Caller controls size/shape via className. */
export function Skeleton({
  className = "",
  style,
  deep = false,
}: {
  className?: string;
  style?: CSSProperties;
  /** Use on near-black "deep" surfaces so the sweep doesn't glare. */
  deep?: boolean;
}) {
  return (
    <span
      aria-hidden
      style={style}
      className={`${deep ? "skeleton--deep" : "skeleton"} block rounded-md ${className}`}
    />
  );
}

/** A run of text lines; the last line is shortened so it reads as prose. */
export function SkeletonText({
  lines = 3,
  className = "",
  lineClassName = "h-3.5",
}: {
  lines?: number;
  className?: string;
  lineClassName?: string;
}) {
  return (
    <span className={`block space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`${lineClassName} rounded-full ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </span>
  );
}

/** Mirrors <MetricCard>: rounded-2xl white card, small label, big value. */
export function SkeletonMetricCard() {
  return (
    <article className="rounded-2xl border border-[color:var(--mist)] bg-[color:var(--paper)] p-5">
      <Skeleton className="h-3 w-20 rounded-full" />
      <Skeleton className="mt-3 h-9 w-24 rounded-lg" />
    </article>
  );
}

/** Mirrors the admin dashboard metric grid: gap-4 sm:2-col lg:4-col. */
export function SkeletonMetricGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonMetricCard key={i} />
      ))}
    </div>
  );
}

/** Mirrors <AdminPageHeader>: Slate eyebrow, display H1, optional description. */
export function SkeletonPageHeader({ description = true }: { description?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="mt-3 h-10 w-64 max-w-full rounded-lg sm:h-12 sm:w-80" />
        {description ? <Skeleton className="mt-4 h-3.5 w-full max-w-md rounded-full" /> : null}
      </div>
      <Skeleton className="h-11 w-32 rounded-xl" />
    </div>
  );
}

/** Mirrors <AdminTrendChart>: gap-4 md:2-col, each a white card with a bar row. */
export function SkeletonChart({ panels = 4 }: { panels?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: panels }).map((_, p) => (
        <div
          key={p}
          className="rounded-2xl border border-[color:var(--mist)] bg-[color:var(--paper)] p-5"
        >
          <div className="flex items-baseline justify-between gap-2">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>
          <div className="mt-4 flex h-24 items-end gap-1.5">
            {Array.from({ length: 12 }).map((_, b) => (
              <Skeleton
                key={b}
                className="flex-1 rounded-t-md"
                // Deterministic varied heights - no Math.random (SSR-safe).
                style={{ height: `${30 + ((b * 37) % 70)}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between">
            <Skeleton className="h-2.5 w-12 rounded-full" />
            <Skeleton className="h-2.5 w-8 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mirrors <InfoCard>: white card with an accent bar, title, body lines. */
export function SkeletonInfoCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <article
          key={i}
          className="rounded-2xl border border-[color:var(--mist)] bg-[color:var(--paper)] p-6"
        >
          <Skeleton className="h-1.5 w-12 rounded-full" />
          <Skeleton className="mt-5 h-7 w-3/4 rounded-md" />
          <SkeletonText className="mt-4" lines={3} />
        </article>
      ))}
    </div>
  );
}

/** A faceted filter/search bar: a search field plus a row of pills. */
export function SkeletonFilterBar({ pills = 5 }: { pills?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Skeleton className="h-11 w-full max-w-xs rounded-xl" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: pills }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
    </div>
  );
}

/**
 * A generic list/table panel skeleton: a bordered white card holding N rows,
 * each a leading block (avatar/thumb) + two text lines + a trailing chip.
 * Matches the row rhythm of the admin tables and merchant panels.
 */
export function SkeletonTable({
  rows = 8,
  withThumb = true,
}: {
  rows?: number;
  withThumb?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--mist)] bg-[color:var(--paper)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-4 px-5 py-4 ${
            i !== rows - 1 ? "border-b border-[color:var(--mist)]" : ""
          }`}
        >
          {withThumb ? <Skeleton className="size-11 shrink-0 rounded-xl" /> : null}
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-1/3 min-w-[8rem] rounded-full" />
            <Skeleton className="mt-2 h-3 w-1/2 min-w-[6rem] rounded-full" />
          </div>
          <Skeleton className="hidden h-3.5 w-24 rounded-full sm:block" />
          <Skeleton className="h-8 w-20 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** A grid of card placeholders (event tiles, etc.). */
export function SkeletonCardGrid({
  count = 6,
  columns = "sm:grid-cols-2 lg:grid-cols-3",
}: {
  count?: number;
  columns?: string;
}) {
  return (
    <div className={`grid gap-5 ${columns}`}>
      {Array.from({ length: count }).map((_, i) => (
        <article
          key={i}
          className="overflow-hidden rounded-2xl border border-[color:var(--mist)] bg-[color:var(--paper)]"
        >
          <Skeleton className="aspect-[3/2] w-full rounded-none" />
          <div className="p-5">
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="mt-3 h-6 w-3/4 rounded-md" />
            <SkeletonText className="mt-3" lines={2} />
          </div>
        </article>
      ))}
    </div>
  );
}
