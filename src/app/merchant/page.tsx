import Link from "next/link";
import type { ReactNode } from "react";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MetricCard, Pill } from "@/components/click-ui";
import { MerchantCalendar } from "@/components/merchant-calendar";
import { MerchantEventsPanel } from "@/components/merchant-events-panel";
import { MerchantAttendeesPanel } from "@/components/merchant-attendees-panel";
import { MerchantSidebar, type MerchantTabKey } from "@/components/merchant-sidebar";
import { StripeDashboardButton } from "@/components/stripe-dashboard-button";
import {
  getMerchantAllAttendees,
  getMerchantEvents,
  getMerchantFinancesSummary,
  getProfileStatus,
  type MerchantFinancesSummary,
} from "@/lib/event-repository";
import { reconcilePendingTransactionsForMerchant } from "@/lib/stripe-sync";

export const metadata = {
  title: "Merchant Portal | Click",
  description: "Click merchant portal for event hosts, booking models, payments, and analytics.",
};

// Consolidated from ten tabs down to five. Venues now live under Events,
// Attendees + Bookings merged into Bookings, Analytics folded into Dashboard,
// and Discounts + Support merged into Settings. Keys are validated against this
// list when reading `?tab=`.
const TAB_KEYS: MerchantTabKey[] = [
  "dashboard",
  "events",
  "bookings",
  "finances",
  "settings",
];

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
  const tab: MerchantTabKey = TAB_KEYS.includes(params.tab as MerchantTabKey)
    ? (params.tab as MerchantTabKey)
    : "dashboard";

  const merchantEvents = await getMerchantEvents(session);
  // Past this point the merchant is always approved (the redirect above guards
  // it), so there's no "pending host" branch to render anymore.
  const businessName = status.merchantProfile.business_name;
  const payoutsEnabled = status.merchantProfile.payouts_enabled;

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-8 text-[color:var(--ink)] sm:px-6 lg:py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <MerchantSidebar
          activeTab={tab}
          businessName={businessName}
          counts={{ events: merchantEvents.length }}
        />
        <div className="min-w-0 flex-1">
          {tab === "dashboard" ? (
            <DashboardTab
              merchantEvents={merchantEvents}
              monthParam={params.month}
              businessName={businessName}
              payoutsEnabled={payoutsEnabled}
            />
          ) : null}
          {tab === "events" ? <EventsTab events={merchantEvents} /> : null}
          {tab === "bookings" ? <BookingsTabAsync session={session} /> : null}
          {tab === "finances" ? <FinancesTabAsync session={session} /> : null}
          {tab === "settings" ? (
            <SettingsTab
              businessName={businessName}
              verification={status.merchantProfile.verification_status}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}

// Lightweight section header sized for the content column (the old SectionIntro
// rendered 6xl display titles meant for full-bleed marketing sections).
function TabHeader({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="font-display mt-2 text-3xl font-light leading-tight tracking-tight text-[color:var(--ink)] sm:text-4xl">
          {title}
        </h1>
        {body ? (
          <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            {body}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function DashboardTab({
  merchantEvents,
  monthParam,
  businessName,
  payoutsEnabled,
}: {
  merchantEvents: Awaited<ReturnType<typeof getMerchantEvents>>;
  monthParam?: string;
  businessName: string;
  payoutsEnabled: boolean;
}) {
  // eslint-disable-next-line react-hooks/purity -- async server component, evaluated once per request
  const now = Date.now();
  const upcoming = merchantEvents.filter(
    (event) => new Date(event.startsAt).getTime() >= now,
  );
  const upcomingCount = upcoming.length;

  // Analytics summary (folded in from the old Analytics tab).
  const totalConfirmed = merchantEvents.reduce((sum, e) => sum + e.confirmed, 0);
  const totalCapacity = merchantEvents.reduce((sum, e) => sum + e.capacity, 0);
  const totalRevenueCents = merchantEvents.reduce(
    (sum, e) => sum + e.priceCents * e.confirmed,
    0,
  );
  const totalWaitlisted = merchantEvents.reduce((sum, e) => sum + e.waitlisted, 0);
  const fillRate = totalCapacity > 0 ? Math.round((totalConfirmed / totalCapacity) * 100) : 0;

  // First-run welcome: shown only while the merchant has zero events. It
  // disappears on its own once the first event is created.
  const showWelcome = merchantEvents.length === 0;

  return (
    <div className="space-y-8 py-10">
      {!payoutsEnabled ? <PayoutSetupBanner /> : null}
      {showWelcome ? <WelcomeToClick businessName={businessName} /> : null}

      <TabHeader
        eyebrow="Overview"
        title={
          upcomingCount > 0
            ? `${upcomingCount} upcoming event${upcomingCount === 1 ? "" : "s"}.`
            : "Your hosting dashboard."
        }
        body="Snapshot of bookings and revenue across all your events, plus the calendar below."
        action={<CreateEventButton />}
      />

      {/* Analytics overview — booking + revenue snapshot across all events. */}
      {!showWelcome ? (
        <section>
          <p className="eyebrow">This month at a glance</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Upcoming" value={upcomingCount.toString()} tone="pink" />
            <MetricCard label="Confirmed RSVPs" value={totalConfirmed.toString()} tone="aqua" />
            <MetricCard label="Fill rate" value={`${fillRate}%`} tone="white" />
            <MetricCard label="Revenue" value={formatPrice(totalRevenueCents)} tone="white" />
          </div>
          {totalWaitlisted > 0 ? (
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
              + {totalWaitlisted} on waitlist across your events
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Your events — quick list of what's coming up, with a create CTA. This
          is the primary working surface, so it sits above the calendar. */}
      {merchantEvents.length > 0 ? (
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Your events</p>
              <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                {upcomingCount > 0
                  ? "Next events on your calendar — click any row to manage attendees."
                  : "No upcoming events. Create one to start taking bookings."}
              </p>
            </div>
            <Link
              href="/merchant?tab=events"
              className="inline-flex shrink-0 items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
            >
              View all events →
            </Link>
          </div>
          <div className="mt-6">
            {upcomingCount > 0 ? (
              <MerchantEventsPanel events={upcoming.slice(0, 5)} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6">
                <p className="text-sm font-medium leading-6 text-[color:var(--mauve)]">
                  Your past events are in the Events tab. Ready for the next one?
                </p>
                <CreateEventButton />
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section>
        <p className="eyebrow">Calendar</p>
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Each day shows your events and how many people have booked. Click any
          chip to see attendees.
        </p>
        <div className="mt-6">
          <MerchantCalendar events={merchantEvents} monthParam={monthParam} />
        </div>
      </section>

      {merchantEvents.length > 0 ? (
        <ConfirmedRsvpChart merchantEvents={merchantEvents} />
      ) : null}
    </div>
  );
}

// Primary CTA — the merchant portal's most important action, so it gets the
// rose fill treatment and is reused in the dashboard header + empty states.
function CreateEventButton() {
  return (
    <Link
      href="/merchant/events/create"
      className="inline-flex shrink-0 items-center rounded-full border-2 border-[color:var(--surface-deep)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
    >
      + Create event
    </Link>
  );
}

// Per-event RSVP bar list, folded in from the old Analytics tab.
function ConfirmedRsvpChart({
  merchantEvents,
}: {
  merchantEvents: Awaited<ReturnType<typeof getMerchantEvents>>;
}) {
  const max = Math.max(...merchantEvents.map((e) => e.confirmed), 1);
  return (
    <section className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
      <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
        Confirmed RSVPs per event
      </span>
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
    </section>
  );
}

// Persistent nudge shown on the dashboard until the merchant finishes Stripe
// payout onboarding. Until payouts are enabled they can still create free
// events, but paid events can't pay out — so we keep the path one click away.
function PayoutSetupBanner() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-3 hard-shadow-sm">
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
  );
}

function WelcomeToClick({ businessName }: { businessName: string }) {
  const steps = [
    {
      n: "01",
      title: "Create your first event.",
      body: "Pick a date, capacity, and price in the 5-step wizard — submissions go live the moment they pass admin review.",
    },
    {
      n: "02",
      title: "Share the link.",
      body: "Every event gets a public page on Discover. Post it to your socials or DM regulars; RSVPs flow straight into Bookings.",
    },
    {
      n: "03",
      title: "Run the door.",
      body: "Open Bookings on the day to check people in, message no-shows, or export a CSV. Payouts land in Finances after the event wraps.",
    },
  ];

  return (
    <section className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--peach-soft)] p-6 hard-shadow-sm sm:p-8">
      <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
        ✷ Welcome to Click
      </span>
      <h2 className="font-display mt-3 text-3xl font-light leading-[1.04] text-[color:var(--ink)] sm:text-4xl">
        You&apos;re in, {businessName}.
      </h2>
      <p className="mt-4 max-w-prose text-sm font-medium leading-6 text-[color:var(--mauve)]">
        Your merchant profile is approved. This portal is where you spin up
        events, watch RSVPs roll in, and get paid. Here&apos;s the three-step lap
        so you know the room.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Pill tone="rose">Approved host</Pill>
        <Pill tone="peach">No events yet</Pill>
        <Pill>Free + paid supported</Pill>
      </div>
      <ol className="mt-6 grid gap-3 md:grid-cols-3">
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
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/merchant/events/create"
          className="inline-flex rounded-full border-2 border-[color:var(--surface-deep)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
        >
          Create your first event →
        </Link>
        <Link
          href="/merchant?tab=settings"
          className="inline-flex rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
        >
          Read the FAQ
        </Link>
      </div>
    </section>
  );
}

function EventsTab({
  events,
}: {
  events: Awaited<ReturnType<typeof getMerchantEvents>>;
}) {
  // Distinct venues, derived from events (folded in from the old Venues tab).
  const venues = Array.from(
    new Map(
      events.map((e) => [
        `${e.locationName}|${e.suburb}`,
        { locationName: e.locationName, suburb: e.suburb, count: 0 },
      ]),
    ).values(),
  );
  for (const e of events) {
    const v = venues.find((v) => v.locationName === e.locationName && v.suburb === e.suburb);
    if (v) v.count++;
  }

  return (
    <div className="space-y-10 py-10">
      <TabHeader
        eyebrow="My events"
        title="Events & venues."
        body="Filter by status and click any row to open attendees, edit, or cancel."
        action={<CreateEventButton />}
      />

      <MerchantEventsPanel events={events} />

      <section>
        <p className="eyebrow">Venues</p>
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Distinct venues across all your events. A full venues table with
          capacity and floor plans lands with the venue-management migration.
        </p>
        {venues.length > 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          <p className="mt-6 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            No venues yet — create an event to add one.
          </p>
        )}
      </section>
    </div>
  );
}

async function BookingsTabAsync({
  session,
}: {
  session: Session | null;
}) {
  const attendees = await getMerchantAllAttendees(session);

  // Per-event summary (folded in from the old Bookings tab).
  const grouped = new Map<string, typeof attendees>();
  for (const a of attendees) {
    const list = grouped.get(a.eventSlug) ?? [];
    list.push(a);
    grouped.set(a.eventSlug, list);
  }

  return (
    <div className="space-y-10 py-10">
      <TabHeader
        eyebrow="Bookings"
        title="Everyone booked across your events."
        body="Per-event status counts up top; toggle check-in or export the full door list below."
      />

      {grouped.size > 0 ? (
        <section>
          <p className="eyebrow">By event</p>
          <ul className="mt-6 space-y-4">
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
        </section>
      ) : null}

      <section>
        <p className="eyebrow">All attendees</p>
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Toggle check-in on the day. Export to CSV for door lists.
        </p>
        <div className="mt-6">
          <MerchantAttendeesPanel rows={attendees} />
        </div>
      </section>
    </div>
  );
}

// Payout-status row at the top of the Finances tab. Drives a five-state badge
// from the cached Connect capability columns and surfaces the right CTA for
// each state — same source of truth as the dashboard banner so the two views
// never disagree.
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
    <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] hard-shadow-sm">
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
    <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] hard-shadow-sm">
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
  // Self-heal any pending rows whose Stripe session is actually paid/expired
  // before reading the summary — the webhook is the primary path, but this keeps
  // the tab correct when it's missed. Best-effort; never block the page on it.
  await reconcilePendingTransactionsForMerchant(session).catch(() => null);
  const finances = await getMerchantFinancesSummary(session);

  return (
    <div className="space-y-8 py-10">
      <TabHeader
        eyebrow="Finances"
        title="Payouts + revenue."
        body="Click-managed paid events route through Stripe. Free events don’t appear here."
      />
      <PayoutStatusCard connect={finances.connect} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total" value={formatPrice(finances.totalRevenueCents)} tone="pink" />
        <MetricCard label="Paid" value={formatPrice(finances.paidRevenueCents)} tone="aqua" />
        <MetricCard label="Pending" value={formatPrice(finances.pendingRevenueCents)} tone="white" />
        <MetricCard label="Refunded" value={formatPrice(finances.refundedRevenueCents)} tone="white" />
      </div>
      <RecentPayoutsCard payouts={finances.recentPayouts} />
      <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] hard-shadow-sm">
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
  );
}

function SettingsTab({
  businessName,
  verification,
}: {
  businessName: string;
  verification: string;
}) {
  const faqs = [
    {
      q: "How long does merchant verification take?",
      a: "Most ABN-verified merchants are approved within 24 business hours. We may ask for a venue photo or insurance certificate for risky categories.",
    },
    {
      q: "Can I run free + paid events under the same profile?",
      a: "Yes. Free events skip Stripe entirely. Paid events route via Stripe Connect — set up under Finances.",
    },
    {
      q: "What happens if I cancel an event?",
      a: "All confirmed attendees are refunded automatically (paid events) and notified. Cancellations show on your profile to deter spam.",
    },
  ];

  return (
    <div className="space-y-10 py-10">
      <TabHeader
        eyebrow="Settings"
        title="Profile, discounts & support."
        body="Update business details and payout account, issue promo codes, and find answers."
      />

      <section>
        <p className="eyebrow">Profile + payouts</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Field label="Business name" value={businessName} />
          <Field label="Verification" value={verification} />
        </div>
        <div className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-5 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Editing business name / website / ABN ships with the
          merchant-self-service migration. Today, email{" "}
          <span className="font-mono">support@click.local</span> to update details.
        </div>
      </section>

      <section>
        <p className="eyebrow">Discounts</p>
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Promo codes & comp tickets.
        </p>
        <div className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-5 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Discount code generator coming with the next migration. For now, share a
          unique paid-event link directly with comp guests and you can issue a full
          refund from Finances.
        </div>
      </section>

      <section>
        <p className="eyebrow">Support</p>
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          If you need a human, email support@click.local — we reply same business day.
        </p>
        <ul className="mt-6 space-y-4">
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
      </section>
    </div>
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
