import { AdminEventQueue } from "@/components/admin-event-queue";
import { getAdminEvents } from "@/lib/event-repository";

export const metadata = {
  title: "Events Management | Admin",
};

export default async function AdminEventsPage() {
  const events = await getAdminEvents();

  return (
    <div className="space-y-8 py-10">
      <AdminEventQueue events={events} />
    </div>
  );
}
