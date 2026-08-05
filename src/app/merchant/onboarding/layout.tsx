import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProfileStatus } from "@/lib/event-repository";
import { OnboardingProgress } from "@/components/merchant-onboarding-wizard";

export const metadata = {
  title: "Get set up",
  description:
    "Welcome aboard - learn how to create events and connect payouts so you can start taking payments on Click.",
};

// Shared chrome + access gate for the post-approval onboarding. Mirrors the
// merchant-signup layout: the gate runs once here instead of in every step.
// Only approved merchants belong here - pending/rejected go to the holding
// page, non-merchants to signup, logged-out visitors to the merchant login.
//
// The chrome is deliberately thin: gate, ground, stepper. The "You're approved"
// sticker and the h1 used to live here, which meant the one piece of good news
// in the flow repeated above every step - and was still exhorting the merchant
// to get started on the step that told them they were finished. Each step now
// owns its own headline; the welcome step owns the news.
export default async function MerchantOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/merchant/login?callbackUrl=/merchant/onboarding");
  }

  const status = await getProfileStatus(session);
  if (!status.merchantProfile) {
    redirect("/merchant/signup");
  }
  if (status.merchantProfile.verification_status !== "approved") {
    redirect("/merchant-pending");
  }

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 pb-12 pt-6 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto grid max-w-3xl gap-6">
        <OnboardingProgress />
        {children}
      </section>
    </main>
  );
}
