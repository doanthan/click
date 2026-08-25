import { Skeleton, SkeletonFilterBar, SkeletonMetricGrid, SkeletonTable } from "@/components/skeleton";
import { ButtonLink, Icon } from "@/components/ds";
import type { ReactNode } from "react";
import { getMerchantEvents } from "@/lib/event-repository";

export type MerchantEvent = Awaited<ReturnType<typeof getMerchantEvents>>[number];

export const dateTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

// Money lives in @/lib/amounts now - `formatMoney` for revenue, payouts and
// refunds (never "Free": a $0 revenue figure is a number, not a pricing model),
// `formatPriceLabel` where zero means free. The local pair rounded to whole
// dollars, so a $12.50 charge told the host they were paid "$13".

// Suspense fallbacks for the two async tabs. They mirror each tab's real
// geometry so the body doesn't jump on hydration: bookings = filter bar + door
// list table; finances = metric grid + a transactions table. A static skeleton
// header keeps the eyebrow/title block in place while the query resolves.
export function TabHeaderSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-24 rounded-full" />
      <Skeleton className="h-8 w-72 max-w-full rounded-xl" />
      <Skeleton className="h-3.5 w-full max-w-md rounded-full" />
    </div>
  );
}

export function BookingsTabSkeleton() {
  return (
    <div className="space-y-8 py-8">
      <TabHeaderSkeleton />
      <div className="space-y-5">
        <SkeletonFilterBar pills={3} />
        <SkeletonTable rows={6} withThumb />
      </div>
    </div>
  );
}

export function FinancesTabSkeleton() {
  return (
    <div className="space-y-7 py-8">
      <TabHeaderSkeleton />
      <SkeletonMetricGrid count={4} />
      <SkeletonTable rows={6} withThumb={false} />
    </div>
  );
}

/**
 * TabHeader - the one page head on every merchant surface: eyebrow → title →
 * subline, with the page's single action on the right. Title is Poppins 600 at
 * the app-compact size (h2, not display - display is reserved for marketing).
 *
 * `action` is the ONE call to action for the screen. Never pass a "Create event"
 * button here AND render another one in a banner or an empty state below.
 */
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
    // rise-soft on the head of every tab. The whole portal shipped with no
    // entrance motion at all, which reads as flat and unfinished directly after
    // the signup and onboarding wizards - both of which use this same cascade
    // heavily. It is motivated by HIERARCHY: the head settles first and the
    // tab's sections follow on rise-d1/d2/d3, so a host's eye is walked down
    // the screen once per navigation. Pure CSS, so it plays before hydration;
    // it never loops; and the global prefers-reduced-motion block near the end
    // of globals.css collapses it to nothing.
    <div className="flex flex-wrap items-end justify-between gap-4 rise-soft">
      <div className="min-w-0 max-w-[560px]">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="font-display mt-2 text-[24px] font-semibold leading-[1.15] tracking-[-0.01em] text-[color:var(--ink)] sm:text-[30px]">
          {title}
        </h1>
        {body ? (
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--slate)]">{body}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * The portal's primary CTA. ONE per screen - the DS is explicit about it, and
 * the old dashboard shipped three (banner + header + empty state) at once.
 */
export function CreateEventButton({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <ButtonLink href="/merchant/events/create" size={size}>
      <Icon name="plus" size={16} />
      Create event
    </ButtonLink>
  );
}
