import {
  SkeletonFilterBar,
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/skeleton";

// Content-column skeleton for /admin/reports (the admin layout already paints
// the sidebar). Table-shaped so it doesn't inherit the dashboard's metric/chart
// skeleton from admin/loading.tsx.
export default function AdminReportsLoading() {
  return (
    <div className="space-y-8 py-10">
      <SkeletonPageHeader />
      <SkeletonFilterBar />
      <SkeletonTable rows={8} />
    </div>
  );
}
