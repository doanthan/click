// The merchant Finances tab's period (bug board #331). The select beside
// Export used to scope only the CSV, so picking "This month" left every figure
// on screen all-time. It is now `?period=` on /merchant?tab=finances, and the
// tiles, the transaction list and the export all read it through this module,
// so the file a host downloads always matches the numbers above it.
//
// Dependency-free: the select (browser), the tab and the export route (Node)
// all import it.

export const FINANCES_PERIODS = ["all", "month", "last-month", "fy", "year"] as const;
export type FinancesPeriod = (typeof FINANCES_PERIODS)[number];

export const FINANCES_PERIOD_LABEL: Record<FinancesPeriod, string> = {
  all: "All time",
  month: "This month",
  "last-month": "Last month",
  fy: "This financial year",
  year: "This year",
};

// The tail of a sentence: "Refunded · this month", "No paid bookings last month".
export const FINANCES_PERIOD_PHRASE: Record<FinancesPeriod, string> = {
  all: "all time",
  month: "this month",
  "last-month": "last month",
  fy: "this financial year",
  year: "this year",
};

export function parseFinancesPeriod(value: string | null | undefined): FinancesPeriod {
  return (FINANCES_PERIODS as readonly string[]).includes(value ?? "")
    ? (value as FinancesPeriod)
    : "all";
}

/**
 * The period as Sydney calendar dates, `from` inclusive and `to` exclusive, or
 * null for all time. Dates, not instants: the SQL turns each into Sydney
 * midnight with `at time zone 'Australia/Sydney'`, which is where daylight
 * saving is handled. "Today" is Sydney's date too. The server runs in UTC, and
 * on the 1st of a month UTC is still in the previous one until 10 or 11am.
 *
 * The financial year is Australia's: 1 July to 30 June.
 */
export function financesPeriodRange(
  period: FinancesPeriod,
  now: Date = new Date(),
): { from: string; to: string } | null {
  if (period === "all") return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  // The 1st of a month, normalising a month past either end of the year.
  const first = (y: number, m: number) => {
    const d = new Date(Date.UTC(y, m - 1, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  };
  switch (period) {
    case "month":
      return { from: first(year, month), to: first(year, month + 1) };
    case "last-month":
      return { from: first(year, month - 1), to: first(year, month) };
    case "year":
      return { from: first(year, 1), to: first(year + 1, 1) };
    case "fy": {
      const startYear = month >= 7 ? year : year - 1;
      return { from: first(startYear, 7), to: first(startYear + 1, 7) };
    }
  }
}

// The scope part of the export's filename: 2026-10, 2026, FY2026-27, all.
export function financesPeriodFileTag(period: FinancesPeriod, now: Date = new Date()): string {
  const range = financesPeriodRange(period, now);
  if (!range) return "all";
  if (period === "year") return range.from.slice(0, 4);
  if (period === "fy") return `FY${range.from.slice(0, 4)}-${range.to.slice(2, 4)}`;
  return range.from.slice(0, 7);
}
