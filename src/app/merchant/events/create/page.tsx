import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHero } from "@/components/click-ui";
import { EventCreateWizard } from "@/components/event-create-wizard";
import { getProfileStatus } from "@/lib/event-repository";

export const metadata = {
  title: "Create event · 5-step wizard | Click",
};

export default async function CreateEventWizardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/merchant/login?callbackUrl=/merchant/events/create");
  }

  const status = await getProfileStatus(session);
  if (!status.merchantProfile) {
    redirect("/merchant/signup");
  }

  if (status.merchantProfile.verification_status !== "approved") {
    return (
      <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
        <section className="mx-auto max-w-3xl">
          <span className="sticker sticker--peach tilt-l-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
            Approval required
          </span>
          <h1 className="mt-6 font-display text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
            Your merchant profile is{" "}
            <span className="italic">{status.merchantProfile.verification_status}</span>.
          </h1>
          <p className="mt-4 text-base font-medium leading-7 text-[color:var(--mauve)]">
            An admin needs to approve your business before you can publish events.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <PageHero
        eyebrow="New event · 5 steps"
        title="Set up a new event."
        body="Basics → schedule → location → media → review. Submissions go to admin for approval."
      />
      <section className="bg-[color:var(--champagne)] py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <EventCreateWizard />
        </div>
      </section>
    </main>
  );
}
