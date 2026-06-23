import { LoadingSpinner } from "@/components/loading-spinner";

// Overrides the dashboard-shaped /merchant loading.tsx so the signup wizard
// (which has its own chrome via merchant/signup/layout.tsx) doesn't flash a
// portal skeleton while its step pages resolve.
export default function MerchantSignupLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 py-16">
      <LoadingSpinner label="Loading…" />
    </div>
  );
}
