import { AdminMembersTable } from "@/components/admin-members-table";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getAdminEventOptions, getAdminMembers } from "@/lib/event-repository";

export const metadata = {
  title: "Attendees Management | Admin",
};

export default async function AdminMembersPage() {
  const [members, options] = await Promise.all([
    getAdminMembers(),
    // Only the {slug,title} picker is needed here, not the full events payload.
    getAdminEventOptions(),
  ]);

  // Keep the same case-insensitive ordering the previous getAdminEvents()-backed
  // list produced (the table component re-sorts the same way, but this preserves
  // the exact data handed in).
  const eventOptions = [...options].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="space-y-8 py-10">
      <AdminPageHeader
        eyebrow="Community"
        title="Attendees"
        description="Search, verify, and moderate member accounts."
      />
      <AdminMembersTable members={members} eventOptions={eventOptions} />
    </div>
  );
}
