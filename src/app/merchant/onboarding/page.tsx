import { redirect } from "next/navigation";

// Entry point for /merchant/onboarding. The access gate lives in the layout;
// here we just forward to the first step so /merchant/onboarding is a stable,
// linkable URL (the approval notification + email deep-link here).
export default function MerchantOnboardingPage() {
  redirect("/merchant/onboarding/welcome");
}
