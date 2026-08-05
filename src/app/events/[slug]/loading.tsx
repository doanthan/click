import { Skeleton, SkeletonText } from "@/components/skeleton";

/**
 * Loading shell for /events/[slug].
 *
 * The event page is the one surface people land on straight from a share link,
 * so the shell reproduces its exact two-column frame - back link, the media
 * well, title, host line, tag row and body on the left; the booking panel on
 * the right - and holds the 372px sidebar width so the RSVP card doesn't jump
 * into place under the reader's cursor. The well takes the single-image ratio
 * EventMediaGallery uses (4/5 on mobile, 16/9 from sm), which is the shape
 * most events land on.
 */
export default function EventLoading() {
  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page max-w-[1180px] pt-4">
        <Skeleton className="h-4 w-16 rounded-full" />

        <div className="mt-5 grid items-start gap-9 lg:grid-cols-[minmax(0,1fr)_372px]">
          {/* ---- Content column ---- */}
          <div className="min-w-0">
            <Skeleton className="aspect-[4/5] w-full rounded-[var(--radius-xl)] sm:aspect-[16/9]" />

            <Skeleton className="mt-6 h-10 w-3/4 rounded-lg sm:h-12" />
            <Skeleton className="mt-3 h-3.5 w-56 max-w-full rounded-full" />

            <div className="mt-4 flex flex-wrap gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[22px] w-20 rounded-full" />
              ))}
            </div>

            <SkeletonText className="mt-6" lines={4} lineClassName="h-4" />
          </div>

          {/* ---- Booking panel ---- */}
          <aside className="rounded-[var(--radius-xl)] border border-[color:var(--line)] bg-[color:var(--paper)] p-6">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <div className="mt-5 space-y-3.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-3.5 w-2/3 rounded-full" />
                    <Skeleton className="mt-1.5 h-3 w-1/2 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
            <Skeleton className="mt-6 h-12 w-full rounded-xl" />
            <Skeleton className="mt-3 h-3 w-40 rounded-full" />
          </aside>
        </div>
      </div>
    </main>
  );
}
