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
          <span className="sticker sticker--peach tilt-l-1 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
            Approval required
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[0.96] tracking-[-0.025em] sm:text-6xl">
            Your merchant profile is{" "}
            <span className="text-[color:var(--coral)]">{status.merchantProfile.verification_status}</span>.
          </h1>
          <p className="mt-4 text-base font-medium leading-7 text-[color:var(--mauve)]">
            An admin needs to approve your business before you can publish events.
          </p>
        </section>
      </main>
    );
  }

  // Payments must be connected before a merchant can create events: every event
  // can sell tickets, so we require Stripe Connect onboarding (charges_enabled)
  // to be finished first. Sends them to the payout step rather than dead-ending.
  if (!status.merchantProfile.charges_enabled) {
    return (
      <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
        <section className="mx-auto max-w-3xl">
          <span className="sticker sticker--peach tilt-l-1 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
            Connect payments first
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[0.96] tracking-[-0.025em] sm:text-6xl">
            Set up payouts before you create events.
          </h1>
          <p className="mt-4 text-base font-medium leading-7 text-[color:var(--mauve)]">
            We collect ticket payments through Stripe and pay them out to your
            connected account. Finish Stripe onboarding and you can publish your
            first event right after.
          </p>
          <a
            href="/merchant/onboarding/payouts"
            className="mt-8 inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wider text-[color:var(--on-deep)] hard-shadow-sm transition hover:-translate-y-0.5"
          >
            Set up payouts →
          </a>
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
