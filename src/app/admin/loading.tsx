import {
  SkeletonChart,
  SkeletonInfoCardGrid,
  SkeletonMetricGrid,
  SkeletonPageHeader,
} from "@/components/skeleton";

/**
 * Content-column skeleton for the admin dashboard home.
 *
 * The admin layout already paints <AdminSidebar> around {children}, so this
 * renders ONLY the content column - header + metric grid + trend chart + the
 * info-card grid - mirroring `src/app/admin/page.tsx`'s `space-y-12 py-10`.
 */
export default function AdminOverviewLoading() {
  return (
    <div className="space-y-12 py-10">
      <SkeletonPageHeader />
      <SkeletonMetricGrid count={8} />
      <SkeletonChart />
      <SkeletonInfoCardGrid count={6} />
    </div>
  );
}
