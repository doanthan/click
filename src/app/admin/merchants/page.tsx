import { AdminMerchantsTable } from "@/components/admin-merchants-table";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getAdminMerchants } from "@/lib/event-repository";
import { requireAdminPage } from "@/lib/admin-guard";

export const metadata = {
  title: "Merchants Management | Admin",
};

const STATUS_VALUES = ["all", "pending", "approved", "rejected", "suspended"] as const;

export default async function AdminMerchantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdminPage();

  const [merchants, params] = await Promise.all([getAdminMerchants(), searchParams]);
  const initialStatus = (STATUS_VALUES as readonly string[]).includes(params.status ?? "")
    ? (params.status as (typeof STATUS_VALUES)[number])
    : "all";

  return (
    <div className="space-y-8 py-10">
      <AdminPageHeader
        eyebrow="Partners"
        title="Merchants"
        description="Review host applications and manage merchant accounts."
      />
      <AdminMerchantsTable merchants={merchants} initialStatus={initialStatus} />
    </div>
  );
}
