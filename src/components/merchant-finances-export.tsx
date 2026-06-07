"use client";

import { toast } from "sonner";
import type { MerchantFinancesSummary } from "@/lib/event-repository";

function csvEscape(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Client-side CSV export of the merchant's recent transactions. Mirrors the
// door-list export in MerchantAttendeesPanel (same csvEscape + Blob download).
export function MerchantFinancesExport({
  transactions,
}: {
  transactions: MerchantFinancesSummary["recentTransactions"];
}) {
  function exportCsv() {
    if (transactions.length === 0) {
      toast.error("No transactions to export yet.");
      return;
    }
    const header = ["Event", "Date", "Status", "Amount (AUD)"].join(",");
    const lines = transactions.map((t) =>
      [
        csvEscape(t.eventTitle),
        csvEscape(new Date(t.createdAt).toISOString()),
        csvEscape(t.status),
        csvEscape((t.amountCents / 100).toFixed(2)),
      ].join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `click-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(
      `Exported ${transactions.length} transaction${transactions.length === 1 ? "" : "s"}.`,
    );
  }

  return (
    <button
      type="button"
      onClick={exportCsv}
      className="inline-flex shrink-0 items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
    >
      Export CSV
    </button>
  );
}
