import { Skeleton, SkeletonCardGrid } from "@/components/skeleton";

/**
 * Loading shell for /confirmed-events ("Your events").
 *
 * Mirrors the real header row - h1 + sub on the left, the List/Calendar
 * segmented toggle on the right - then the underlined tab strip and the event
 * grid. The photo nudge banner between them is conditional (no photo AND at
 * least one upcoming seat), so it is not drawn.
 */
export default function ConfirmedEventsLoading() {
  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Skeleton className="h-9 w-56 max-w-full rounded-lg sm:h-11 sm:w-64" />
            <Skeleton className="mt-2.5 h-3.5 w-72 max-w-full rounded-full" />
          </div>
          {/* View toggle - radius 12, matching the real control */}
          <Skeleton className="h-[42px] w-[168px] rounded-[12px]" />
        </div>

        {/* Tab strip */}
        <div className="mt-7 flex gap-6 border-b border-[color:var(--mist)] pb-3 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-20 shrink-0 rounded-full" />
          ))}
        </div>

        <div className="mt-6">
          <SkeletonCardGrid count={6} />
        </div>
      </div>
    </main>
  );
}
