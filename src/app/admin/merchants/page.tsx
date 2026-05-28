import { AdminMerchantsTable } from "@/components/admin-merchants-table";
import { getAdminMerchants } from "@/lib/event-repository";

export const metadata = {
  title: "Merchants Management | Admin",
};

export default async function AdminMerchantsPage() {
  const merchants = await getAdminMerchants();

  return (
    <div className="space-y-8 py-10">
      <AdminMerchantsTable merchants={merchants} />
    </div>
  );
}
