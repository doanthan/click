import { LoadingSpinner } from "@/components/loading-spinner";
import { RouteSkeleton } from "@/components/route-transition";

// Overrides the dashboard-shaped /merchant loading.tsx for this non-dashboard
// route so a portal skeleton never flashes on the login screen.
export default function MerchantLoginLoading() {
  return (
    <RouteSkeleton>
      <div className="flex min-h-[50vh] items-center justify-center px-4 py-20">
        <LoadingSpinner label="Loading…" />
      </div>
    </RouteSkeleton>
  );
}
