import { Skeleton, SkeletonCardGrid } from "@/components/skeleton";

/**
 * Loading shell for /discover.
 *
 * Mirrors EventExplorer's own chrome, not the page's: the h1 + blurb, the
 * h-12 search field, the category rail, then the two-column body - a sticky
 * 260px filter aside (lg and up only, exactly as the real one) beside the
 * results grid. The personalized rail above it is conditional on a session
 * with picks, so it is deliberately not drawn: a placeholder for a band that
 * often isn't there reads as a layout shift, not a load.
 */
export default function DiscoverLoading() {
  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <section className="ck-page pt-6">
        {/* Heading + blurb */}
        <Skeleton className="h-9 w-72 max-w-full rounded-lg sm:h-11 sm:w-96" />
        <Skeleton className="mt-2.5 h-3.5 w-64 max-w-full rounded-full" />

        {/* Search field - same height and radius as the real input */}
        <Skeleton className="mt-4 h-12 w-full rounded-xl" />

        {/* Category rail */}
        <div className="mt-5 flex gap-1.5 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-[76px] shrink-0 rounded-xl" />
          ))}
        </div>

        <div className="mt-5 flex items-start gap-9">
          {/* Filter aside - lg and up, matching the real sticky column */}
          <aside className="hidden w-[260px] shrink-0 lg:block">
            {Array.from({ length: 4 }).map((_, group) => (
              <div key={group} className="mb-6">
                <Skeleton className="mb-2.5 h-3 w-24 rounded-full" />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 4 }).map((_, pill) => (
                    <Skeleton key={pill} className="h-8 w-20 rounded-full" />
                  ))}
                </div>
              </div>
            ))}
          </aside>

          <div className="min-w-0 flex-1">
            {/* Result count + sort row */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="h-9 w-32 rounded-full" />
            </div>
            <SkeletonCardGrid count={6} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" />
          </div>
        </div>
      </section>
    </main>
  );
}
