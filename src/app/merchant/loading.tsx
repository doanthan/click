import {
  Skeleton,
  SkeletonMetricGrid,
  SkeletonTable,
} from "@/components/skeleton";

/**
 * Route-level loading shell for the merchant portal.
 *
 * The portal chrome (sidebar + mobile nav) lives inside `page.tsx`, not a
 * layout, so this fallback reproduces a lightweight version of that shell — a
 * sticky sidebar card with a logo/title block and a stack of nav pills, beside
 * a content column carrying a header skeleton, the dashboard metric grid, and a
 * table — so the shape is in place the instant the route starts resolving. The
 * shimmer auto-freezes under `prefers-reduced-motion` via globals.css.
 */
export default function MerchantLoading() {
  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-8 text-[color:var(--ink)] sm:px-6 lg:py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {/* Sidebar shell — mirrors <MerchantSidebar>'s desktop aside. */}
        <aside className="hidden lg:sticky lg:top-6 lg:block lg:w-[17.5rem] lg:shrink-0">
          <nav className="flex flex-col rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-3 pb-4 hard-shadow">
            <div className="flex items-center gap-3 px-2 pb-4 pt-2">
              <Skeleton className="size-11 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-28 rounded-full" />
                <Skeleton className="mt-2 h-2.5 w-20 rounded-full" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-2xl" />
              ))}
            </div>
            <div className="mx-1 my-3 border-t-2 border-[color:var(--line)]" />
            <Skeleton className="h-11 w-full rounded-2xl" />
            <Skeleton className="mt-3 h-11 w-full rounded-2xl" />
          </nav>
        </aside>

        {/* Content column — header + dashboard metric grid + a table. */}
        <div className="min-w-0 flex-1 space-y-8 py-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="mt-3 h-10 w-72 max-w-full rounded-lg sm:h-12 sm:w-96" />
              <Skeleton className="mt-4 h-3.5 w-full max-w-md rounded-full" />
            </div>
            <Skeleton className="h-11 w-36 rounded-full" />
          </div>
          <SkeletonMetricGrid count={4} />
          <SkeletonTable rows={6} withThumb />
        </div>
      </div>
    </main>
  );
}
