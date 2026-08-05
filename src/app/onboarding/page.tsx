import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OnboardingForm } from "@/components/onboarding-form";
import { getProfileStatus } from "@/lib/event-repository";
import { safeNext } from "@/lib/safe-next";

export const metadata = {
  title: "Onboarding | Click",
  description: "Set up your Click profile.",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/onboarding");
  }

  // Where the visitor was headed before signup interrupted them - passed on by
  // /post-login and handed to the form so finishing onboarding resumes the trip.
  const next = safeNext((await searchParams)?.next);

  const status = await getProfileStatus(session);
  if (status.onboardingComplete) {
    redirect(next ?? "/dashboard");
  }

  // One calm column on the cream ground. The form owns its own chrome (wordmark
  // header, scrolling body, sticky Continue bar), so the page is just the ground
  // - the old lg-only aside repeated the form's headline word for word.
  return (
    <main className="min-h-[100dvh] bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <OnboardingForm initialName={session.user.name ?? ""} next={next} />
    </main>
  );
}
