"use client";

import { useState } from "react";

// CSV export of the merchant's transactions with a period filter. The actual
// query + CSV is built server-side by /api/merchant/finances/export (so the
// export is the FULL set, not just the 20-row preview the Finances tab shows);
// this control just picks the period and triggers the download.
type Period = "all" | "year" | "month";

export function MerchantFinancesExport() {
  const [period, setPeriod] = useState<Period>("month");

  function exportCsv() {
    const now = new Date();
    const params = new URLSearchParams();
    if (period === "year") {
      params.set("year", String(now.getFullYear()));
    } else if (period === "month") {
      params.set("year", String(now.getFullYear()));
      params.set("month", String(now.getMonth() + 1));
    }
    const qs = params.toString();
    // Navigating to the route triggers a file download via Content-Disposition.
    window.location.href = `/api/merchant/finances/export${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <label className="sr-only" htmlFor="finances-export-period">
        Export period
      </label>
      <select
        id="finances-export-period"
        value={period}
        onChange={(e) => setPeriod(e.target.value as Period)}
        className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-2 text-xs font-bold text-[color:var(--ink)] hard-shadow-sm focus:outline-none"
      >
        <option value="month">This month</option>
        <option value="year">This year</option>
        <option value="all">All time</option>
      </select>
      <button
        type="button"
        onClick={exportCsv}
        className="inline-flex shrink-0 items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
      >
        Export CSV
      </button>
    </div>
  );
}
