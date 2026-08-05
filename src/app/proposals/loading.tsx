import { Skeleton } from "@/components/skeleton";

/**
 * Loading shell for /proposals ("Your clicks").
 *
 * Narrow 760px column: h1 + the two-line blurb, then the ClicksList entries -
 * each an avatar pair, the plan line, and the open-drawer action.
 */
export default function ProposalsLoading() {
  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page max-w-[760px] pt-6">
        <Skeleton className="h-9 w-52 max-w-full rounded-lg sm:h-11 sm:w-60" />
        <Skeleton className="mt-3 h-3.5 w-full max-w-[560px] rounded-full" />
        <Skeleton className="mt-2 h-3.5 w-full max-w-[480px] rounded-full" />

        <div className="mt-7 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-[var(--radius-xl)] border border-[color:var(--line)] bg-[color:var(--paper)] p-5"
            >
              <Skeleton className="size-12 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-1/3 min-w-[7rem] rounded-full" />
                <Skeleton className="mt-2 h-3 w-2/3 min-w-[10rem] rounded-full" />
              </div>
              <Skeleton className="h-9 w-24 shrink-0 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
