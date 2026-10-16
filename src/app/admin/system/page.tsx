import { AdminQaAccess } from "@/components/admin-qa-access";
import { AdminRunNow } from "@/components/admin-run-now";
import { AdminSystemSettings } from "@/components/admin-system-settings";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getSystemSettings } from "@/lib/event-repository";
import { requireAdminPage } from "@/lib/admin-guard";
import { isLocalDevelopment } from "@/lib/runtime-mode";
import { isTestSwitcherUnlocked } from "@/lib/test-switcher";

export const metadata = {
  title: "System | Admin",
};

// The Run-now Server Actions run a whole cron job (03 §10) - the same budget
// the daily-picks cron route has.
export const maxDuration = 300;

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
      <AdminRunNow />
      <AdminQaAccess unlocked={await isTestSwitcherUnlocked()} alwaysOn={isLocalDevelopment()} />
    </div>
  );
}
