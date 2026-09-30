import {
  SkeletonFilterBar,
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/skeleton";
import { RouteSkeleton } from "@/components/route-transition";

/**
 * Content-column skeleton for /admin/events. Rendered inside the admin layout's
 * content slot (sidebar is already painted), mirroring the real page's
 * `space-y-8 py-10` container: header + faceted filter bar + event queue table.
 */
export default function AdminEventsLoading() {
  return (
    <RouteSkeleton>
      <div className="space-y-8 py-10">
        <SkeletonPageHeader />
        <SkeletonFilterBar />
        <SkeletonTable rows={8} />
      </div>
    </RouteSkeleton>
  );
}
