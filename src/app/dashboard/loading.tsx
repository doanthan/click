import { Skeleton, SkeletonEventCard } from "@/components/skeleton";

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
        <section className="mt-8 sm:mt-14">
          <div className="flex items-end justify-between gap-4">
            <Skeleton className="h-7 w-48 max-w-full rounded-md" />
            <Skeleton className="h-4 w-24 rounded-full" />
          </div>
          <div className="ckRail mt-3.5 -mx-5 flex gap-4 overflow-hidden px-5 pb-4 sm:mx-0 sm:mt-4.5 sm:grid sm:grid-cols-2 sm:gap-5 sm:px-0 sm:pb-0 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-[84vw] max-w-[340px] shrink-0 sm:w-auto sm:max-w-none sm:min-w-0">
                <SkeletonEventCard />
              </div>
            ))}
          </div>
        </section>

        {/* "click with someone" - one narrow person card */}
        <section className="mt-8 max-w-[760px] sm:mt-14">
          <Skeleton className="h-7 w-56 max-w-full rounded-md" />
          <Skeleton className="mt-2.5 h-3.5 w-72 max-w-full rounded-full" />
          <div className="mt-3.5 rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-4 sm:mt-4.5 sm:p-5">
            <div className="flex items-start gap-3 sm:items-center">
              <Skeleton className="size-[52px] shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-1/2 rounded-md" />
                <Skeleton className="mt-2 h-3.5 w-2/3 rounded-full" />
              </div>
            </div>
            {/* Below sm the action pair stacks full-width; from sm it sits in a
                190px right-hand column. */}
            <div className="mt-3 flex flex-col gap-2 sm:hidden">
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
            <Skeleton className="mt-3 hidden h-9 w-[190px] rounded-xl sm:block" />
          </div>
        </section>

        {/* "click radar" - the compact one-row social-proof bar */}
        <section className="mt-8 max-w-[760px] sm:mt-14">
          <Skeleton className="h-7 w-40 max-w-full rounded-md" />
          <Skeleton className="mt-2.5 h-3.5 w-64 max-w-full rounded-full" />
          {/* ClickRadar is a compact social-proof BAR, never a card with a
              cover - one hairline row per event, icon + one line of aggregate
              text. Anything taller here collapses when the page resolves. */}
          <div className="mt-3.5 overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] sm:mt-4.5">
            <div className="flex items-center gap-3.5 px-4 py-4">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1 rounded-full" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
