import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminTrendChart } from "@/components/admin-trend-chart";
import { InfoCard, MetricCard } from "@/components/click-ui";
import { adminModules } from "@/lib/click-data";
import {
  getAdminEvents,
  getAdminMetrics,
  getAdminWeeklyTrend,
} from "@/lib/event-repository";

export const metadata = {
  title: "Dashboard | Admin",
};

export default async function AdminOverviewPage() {
  const [events, trend] = await Promise.all([
    getAdminEvents(),
    getAdminWeeklyTrend(),
  ]);
  const metrics = await getAdminMetrics(events);

  return (
    <div className="space-y-12 py-10">
      <AdminPageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Platform health at a glance — members, events, merchants, and revenue."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Members" value={metrics.totalMembers.toLocaleString()} tone="cream" />
        <MetricCard label="New this week" value={metrics.newMembersThisWeek.toLocaleString()} tone="peach" />
        <MetricCard label="Pending events" value={metrics.pendingEvents.toLocaleString()} tone="rose" />
        <MetricCard label="Pending merchants" value={metrics.pendingMerchants.toLocaleString()} tone="ink" />
        <MetricCard label="Total events" value={metrics.totalEvents.toLocaleString()} tone="peach" />
        <MetricCard label="Confirmed RSVPs" value={metrics.confirmedRsvps.toLocaleString()} tone="cream" />
        <MetricCard label="Merchants" value={metrics.totalMerchants.toLocaleString()} tone="rose" />
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
