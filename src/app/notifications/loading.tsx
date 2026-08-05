import { Skeleton } from "@/components/skeleton";

/**
 * Loading shell for /notifications.
 *
 * A narrow 720px column: h1 + sub, then the single bordered panel of rows.
 * Each row mirrors NotificationRow - a size-9 lavender disc, title, body,
 * timestamp - so the panel keeps its height while the feed resolves.
 */
export default function NotificationsLoading() {
  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page max-w-[720px] pt-6">
        <Skeleton className="h-9 w-56 max-w-full rounded-lg sm:h-11 sm:w-64" />
        <Skeleton className="mt-2.5 h-3.5 w-full max-w-sm rounded-full" />

        <div className="mt-7 overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`flex gap-3 px-4 py-4 ${i !== 5 ? "border-b border-[color:var(--line-soft)]" : ""}`}
            >
              <Skeleton className="mt-0.5 size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-2/3 min-w-[9rem] rounded-full" />
                <Skeleton className="mt-2 h-3 w-full rounded-full" />
                <Skeleton className="mt-2 h-2.5 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
