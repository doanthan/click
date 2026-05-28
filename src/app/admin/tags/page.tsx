import { AdminTagManager } from "@/components/admin-tag-manager";
import { getAdminTags } from "@/lib/event-repository";

export const metadata = {
  title: "Contents Management | Admin",
};

export default async function AdminTagsPage() {
  const tags = await getAdminTags();

  return (
    <div className="space-y-8 py-10">
      <AdminTagManager tags={tags} />
    </div>
  );
}
