import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OnboardingForm } from "@/components/onboarding-form";
import { getEventsForExplore, getProfileStatus } from "@/lib/event-repository";
import { safeNext } from "@/lib/safe-next";

export const metadata = {
  title: "Onboarding",
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

  // Anyone sent back here with a profile already part-filled (an account from
  // before the birth date was required, say) shouldn't retype what we hold.
  // Only a 4-digit postcode is reusable: profiles.suburb used to store a suburb
  // NAME, which can't seed a postcode field.
  const savedPostcode = /^\d{4}$/.test(status.suburb?.trim() ?? "")
    ? status.suburb!.trim()
    : "";

  // Real events for the step-3 value preview ("here's what Click looks like for
  // you"), which is what earns the interests step. The catalogue comes back
  // sorted soonest-first; the form picks the three that fit the intents just
  // chosen. Empty (no events, or no DB) is fine - the step falls back to copy
  // rather than showing invented cards.
  // ponytail: reuses the same unfiltered explore query the homepage runs, and
  // ships the first 12 to the client. If the catalogue ever gets big enough for
  // that to hurt, this wants its own small LIMIT 12 query.
  const previewEvents = (await getEventsForExplore()).slice(0, 12).map((event) => ({
    id: event.id,
    title: event.title,
    category: event.category,
    date: event.date,
    time: event.time,
    suburb: event.suburb,
    price: event.price,
    image: event.image,
    imageAlt: event.imageAlt,
  }));

  // One calm column on the cream ground. The form owns its own chrome (wordmark
  // header, progress bar, scrolling step body, sticky Continue bar), so the page
  // is just the ground.
  return (
    <main className="min-h-[100dvh] bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <OnboardingForm
        initialName={session.user.name ?? ""}
        initialPostcode={savedPostcode}
        initialPhotoUrl={status.photoUrl}
        previewEvents={previewEvents}
        next={next}
        accountKey={session.user.email ?? null}
      />
    </main>
  );
}
