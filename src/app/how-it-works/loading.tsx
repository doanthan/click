import { Skeleton } from "@/components/skeleton";
import { HowItWorksIntro } from "./intro";
import { RouteSkeleton } from "@/components/route-transition";

/**
 * Loading shell for /how-it-works: the page's own hero and three steps, with a
 * placeholder for the CTA, the one part that waits on the session. Bars sized
 * to the copy could not follow it: the display headline runs four or five
 * lines depending on the phone. The sections further down arrive before
 * anyone scrolls to them.
 */
export default function HowItWorksLoading() {
  return (
    <RouteSkeleton>
      <main className="bg-[color:var(--champagne)] text-[color:var(--ink)]">
        <HowItWorksIntro cta={<Skeleton className="h-[52px] w-[216px] rounded-md" />} />
      </main>
    </RouteSkeleton>
  );
}
