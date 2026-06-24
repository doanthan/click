import { Skeleton, SkeletonCardGrid, SkeletonText } from "@/components/skeleton";

/**
 * Loading shell for /dashboard.
 *
 * The dashboard has no segment layout of its own — `page.tsx` owns the full
 * `main` chrome (the root layout already supplies the site header + footer
 * around it). So this reproduces that page's own shell: the peach sticker +
 * display greeting + intro, the two-up metric row, the "click with someone"
 * people block beside the radar rail, and the upcoming-events grid.
 */
export default function DashboardLoading() {
  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-6xl">
        <Skeleton className="h-7 w-32 rounded-full" />
        <Skeleton className="mt-6 h-12 w-64 max-w-full rounded-lg sm:h-16 sm:w-80" />
        <Skeleton className="mt-4 h-3.5 w-full max-w-2xl rounded-full" />

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <article
              key={i}
              className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm"
            >
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="mt-3 h-9 w-16 rounded-lg" />
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-6xl">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <Skeleton className="h-3 w-32 rounded-full" />
            <Skeleton className="mt-3 h-9 w-72 max-w-full rounded-lg" />
            <SkeletonText className="mt-3 max-w-xl" lines={2} />
          </div>
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow-sm">
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-1/2 rounded-md" />
                <Skeleton className="mt-2 h-3.5 w-2/3 rounded-full" />
              </div>
            </div>
            <SkeletonText className="mt-5" lines={3} />
            <Skeleton className="mt-6 h-11 w-40 rounded-full" />
          </div>
          <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow-sm">
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="mt-4 aspect-[3/2] w-full rounded-xl" />
            <Skeleton className="mt-4 h-5 w-3/4 rounded-md" />
            <SkeletonText className="mt-3" lines={2} />
          </div>
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-6xl">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="mt-3 h-9 w-64 max-w-full rounded-lg" />
          </div>
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
        <div className="mt-6">
          <SkeletonCardGrid count={4} columns="lg:grid-cols-2" />
        </div>
      </section>
    </main>
  );
}
