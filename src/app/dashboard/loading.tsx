import { Skeleton, SkeletonCardGrid, SkeletonText } from "@/components/skeleton";

/**
 * Loading shell for /dashboard.
 *
 * The dashboard has no segment layout of its own - `page.tsx` owns the full
 * `main` chrome (the root layout already supplies the site header + footer
 * around it). So this reproduces that page's own shell: the greeting + h2
 * heading, the moment banner, the "You're going" card grid, and the narrow
 * "click with someone" / "click radar" rails.
 */
export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page pt-6">
        {/* Greeting + heading */}
        <Skeleton className="h-4 w-40 rounded-full" />
        <Skeleton className="mt-2.5 h-8 w-72 max-w-full rounded-lg sm:w-96" />

        {/* Moment banner - lav-bg fill + lavender hairline, like the real MomentBanner */}
        <div className="mt-6 max-w-[760px] rounded-[var(--radius-xl)] border border-[color:var(--lavender)] bg-[color:var(--lav-bg)] p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="size-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="mt-2 h-5 w-2/3 rounded-md" />
            </div>
            <Skeleton className="hidden h-9 w-28 rounded-xl sm:block" />
          </div>
        </div>

        {/* "You're going" - section header + event-card grid */}
        <section className="mt-12">
          <div className="flex items-end justify-between gap-4">
            <Skeleton className="h-7 w-48 max-w-full rounded-md" />
            <Skeleton className="h-4 w-24 rounded-full" />
          </div>
          <div className="mt-5">
            <SkeletonCardGrid count={3} columns="sm:grid-cols-2 lg:grid-cols-3" />
          </div>
        </section>

        {/* "click with someone" - one narrow person card */}
        <section className="mt-12 max-w-[760px]">
          <Skeleton className="h-7 w-56 max-w-full rounded-md" />
          <Skeleton className="mt-2.5 h-3.5 w-72 max-w-full rounded-full" />
          <div className="mt-5 rounded-[var(--radius-xl)] border border-[color:var(--line)] bg-[color:var(--paper)] p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-1/2 rounded-md" />
                <Skeleton className="mt-2 h-3.5 w-2/3 rounded-full" />
              </div>
            </div>
            <SkeletonText className="mt-5" lines={2} />
            <Skeleton className="mt-6 h-11 w-40 rounded-xl" />
          </div>
        </section>

        {/* "click radar" - one wide event card */}
        <section className="mt-12 max-w-[760px]">
          <Skeleton className="h-7 w-40 max-w-full rounded-md" />
          <Skeleton className="mt-2.5 h-3.5 w-64 max-w-full rounded-full" />
          <div className="mt-5 overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--line)] bg-[color:var(--paper)]">
            <Skeleton className="aspect-[3/2] w-full rounded-none sm:aspect-[3/1]" />
            <div className="p-5">
              <Skeleton className="h-5 w-3/4 rounded-md" />
              <SkeletonText className="mt-3" lines={2} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
