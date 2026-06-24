import {
  SkeletonFilterBar,
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/skeleton";

// Content-column skeleton for /admin/location-waitlist (sidebar already painted
// by the admin layout). Table-shaped so it doesn't inherit the dashboard skeleton.
export default function AdminLocationWaitlistLoading() {
  return (
    <div className="space-y-8 py-10">
      <SkeletonPageHeader />
      <SkeletonFilterBar />
      <SkeletonTable rows={8} />
    </div>
  );
}
