import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  DocumentsSection,
  WizardShell,
} from "@/components/merchant-signup-wizard";

export const metadata = {
  title: "Documents · Become a host | Click",
};

// Step 3/3 · Documents → Submit.
export default async function MerchantSignupDocumentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/merchant/signup");

  return (
    <WizardShell step={2}>
      <DocumentsSection />
    </WizardShell>
  );
}
