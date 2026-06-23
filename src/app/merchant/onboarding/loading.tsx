import { LoadingSpinner } from "@/components/loading-spinner";

// Overrides the dashboard-shaped /merchant loading.tsx so the onboarding
// walkthrough (its own chrome via merchant/onboarding/layout.tsx) doesn't
// flash a portal skeleton between steps.
export default function MerchantOnboardingLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 py-16">
      <LoadingSpinner label="Loading…" />
    </div>
  );
}
