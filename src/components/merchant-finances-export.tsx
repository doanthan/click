"use client";

import { useState } from "react";

// CSV export of the merchant's transactions with a period filter. The actual
// query + CSV is built server-side by /api/merchant/finances/export (so the
// export is the FULL set, not just the 20-row preview the Finances tab shows);
// this control just picks the period and triggers the download.
type Period = "all" | "year" | "month";

// Used in the "nothing in this period" line, so it has to read as the tail of a
// sentence rather than as the option label.
const PERIOD_PHRASE: Record<Period, string> = {
  all: "yet",
  year: "this year",
  month: "this month",
};

export function MerchantFinancesExport() {
  // "All time", NOT "This month". Every figure on this tab is all-time -
  // Collected, Click fee, your net, and a Refunded tile that says "all time" on
  // its face - so a host who reads $4,200 collected and taps Export got a file
  // holding whatever happened since the 1st, with no hint that the two numbers
  // were scoped differently. The default now matches what is on screen above it.
  const [period, setPeriod] = useState<Period>("all");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function exportCsv() {
    if (busy) return;
    const now = new Date();
    const params = new URLSearchParams();
    if (period === "year") {
      params.set("year", String(now.getFullYear()));
    } else if (period === "month") {
      params.set("year", String(now.getFullYear()));
      params.set("month", String(now.getMonth() + 1));
    }
    const qs = params.toString();
    const url = `/api/merchant/finances/export${qs ? `?${qs}` : ""}`;

    /* This used to be a bare `window.location.href = url`, which hands the
       browser whatever comes back and says nothing either way. Two things came
       back that a host could not read: a period with no paid bookings, which
       downloads a file containing only the header row and opens on an empty
       spreadsheet, and an error, which navigates the tab to raw JSON. Fetching
       it ourselves is what lets us tell the difference before anything lands in
       the downloads folder. */
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        setNote("Couldn't build the export just now - try again in a moment.");
        return;
      }
      const csv = await response.text();
      // The route always writes a header line; rows follow it. One line means
      // no transactions matched.
      if (csv.split("\n").filter((line) => line.trim()).length <= 1) {
        setNote(`No paid bookings ${PERIOD_PHRASE[period]} - so there's nothing to export.`);
        return;
      }
      const filename =
        /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ??
        "click-transactions.csv";
      const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = href;
      link.download = filename;
      // In the document and revoked a tick later, not detached and revoked
      // inline: Firefox has never reliably fired click() on an anchor that is
      // not in the tree, and revoking the object URL in the same turn can pull
      // the blob out from under a download that has not started reading it.
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 0);
    } catch {
      setNote("Couldn't reach the server, so nothing was downloaded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0">
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="finances-export-period">
          Export period
        </label>
        <select
          id="finances-export-period"
          value={period}
          onChange={(e) => {
            setNote(null);
            setPeriod(e.target.value as Period);
          }}
          className="h-9 rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-3 text-[13px] text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none"
        >
          <option value="all">All time</option>
          <option value="year">This year</option>
          <option value="month">This month</option>
        </select>
        <button
          type="button"
          onClick={exportCsv}
          aria-busy={busy || undefined}
          aria-disabled={busy || undefined}
          className={`ck-btn ck-btn--sm ck-btn--secondary shrink-0 ${busy ? "opacity-60" : ""}`}
        >
          {busy ? "Preparing…" : "Export CSV"}
        </button>
      </div>
      {note ? (
        <p
          role="status"
          className="mt-1.5 max-w-[280px] text-[12.5px] leading-[1.45] font-medium text-[color:var(--slate)] sm:text-right"
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}
