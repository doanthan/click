import Link from "next/link";
import { Logo } from "@/components/ds";
import { Skeleton } from "@/components/skeleton";

/**
 * Loading shell for /onboarding.
 *
 * Mirrors OnboardingForm's first step, chrome included, because the page draws
 * none of its own: the wordmark and progress track, the step's disc + eyebrow
 * + heading + sub in a max-w-xl column, its fields, and the sticky Continue
 * bar. Chromeless like the real route, so the global header never flashes in.
 */
export default function OnboardingLoading() {
  return (
    <main className="min-h-[100dvh] bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <section className="flex min-h-[100dvh] flex-col">
        <header className="flex-none px-5 pt-[max(env(safe-area-inset-top),1rem)] sm:px-8">
          <div className="mx-auto w-full max-w-xl">
            <Link href="/" aria-label="Click home" className="inline-flex">
              <Logo size={26} />
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-1.5 flex-1 rounded-full bg-[color:var(--lav-bg)]" />
              <Skeleton className="h-3 w-10 rounded-full" />
            </div>
            <Skeleton className="mt-2 h-3 w-52 max-w-full rounded-full" />
          </div>
        </header>

        <div className="flex-1 px-5 py-8 sm:px-8">
          <div className="mx-auto grid w-full max-w-xl gap-7">
            <div>
              <Skeleton className="size-[52px] rounded-full" />
              <Skeleton className="mt-4 h-3 w-24 rounded-full" />
              <Skeleton className="mt-2.5 h-7 w-64 max-w-full rounded-lg" />
              <Skeleton className="mt-2.5 h-3.5 w-full max-w-sm rounded-full" />
            </div>
            <div className="grid gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="grid gap-1.5">
                  <Skeleton className="h-3.5 w-24 rounded-full" />
                  <Skeleton className="h-[50px] w-full rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer
          className="sticky bottom-0 z-20 flex-none border-t border-[color:var(--mist)] bg-[color:var(--champagne)] px-5 pt-3 sm:px-8"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          <div className="mx-auto max-w-xl">
            <Skeleton className="h-[52px] w-full rounded-xl" />
          </div>
        </footer>
      </section>
    </main>
  );
}
