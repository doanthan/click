import {
  SkeletonFilterBar,
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/skeleton";

/**
 * Content-column skeleton for /admin/members. Rendered inside the admin layout's
 * content slot (sidebar is already painted), mirroring the real page's
 * `space-y-8 py-10` container: header + search/filter bar + members table.
 */
export default function AdminMembersLoading() {
  return (
    <div className="space-y-8 py-10">
      <SkeletonPageHeader />
      <SkeletonFilterBar />
      <SkeletonTable rows={8} />
    </div>
  );
}
