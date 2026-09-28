import { AdminTagManager } from "@/components/admin-tag-manager";
import { AdminTagRequests } from "@/components/admin-tag-requests";
import { AdminPageHeader } from "@/components/admin-page-header";
import {
  getAdminTags,
  getMerchantCategoryOptions,
  getTagRequestsForAdmin,
} from "@/lib/event-repository";
import { requireAdminPage } from "@/lib/admin-guard";

export const metadata = {
  title: "Tags & Categories | Admin",
};

export default async function AdminTagsPage() {
  await requireAdminPage();

  // Tag requests read fail-soft (empty until database/068 is applied), and the
  // category list is the one hosts pick events from.
  const [tags, tagRequests, categories] = await Promise.all([
    getAdminTags(),
    getTagRequestsForAdmin(),
    getMerchantCategoryOptions().catch(() => []),
  ]);

  return (
    <div className="space-y-8 py-10">
      <AdminPageHeader
        eyebrow="Taxonomy"
        title="Tags & Categories"
        description="Curate the interest tags events and people are matched on."
      />
      <AdminTagRequests
        requests={tagRequests}
        categories={categories.map((category) => category.name)}
      />
      {/* Keyed on the count so an approved request's new tag shows up after the
          refresh - the manager seeds its own list state once, from props. */}
      <AdminTagManager key={tags.length} tags={tags} />
    </div>
  );
}
