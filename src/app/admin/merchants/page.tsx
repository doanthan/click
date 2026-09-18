import { AdminMerchantsTable } from "@/components/admin-merchants-table";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getAdminMerchants } from "@/lib/event-repository";
import { requireAdminPage } from "@/lib/admin-guard";
import { auth, isAdminEmail } from "@/auth";

export const metadata = {
  title: "Merchants Management | Admin",
};

const STATUS_VALUES = ["all", "pending", "approved", "rejected", "suspended"] as const;

// The window the table loads with. getAdminMerchants floats pending
// applications to the top of it, so the review queue is never what falls off.
const PAGE_SIZE = 200;

/**
 * Re-query merchants for a search term.
 *
 * A server action is its own public POST endpoint - requireAdminPage() below
 * runs for the page render, NOT for this - so admin is re-derived here.
 */
async function searchMerchants(term: string) {
  "use server";
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    throw new Error("Admin access is required.");
  }
  const search = term.trim();
  return getAdminMerchants({ search: search || undefined, limit: PAGE_SIZE });
}

export default async function AdminMerchantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdminPage();

  const [merchants, params] = await Promise.all([
    getAdminMerchants({ limit: PAGE_SIZE }),
    searchParams,
  ]);
  const initialStatus = (STATUS_VALUES as readonly string[]).includes(params.status ?? "")
    ? (params.status as (typeof STATUS_VALUES)[number])
    : "all";

  return (
    <div className="space-y-8 py-10">
      <AdminPageHeader
        eyebrow="Partners"
        title="Merchants"
        description="Review host applications and manage merchant accounts."
      />
      <AdminMerchantsTable
        merchants={merchants}
        initialStatus={initialStatus}
        windowSize={PAGE_SIZE}
        searchMerchants={searchMerchants}
      />
    </div>
  );
}
