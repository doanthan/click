import { Skeleton, SkeletonText } from "@/components/skeleton";

/**
 * Loading shell for /how-it-works: the hero (display h1, lede, the one CTA)
 * and the lavender three-step band under it - everything above the fold. The
 * sections further down arrive before anyone scrolls to them.
 */
export default function HowItWorksLoading() {
  return (
    <main className="bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <section className="ck-page pt-12 pb-14 sm:pt-16">
        <div className="max-w-[720px]">
          <Skeleton className="h-8 w-full max-w-[640px] rounded-lg sm:h-14" />
          <Skeleton className="mt-2.5 h-8 w-full max-w-[600px] rounded-lg sm:h-14" />
          <Skeleton className="mt-2.5 h-8 w-2/3 max-w-[420px] rounded-lg sm:h-14" />
          <SkeletonText className="mt-5 max-w-[540px]" lines={2} lineClassName="h-4 sm:h-5" />
          <Skeleton className="mt-6 h-[52px] w-48 rounded-xl" />
        </div>
      </section>

      <section className="bg-[color:var(--lav-bg)]">
        <div className="ck-page py-12 sm:py-16">
          <Skeleton className="h-3 w-28 rounded-full" />
          <Skeleton className="mt-3 h-7 w-full max-w-[520px] rounded-lg" />
          <SkeletonText className="mt-4 max-w-[620px]" lines={2} lineClassName="h-4" />
          <div className="mt-9 grid gap-8 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="mb-3 size-12 rounded-full" />
                <Skeleton className="h-5 w-40 max-w-full rounded-md" />
                <SkeletonText className="mt-3" lines={3} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
