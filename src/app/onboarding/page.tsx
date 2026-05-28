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

  return (
    // Mobile: full-bleed app-shell so the sticky header / footer hug the viewport.
    // Desktop (lg+): brings back the side intro alongside the stepper.
    <main className="paper-noise min-h-[100dvh] bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <div className="mx-auto grid min-h-[100dvh] max-w-6xl gap-0 lg:grid-cols-[0.4fr_0.6fr] lg:gap-10 lg:px-6 lg:py-12">
        <aside className="hidden lg:block lg:sticky lg:top-24 lg:h-fit">
          <span className="sticker sticker--peach tilt-l-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
            Set up your profile
          </span>
          <h1 className="font-display mt-6 text-5xl font-light leading-[0.96] tracking-tight">
            Six quick taps. <span className="italic">No quiz.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base font-medium leading-7 text-[color:var(--mauve)]">
            One decision per screen. Skip anything optional — you can polish it
            later from your dashboard.
          </p>
          <ul className="mt-6 grid gap-2 text-sm font-semibold text-[color:var(--mauve)]">
            <li>✷ Suburb decides which events we show first.</li>
            <li>✷ Intent helps us avoid the wrong rooms.</li>
            <li>✷ Tags shape your recommendations.</li>
          </ul>
        </aside>

        <OnboardingForm initialName={session.user.name ?? ""} />
      </div>
    </main>
  );
}
