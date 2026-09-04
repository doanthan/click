import { formatMoney } from "@/lib/amounts";
import type { AdminTrendBucket } from "@/lib/event-repository";

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
});

type Metric = {
  key: "members" | "events" | "rsvps" | "revenueCents";
  label: string;
  format: (n: number) => string;
  bar: string;
};

const metrics: Metric[] = [
  { key: "members", label: "New members", format: (n) => n.toLocaleString(), bar: "border border-[color:var(--line-strong)] bg-[color:var(--lavender-300)]" },
  { key: "events", label: "New events", format: (n) => n.toLocaleString(), bar: "bg-[color:var(--purple-600)]" },
  { key: "rsvps", label: "RSVPs", format: (n) => n.toLocaleString(), bar: "bg-[color:var(--purple-400)]" },
  { key: "revenueCents", label: "Paid revenue", format: (n) => formatMoney(n), bar: "border border-[color:var(--line-strong)] bg-[color:var(--lavender-400)]" },
];

export function AdminTrendChart({ buckets }: { buckets: AdminTrendBucket[] }) {
  if (buckets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--paper)] p-6 text-sm leading-6 text-[color:var(--slate)]">
        No trend data yet. Buckets populate as activity accrues.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {metrics.map((m) => {
        const values = buckets.map((b) => b[m.key]);
        const max = Math.max(...values, 1);
        const total = values.reduce((a, b) => a + b, 0);
        return (
          <div
            key={m.key}
            className="rounded-2xl bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="eyebrow">{m.label}</span>
              <span className="font-display text-2xl font-semibold leading-none tabular-nums text-[color:var(--ink)]">
                {m.format(total)}
              </span>
            </div>
            <div className="mt-4 flex h-24 items-end gap-1.5">
              {buckets.map((b) => {
                const v = b[m.key];
                const pct = Math.max(Math.round((v / max) * 100), v > 0 ? 6 : 2);
                const isEmpty = v === 0;
                return (
                  // Full-height, bottom-aligned column so the bar's percentage
                  // height resolves against a definite parent height (otherwise
                  // the bars collapse to zero and the chart looks empty).
                  // `tabIndex` lets keyboard users reveal the CSS-only popover
                  // via :focus-within - no JS, so the component stays an RSC.
                  <div
                    key={`${m.key}-${b.week}`}
                    className="group relative flex h-full flex-1 items-end focus:outline-none"
                    tabIndex={0}
                    role="img"
                    aria-label={`${m.label}, week of ${dateFormatter.format(new Date(b.week))}: ${m.format(v)}`}
                  >
                    {/* CSS-only brand popover: hidden by default, revealed on
                        hover/focus of this `group` wrapper. Positioned above the
                        bar, centered, never intercepts pointer events. */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[color:var(--paper)] px-2 py-1 text-center opacity-0 shadow-[var(--shadow-md)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                      <span className="block text-[11px] font-semibold text-[color:var(--slate)]">
                        {dateFormatter.format(new Date(b.week))}
                      </span>
                      <span className="block text-[13px] font-semibold tabular-nums text-[color:var(--ink)]">
                        {m.format(v)}
                      </span>
                    </div>
                    <div
                      className={
                        isEmpty
                          ? "w-full rounded-t-md border border-dashed border-[color:var(--line)] bg-transparent"
                          : `w-full rounded-t-md ${m.bar}`
                      }
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[11px] font-semibold text-[color:var(--slate)]">
              <span>{dateFormatter.format(new Date(buckets[0].week))}</span>
              <span>now</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
