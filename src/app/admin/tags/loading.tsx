import {
  SkeletonFilterBar,
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/skeleton";
import { RouteSkeleton } from "@/components/route-transition";

// Content-column skeleton for /admin/tags (sidebar already painted by the admin
// layout). Table-shaped so it doesn't inherit the dashboard skeleton.
export default function AdminTagsLoading() {
  return (
    <RouteSkeleton>
      <div className="space-y-8 py-10">
        <SkeletonPageHeader />
        <SkeletonFilterBar />
        <SkeletonTable rows={8} withThumb={false} />
      </div>
    </RouteSkeleton>
  );
}
