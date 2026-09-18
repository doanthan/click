import { AdminMembersTable } from "@/components/admin-members-table";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getAdminEventOptions, getAdminMembers } from "@/lib/event-repository";
import { requireAdminPage } from "@/lib/admin-guard";
import { auth, isAdminEmail } from "@/auth";

export const metadata = {
  title: "Attendees Management | Admin",
};

// The window the table loads with. Matches the repository default; named here
// because the table needs the same number to tell the admin the list is capped.
const PAGE_SIZE = 250;

/**
 * Re-query members for a search term.
 *
 * A server action is its own public POST endpoint - requireAdminPage() below
 * runs for the page render, NOT for this - so admin is re-derived on every
 * call, the same way the transactions ledger action does it.
 */
async function searchMembers(term: string) {
  "use server";
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    throw new Error("Admin access is required.");
  }
  const search = term.trim();
  return getAdminMembers({ search: search || undefined, limit: PAGE_SIZE });
}

export default async function AdminMembersPage() {
  await requireAdminPage();

  const [members, options] = await Promise.all([
    getAdminMembers({ limit: PAGE_SIZE }),
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
      <AdminMembersTable
        members={members}
        eventOptions={eventOptions}
        windowSize={PAGE_SIZE}
        searchMembers={searchMembers}
      />
    </div>
  );
}
