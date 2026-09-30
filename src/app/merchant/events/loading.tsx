import { LoadingSpinner } from "@/components/loading-spinner";
import { RouteSkeleton } from "@/components/route-transition";

// Overrides the dashboard-shaped /merchant loading.tsx for the event detail +
// create-wizard routes so a portal skeleton never flashes here.
export default function MerchantEventsLoading() {
  return (
    <RouteSkeleton>
      <div className="flex min-h-[40vh] items-center justify-center px-4 py-16">
        <LoadingSpinner label="Loading…" />
      </div>
    </RouteSkeleton>
  );
}
