import { MetricCard, SectionIntro } from "@/components/click-ui";
import type { AdminAnalytics, AdminAnalyticsPoint } from "@/lib/event-repository";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatBucketLabel(bucket: string) {
  const date = new Date(`${bucket}T00:00:00Z`);
  return date.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

function LineChart({
  title,
  series,
  accessor,
  color,
  formatValue = (n: number) => n.toLocaleString(),
}: {
  title: string;
  series: AdminAnalyticsPoint[];
  accessor: (point: AdminAnalyticsPoint) => number;
  color: string;
  formatValue?: (n: number) => string;
}) {
  if (series.length === 0) {
    return (
      <article className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6 text-sm font-semibold text-[color:var(--mauve)]">
        {title} — no data yet.
      </article>
    );
  }

  const width = 480;
  const height = 160;
  const padding = 12;
  const values = series.map(accessor);
  const max = Math.max(1, ...values);
  const stepX = (width - padding * 2) / Math.max(1, series.length - 1);

  const points = series
    .map((point, idx) => {
      const value = accessor(point);
      const x = padding + idx * stepX;
      const y = padding + (height - padding * 2) * (1 - value / max);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const last = series[series.length - 1];
  const total = values.reduce((sum, value) => sum + value, 0);

  return (
    <article className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            {title}
          </p>
          <p className="font-display mt-1 text-3xl font-light leading-none">
            {formatValue(total)}
          </p>
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          last 30 days
        </p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-4 h-32 w-full"
        role="img"
        aria-label={`${title} trend over 30 days`}
      >
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {series.map((point, idx) => {
          const value = accessor(point);
          const x = padding + idx * stepX;
          const y = padding + (height - padding * 2) * (1 - value / max);
          return (
            <circle
              key={point.bucket}
              cx={x}
              cy={y}
              r={value === max && value > 0 ? 3.5 : 1.5}
              fill={color}
            />
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-[0.65rem] font-mono uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        <span>{formatBucketLabel(series[0].bucket)}</span>
        <span>
          {formatBucketLabel(last.bucket)} · {formatValue(accessor(last))}
        </span>
      </div>
    </article>
  );
}

export function AdminAnalyticsPanel({ analytics }: { analytics: AdminAnalytics }) {
  const { series, totals, topCategories } = analytics;
  const maxCategoryCount = topCategories.reduce(
    (max, entry) => Math.max(max, entry.count),
    1,
  );

  return (
    <div className="space-y-10 py-10">
      <SectionIntro
        eyebrow="Platform analytics"
        title="Growth, engagement, and revenue at a glance."
        body="A live 30-day window from the database. Real revenue from paid Stripe transactions, real RSVPs from event_attendees."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="New members" value={totals.newMembers.toLocaleString()} tone="peach" />
        <MetricCard label="RSVPs" value={totals.rsvps.toLocaleString()} tone="rose" />
        <MetricCard label="Events created" value={totals.events.toLocaleString()} tone="cream" />
        <MetricCard label="Revenue" value={formatCurrency(totals.revenueCents)} tone="ink" />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <LineChart
          title="New members"
          series={series}
          accessor={(point) => point.members}
          color="var(--rose)"
        />
        <LineChart
          title="RSVPs"
          series={series}
          accessor={(point) => point.rsvps}
          color="var(--peach)"
        />
        <LineChart
          title="Events created"
          series={series}
          accessor={(point) => point.events}
          color="var(--ink)"
        />
        <LineChart
          title="Revenue"
          series={series}
          accessor={(point) => point.revenueCents}
          color="var(--mauve)"
          formatValue={formatCurrency}
        />
      </div>

      <article className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          Top categories
        </p>
        {topCategories.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-[color:var(--mauve)]">
            No event data yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {topCategories.map((entry) => {
              const widthPct = Math.round((entry.count / maxCategoryCount) * 100);
              return (
                <li key={entry.category} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3">
                  <span className="text-sm font-bold text-[color:var(--ink)]">
                    {entry.category}
                  </span>
                  <span className="block h-3 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)]">
                    <span
                      className="block h-full rounded-full bg-[color:var(--rose)]"
                      style={{ width: `${widthPct}%` }}
                    />
                  </span>
                  <span className="text-right font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                    {entry.count}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </div>
  );
}
