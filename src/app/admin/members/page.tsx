import { AdminMembersTable } from "@/components/admin-members-table";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getAdminEvents, getAdminMembers } from "@/lib/event-repository";

export const metadata = {
  title: "Attendees Management | Admin",
};

export default async function AdminMembersPage() {
  const [members, events] = await Promise.all([
    getAdminMembers(),
    getAdminEvents(),
  ]);

  const eventOptions = events
    .map((event) => ({ slug: event.id, title: event.title }))
    .sort((a, b) => a.title.localeCompare(b.title));

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
