import { Skeleton, SkeletonCardGrid } from "@/components/skeleton";
import { RouteSkeleton } from "@/components/route-transition";

/** Loading shell for /around-me - h1 + sub, the map at its real height, then the list. */
export default function AroundMeLoading() {
  return (
    <RouteSkeleton>
      <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
        <div className="ck-page pt-6">
          <Skeleton className="h-9 w-64 max-w-full rounded-lg sm:h-11 sm:w-80" />
          <Skeleton className="mt-2.5 h-3.5 w-80 max-w-full rounded-full" />
          <Skeleton className="mt-5 h-[min(56vh,520px)] min-h-[300px] w-full rounded-[var(--radius-xl)]" />
          <Skeleton className="mt-7 h-7 w-48 max-w-full rounded-lg" />
          <Skeleton className="mt-2.5 h-3.5 w-56 max-w-full rounded-full" />
          <div className="mt-5">
            <SkeletonCardGrid count={3} />
          </div>
        </div>
      </main>
    </RouteSkeleton>
  );
}
