import { Skeleton, SkeletonText } from "@/components/skeleton";

/**
 * Loading shell for /categories.
 *
 * The page is force-dynamic (event and tag counts are read live), so it always
 * waits on Postgres. Mirrors the h1 + blurb and the 3-up card grid, each card
 * carrying its glyph, title, description, tag row and the counts footer that
 * sits under a hairline.
 */
export default function CategoriesLoading() {
  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page pt-8">
        <Skeleton className="h-9 w-80 max-w-full rounded-lg sm:h-11 sm:w-[28rem]" />
        <Skeleton className="mt-3 h-3.5 w-full max-w-[620px] rounded-full" />

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <article
              key={i}
              className="flex flex-col rounded-2xl border border-[color:var(--mist)] bg-[color:var(--paper)] p-6"
            >
              <Skeleton className="size-11 rounded-full" />
              <Skeleton className="mt-4 h-6 w-1/2 min-w-[7rem] rounded-md" />
              <SkeletonText className="mt-2" lines={2} />
              <div className="mt-4 flex flex-wrap gap-1.5">
                {Array.from({ length: 3 }).map((_, tag) => (
                  <Skeleton key={tag} className="h-[26px] w-16 rounded-full" />
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-[color:var(--mist)] pt-4">
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="h-3 w-16 rounded-full" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
