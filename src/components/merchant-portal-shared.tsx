import { Skeleton, SkeletonFilterBar, SkeletonMetricGrid, SkeletonTable } from "@/components/skeleton";
import Link from "next/link";
import type { ReactNode } from "react";
import { getMerchantEvents } from "@/lib/event-repository";

export type MerchantEvent = Awaited<ReturnType<typeof getMerchantEvents>>[number];

export const priceFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

export const dateTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function formatPrice(cents: number) {
  if (cents === 0) return "Free";
  return priceFormatter.format(cents / 100);
}

// Suspense fallbacks for the two async tabs. They mirror each tab's real
// geometry so the body doesn't jump on hydration: bookings = filter bar + door
// list table; finances = metric grid + a transactions table. A static skeleton
// header keeps the eyebrow/title block in place while the query resolves.
export function TabHeaderSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-24 rounded-full" />
      <Skeleton className="h-9 w-72 max-w-full rounded-lg sm:h-10" />
      <Skeleton className="h-3.5 w-full max-w-md rounded-full" />
    </div>
  );
}

export function BookingsTabSkeleton() {
  return (
    <div className="space-y-10 py-10">
      <TabHeaderSkeleton />
      <div className="space-y-6">
        <SkeletonFilterBar pills={3} />
        <SkeletonTable rows={6} withThumb />
      </div>
    </div>
  );
}

export function FinancesTabSkeleton() {
  return (
    <div className="space-y-8 py-10">
      <TabHeaderSkeleton />
      <SkeletonMetricGrid count={4} />
      <SkeletonTable rows={6} withThumb={false} />
    </div>
  );
}

// Lightweight section header sized for the content column (the old SectionIntro
// rendered 6xl display titles meant for full-bleed marketing sections).
export function TabHeader({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="font-display mt-2 text-3xl font-bold leading-tight tracking-[-0.025em] text-[color:var(--ink)] sm:text-4xl">
          {title}
        </h1>
        {body ? (
          <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            {body}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// Primary CTA — the merchant portal's most important action, so it gets the
// rose fill treatment and is reused in the dashboard header + empty states.
export function CreateEventButton() {
  return (
    <Link
      href="/merchant/events/create"
      className="inline-flex shrink-0 items-center rounded-full border-2 border-[color:var(--surface-deep)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
    >
      + Create event
    </Link>
  );
}
