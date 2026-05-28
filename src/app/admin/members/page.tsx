import { AdminMembersTable } from "@/components/admin-members-table";
import { getAdminMembers } from "@/lib/event-repository";

export const metadata = {
  title: "Attendees Management | Admin",
};

export default async function AdminMembersPage() {
  const members = await getAdminMembers();

  return (
    <div className="space-y-8 py-10">
      <AdminMembersTable members={members} />
    </div>
  );
}
