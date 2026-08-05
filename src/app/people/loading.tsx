import { Skeleton, SkeletonText } from "@/components/skeleton";

/**
 * Loading shell for /people ("click with someone").
 *
 * The page is a narrow 760px column: lowercase h1 + sub, the daily set of
 * three person cards, then the clicks section. Three cards because the daily
 * set is capped at three by design (`suggested.slice(0, 3)`), so the shell can
 * promise the real count without guessing.
 */
export default function PeopleLoading() {
  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page max-w-[760px] pt-6">
        <Skeleton className="h-9 w-64 max-w-full rounded-lg sm:h-11 sm:w-80" />
        <Skeleton className="mt-2.5 h-3.5 w-72 max-w-full rounded-full" />

        {/* ---- The daily set ---- */}
        <section className="mt-7">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <Skeleton className="h-6 w-56 max-w-full rounded-md sm:h-7" />
            <Skeleton className="h-3.5 w-20 rounded-full" />
          </div>
          <div className="space-y-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <PersonCardSkeleton key={i} />
            ))}
          </div>
        </section>

        {/* ---- Your clicks ---- */}
        <section className="mt-12">
          <Skeleton className="mb-1 h-6 w-40 rounded-md sm:h-7" />
          <Skeleton className="mt-2 h-3.5 w-64 max-w-full rounded-full" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-[var(--radius-xl)] border border-[color:var(--line)] bg-[color:var(--paper)] p-5"
              >
                <Skeleton className="size-12 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-1/3 min-w-[7rem] rounded-full" />
                  <Skeleton className="mt-2 h-3 w-1/2 min-w-[9rem] rounded-full" />
                </div>
                <Skeleton className="h-9 w-28 shrink-0 rounded-xl" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

/** Mirrors ClickWithSomeoneUserCard: big round avatar, name, blurb, one CTA. */
function PersonCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[color:var(--line)] bg-[color:var(--paper)] p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-1/2 min-w-[8rem] rounded-md" />
          <Skeleton className="mt-2 h-3.5 w-2/3 rounded-full" />
        </div>
      </div>
      <SkeletonText className="mt-5" lines={2} />
      <div className="mt-5 flex flex-wrap gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[26px] w-20 rounded-full" />
        ))}
      </div>
      <Skeleton className="mt-6 h-11 w-40 rounded-xl" />
    </div>
  );
}
