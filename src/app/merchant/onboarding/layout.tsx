import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProfileStatus } from "@/lib/event-repository";
import { OnboardingProgress } from "@/components/merchant-onboarding-wizard";

export const metadata = {
  title: "Get set up | Click",
  description:
    "Welcome aboard - learn how to create events and connect payouts so you can start taking payments on Click.",
};

// Shared chrome + access gate for the post-approval onboarding. Mirrors the
// merchant-signup layout: the gate runs once here instead of in every step.
// Only approved merchants belong here — pending/rejected go to the holding
// page, non-merchants to signup, logged-out visitors to the merchant login.
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
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 pb-12 pt-2 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-3xl">
        <span className="sticker sticker--peach tilt-l-1 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          You&apos;re approved
        </span>
        <h1 className="font-display mt-3 text-4xl font-bold leading-[0.96] tracking-[-0.025em] sm:text-5xl">
          Let&apos;s get you <span className="text-[color:var(--rose)]">hosting</span>.
        </h1>
        {/* Not "let's get you paid" - the payout step is skippable and free
            events are a first-class path, so the frame has to fit both. */}
        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[color:var(--mauve)]">
          A quick lap around hosting on Click. Running free events? You&apos;re
          already set - connect a bank account only when you want to charge.
        </p>

        <div className="mt-5 grid gap-6">
          <OnboardingProgress />
          {children}
        </div>
      </section>
    </main>
  );
}
