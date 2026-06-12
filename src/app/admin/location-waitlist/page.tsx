import { AdminLocationWaitlistTable } from "@/components/admin-location-waitlist-table";
import { getAdminLocationWaitlist } from "@/lib/event-repository";

export const metadata = {
  title: "Location Waitlist | Admin",
};

export default async function AdminLocationWaitlistPage() {
  const entries = await getAdminLocationWaitlist();

  return (
    <div className="space-y-8 py-10">
      <AdminLocationWaitlistTable entries={entries} />
    </div>
  );
}
