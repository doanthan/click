import {
  SkeletonFilterBar,
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/skeleton";

/**
 * Content-column skeleton for /admin/transactions. Rendered inside the admin
 * layout's content slot (sidebar is already painted), mirroring the real page's
 * `space-y-8 py-10` container. The real page's header lives inside
 * <AdminTransactionsTable>, so we stand it in with the shared page-header
 * skeleton + the date/status filter bar + the transactions table.
 */
export default function AdminTransactionsLoading() {
  return (
    <div className="space-y-8 py-10">
      <SkeletonPageHeader />
      <SkeletonFilterBar />
      <SkeletonTable rows={8} />
    </div>
  );
}
