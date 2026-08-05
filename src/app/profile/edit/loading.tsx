import { Skeleton } from "@/components/skeleton";

/**
 * Loading shell for /profile/edit.
 *
 * Its own file rather than inheriting /profile's card: the edit page is a form
 * at a different width (720px, pt-6, pb-8), and a read-view skeleton would
 * settle into the wrong shape. Mirrors the eyebrow + h1 + sub, the avatar row
 * the uploader owns, and the stack of labelled fields.
 */
export default function ProfileEditLoading() {
  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-8 text-[color:var(--ink)]">
      <div className="ck-page pt-6">
        <div className="max-w-[720px]">
          <Skeleton className="h-3 w-16 rounded-full" />
          <Skeleton className="mt-2.5 h-9 w-56 max-w-full rounded-lg sm:h-11 sm:w-64" />
          <Skeleton className="mt-2.5 h-3.5 w-72 max-w-full rounded-full" />

          {/* Avatar row */}
          <div className="mt-7 flex items-center gap-5">
            <Skeleton className="size-20 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-9 w-32 rounded-xl" />
              <Skeleton className="mt-2.5 h-3 w-48 max-w-full rounded-full" />
            </div>
          </div>

          {/* Field stack */}
          <div className="mt-8 space-y-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-3.5 w-28 rounded-full" />
                <Skeleton className={`mt-2 w-full rounded-xl ${i === 1 ? "h-28" : "h-12"}`} />
              </div>
            ))}
          </div>

          <Skeleton className="mt-8 h-12 w-40 rounded-xl" />
        </div>
      </div>
    </main>
  );
}
