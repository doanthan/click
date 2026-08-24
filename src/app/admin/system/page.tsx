import { AdminSystemSettings } from "@/components/admin-system-settings";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getSystemSettings } from "@/lib/event-repository";
import { requireAdminPage } from "@/lib/admin-guard";

export const metadata = {
  title: "System | Admin",
};

export default async function AdminSystemPage() {
  await requireAdminPage();

  const systemSettings = await getSystemSettings();

  return (
    <div className="space-y-8 py-10">
      <AdminPageHeader
        eyebrow="Configuration"
        title="System"
        description="Platform-wide settings and feature switches."
      />
      <AdminSystemSettings initial={systemSettings} />
    </div>
  );
}
