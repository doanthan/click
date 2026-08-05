import { Skeleton, SkeletonText } from "@/components/skeleton";

/**
 * Loading shell for /profile - and, by inheritance, /profile/[userId], which
 * renders the same card geometry for someone else's profile.
 *
 * One left-aligned 660px card: avatar · eyebrow + name + meta line · action,
 * then the labelled sections under hairline rules.
 */
export default function ProfileLoading() {
  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page pt-8">
        <div className="max-w-[660px]">
          <article className="rounded-[18px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
            <header className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4 sm:gap-[18px]">
                <Skeleton className="size-[72px] shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-3 w-20 rounded-full" />
                  <Skeleton className="mt-2 h-8 w-48 max-w-full rounded-lg" />
                  <Skeleton className="mt-2.5 h-3 w-40 max-w-full rounded-full" />
                </div>
              </div>
              <Skeleton className="h-9 w-28 shrink-0 rounded-xl" />
            </header>

            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div className="my-6 h-px bg-[color:var(--mist)]" />
                <Skeleton className="h-3 w-16 rounded-full" />
                {i === 0 ? (
                  <SkeletonText className="mt-3" lines={2} />
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Array.from({ length: 4 }).map((_, tag) => (
                      <Skeleton key={tag} className="h-[30px] w-24 rounded-full" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </article>
        </div>
      </div>
    </main>
  );
}
