import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  ContactSection,
  WizardShell,
} from "@/components/merchant-signup-wizard";

export const metadata = {
  title: "Contact & address · Become a host",
};

// Step 2/3 · Contact & address.
export default async function MerchantSignupContactPage() {
  const session = await auth();
  if (!session?.user) redirect("/merchant/signup");

  return (
    <WizardShell step={1}>
      <ContactSection />
    </WizardShell>
  );
}
