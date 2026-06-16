import { AdminMerchantsTable } from "@/components/admin-merchants-table";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getAdminMerchants } from "@/lib/event-repository";

export const metadata = {
  title: "Merchants Management | Admin",
};

export default async function AdminMerchantsPage() {
  const merchants = await getAdminMerchants();

  return (
    <div className="space-y-8 py-10">
      <AdminPageHeader
        eyebrow="Partners"
        title="Merchants"
        description="Review host applications and manage merchant accounts."
      />
      <AdminMerchantsTable merchants={merchants} />
    </div>
  );
}
