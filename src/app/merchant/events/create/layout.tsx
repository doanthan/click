import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EventCreateProvider } from "@/components/event-create-wizard";
import {
  getMerchantCategoryOptions,
  getMerchantEventCreateOptions,
  getMerchantTagOptions,
  getProfileStatus,
} from "@/lib/event-repository";
import { getPlatformFeeBps } from "@/lib/stripe-connect";

export const metadata = {
  title: "Create event",
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
          <p className="eyebrow">Approval required</p>
          <h1 className="mt-6 font-display text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-4xl">
            Your merchant profile is{" "}
            <span className="text-[color:var(--rose)]">{status.merchantProfile.verification_status}</span>.
          </h1>
          <p className="mt-4 text-base leading-7 text-[color:var(--slate)]">
            An admin needs to approve your business before you can publish events.
          </p>
        </section>
      </main>
    );
  }

  // The one-time post-approval walkthrough runs BEFORE the first event, the
  // same way /merchant gates it. Without this, the approval email's "Create
  // your first event" link (createEventUrl) dropped merchants straight in here,
  // so they built an event and only afterwards got bounced into a "You're
  // approved - here's how events work" tour. It's four pages and the last one
  // stamps onboarding_completed_at, so this can't loop.
  if (!status.merchantProfile.onboarding_completed_at) {
    redirect("/merchant/onboarding");
  }

  // NO payout gate here. Onboarding explicitly offers "Skip for now - you can
  // keep going and run free events", so blocking the whole wizard on
  // charges_enabled dead-ended every merchant who took that offer. Stripe
  // Connect is enforced where it actually matters instead:
  //   - createEventForMerchant keeps the event 'pending' unless payouts are live
  //   - approveEventForAdmin refuses to publish a PAID merchant event without it
  //   - checkout throws PayoutsNotReadyError as the final backstop
  // The Schedule step warns as soon as a non-zero price is typed, so a merchant
  // learns this before submitting rather than from an admin rejection.
  const [categoryRows, tagOptions, createOptions] = await Promise.all([
    getMerchantCategoryOptions(),
    getMerchantTagOptions(),
    getMerchantEventCreateOptions(status.merchantProfile.id),
  ]);
  const categoryOptions = categoryRows.map((c) => c.name);

  // Read server-side and handed down: PLATFORM_FEE_BPS is a server env var, and
  // the Schedule step has to be able to tell a merchant what they will actually
  // receive before they price a live-Stripe ticket.
  const platformFeeBps = getPlatformFeeBps();

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <section className="bg-[color:var(--champagne)] py-8">
        {/* .ck-page outside, the form's own cap inside and NOT centred - the DS
            rule for a narrow page: same left edge as /merchant (so stepping into
            the wizard doesn't slide the column sideways), whitespace falls to
            the right, and the form still stops at a readable width. */}
        <div className="ck-page">
          <div className="max-w-4xl">
            <EventCreateProvider
              categoryOptions={categoryOptions}
              tagOptions={tagOptions}
              hostNameOptions={createOptions.hostNames}
              venueOptions={createOptions.venues}
              chargesEnabled={status.merchantProfile.charges_enabled === true}
              platformFeeBps={platformFeeBps}
            >
              {children}
            </EventCreateProvider>
          </div>
        </div>
      </section>
    </main>
  );
}
