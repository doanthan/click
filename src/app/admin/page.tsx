import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminTrendChart } from "@/components/admin-trend-chart";
import { InfoCard, MetricCard } from "@/components/click-ui";
import { adminModules } from "@/lib/click-data";
import {
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
  const [trend, metrics] = await Promise.all([
    getAdminWeeklyTrend(),
    getAdminMetrics([]),
  ]);

  return (
    <div className="space-y-12 py-10">
      <AdminPageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Platform health at a glance - members, events, merchants, and revenue."
      />
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
