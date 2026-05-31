import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EventCreateProvider } from "@/components/event-create-wizard";
import {
  getMerchantCategoryOptions,
  getMerchantEventCreateOptions,
  getMerchantTagOptions,
  getProfileStatus,
} from "@/lib/event-repository";

export const metadata = {
  title: "Create event | Click",
};

// Shared chrome + state provider for the whole /merchant/events/create flow.
// The provider is mounted here (not in each step page) so wizard state survives
// client-side navigation between sibling step pages — App Router keeps layouts
// mounted across child page transitions, so the form state inside the provider
// doesn't reset when you go Basics → Schedule → … → Review.
//
// Auth + merchant-approval gating also happens once here instead of being
// repeated in every step page.
export default async function CreateEventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const [categoryRows, tagOptions, createOptions] = await Promise.all([
    getMerchantCategoryOptions(),
    getMerchantTagOptions(),
    getMerchantEventCreateOptions(status.merchantProfile.id),
  ]);
  const categoryOptions = categoryRows.map((c) => c.name);

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <section className="bg-[color:var(--champagne)] py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <EventCreateProvider
            categoryOptions={categoryOptions}
            tagOptions={tagOptions}
            hostNameOptions={createOptions.hostNames}
            venueOptions={createOptions.venues}
          >
            {children}
          </EventCreateProvider>
        </div>
      </section>
    </main>
  );
}
