import { Skeleton, SkeletonText } from "@/components/skeleton";

/**
 * Loading shell for /account-settings.
 *
 * Mirrors the real two-column split: a 232px tab rail (lg and up) beside the
 * 640px panel column, with the section heading sitting over its hairline.
 */
export default function AccountSettingsLoading() {
  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page pt-8">
        <Skeleton className="h-9 w-56 max-w-full rounded-lg sm:h-11 sm:w-64" />

        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-11">
          {/* Tab rail - horizontal pills below lg, a stacked list above it */}
          <div className="flex gap-2 overflow-hidden lg:flex-col lg:gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-28 shrink-0 rounded-xl lg:w-full" />
            ))}
          </div>

          <div className="min-w-0 max-w-[640px]">
            <Skeleton className="h-7 w-48 max-w-full rounded-md sm:h-8" />
            <div className="mt-4 h-px bg-[color:var(--mist)]" />

            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="mt-6">
                <Skeleton className="h-5 w-40 max-w-full rounded-md" />
                <SkeletonText className="mt-2" lines={2} />
                <Skeleton className="mt-4 h-11 w-full max-w-sm rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
