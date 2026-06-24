import {
  SkeletonFilterBar,
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/skeleton";

/**
 * Content-column skeleton for /admin/merchants. Rendered inside the admin
 * layout's content slot (sidebar is already painted), mirroring the real page's
 * `space-y-8 py-10` container: header + filter bar + merchants table.
 */
export default function AdminMerchantsLoading() {
  return (
    <div className="space-y-8 py-10">
      <SkeletonPageHeader />
      <SkeletonFilterBar />
      <SkeletonTable rows={8} />
    </div>
  );
}
