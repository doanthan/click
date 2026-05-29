import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  BusinessSection,
  WizardShell,
} from "@/components/merchant-signup-wizard";

export const metadata = {
  title: "Business details · Become a host | Click",
};

// Step 1/3 · Business details.
export default async function MerchantSignupBusinessPage() {
  const session = await auth();
  if (!session?.user) redirect("/merchant/signup");

  return (
    <WizardShell step={0}>
      <BusinessSection />
    </WizardShell>
  );
}
