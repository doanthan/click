/**
 * Merchant finances CSV export.
 *
 * GET /api/merchant/finances/export?year=YYYY&month=MM
 *   - no params   → every transaction
 *   - year only   → that calendar year (Australia/Sydney)
 *   - year+month  → that month
 *
 * Streams a `text/csv` attachment of the FULL matching transaction set (unlike
 * the Finances tab summary, which previews only the last 20). Merchant-scoped:
 * getMerchantTransactionsForExport resolves the caller's merchant_profile and
 * returns [] for anyone who isn't a merchant.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMerchantTransactionsForExport } from "@/lib/event-repository";

export const runtime = "nodejs";

function csvEscape(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const yearRaw = Number(searchParams.get("year"));
  const monthRaw = Number(searchParams.get("month"));
  const year = Number.isFinite(yearRaw) && yearRaw > 0 ? yearRaw : undefined;
  const month =
    Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : undefined;

  const rows = await getMerchantTransactionsForExport(session, { year, month });

  // Sydney, not UTC. getMerchantTransactionsForExport filters the year/month
  // with `at time zone 'Australia/Sydney'`, so printing .toISOString() put rows
  // in the file under a DIFFERENT date than the one they were selected by: a
  // 9am-Sydney charge on 1 August exported as 2026-07-31T23:00:00Z, and an
  // "August" CSV opened on rows dated July. The whole portal is Sydney; the
  // export has to agree with it.
  const sydneyStamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  // en-CA gives YYYY-MM-DD, so "2026-08-01, 09:00:00" -> "2026-08-01 09:00:00":
  // sortable as text, and unambiguous in a spreadsheet.
  const formatSydney = (iso: string) =>
    sydneyStamp.format(new Date(iso)).replace(", ", " ");

  const header = ["Event", "Date (Australia/Sydney)", "Status", "Amount (AUD)"].join(",");
  const lines = rows.map((r) =>
    [
      csvEscape(r.eventTitle),
      csvEscape(formatSydney(r.createdAt)),
      csvEscape(r.status),
      csvEscape((r.amountCents / 100).toFixed(2)),
    ].join(","),
  );
  const csv = [header, ...lines].join("\n");

  const scope = year ? (month ? `${year}-${String(month).padStart(2, "0")}` : `${year}`) : "all";
  const filename = `click-transactions-${scope}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv;charset=utf-8;",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
