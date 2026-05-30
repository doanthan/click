import Link from "next/link";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MetricCard, Pill, SectionIntro } from "@/components/click-ui";
import { CreateEventForm } from "@/components/create-event-form";
import { MerchantCalendar } from "@/components/merchant-calendar";
import { MerchantEventsPanel } from "@/components/merchant-events-panel";
import { MerchantAttendeesPanel } from "@/components/merchant-attendees-panel";
import { StripeDashboardButton } from "@/components/stripe-dashboard-button";
import {
  getMerchantAllAttendees,
  getMerchantEvents,
  getMerchantFinancesSummary,
  getProfileStatus,
  type MerchantFinancesSummary,
} from "@/lib/event-repository";

export const metadata = {
  title: "Merchant Portal | Click",
  description: "Click merchant portal for event hosts, booking models, payments, and analytics.",
};

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "events", label: "Events" },
  { key: "venues", label: "Venues" },
  { key: "attendees", label: "Attendees" },
  { key: "bookings", label: "Bookings" },
  { key: "finances", label: "Finances" },
  { key: "analytics", label: "Analytics" },
  { key: "discounts", label: "Discounts" },
  { key: "support", label: "Support" },
  { key: "settings", label: "Settings" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const priceFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function formatPrice(cents: number) {
  if (cents === 0) return "Free";
  return priceFormatter.format(cents / 100);
}

type MerchantPageProps = {
  searchParams?: Promise<{ month?: string; tab?: string }>;
};

export default async function MerchantPage({ searchParams }: MerchantPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/merchant/login?callbackUrl=/merchant");
  }

  const status = await getProfileStatus(session);
  if (!status.merchantProfile) {
    redirect("/merchant/signup");
  }
  // Spec §1: portal access is blocked until status='approved'. Pending or
  // rejected applications get the holding page instead of an empty portal.
  if (status.merchantProfile.verification_status !== "approved") {
    redirect("/merchant-pending");
  }
  // First visit after approval: send the merchant through the one-time
  // onboarding walkthrough (how-to + Stripe payout setup). It's skippable —
  // reaching the final step stamps onboarding_completed_at so we don't loop.
  if (!status.merchantProfile.onboarding_completed_at) {
    redirect("/merchant/onboarding");
  }

  const params = (await searchParams) ?? {};
  const tab: TabKey = TABS.some((t) => t.key === params.tab)
    ? (params.tab as TabKey)
    : "dashboard";

  const merchantEvents = await getMerchantEvents(session);
  const merchantApproved = status.merchantProfile.verification_status === "approved";
  // eslint-disable-next-line react-hooks/purity -- async server component, evaluated once per request
  const now = Date.now();
  const upcomingEvents = merchantEvents.filter(
    (event) => new Date(event.startsAt).getTime() >= now,
  );

  // Analytics tab still wants the rolled-up totals; the hero that previously
  // surfaced them was redundant with the dashboard sections below, so it's
  // gone. fillRate / pendingCount lived only in that hero and went with it.
  const totalConfirmed = merchantEvents.reduce((sum, event) => sum + event.confirmed, 0);
  const totalCapacity = merchantEvents.reduce((sum, event) => sum + event.capacity, 0);
  const totalRevenueCents = merchantEvents.reduce(
    (sum, event) => sum + event.priceCents * event.confirmed,
    0,
  );

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <nav className="sticky top-0 z-30 border-b-2 border-[color:var(--line)] bg-[color:var(--cream)]">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6">
          <span className="font-mono shrink-0 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Portal ✷
          </span>
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={`/merchant?tab=${t.key}`}
                className={`shrink-0 rounded-full border-2 border-[color:var(--line)] px-4 py-1.5 text-xs font-bold uppercase tracking-wide hard-shadow-sm ${
                  active
                    ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                    : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {tab === "dashboard" ? (
        <DashboardTab
          merchantEvents={merchantEvents}
          upcomingCount={upcomingEvents.length}
          monthParam={params.month}
          merchantApproved={merchantApproved}
          verificationStatus={status.merchantProfile.verification_status}
          businessName={status.merchantProfile.business_name}
          payoutsEnabled={status.merchantProfile.payouts_enabled}
        />
      ) : null}
      {tab === "events" ? <EventsTab events={merchantEvents} /> : null}
      {tab === "venues" ? <VenuesTab merchantEvents={merchantEvents} /> : null}
      {tab === "attendees" ? <AttendeesTabAsync session={session} /> : null}
      {tab === "bookings" ? <BookingsTabAsync session={session} /> : null}
      {tab === "finances" ? <FinancesTabAsync session={session} /> : null}
      {tab === "analytics" ? (
        <AnalyticsTab
          totalConfirmed={totalConfirmed}
          totalCapacity={totalCapacity}
          totalRevenueCents={totalRevenueCents}
          merchantEvents={merchantEvents}
        />
      ) : null}
      {tab === "discounts" ? <DiscountsTab /> : null}
      {tab === "support" ? <SupportTab /> : null}
      {tab === "settings" ? (
        <SettingsTab
          businessName={status.merchantProfile.business_name}
          verification={status.merchantProfile.verification_status}
        />
      ) : null}
    </main>
  );
}

function DashboardTab({
  merchantEvents,
  upcomingCount,
  monthParam,
  merchantApproved,
  verificationStatus,
  businessName,
  payoutsEnabled,
}: {
  merchantEvents: Awaited<ReturnType<typeof getMerchantEvents>>;
  upcomingCount: number;
  monthParam?: string;
  merchantApproved: boolean;
  verificationStatus: string;
  businessName: string;
  payoutsEnabled: boolean;
}) {
  // First-run welcome: shown only while the merchant has zero events. It
  // disappears on its own once the first event is created, so there's no
  // dismiss-state to persist.
  const showWelcome = merchantApproved && merchantEvents.length === 0;
  return (
    <>
      {merchantApproved && !payoutsEnabled ? <PayoutSetupBanner /> : null}
      {showWelcome ? <WelcomeToClick businessName={businessName} /> : null}

      <section className="bg-[color:var(--champagne)] py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Calendar"
            title={
              upcomingCount > 0
                ? `${upcomingCount} upcoming event${upcomingCount === 1 ? "" : "s"}.`
                : "Your hosting calendar."
            }
            body="Each day shows your events and how many people have booked. Click any chip to see attendees."
          />

          <div className="mt-8">
            <MerchantCalendar events={merchantEvents} monthParam={monthParam} />
          </div>
        </div>
      </section>

      <section className="bg-[color:var(--peach)] py-12">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.74fr_1.26fr]">
          <div>
            <SectionIntro
              eyebrow="Create event"
              title={
                merchantApproved
                  ? "Add another event."
                  : "Approval required before publishing."
              }
              body={
                merchantApproved
                  ? "Set the venue, date, seats, and price. Submissions go to admin for review."
                  : "An admin needs to approve your merchant profile before you can create Click-managed events."
              }
            />
            {merchantApproved ? (
              <Link
                href="/merchant/events/create"
                className="mt-6 inline-flex rounded-full border-2 border-[color:var(--surface-deep)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
              >
                Use 5-step wizard →
              </Link>
            ) : null}
          </div>

          {merchantApproved ? (
            <CreateEventForm />
          ) : (
            <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm">
              <p className="font-display text-3xl font-light leading-tight">
                Current status: {verificationStatus}
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                Your ABN, website, and contact details are visible to admins in
                the merchant approval queue. Once approved, this form unlocks.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

// Persistent nudge shown on the dashboard until the merchant finishes Stripe
// payout onboarding. Until payouts are enabled they can still create free
// events, but paid events can't pay out — so we keep the path one click away.
function PayoutSetupBanner() {
  return (
    <section className="border-b-2 border-[color:var(--line)] bg-[color:var(--rose)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p className="text-sm font-bold text-[color:var(--surface-deep)]">
          ✷ Connect your bank to take payments — finish payout setup to publish paid events.
        </p>
        <Link
          href="/merchant/onboarding/payouts"
          className="inline-flex shrink-0 rounded-full border-2 border-[color:var(--surface-deep)] bg-[color:var(--champagne)] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--cream)]"
        >
          Finish payout setup →
        </Link>
      </div>
    </section>
  );
}

function WelcomeToClick({ businessName }: { businessName: string }) {
  const steps = [
    {
      n: "01",
      title: "Create your first event.",
      body: "Pick a date, capacity, and price. Use the 5-step wizard or the quick form below — submissions go live the moment they pass admin review.",
    },
    {
      n: "02",
      title: "Share the link.",
      body: "Every event gets a public page on Discover. Post it to your socials or DM regulars; RSVPs flow straight into Bookings.",
    },
    {
      n: "03",
      title: "Run the door.",
      body: "Open Attendees on the day to check people in, message no-shows, or export a CSV. Payouts land in Finances after the event wraps.",
    },
  ];

  return (
    <section className="border-b-2 border-[color:var(--line)] bg-[color:var(--peach-soft)] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              ✷ Welcome to Click
            </span>
            <h2 className="font-display mt-3 text-4xl font-light leading-[1.04] text-[color:var(--ink)] sm:text-5xl">
              You&apos;re in, {businessName}.
            </h2>
            <p className="mt-4 max-w-prose text-sm font-medium leading-6 text-[color:var(--mauve)]">
              Your merchant profile is approved. This portal is where you spin
              up events, watch RSVPs roll in, and get paid. Here&apos;s the
              three-step lap so you know the room.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Pill tone="rose">Approved host</Pill>
              <Pill tone="peach">No events yet</Pill>
              <Pill>Free + paid supported</Pill>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/merchant/events/create"
                className="inline-flex rounded-full border-2 border-[color:var(--surface-deep)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
              >
                Create your first event →
              </Link>
              <Link
                href="/merchant?tab=support"
                className="inline-flex rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
              >
                Read the FAQ
              </Link>
            </div>
          </div>

          <ol className="grid gap-3 sm:grid-cols-1">
            {steps.map((step) => (
              <li
                key={step.n}
                className="flex gap-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm"
              >
                <span className="font-display shrink-0 text-3xl font-light leading-none text-[color:var(--rose)]">
                  {step.n}
                </span>
                <div className="min-w-0">
                  <p className="font-display text-xl font-light leading-tight text-[color:var(--ink)]">
                    {step.title}
                  </p>
                  <p className="mt-1.5 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function EventsTab({
  events,
}: {
  events: Awaited<ReturnType<typeof getMerchantEvents>>;
}) {
  return (
    <section className="bg-[color:var(--champagne)] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionIntro
          eyebrow="My events"
          title="All hosting commitments."
          body="Filter by status and click any row to open attendees, edit, or cancel."
        />
        <div className="mt-8">
          <MerchantEventsPanel events={events} />
        </div>
      </div>
    </section>
  );
}

function VenuesTab({
  merchantEvents,
}: {
  merchantEvents: Awaited<ReturnType<typeof getMerchantEvents>>;
}) {
  const venues = Array.from(
    new Map(
      merchantEvents.map((e) => [
        `${e.locationName}|${e.suburb}`,
        { locationName: e.locationName, suburb: e.suburb, count: 0 },
      ]),
    ).values(),
  );
  for (const e of merchantEvents) {
    const v = venues.find((v) => v.locationName === e.locationName && v.suburb === e.suburb);
    if (v) v.count++;
  }

  return (
    <section className="bg-[color:var(--champagne)] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionIntro
          eyebrow="Venues"
          title="Where you host."
          body="Distinct venues across all your events. A full venues table with capacity and floor plans lands with the venue-management migration."
        />
        {venues.length > 0 ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <article
                key={`${venue.locationName}-${venue.suburb}`}
                className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm"
              >
                <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                  Venue
                </span>
                <h3 className="font-display mt-2 text-2xl font-light leading-tight">
                  {venue.locationName}
                </h3>
                <p className="mt-2 text-sm font-semibold text-[color:var(--mauve)]">
                  {venue.suburb}
                </p>
                <Pill tone="peach">
                  {venue.count} event{venue.count === 1 ? "" : "s"}
                </Pill>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            No venues yet — create an event to add one.
          </p>
        )}
      </div>
    </section>
  );
}

async function AttendeesTabAsync({
  session,
}: {
  session: Session | null;
}) {
  const attendees = await getMerchantAllAttendees(session);
  return (
    <section className="bg-[color:var(--champagne)] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionIntro
          eyebrow="Attendees"
          title="People booked across your events."
          body="Toggle check-in on the day. Export to CSV for door lists."
        />
        <div className="mt-8">
          <MerchantAttendeesPanel rows={attendees} />
        </div>
      </div>
    </section>
  );
}

async function BookingsTabAsync({
  session,
}: {
  session: Session | null;
}) {
  const attendees = await getMerchantAllAttendees(session);
  const grouped = new Map<string, typeof attendees>();
  for (const a of attendees) {
    const list = grouped.get(a.eventSlug) ?? [];
    list.push(a);
    grouped.set(a.eventSlug, list);
  }

  return (
    <section className="bg-[color:var(--champagne)] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionIntro
          eyebrow="Bookings"
          title="By event."
          body="Bookings grouped by event, with status counts."
        />
        {grouped.size === 0 ? (
          <p className="mt-8 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            No bookings yet.
          </p>
        ) : (
          <ul className="mt-8 space-y-4">
            {Array.from(grouped.entries()).map(([slug, list]) => {
              const confirmed = list.filter((a) => a.status === "confirmed").length;
              const waitlisted = list.filter((a) => a.status === "waitlisted").length;
              const cancelled = list.filter((a) => a.status === "cancelled").length;
              return (
                <li
                  key={slug}
                  className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                        Event
                      </span>
                      <Link
                        href={`/merchant/events/${slug}`}
                        className="font-display block text-2xl font-light leading-tight hover:text-[color:var(--rose)]"
                      >
                        {list[0].eventTitle}
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Pill tone="peach">{confirmed} confirmed</Pill>
                      <Pill tone="rose">{waitlisted} waitlist</Pill>
                      <Pill tone="cream">{cancelled} cancelled</Pill>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// Payout-status row at the top of the Finances tab. Drives a five-state badge
// from the cached Connect capability columns and surfaces the right CTA for
// each state — same source of truth as the /merchant?tab=dashboard banner so
// the two views never disagree.
function PayoutStatusCard({
  connect,
}: {
  connect: MerchantFinancesSummary["connect"];
}) {
  let badgeTone: "rose" | "peach" | "aqua" | "cream" = "rose";
  let badgeLabel = "Not set up";
  let body = "Connect a Stripe account to accept paid bookings and get paid out automatically.";

  if (!connect.hasAccount) {
    badgeTone = "rose";
    badgeLabel = "Not set up";
    body = "Connect a Stripe account to accept paid bookings and get paid out automatically.";
  } else if (!connect.detailsSubmitted) {
    badgeTone = "rose";
    badgeLabel = "Onboarding incomplete";
    body = "Pick up where you left off in the hosted Stripe flow to finish connecting your bank.";
  } else if (!connect.chargesEnabled) {
    badgeTone = "aqua";
    badgeLabel = "Verification pending";
    body = "Stripe is reviewing your details. Once approved, paid events will accept bookings.";
  } else if (!connect.payoutsEnabled) {
    badgeTone = "peach";
    badgeLabel = "Charging only";
    body = "You can charge for events, but payouts to your bank aren't enabled yet — finish payout setup in Stripe.";
  } else {
    badgeTone = "peach";
    badgeLabel = "Active";
    body = "Payments route to your connected account and pay out on the monthly schedule.";
  }

  // Action varies by state: not-yet-charging merchants go back to the
  // onboarding wizard; live merchants get a Stripe-dashboard deep link.
  const ready = connect.hasAccount && connect.chargesEnabled;

  return (
    <div className="mt-8 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] hard-shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              Payouts
            </span>
            <Pill tone={badgeTone}>{badgeLabel}</Pill>
          </div>
          <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            {body}
          </p>
        </div>
        <div className="shrink-0">
          {ready ? (
            <StripeDashboardButton />
          ) : (
            <Link
              href="/merchant/onboarding/payouts"
              className="inline-flex items-center justify-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
            >
              {connect.hasAccount ? "Continue setup →" : "Connect Stripe →"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// Recent Stripe payouts from the connected account. Populated by the
// `payout.*` webhook in stripe-sync.ts; older history lives in the Express
// dashboard, one click away via <StripeDashboardButton />.
function RecentPayoutsCard({
  payouts,
}: {
  payouts: MerchantFinancesSummary["recentPayouts"];
}) {
  return (
    <div className="mt-6 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] hard-shadow-sm">
      <div className="border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-3">
        <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          Recent payouts
        </span>
      </div>
      {payouts.length === 0 ? (
        <p className="p-6 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          No payouts yet — Stripe pays out monthly once you have a connected
          balance. Past payouts will show up here.
        </p>
      ) : (
        <ul className="divide-y-2 divide-[color:var(--line-soft)]">
          {payouts.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0">
                <p className="font-bold text-[color:var(--ink)]">
                  {p.arrivalDate
                    ? dateTimeFormatter.format(new Date(p.arrivalDate))
                    : "Pending arrival"}
                </p>
                {p.bankLast4 ? (
                  <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                    Bank ····{p.bankLast4}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <Pill tone={p.status === "paid" ? "peach" : "rose"}>{p.status}</Pill>
                <span className="font-bold text-[color:var(--ink)]">
                  {formatPrice(p.amountCents)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function FinancesTabAsync({
  session,
}: {
  session: Session | null;
}) {
  const finances = await getMerchantFinancesSummary(session);

  return (
    <section className="bg-[color:var(--champagne)] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionIntro
          eyebrow="Finances"
          title="Payouts + revenue."
          body="Click-managed paid events route through Stripe. Free events don’t appear here."
        />
        <PayoutStatusCard connect={finances.connect} />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total" value={formatPrice(finances.totalRevenueCents)} tone="pink" />
          <MetricCard label="Paid" value={formatPrice(finances.paidRevenueCents)} tone="aqua" />
          <MetricCard label="Pending" value={formatPrice(finances.pendingRevenueCents)} tone="white" />
          <MetricCard label="Refunded" value={formatPrice(finances.refundedRevenueCents)} tone="white" />
        </div>
        <RecentPayoutsCard payouts={finances.recentPayouts} />
        <div className="mt-6 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] hard-shadow-sm">
          <div className="border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-3">
            <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              Recent transactions
            </span>
          </div>
          {finances.recentTransactions.length === 0 ? (
            <p className="p-6 text-sm font-medium leading-6 text-[color:var(--mauve)]">
              No transactions yet.
            </p>
          ) : (
            <ul className="divide-y-2 divide-[color:var(--line-soft)]">
              {finances.recentTransactions.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-[color:var(--ink)] truncate">
                      {t.eventTitle}
                    </p>
                    <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                      {dateTimeFormatter.format(new Date(t.createdAt))}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Pill tone={t.status === "paid" ? "peach" : "rose"}>{t.status}</Pill>
                    <span className="font-bold text-[color:var(--ink)]">
                      {formatPrice(t.amountCents)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function AnalyticsTab({
  totalConfirmed,
  totalCapacity,
  totalRevenueCents,
  merchantEvents,
}: {
  totalConfirmed: number;
  totalCapacity: number;
  totalRevenueCents: number;
  merchantEvents: Awaited<ReturnType<typeof getMerchantEvents>>;
}) {
  const max = Math.max(...merchantEvents.map((e) => e.confirmed), 1);
  return (
    <section className="bg-[color:var(--champagne)] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionIntro
          eyebrow="Analytics"
          title="Performance at a glance."
          body="Confirmed RSVPs per event, fill rate trend, revenue summary."
        />
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <MetricCard label="Confirmed RSVPs" value={totalConfirmed.toString()} tone="pink" />
          <MetricCard
            label="Fill rate"
            value={`${totalCapacity > 0 ? Math.round((totalConfirmed / totalCapacity) * 100) : 0}%`}
            tone="aqua"
          />
          <MetricCard label="Revenue" value={formatPrice(totalRevenueCents)} tone="white" />
        </div>

        <div className="mt-8 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
          <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
            Confirmed RSVPs per event
          </span>
          {merchantEvents.length === 0 ? (
            <p className="mt-4 text-sm font-medium leading-6 text-[color:var(--mauve)]">
              No events yet.
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {merchantEvents.slice(0, 10).map((e) => {
                const pct = Math.round((e.confirmed / max) * 100);
                return (
                  <li key={e.slug}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-bold text-[color:var(--ink)] truncate">
                        {e.status === "Pending" ? "· " : ""}
                        {e.suburb} · {e.category}
                      </span>
                      <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                        {e.confirmed}/{e.capacity}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-[color:var(--peach-soft)]">
                      <div
                        className="h-2 rounded-full bg-[color:var(--rose)]"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function DiscountsTab() {
  return (
    <section className="bg-[color:var(--champagne)] py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionIntro
          eyebrow="Discounts"
          title="Promo codes & comp tickets."
          body="Issue percent-off, fixed-amount, or comp codes per event. The discount-codes migration lands next."
        />
        <div className="mt-8 rounded-3xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6">
          <p className="text-sm font-medium leading-6 text-[color:var(--mauve)]">
            Discount code generator coming with the next migration. For now, share
            a unique paid-event link directly with comp guests and you can issue a
            full refund from Finances.
          </p>
        </div>
      </div>
    </section>
  );
}

function SupportTab() {
  const faqs = [
    {
      q: "How long does merchant verification take?",
      a: "Most ABN-verified merchants are approved within 24 business hours. We may ask for a venue photo or insurance certificate for risky categories.",
    },
    {
      q: "Can I run free + paid events under the same profile?",
      a: "Yes. Free events skip Stripe entirely. Paid events route via Stripe Connect — set up under Settings.",
    },
    {
      q: "What happens if I cancel an event?",
      a: "All confirmed attendees are refunded automatically (paid events) and notified. Cancellations show on your profile to deter spam.",
    },
  ];
  return (
    <section className="bg-[color:var(--champagne)] py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionIntro
          eyebrow="Support"
          title="Common merchant questions."
          body="If you need a human, email support@click.local — we reply same business day."
        />
        <ul className="mt-8 space-y-4">
          {faqs.map((f) => (
            <li
              key={f.q}
              className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm"
            >
              <p className="font-display text-xl font-light leading-tight">
                {f.q}
              </p>
              <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                {f.a}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SettingsTab({
  businessName,
  verification,
}: {
  businessName: string;
  verification: string;
}) {
  return (
    <section className="bg-[color:var(--champagne)] py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionIntro
          eyebrow="Settings"
          title="Profile + payouts."
          body="Update business details, payout account, and notification preferences."
        />
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Field label="Business name" value={businessName} />
          <Field label="Verification" value={verification} />
        </div>
        <div className="mt-6 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-5 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Editing business name / website / ABN ships with the
          merchant-self-service migration. Today, email{" "}
          <span className="font-mono">support@click.local</span> to update details.
        </div>
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4 hard-shadow-sm">
      <dt className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-bold text-[color:var(--ink)] break-all">
        {value}
      </dd>
    </div>
  );
}
