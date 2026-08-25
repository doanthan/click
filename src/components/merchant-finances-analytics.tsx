import { formatMoney } from "@/lib/amounts";
import type { MerchantFinancesSummary } from "@/lib/event-repository";

const MONTH_SHORT = new Intl.DateTimeFormat("en-AU", {
  month: "short",
  timeZone: "Australia/Sydney",
});

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  // Anchor mid-month at noon UTC so the Sydney-formatted short month never
  // drifts to the neighbouring month.
  return MONTH_SHORT.format(new Date(Date.UTC(year, month - 1, 15, 12)));
}

// Last 6 calendar months ending this month (Australia/Sydney), as "YYYY-MM".
function lastSixMonthKeys(): string[] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const keys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

// Revenue-by-month bar chart for the Finances tab. Pure server component - a
// CSS-height bar per month, no chart library. Renders the last 6 months so the
// axis stays readable even for merchants with a long history.
export function MerchantFinancesAnalytics({
  monthlyRevenue,
}: {
  monthlyRevenue: MerchantFinancesSummary["monthlyRevenue"];
}) {
  const paidByMonth = new Map(monthlyRevenue.map((m) => [m.month, m.paidCents]));
  const months = lastSixMonthKeys().map((key) => ({
    key,
    label: monthLabel(key),
    paidCents: paidByMonth.get(key) ?? 0,
  }));
  const peak = Math.max(1, ...months.map((m) => m.paidCents));
  const total = months.reduce((sum, m) => sum + m.paidCents, 0);

  return (
    <div className="rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--mist)] px-5 py-3.5">
        <span className="text-xs font-bold tracking-[0.08em] uppercase text-[color:var(--purple-700)]">
          Revenue · last 6 months
        </span>
        <span className="text-[13px] font-semibold text-[color:var(--slate)]">
          {formatMoney(total)} paid
        </span>
      </div>

      {total === 0 ? (
        <p className="p-6 text-sm leading-6 text-[color:var(--slate)]">
          No paid revenue in the last 6 months yet. Paid-event sales show up here.
        </p>
      ) : (
        <div className="flex items-end justify-between gap-2 px-5 pb-4 pt-6 sm:gap-4">
          {months.map((m) => {
            const heightPct = Math.round((m.paidCents / peak) * 100);
            return (
              <div key={m.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                {/* min-w-0 above, and the label is hidden below sm. Without the
                    first, each column cannot shrink past its min-content width -
                    which is this un-wrappable money token - so at 375px six
                    columns of "$12,450" scrolled the whole page sideways. The
                    figure is still on the bar's title tooltip and in the totals
                    above the chart. */}
                <span className="hidden text-[11px] font-semibold tabular-nums text-[color:var(--ink)] sm:block">
                  {m.paidCents > 0 ? formatMoney(m.paidCents) : ""}
                </span>
                <div
                  className="flex w-full items-end rounded-t-md"
                  style={{ height: "120px" }}
                  title={`${m.label}: ${formatMoney(m.paidCents)} paid`}
                >
                  <div
                    className="w-full rounded-t-md bg-[color:var(--sage)]"
                    style={{ height: `${Math.max(heightPct, m.paidCents > 0 ? 6 : 0)}%` }}
                  />
                </div>
                <span className="text-[11px] font-medium text-[color:var(--slate)]">
                  {m.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
