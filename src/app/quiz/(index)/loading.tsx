import { Skeleton, SkeletonText } from "@/components/skeleton";
import { RouteSkeleton } from "@/components/route-transition";

/**
 * Loading shell for /quiz: the h1 + sub in the 760px column, then the two
 * quiz cards. The saved note and "Latest persona" block are conditional, so
 * they are not drawn.
 *
 * It lives in the (index) route group on purpose. A loading.tsx beside
 * quiz/page.tsx would also wrap /quiz/personality and /quiz/life, and flash
 * this list shape before both of those one-question-at-a-time takeovers.
 */
export default function QuizIndexLoading() {
  return (
    <RouteSkeleton>
      <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
        <div className="ck-page max-w-[760px] pt-6">
          <Skeleton className="h-8 w-full max-w-[600px] rounded-lg sm:h-10" />
          <Skeleton className="mt-2 h-8 w-2/3 max-w-[360px] rounded-lg sm:h-10" />
          <Skeleton className="mt-3 h-3.5 w-full max-w-[560px] rounded-full" />

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)]"
              >
                <Skeleton className="size-11 rounded-full" />
                <Skeleton className="mt-4 h-3 w-24 rounded-full" />
                <Skeleton className="mt-2.5 h-6 w-3/4 rounded-md" />
                <SkeletonText className="mt-3" lines={2} />
                {/* ButtonLink size="sm": 36px, 44px on a touch screen, button radius. */}
                <Skeleton className="mt-5 h-9 w-44 rounded-md pointer-coarse:h-11" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </RouteSkeleton>
  );
}
