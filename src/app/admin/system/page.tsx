import { AdminSystemSettings } from "@/components/admin-system-settings";
import { getSystemSettings } from "@/lib/event-repository";

export const metadata = {
  title: "System | Admin",
};

export default async function AdminSystemPage() {
  const systemSettings = await getSystemSettings();

  return (
    <div className="space-y-8 py-10">
      <AdminSystemSettings initial={systemSettings} />
    </div>
  );
}
