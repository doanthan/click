import { Suspense } from "react";
import { AdminEventQueue } from "@/components/admin-event-queue";
import { getAdminEvents, getProfileTagOptions } from "@/lib/event-repository";

export const metadata = {
  title: "Events Management | Admin",
};

export default async function AdminEventsPage() {
  const [events, tagOptions] = await Promise.all([
    getAdminEvents(),
    getProfileTagOptions(),
  ]);
  // Flatten the curated interest tags into the {slug,label} list the queue's
  // per-event tag editor offers.
  const interestTagOptions = tagOptions.interestCategories
    .flatMap((category) => category.tags)
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="space-y-8 py-10">
      {/* AdminEventQueue reads filters from the query string via useSearchParams,
          which Next requires to sit under a Suspense boundary. */}
      <Suspense fallback={null}>
        <AdminEventQueue events={events} tagOptions={interestTagOptions} />
      </Suspense>
    </div>
  );
}
