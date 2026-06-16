import { AdminTagManager } from "@/components/admin-tag-manager";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getAdminTags } from "@/lib/event-repository";

export const metadata = {
  title: "Tags & Categories | Admin",
};

export default async function AdminTagsPage() {
  const tags = await getAdminTags();

  return (
    <div className="space-y-8 py-10">
      <AdminPageHeader
        eyebrow="Taxonomy"
        title="Tags & Categories"
        description="Curate the interest tags events and people are matched on."
      />
      <AdminTagManager tags={tags} />
    </div>
  );
}
