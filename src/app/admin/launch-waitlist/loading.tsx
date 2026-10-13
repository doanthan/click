import { SkeletonPageHeader, SkeletonTable } from "@/components/skeleton";
import { RouteSkeleton } from "@/components/route-transition";

// Content-column skeleton for /admin/launch-waitlist (sidebar already painted
// by the admin layout). Table-shaped so it doesn't inherit the dashboard skeleton.
export default function AdminLaunchWaitlistLoading() {
  return (
    <RouteSkeleton>
      <div className="space-y-8 py-10">
        <SkeletonPageHeader />
        <SkeletonTable rows={8} />
      </div>
    </RouteSkeleton>
  );
}
