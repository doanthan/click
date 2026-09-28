import { AdminMembersTable, type MembersFilters } from "@/components/admin-members-table";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getAdminEventOptions, getAdminMembers } from "@/lib/event-repository";
import { requireAdminPage } from "@/lib/admin-guard";

export const metadata = {
  title: "Attendees Management | Admin",
};

// One page of rows, fetched per request. Filters and the page number live in
// the URL, so the server decides every one of them and a filtered view can be
// linked to.
const PAGE_SIZE = 25;

const ROLES = new Set(["attendee", "merchant", "admin"]);

type SearchParams = Record<"q" | "role" | "event" | "area" | "page", string | string[] | undefined>;

// A repeated param (?q=a&q=b) arrives as an array; the first one wins.
const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams?: Promise<Partial<SearchParams>>;
}) {
  await requireAdminPage();

  const params = (await searchParams) ?? {};
  const role = first(params.role);
  const filters: MembersFilters = {
    q: first(params.q),
    role: ROLES.has(role) ? (role as MembersFilters["role"]) : "all",
    event: first(params.event),
    area: first(params.area) === "outside" ? "outside" : "all",
  };
  const requestedPage = Math.max(1, Number.parseInt(first(params.page) || "1", 10) || 1);

  const [page, options] = await Promise.all([
    getAdminMembers({
      search: filters.q || undefined,
      role: filters.role === "all" ? undefined : filters.role,
      eventSlug: filters.event || undefined,
      outsidePilot: filters.area === "outside",
      limit: PAGE_SIZE,
      offset: (requestedPage - 1) * PAGE_SIZE,
    }),
    // Only the {slug,title} picker is needed here, not the full events payload.
    getAdminEventOptions(),
  ]);
  const eventOptions = [...options].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="space-y-8 py-10">
      <AdminPageHeader
        eyebrow="Community"
        title="Attendees"
        description="Search, verify, and moderate member accounts."
      />
      <AdminMembersTable
        page={page}
        pageSize={PAGE_SIZE}
        filters={filters}
        eventOptions={eventOptions}
      />
    </div>
  );
}
