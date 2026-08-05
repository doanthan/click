import { Skeleton, SkeletonCardGrid } from "@/components/skeleton";

/** Loading shell for /bookmarks ("Saved") - h1 + sub, then the saved grid. */
export default function BookmarksLoading() {
  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page pt-8">
        <Skeleton className="h-9 w-48 max-w-full rounded-lg sm:h-11 sm:w-56" />
        <Skeleton className="mt-2.5 h-3.5 w-72 max-w-full rounded-full" />
        <div className="mt-7">
          <SkeletonCardGrid count={3} />
        </div>
      </div>
    </main>
  );
}
