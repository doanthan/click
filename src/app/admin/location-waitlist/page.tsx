import { AdminLocationWaitlistTable } from "@/components/admin-location-waitlist-table";
import { getAdminLocationWaitlist } from "@/lib/event-repository";
import { requireAdminPage } from "@/lib/admin-guard";

export const metadata = {
  title: "Location Waitlist | Admin",
};

export default async function AdminLocationWaitlistPage() {
  await requireAdminPage();

  const entries = await getAdminLocationWaitlist();

  return (
    <div className="space-y-8 py-10">
      <AdminLocationWaitlistTable entries={entries} />
    </div>
  );
}
