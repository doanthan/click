import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminTrendChart } from "@/components/admin-trend-chart";
import { InfoCard, MetricCard } from "@/components/click-ui";
import { adminModules } from "@/lib/click-data";
import {
  countAdminMoneyAlerts,
  getAdminClickOutcomes,
  getAdminMetrics,
  getAdminWeeklyTrend,
} from "@/lib/event-repository";
import { requireAdminPage } from "@/lib/admin-guard";

export const metadata = {
  title: "Dashboard | Admin",
};

export default async function AdminOverviewPage() {
  await requireAdminPage();

  // getAdminMetrics computes every live metric from its own COUNT queries; the
  // `events` argument only feeds the DB-down fallback's event/pending counts,
  // and getAdminEvents()'s own fallback already returns [] (so events.length /
  // pendingCount are 0 in that path regardless). Passing [] here is therefore
  // behaviourally identical and lets all three fan out concurrently instead of
  // awaiting metrics serially after the events query.
  const [trend, metrics, money, clicks] = await Promise.all([
    getAdminWeeklyTrend(),
    getAdminMetrics([]),
    countAdminMoneyAlerts(),
    getAdminClickOutcomes(),
  ]);

  // Bug board #277: where live mutual clicks stall before a first night out.
  const stalls = [
    { label: "No plan suggested yet", value: clicks.noPlanYet },
    { label: "Plan suggested, waiting on a reply", value: clicks.awaitingReply },
    { label: "Plan agreed, not both booked", value: clicks.agreedNotBooked },
    { label: "Plan fell through (declined, unanswered or the event filled)", value: clicks.planFellThrough },
  ];

  return (
    <div className="space-y-12 py-10">
      <AdminPageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Platform health at a glance - members, events, merchants, and revenue."
      />

      {/* When Postgres is unreachable these reads fall back to zeroes, and the
          money banner below vanishes with them - an outage that looks like a
          quiet day. Say so instead. */}
      {metrics.unavailable || money.unavailable ? (
        <div
          role="alert"
          className="rounded-2xl border border-[color:var(--mist)] bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span
              aria-hidden
              className="inline-block size-2 shrink-0 rounded-full bg-[color:var(--coral)]"
            />
            <p className="eyebrow">Live data unavailable</p>
          </div>
          <h2 className="font-display mt-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
            Couldn&apos;t load live numbers
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--slate)]">
            The database didn&apos;t answer, so the numbers on this page may be wrong and failed
            refunds or open disputes may be missing. Reload in a minute.
          </p>
        </div>
      ) : null}

      {/* Only rendered when there is something to act on, so a clear platform
          shows a clean dashboard rather than a permanent zero. The two things
          it counts - refunds that never reached Stripe, and disputes with a
          deadline running - are the only admin work where waiting costs money. */}
      {money.total > 0 ? (
        <Link
          href="/admin/transactions"
          className="block rounded-2xl border border-[color:var(--mist)] bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)] transition-colors hover:border-[color:var(--purple)]"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span
              aria-hidden
              className="inline-block size-2 shrink-0 rounded-full bg-[color:var(--coral)]"
            />
            <p className="eyebrow">Needs attention</p>
          </div>
          <h2 className="font-display mt-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
            {[
              money.refundFailures > 0
                ? `${money.refundFailures} failed ${money.refundFailures === 1 ? "refund" : "refunds"}`
                : null,
              money.openDisputes > 0
                ? `${money.openDisputes} open ${money.openDisputes === 1 ? "dispute" : "disputes"}`
                : null,
            ]
              .filter(Boolean)
              .join(" and ")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--slate)]">
            {money.refundFailures > 0 && money.openDisputes > 0
              ? "Someone is out of pocket, and Stripe has a clock running. Open Transactions."
              : money.refundFailures > 0
                ? "Someone was told their refund was coming and it never left. Open Transactions."
                : "Stripe decides for the cardholder if the evidence deadline passes. Open Transactions."}
          </p>
        </Link>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* "Onboarded" because this counts profiles that finished onboarding
            (suburb set) - the Attendees page lists every profile, so its All
            count can be higher. */}
        <MetricCard label="Onboarded members" value={metrics.totalMembers.toLocaleString()} tone="cream" href="/admin/members" />
        <MetricCard label="New this week" value={metrics.newMembersThisWeek.toLocaleString()} tone="peach" href="/admin/members" />
        <MetricCard label="Pending events" value={metrics.pendingEvents.toLocaleString()} tone="rose" href="/admin/events" />
        <MetricCard label="Pending merchants" value={metrics.pendingMerchants.toLocaleString()} tone="ink" href="/admin/merchants?status=pending" />
        <MetricCard label="Total events" value={metrics.totalEvents.toLocaleString()} tone="peach" href="/admin/events?status=all&when=all" />
        {/* Bug board #309: "confirmed, but what if they cancelled?" Every path
            that ends a booking (the member cancelling, the host or Click
            cancelling the event, an admin's full refund) moves its row to
            'cancelled', so the count already leaves it out - the card now says so. */}
        <MetricCard
          label="Confirmed RSVPs"
          value={metrics.confirmedRsvps.toLocaleString()}
          tone="cream"
          hint="All-time bookings, minus any that were cancelled. Doesn't include +1s."
        />
        <MetricCard label="Merchants" value={metrics.totalMerchants.toLocaleString()} tone="rose" href="/admin/merchants" />
        <MetricCard label="Mutual Clicks" value={metrics.mutualClicks.toLocaleString()} tone="ink" />
      </div>

      {/* Bug board #276/#277 - did the click turn into a night out, and where do
          the rest stall. Definitions live on getAdminClickOutcomes. */}
      <section aria-labelledby="click-outcomes-heading">
        <p className="eyebrow">Clicks to nights out</p>
        <h2
          id="click-outcomes-heading"
          className="font-display mt-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]"
        >
          Did the mutual click make it out?
        </h2>
        <p className="mt-2 max-w-[720px] text-sm leading-6 text-[color:var(--slate)]">
          A pair has gone out together once both held a seat at the same event after their
          mutual click, and that event has happened. Pairs count once, however many times they
          clicked. Door check-in is optional for hosts, so it is shown as a subset, not the test.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <MetricCard label="Went to an event together" value={clicks.wentTogether.toLocaleString()} tone="rose" />
          <MetricCard label="Both checked in at the door" value={clicks.checkedInTogether.toLocaleString()} tone="cream" />
          <MetricCard label="Booked together, first night coming up" value={clicks.bookedTogether.toLocaleString()} tone="peach" />
        </div>

        <div className="mt-4 rounded-2xl bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
          <h3 className="font-display text-lg font-semibold text-[color:var(--ink)]">
            Still working it out
          </h3>
          <p className="mt-1 text-sm leading-6 text-[color:var(--slate)]">
            Live mutual clicks with no night out together yet, by where their plan is.
          </p>
          <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {stalls.map((stall) => (
              <div
                key={stall.label}
                className="flex items-baseline justify-between gap-4 border-b border-[color:var(--line)] pb-2"
              >
                <dt className="text-sm text-[color:var(--ink)]">{stall.label}</dt>
                <dd className="font-display text-xl font-semibold tabular-nums text-[color:var(--ink)]">
                  {stall.value.toLocaleString()}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-[color:var(--slate)]">
            {clicks.endedWithoutNightOut.toLocaleString()} mutual{" "}
            {clicks.endedWithoutNightOut === 1 ? "click has" : "clicks have"} run their course
            without a night out together.
          </p>
        </div>
      </section>

      <div>
        <AdminTrendChart buckets={trend} />
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {adminModules.map(([title, body], index) => (
          <InfoCard
            key={title}
            title={title}
            body={body}
            accent={index === 4 ? "rose" : index === 5 ? "ink" : "peach"}
          />
        ))}
      </div>
    </div>
  );
}
