"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FINANCES_PERIODS,
  FINANCES_PERIOD_LABEL,
  FINANCES_PERIOD_PHRASE,
  type FinancesPeriod,
} from "@/lib/finances-period";

// The Finances tab's period picker and its CSV export. The period is the
// page's `?period=` (bug board #331): it used to scope only the export, so a
// host who picked "This month" watched every figure stay all-time. Picking one
// now re-renders the tiles and the transaction list on the server, and the
// export asks for the same period, so the file matches the screen. The CSV is
// built server-side by /api/merchant/finances/export (the FULL set, not the
// 20-row preview the tab shows).
export function MerchantFinancesExport({ period: shown }: { period: FinancesPeriod }) {
  const router = useRouter();
  // The tab renders this with key={period}, so a new server render resets it.
  // Local state only covers the beat before that render lands.
  const [period, setPeriod] = useState<FinancesPeriod>(shown);
  const [switching, startSwitch] = useTransition();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  function choose(next: FinancesPeriod) {
    setNote(null);
    setPeriod(next);
    startSwitch(() => {
      router.replace(
        next === "all" ? "/merchant?tab=finances" : `/merchant?tab=finances&period=${next}`,
        { scroll: false },
      );
    });
  }

  async function exportCsv() {
    if (busy) return;
    const url =
      period === "all"
        ? "/api/merchant/finances/export"
        : `/api/merchant/finances/export?period=${period}`;

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
        setNote(
          `No paid bookings ${period === "all" ? "yet" : FINANCES_PERIOD_PHRASE[period]} - so there's nothing to export.`,
        );
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
        <label className="sr-only" htmlFor="finances-period">
          Show figures for
        </label>
        <select
          id="finances-period"
          value={period}
          aria-busy={switching || undefined}
          onChange={(e) => choose(e.target.value as FinancesPeriod)}
          className="h-9 rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-3 text-[13px] text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none"
        >
          {FINANCES_PERIODS.map((p) => (
            <option key={p} value={p}>
              {FINANCES_PERIOD_LABEL[p]}
            </option>
          ))}
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
