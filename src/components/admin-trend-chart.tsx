import type { AdminTrendBucket } from "@/lib/event-repository";

const priceFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

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
  { key: "members", label: "New members", format: (n) => n.toLocaleString(), bar: "bg-[color:var(--peach)]" },
  { key: "events", label: "New events", format: (n) => n.toLocaleString(), bar: "bg-[color:var(--rose)]" },
  { key: "rsvps", label: "RSVPs", format: (n) => n.toLocaleString(), bar: "bg-[color:var(--ink)]" },
  { key: "revenueCents", label: "Paid revenue", format: (n) => priceFormatter.format(n / 100), bar: "bg-[color:var(--punch)]" },
];

export function AdminTrendChart({ buckets }: { buckets: AdminTrendBucket[] }) {
  if (buckets.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6 text-sm font-medium leading-6 text-[color:var(--mauve)]">
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
            className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                {m.label}
              </span>
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
                  // via :focus-within — no JS, so the component stays an RSC.
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
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[color:var(--line)] bg-[color:var(--cream)] px-2 py-1 text-center opacity-0 transition-opacity duration-150 hard-shadow-sm group-hover:opacity-100 group-focus-within:opacity-100">
                      <span className="block font-condensed text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[color:var(--mauve)]">
                        {dateFormatter.format(new Date(b.week))}
                      </span>
                      <span className="block font-condensed text-[0.8rem] font-bold tabular-nums text-[color:var(--ink)]">
                        {m.format(v)}
                      </span>
                    </div>
                    <div
                      className={
                        isEmpty
                          ? "w-full rounded-t-md border border-dashed border-[color:var(--line)] bg-transparent"
                          : `w-full rounded-t-md border border-[color:var(--line)] ${m.bar}`
                      }
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
              <span>{dateFormatter.format(new Date(buckets[0].week))}</span>
              <span>now</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
