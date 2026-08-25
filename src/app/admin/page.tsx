import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminTrendChart } from "@/components/admin-trend-chart";
import { InfoCard, MetricCard } from "@/components/click-ui";
import { adminModules } from "@/lib/click-data";
import {
  countAdminMoneyAlerts,
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
  const [trend, metrics, money] = await Promise.all([
    getAdminWeeklyTrend(),
    getAdminMetrics([]),
    countAdminMoneyAlerts(),
  ]);

  return (
    <div className="space-y-12 py-10">
      <AdminPageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Platform health at a glance - members, events, merchants, and revenue."
      />

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
        <MetricCard label="Confirmed RSVPs" value={metrics.confirmedRsvps.toLocaleString()} tone="cream" />
        <MetricCard label="Merchants" value={metrics.totalMerchants.toLocaleString()} tone="rose" href="/admin/merchants" />
        <MetricCard label="Mutual Clicks" value={metrics.mutualClicks.toLocaleString()} tone="ink" />
      </div>

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
