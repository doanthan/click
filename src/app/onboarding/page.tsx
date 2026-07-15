import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OnboardingForm } from "@/components/onboarding-form";
import { getProfileStatus } from "@/lib/event-repository";

export const metadata = {
  title: "Onboarding | Click",
  description: "Set up your Click profile.",
};

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/onboarding");
  }

  const status = await getProfileStatus(session);
  if (status.onboardingComplete) {
    redirect("/dashboard");
  }

  // One calm column on the cream ground. The form owns its own chrome (wordmark
  // header, scrolling body, sticky Continue bar), so the page is just the ground
  // - the old lg-only aside repeated the form's headline word for word.
  return (
    <main className="min-h-[100dvh] bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <OnboardingForm initialName={session.user.name ?? ""} />
    </main>
  );
}
