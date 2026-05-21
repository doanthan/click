import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MetricCard, PageHero, Pill, SectionIntro } from "@/components/click-ui";
import { CreateEventForm } from "@/components/create-event-form";
import { MerchantCalendar } from "@/components/merchant-calendar";
import { MerchantEventsPanel } from "@/components/merchant-events-panel";
import { getMerchantEvents, getProfileStatus } from "@/lib/event-repository";

export const metadata = {
  title: "Merchant Portal | Click",
  description: "Click merchant portal for event hosts, booking models, payments, and analytics.",
};

const priceFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

function formatPrice(cents: number) {
  if (cents === 0) return "Free";
  return priceFormatter.format(cents / 100);
}

function currentTimestamp() {
  return Date.now();
}

type MerchantPageProps = {
  searchParams?: Promise<{ month?: string }>;
};

export default async function MerchantPage({ searchParams }: MerchantPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/merchant");
  }

  const status = await getProfileStatus(session);
  if (!status.merchantProfile) {
    redirect("/merchant/signup");
  }

  const params = (await searchParams) ?? {};
  const merchantEvents = await getMerchantEvents(session);
  const merchantApproved = status.merchantProfile.verification_status === "approved";
  const now = currentTimestamp();
  const upcomingEvents = merchantEvents.filter(
    (event) => new Date(event.startsAt).getTime() >= now,
  );

  const totalConfirmed = merchantEvents.reduce((sum, event) => sum + event.confirmed, 0);
  const totalCapacity = merchantEvents.reduce((sum, event) => sum + event.capacity, 0);
  const totalRevenueCents = merchantEvents.reduce(
    (sum, event) => sum + event.priceCents * event.confirmed,
    0,
  );
  const pendingCount = merchantEvents.filter((event) => event.status === "Pending").length;
  const fillRate = totalCapacity > 0 ? Math.round((totalConfirmed / totalCapacity) * 100) : 0;

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <PageHero
        eyebrow="Merchant portal"
        title={`Hosting as ${status.merchantProfile.business_name}.`}
        body="Create events, set capacity, watch RSVPs come in. Click into any event to see the people booking and contact them if needed."
      >
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Hosted events" value={merchantEvents.length.toString()} tone="white" />
          <MetricCard label="Fill rate" value={`${fillRate}%`} tone="aqua" />
          <MetricCard label="Confirmed revenue" value={formatPrice(totalRevenueCents)} tone="pink" />
          <MetricCard label="Pending review" value={pendingCount.toString()} tone="white" />
        </div>
      </PageHero>

      <section className="bg-[color:var(--champagne)] py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Calendar"
            title={
              upcomingEvents.length > 0
                ? `${upcomingEvents.length} upcoming event${upcomingEvents.length === 1 ? "" : "s"}.`
                : "Your hosting calendar."
            }
            body="Each day shows your events and how many people have booked. Click any chip to see attendees."
          />

          <div className="mt-8">
            <MerchantCalendar events={merchantEvents} monthParam={params.month} />
          </div>
        </div>
      </section>

      <section className="bg-[color:var(--champagne)] pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="My events"
            title="All hosting commitments."
            body="The same events as a sortable list. Click any row to see the attendee list, capacity, and waitlist."
          />

          <div className="mt-8">
            <MerchantEventsPanel events={merchantEvents} />
          </div>
        </div>
      </section>

      <section className="bg-[color:var(--peach)] py-12">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.74fr_1.26fr]">
          <div>
            <SectionIntro
              eyebrow="Create event"
              title={merchantApproved ? "Add another event." : "Approval required before publishing."}
              body={
                merchantApproved
                  ? "Set the venue, date, seats, and price. Submissions go to admin for review."
                  : "An admin needs to approve your merchant profile before you can create Click-managed events."
              }
            />
            <div className="mt-8 flex flex-wrap gap-2">
              <Pill tone="pink">Capacity enforced</Pill>
              <Pill>Auto-waitlist</Pill>
              <Pill tone="aqua">Schedule conflict check</Pill>
            </div>
          </div>

          {merchantApproved ? (
            <CreateEventForm />
          ) : (
            <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm">
              <p className="font-display text-3xl font-light leading-tight">
                Current status: {status.merchantProfile.verification_status}
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                Your ABN, website, and contact details are visible to admins in
                the merchant approval queue. Once approved, this form unlocks.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
