"use client";

import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type {
  AdminConnectAccountRow,
  AdminDisputeRow,
  AdminPayoutRow,
  AdminRefundFailureRow,
  AdminTransactionRefund,
  AdminTransactionRow,
} from "@/lib/event-repository";
import { AdminMoneyAttention } from "@/components/admin-money-attention";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Badge, type BadgeTone } from "@/components/ds";

// /admin/transactions client UI:
// • A 30-day default view of payment_transactions joined with event + attendee
//   + merchant, re-queryable to any window through the From/To dates. Filters:
//   status pill, free-text search, merchant select - those run over the rows
//   already loaded, so an older charge is reached by widening the dates first.
// • KPI stickers across the top reflect the currently-filtered set so admins
//   can sanity-check what they're looking at, not raw totals.
// • Four tabs: Needs attention (default WHEN it has anything in it - see
//   below), Transactions, Payouts, Connect accounts.
// • "Sync from Stripe" button (top right) calls /api/admin/transactions/sync
//   and reloads the route on completion. Counts are shown briefly.
// • Row tap opens an inline detail drawer with refund history + a refund
//   button. Refund posts to /api/admin/transactions/[id]/refund; the row's
//   refundedAmountCents + status optimistically update on success.

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "partially_refunded", label: "Partial refund" },
  { value: "refunded", label: "Refunded" },
  { value: "failed", label: "Failed" },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]["value"];
type Tab = "attention" | "transactions" | "payouts" | "accounts";
type RefundReason = "duplicate" | "fraudulent" | "requested_by_customer";

const dateTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dateOnlyFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatMoney(amountCents: number | null | undefined, currency: string) {
  if (amountCents == null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

function statusTone(status: string): BadgeTone {
  switch (status) {
    case "paid":
      return "sage";
    case "partially_refunded":
      return "amber";
    case "refunded":
      return "neutral";
    case "failed":
      return "coral";
    default:
      return "lavender"; // pending
  }
}

function payoutStatusTone(status: string): BadgeTone {
  switch (status) {
    case "paid":
      return "sage";
    case "in_transit":
      return "lavender";
    case "failed":
      return "coral";
    case "canceled":
      return "neutral";
    default:
      return "lavender";
  }
}

function truncate(value: string | null, head = 8, tail = 4) {
  if (!value) return "—";
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

// The backfill window, in days. It matches the ledger's default view on
// purpose: the header promises "last 30 days", so a sync that only reached back
// 7 reported "0 charges seen" for a webhook it never looked at.
const SYNC_WINDOW_DAYS = 30;

// <input type="date"> hands back a bare YYYY-MM-DD. Anchor "from" at the start
// of that day and "to" at the end of it, in the admin's own timezone, so
// picking the same day at both ends means that whole day and not an empty
// window. An empty box means no bound on that side.
function startOfDay(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : "";
}

function endOfDay(value: string) {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : "";
}

export function AdminTransactionsTable({
  initialTransactions,
  initialHasMore,
  initialPayouts,
  connectAccounts,
  refundFailures,
  disputes,
  defaultDateFrom,
  loadPage,
  loadRefunds,
}: {
  initialTransactions: AdminTransactionRow[];
  initialHasMore: boolean;
  initialPayouts: AdminPayoutRow[];
  connectAccounts: AdminConnectAccountRow[];
  refundFailures: AdminRefundFailureRow[];
  disputes: AdminDisputeRow[];
  defaultDateFrom: string;
  /** Server action on the page - re-gates admin, then re-queries the ledger. */
  loadPage: (input: {
    dateFrom: string;
    dateTo: string;
    offset: number;
  }) => Promise<{ rows: AdminTransactionRow[]; hasMore: boolean }>;
  /** Server action on the page - re-gates admin, then reads payment_refunds. */
  loadRefunds: (transactionId: string) => Promise<AdminTransactionRefund[]>;
}) {
  const router = useRouter();
  const attentionCount = refundFailures.length + disputes.length;
  // Open on the queue when it has anything in it. Someone owed a refund, or a
  // dispute with a Stripe deadline on it, outranks the ledger every time - and
  // the whole reason these went unnoticed for so long is that nothing ever put
  // them in front of anyone. When it is empty this is just the ledger again.
  const [tab, setTab] = useState<Tab>(attentionCount > 0 ? "attention" : "transactions");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [payouts] = useState(initialPayouts);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [merchantFilter, setMerchantFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncing, startSync] = useTransition();
  // The window the loaded rows came from. `defaultDateFrom` is the server's ISO
  // instant for 30 days ago; the date input wants the bare day part of it.
  const [dateFrom, setDateFrom] = useState(defaultDateFrom.slice(0, 10));
  const [dateTo, setDateTo] = useState("");
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();

  // Typing stays responsive on the row cap by filtering against a deferred copy
  // of the search term; the input itself stays bound to the immediate `search`.
  const deferredSearch = useDeferredValue(search);

  const merchants = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of transactions) {
      if (t.merchantProfileId && t.merchantName) {
        map.set(t.merchantProfileId, t.merchantName);
      }
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [transactions]);

  // Per-status pill counts in ONE pass over the rows (was N filter() passes,
  // one per pill, on every render). `all` is just the total.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of transactions) {
      counts[t.status] = (counts[t.status] ?? 0) + 1;
    }
    return counts;
  }, [transactions]);

  // Precompute everything each cell renders — parsed/formatted dates, currency
  // strings, the derived net, and a lowercased search haystack — so render and
  // filtering read precomputed values instead of re-parsing on every keystroke.
  const displayRows = useMemo(() => {
    return transactions.map((t) => {
      const created = new Date(t.createdAt);
      // `transfer_amount_cents` is the transfer as it was CREATED at checkout -
      // Stripe reverses it on refund (issueRefund sends reverse_transfer) but
      // nothing writes the reversal back to that column. So a fully refunded
      // charge kept showing the merchant's whole cut as "net", which is money
      // they no longer have. Take the refunds off the derived figure and clamp
      // at 0; refundedAmountCents only counts refunds that actually succeeded,
      // so this is what is left with the merchant, not what was once sent.
      const gross =
        t.transferAmountCents != null
          ? t.transferAmountCents
          : t.amountCents - (t.applicationFeeCents ?? 0);
      const net = Math.max(gross - t.refundedAmountCents, 0);
      return {
        row: t,
        net,
        dateLabel: dateOnlyFormatter.format(created),
        timeLabel: dateTimeFormatter.format(created).split(", ").slice(-1)[0],
        amountLabel: formatMoney(t.amountCents, t.currency),
        feeLabel: formatMoney(t.applicationFeeCents, t.currency),
        netLabel: formatMoney(net, t.currency),
        refundedLabel:
          t.refundedAmountCents > 0 ? formatMoney(t.refundedAmountCents, t.currency) : "—",
        piLabel: truncate(t.stripePaymentIntentId),
        haystack: [
          t.eventTitle,
          t.attendeeName,
          t.attendeeEmail,
          t.merchantName,
          t.stripePaymentIntentId,
          t.stripeChargeId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    });
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return displayRows.filter((d) => {
      const t = d.row;
      if (status !== "all" && t.status !== status) return false;
      if (merchantFilter !== "all" && t.merchantProfileId !== merchantFilter) return false;
      if (!q) return true;
      return d.haystack.includes(q);
    });
  }, [displayRows, status, merchantFilter, deferredSearch]);

  // KPI stickers reflect the filtered set so the headline numbers match the
  // table the admin is actually looking at.
  const kpis = useMemo(() => {
    let gross = 0;
    let refunded = 0;
    let net = 0;
    let fees = 0;
    let paidCount = 0;
    for (const { row: t } of filtered) {
      if (t.status === "paid" || t.status === "partially_refunded" || t.status === "refunded") {
        gross += t.amountCents;
        refunded += t.refundedAmountCents;
        if (t.applicationFeeCents != null) fees += t.applicationFeeCents;
        paidCount += 1;
      }
      net = gross - refunded;
    }
    return { gross, refunded, net, fees, paidCount };
  }, [filtered]);

  const filtersActive = status !== "all" || merchantFilter !== "all" || search.trim() !== "";

  function clearFilters() {
    setStatus("all");
    setMerchantFilter("all");
    setSearch("");
  }

  // Re-query the ledger for a new window. Everything else on this screen -
  // the pills, the merchant select, the search box - only ever filtered the
  // rows already in memory, so before this the console could not look at a
  // charge older than its one fixed 30-day slice, and the refund control lives
  // inside a loaded row.
  function reload(nextFrom: string, nextTo: string) {
    setLoadError(null);
    startLoad(async () => {
      try {
        const page = await loadPage({
          dateFrom: startOfDay(nextFrom),
          dateTo: endOfDay(nextTo),
          offset: 0,
        });
        setTransactions(page.rows);
        setHasMore(page.hasMore);
        // The expanded row almost certainly is not in the new window, and an
        // open refund box belonging to a row that is no longer on screen is the
        // last thing this console should keep.
        setOpenRow(null);
      } catch {
        setLoadError("Could not load that window. Try again.");
      }
    });
  }

  function loadMore() {
    setLoadError(null);
    startLoad(async () => {
      try {
        const page = await loadPage({
          dateFrom: startOfDay(dateFrom),
          dateTo: endOfDay(dateTo),
          offset: transactions.length,
        });
        setTransactions((current) => [...current, ...page.rows]);
        setHasMore(page.hasMore);
      } catch {
        setLoadError("Could not load more. Try again.");
      }
    });
  }

  function runSync() {
    setSyncMessage("Syncing…");
    startSync(async () => {
      try {
        const res = await fetch("/api/admin/transactions/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sinceDays: SYNC_WINDOW_DAYS, scope: "all" }),
        });
        const body = (await res.json()) as {
          ok?: boolean;
          sinceDays?: number;
          counts?: {
            chargesSeen: number;
            transactionsUpdated: number;
            refundsUpserted: number;
            payoutsUpserted: number;
            accountsUpdated: number;
            accountsScanned: number;
            bookingsReconciled?: number;
          };
          error?: string;
        };
        if (!res.ok || !body.ok) {
          setSyncMessage(body.error ?? "Sync failed.");
          return;
        }
        const c = body.counts ?? {
          chargesSeen: 0,
          transactionsUpdated: 0,
          refundsUpserted: 0,
          payoutsUpserted: 0,
          accountsUpdated: 0,
          accountsScanned: 0,
          bookingsReconciled: 0,
        };
        // Name the window the sync actually used - the route echoes it back, so
        // this is the real number and not our request. "0 charges seen" with no
        // window on it reads as "Stripe has nothing", which is a different and
        // much more alarming claim than "nothing in the last 30 days".
        setSyncMessage(
          `Synced last ${body.sinceDays ?? SYNC_WINDOW_DAYS} days: ${c.chargesSeen} charges seen · ${c.transactionsUpdated} txns updated · ${c.refundsUpserted} refunds · ${c.payoutsUpserted} payouts · ${c.accountsUpdated}/${c.accountsScanned} accounts · ${c.bookingsReconciled ?? 0} bookings confirmed`,
        );
        router.refresh();
      } catch (error) {
        setSyncMessage(
          error instanceof Error ? error.message : "Sync failed.",
        );
      }
    });
  }

  function handleRefundComplete(transactionId: string, newRefunded: number, newStatus: string) {
    setTransactions((current) =>
      current.map((t) =>
        t.id === transactionId
          ? { ...t, refundedAmountCents: newRefunded, status: newStatus }
          : t,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="eyebrow">Transactions</span>
          <h1 className="font-display mt-3 text-4xl font-semibold leading-tight tracking-[-0.025em] text-[color:var(--ink)]">
            Stripe ledger
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[color:var(--slate)]">
            <code className="font-mono">payment_transactions</code>, last 30 days by
            default - change the dates to look further back. Use{" "}
            <strong>Sync from Stripe</strong> to backfill the last {SYNC_WINDOW_DAYS} days
            of anything the webhook missed.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <button
            type="button"
            onClick={runSync}
            disabled={syncing}
            className="ck-btn ck-btn--primary ck-btn--sm"
          >
            {syncing ? "Syncing…" : "Sync from Stripe"}
          </button>
          {syncMessage ? (
            <p className="max-w-md text-right text-xs font-medium text-[color:var(--slate)]">
              {syncMessage}
            </p>
          ) : null}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Gross volume (filtered)" value={formatMoney(kpis.gross, "AUD")} note={`${kpis.paidCount} paid txns`} />
        <Kpi label="Refunded" value={formatMoney(kpis.refunded, "AUD")} note="includes partial refunds" />
        {/* This was labelled "Net to merchants", which it has never been: it
            still has the platform fee and Stripe's own processing fee inside
            it, and it counts platform-owned events that have no merchant at
            all. The mirror cannot produce a true net either - we store the
            application fee but not Stripe's cut, and a reversed transfer never
            comes back to transfer_amount_cents - so name the figure we do have
            rather than keep a number an admin could hand a merchant. */}
        <Kpi
          label="Net after refunds"
          value={formatMoney(kpis.net, "AUD")}
          note="gross minus refunds, before fees"
        />
        <Kpi label="Platform fees" value={formatMoney(kpis.fees, "AUD")} note="from Stripe Connect" />
      </section>
      {/* The stickers only ever add up the rows in memory. With more still
          behind Load more they are a running subtotal, not the window - say so
          up here, where the numbers are, and not only next to the table. */}
      {hasMore ? (
        <p className="text-xs font-medium text-[color:var(--slate)]">
          These cover the {transactions.length} rows loaded so far. This window holds
          more - use <strong>Load more</strong> under the table for the full totals.
        </p>
      ) : null}

      <nav className="flex flex-wrap gap-2">
        {(
          [
            ["attention", `Needs attention (${attentionCount})`],
            // The "+" is the tell that the window holds more than is loaded.
            ["transactions", `Transactions (${transactions.length}${hasMore ? "+" : ""})`],
            ["payouts", `Payouts (${payouts.length})`],
            ["accounts", `Connect accounts (${connectAccounts.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`ck-tag ck-tag--select ${tab === value ? "ck-tag--selected" : ""}`}
          >
            {label}
            {/* A count in the label is easy to read past. The dot is for the one
                tab where "not zero" means someone is out of pocket or a Stripe
                clock is running. Status colour on a marker, never on the tab. */}
            {value === "attention" && attentionCount > 0 ? (
              <span
                aria-hidden
                className="ml-1.5 inline-block size-1.5 rounded-full bg-[color:var(--coral)] align-middle"
              />
            ) : null}
          </button>
        ))}
      </nav>

      {tab === "transactions" ? (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => {
                const count =
                  option.value === "all"
                    ? transactions.length
                    : statusCounts[option.value] ?? 0;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatus(option.value)}
                    className={`ck-tag ck-tag--select ${status === option.value ? "ck-tag--selected" : ""}`}
                  >
                    {option.label} <span className="opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* The window itself, not a filter over the loaded rows: both
                  inputs re-query. Native date inputs so the min/max keep the
                  range the right way round with no code of ours. */}
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-[color:var(--slate)]">
                From
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    reload(e.target.value, dateTo);
                  }}
                  className="rounded-xl border border-[color:var(--mist)] bg-white px-3 py-2 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
                />
              </label>
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-[color:var(--slate)]">
                To
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    reload(dateFrom, e.target.value);
                  }}
                  className="rounded-xl border border-[color:var(--mist)] bg-white px-3 py-2 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
                />
              </label>
              <select
                value={merchantFilter}
                onChange={(e) => setMerchantFilter(e.target.value)}
                className="rounded-xl border border-[color:var(--mist)] bg-white px-4 py-2 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
              >
                <option value="all">All merchants</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Event, attendee, merchant, pi_…"
                className="w-full rounded-xl border border-[color:var(--mist)] bg-white px-4 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--slate)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)] sm:w-80"
              />
            </div>
          </div>

          <div className="overflow-visible rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
            <div className="hidden grid-cols-[1.1fr_1.4fr_1.3fr_1.1fr_0.9fr_0.9fr_0.9fr_0.4fr] gap-4 border-b border-[color:var(--line)] px-5 py-3 text-xs font-semibold text-[color:var(--slate)] lg:grid">
              <span>Date</span>
              <span>Event · Attendee</span>
              <span>Merchant</span>
              <span>Amount</span>
              <span>Fee / Net</span>
              <span>Refunded</span>
              <span>Status</span>
              <span className="text-right">PI</span>
            </div>
            {filtered.length === 0 ? (
              <div className="px-5 py-10">
                <EmptyState
                  bare
                  eyebrow="No transactions"
                  title="No transactions match this filter."
                  body={
                    filtersActive
                      ? "Nothing here for the current status, merchant or search - and search only reads the rows loaded below. Clear the filters, or widen the dates to look further back."
                      : "No payment_transactions in this window. Widen the dates, or run Sync from Stripe to backfill anything the webhook missed."
                  }
                  action={
                    filtersActive ? (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="ck-btn ck-btn--secondary ck-btn--sm"
                      >
                        Clear filters
                      </button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              filtered.map((d) => {
                const t = d.row;
                const isOpen = openRow === t.id;
                return (
                  <div key={t.id} className="border-b border-[color:var(--line)] last:border-0">
                    <button
                      type="button"
                      onClick={() => setOpenRow(isOpen ? null : t.id)}
                      className="grid w-full gap-3 px-5 py-4 text-left text-sm text-[color:var(--slate)] transition-colors hover:bg-[color:var(--lavender-100)]/50 lg:grid-cols-[1.1fr_1.4fr_1.3fr_1.1fr_0.9fr_0.9fr_0.9fr_0.4fr] lg:items-center"
                    >
                      <div>
                        <p className="font-semibold text-[color:var(--ink)]">
                          {d.dateLabel}
                        </p>
                        <p className="text-[11px]">
                          {d.timeLabel}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-[color:var(--ink)]">
                          {t.eventTitle ?? "—"}
                        </p>
                        <p className="text-xs">{t.attendeeName ?? "(unknown)"}</p>
                        <p className="text-[11px]">{t.attendeeEmail ?? ""}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-[color:var(--ink)]">
                          {t.merchantName ?? "—"}
                        </p>
                      </div>
                      {/* Below lg the headers are gone and these cells stack, so
                          two bare money figures sat under each other with
                          nothing saying which was the charge and which came
                          back. Fee/Net already carried its labels inline - the
                          same treatment here, hidden at lg where the header row
                          says it instead. */}
                      <div>
                        <p className="font-semibold text-[color:var(--ink)]">
                          <span className="font-normal text-[color:var(--slate)] lg:hidden">
                            amount{" "}
                          </span>
                          {d.amountLabel}
                        </p>
                        <p className="text-[11px] uppercase">{t.currency}</p>
                      </div>
                      <div>
                        <p className="text-xs">
                          fee {d.feeLabel}
                        </p>
                        <p className="text-xs font-semibold text-[color:var(--ink)]">
                          net {d.netLabel}
                        </p>
                        {/* Say why net is not simply amount minus fee here -
                            otherwise the arithmetic looks broken to anyone
                            checking it against the two figures beside it. */}
                        {t.refundedAmountCents > 0 ? (
                          <p className="text-[11px]">after refunds</p>
                        ) : null}
                      </div>
                      <div>
                        <p className="font-semibold text-[color:var(--ink)]">
                          <span className="font-normal text-[color:var(--slate)] lg:hidden">
                            refunded{" "}
                          </span>
                          {d.refundedLabel}
                        </p>
                      </div>
                      <div>
                        <Badge tone={statusTone(t.status)}>
                          {t.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="text-right font-mono text-[11px] text-[color:var(--slate)]">
                        {d.piLabel}
                      </div>
                    </button>

                    {isOpen ? (
                      <TransactionDetail
                        row={t}
                        loadRefunds={loadRefunds}
                        onRefundComplete={(refunded, newStatus) =>
                          handleRefundComplete(t.id, refunded, newStatus)
                        }
                      />
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          {/* The console loaded exactly 200 rows and said nothing about it, so a
              window holding 900 charges looked like a window holding 200 - and
              the ones past the cap could not be opened, which is the only place
              the refund control exists. The count is always on screen now, and
              the "+" means the window has more than this. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-[color:var(--slate)]">
              Showing {filtered.length} of {transactions.length}
              {hasMore ? "+" : ""} in this window
              {loading ? " · loading…" : ""}
            </p>
            {hasMore ? (
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="ck-btn ck-btn--secondary ck-btn--sm"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            ) : null}
          </div>
          {loadError ? (
            <p className="rounded-lg border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/5 px-3 py-2 text-xs font-medium text-[color:var(--danger)]">
              {loadError}
            </p>
          ) : null}
        </>
      ) : null}

      {tab === "attention" ? (
        <AdminMoneyAttention refundFailures={refundFailures} disputes={disputes} />
      ) : null}
      {tab === "payouts" ? <PayoutsView payouts={payouts} /> : null}
      {tab === "accounts" ? <ConnectAccountsView accounts={connectAccounts} /> : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl bg-[color:var(--paper)] px-5 py-4 shadow-[var(--shadow-sm)]">
      <p className="text-[11px] font-semibold text-[color:var(--slate)]">{label}</p>
      <p className="font-display mt-1 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
        {value}
      </p>
      <p className="mt-1 text-xs text-[color:var(--slate)]">{note}</p>
    </div>
  );
}

// Refund status is a Stripe enum: succeeded / pending / failed / canceled /
// requires_action. Anything that is not `succeeded` means the money has not
// reached the attendee, so it never gets the quiet neutral treatment.
function refundStatusTone(status: string): BadgeTone {
  switch (status) {
    case "succeeded":
      return "sage";
    case "failed":
    case "canceled":
      return "coral";
    default:
      return "amber"; // pending, requires_action
  }
}

// Inline detail drawer rendered under an expanded transaction row.
function TransactionDetail({
  row,
  loadRefunds,
  onRefundComplete,
}: {
  row: AdminTransactionRow;
  loadRefunds: (transactionId: string) => Promise<AdminTransactionRefund[]>;
  onRefundComplete: (refundedAmountCents: number, newStatus: string) => void;
}) {
  const refundable = Math.max(row.amountCents - row.refundedAmountCents, 0);
  const [amount, setAmount] = useState<string>((refundable / 100).toFixed(2));
  const [reason, setReason] = useState<RefundReason | "">("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Holds the amount awaiting confirmation. Every other destructive action in
  // this console (reject event, cancel event, reject merchant, delete tag,
  // suspend member, maintenance mode) is gated behind ConfirmDialog; the one
  // that moves real money on the LIVE key was not. The amount box opens
  // pre-filled with the full refundable balance, so a single mis-aimed tap - or
  // one meant for the row below - issued a full refund with no undo, reversed
  // the merchant's transfer, and clawed back the platform fee.
  const [pendingCents, setPendingCents] = useState<number | null>(null);
  const refundable_lt_total = row.refundedAmountCents > 0;

  // Refund history. The ledger row cannot show a refund that FAILED at Stripe:
  // refundedAmountCents counts succeeded refunds only, so an attempt that came
  // back `failed` leaves the row reading "paid" with nothing refunded, exactly
  // like a charge nobody ever tried to refund - while the attendee is still
  // owed the money.
  // The payment_refunds rows are the only record it happened, and nothing on
  // this screen read them before. Loaded per drawer, so a 200-row window does
  // not carry 200 refund queries nobody asked for.
  const [refunds, setRefunds] = useState<AdminTransactionRefund[] | null>(null);
  const [refundsUnavailable, setRefundsUnavailable] = useState(false);
  // Bumped after a refund goes through so the one just issued appears here too.
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    let live = true;
    loadRefunds(row.id)
      .then((rows) => {
        if (live) {
          setRefunds(rows);
          setRefundsUnavailable(false);
        }
      })
      .catch(() => {
        // Never claim "no refunds" when we simply could not read them - on this
        // screen that is the difference between a clean charge and one where
        // someone is out of pocket.
        if (live) {
          setRefunds([]);
          setRefundsUnavailable(true);
        }
      });
    return () => {
      live = false;
    };
  }, [row.id, historyKey, loadRefunds]);

  // Only the ones Stripe actually stopped. A `pending` refund is on its way and
  // says so on its own row - putting it in the banner would cry wolf on money
  // that is moving, and the banner has to stay believable for the ones that are
  // not.
  const stoppedRefunds = (refunds ?? []).filter(
    (r) => r.status === "failed" || r.status === "canceled",
  );

  function requestRefund() {
    setError(null);
    setSuccess(null);
    const cents = Math.round(Number(amount.replace(/[^0-9.]/g, "")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Amount must be a positive number.");
      return;
    }
    if (cents > refundable) {
      setError(`Amount is more than the ${formatMoney(refundable, row.currency)} still refundable.`);
      return;
    }
    setPendingCents(cents);
  }

  async function submit(cents: number) {
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/transactions/${row.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: cents, reason: reason || undefined }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        refund?: { refundedAmountCents: number; newStatus: string };
      };
      if (!res.ok || !body.ok || !body.refund) {
        setError(body.error ?? "Refund failed.");
        return;
      }
      // Read the seat consequence off the status the server came back with,
      // not off our own arithmetic: `refunded` is exactly the branch where
      // issueRefund released the seat, so the confirmation cannot claim a
      // release that did not happen (or stay silent about one that did).
      setSuccess(
        body.refund.newStatus === "refunded"
          ? `Refunded ${formatMoney(cents, row.currency)} - fully refunded. Their seat and any guest spots are cancelled, and the seat has gone back to the waitlist.`
          : `Refunded ${formatMoney(cents, row.currency)} - new status: ${body.refund.newStatus.replace("_", " ")}. Their seat is unchanged.`,
      );
      onRefundComplete(body.refund.refundedAmountCents, body.refund.newStatus);
      const newRefundable = Math.max(row.amountCents - body.refund.refundedAmountCents, 0);
      setAmount((newRefundable / 100).toFixed(2));
      // Re-read the history so the refund just issued is in it - including the
      // case where Stripe accepted it as `pending` rather than succeeded.
      setHistoryKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed.");
    } finally {
      setSubmitting(false);
      setPendingCents(null);
    }
  }

  const canRefund = refundable > 0 && (row.status === "paid" || row.status === "partially_refunded");
  const refundTarget = row.attendeeName ?? row.attendeeEmail ?? "this attendee";
  // A refund that clears the remaining balance lands the transaction on
  // `refunded`, and /api/admin/transactions/[id]/refund is the one refund path
  // that passes settleBooking: true - so issueRefund goes on to call
  // settleRefundedBooking({ releaseSeat: true }), which cancels the seat,
  // cancels the guest spots bought with it and offers the seat to the waitlist.
  // A partial refund does none of that. Both got the identical dialog, so the
  // consequence an admin could not undo was the one it never mentioned.
  const isFullRefund = pendingCents !== null && pendingCents >= refundable;

  return (
    <div className="border-t border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-5 text-sm text-[color:var(--slate)]">
      <ConfirmDialog
        open={pendingCents !== null}
        tone="rose"
        title={isFullRefund ? "Issue this full refund?" : "Issue this partial refund?"}
        confirmLabel={
          pendingCents !== null
            ? `Refund ${formatMoney(pendingCents, row.currency)}`
            : "Refund"
        }
        busy={submitting}
        description={
          <>
            {pendingCents !== null ? formatMoney(pendingCents, row.currency) : ""} goes back
            to {refundTarget}
            {row.eventTitle ? ` for ${row.eventTitle}` : ""}. Stripe refunds cannot be
            undone, and for a merchant-hosted event this also reverses the merchant&apos;s
            transfer and claws back the platform fee.{" "}
            {isFullRefund ? (
              <>
                It clears the balance, so it also cancels their seat and any guest spots
                bought with it, and offers the seat to the next person on the waitlist -
                none of which can be undone from here.
              </>
            ) : (
              <>
                It leaves {formatMoney(refundable - (pendingCents ?? 0), row.currency)} on
                the charge, so they keep their seat and stay on the roster.
              </>
            )}
          </>
        }
        onConfirm={() => {
          if (pendingCents !== null) void submit(pendingCents);
        }}
        onCancel={() => setPendingCents(null)}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="eyebrow">Details</p>
          <Detail
            k="Charge"
            v={row.stripeChargeId ?? "(not synced yet)"}
            mono
          />
          <Detail k="Payment intent" v={row.stripePaymentIntentId ?? "—"} mono />
          <Detail
            k="Transfer"
            v={
              row.transferAmountCents != null
                ? `${formatMoney(row.transferAmountCents, row.currency)} to merchant`
                : "—"
            }
          />
          <Detail k="Last synced" v={row.lastSyncedAt ? dateTimeFormatter.format(new Date(row.lastSyncedAt)) : "never"} />
          {row.eventSlug ? (
            <Detail
              k="Event"
              v={
                <Link className="font-semibold text-[color:var(--purple)] underline" href={`/events/${row.eventSlug}`}>
                  {row.eventTitle ?? row.eventSlug}
                </Link>
              }
            />
          ) : null}
          {row.merchantProfileId ? (
            <Detail
              k="Merchant"
              v={
                <Link
                  className="font-semibold text-[color:var(--purple)] underline"
                  href={`/admin/merchants/${row.merchantProfileId}`}
                >
                  {row.merchantName ?? "Open merchant"}
                </Link>
              }
            />
          ) : null}
          {row.attendeeId ? (
            <Detail
              k="Attendee"
              v={
                <Link
                  className="font-semibold text-[color:var(--purple)] underline"
                  href={`/admin/members/${row.attendeeId}`}
                >
                  {row.attendeeName ?? row.attendeeEmail ?? "Open profile"}
                </Link>
              }
            />
          ) : null}
        </div>
        <div className="space-y-3">
          <p className="eyebrow">Refund</p>
          {canRefund ? (
            <>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <label className="block text-[12.5px] font-semibold text-[color:var(--slate)]">
                  Amount ({row.currency})
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[color:var(--mist)] bg-white px-4 py-2 text-sm tabular-nums text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
                  />
                </label>
                <label className="block text-[12.5px] font-semibold text-[color:var(--slate)]">
                  Reason
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as RefundReason | "")}
                    className="mt-1 w-full rounded-xl border border-[color:var(--mist)] bg-white px-4 py-2 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
                  >
                    <option value="">— select —</option>
                    <option value="requested_by_customer">Requested by customer</option>
                    <option value="duplicate">Duplicate</option>
                    <option value="fraudulent">Fraudulent</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={requestRefund}
                  disabled={submitting}
                  className="ck-btn ck-btn--primary ck-btn--sm self-end"
                >
                  {submitting ? "Refunding…" : "Issue refund"}
                </button>
              </div>
              <p className="text-xs font-medium">
                Refundable: {formatMoney(refundable, row.currency)}{" "}
                {refundable_lt_total ? `(of ${formatMoney(row.amountCents, row.currency)})` : null}
              </p>
            </>
          ) : (
            <p className="text-xs font-medium">
              {row.status === "refunded"
                ? "Fully refunded - no remaining balance."
                : row.status === "failed"
                  ? "Charge failed - nothing to refund."
                  : row.status === "pending"
                    ? "Charge not yet captured - refund unavailable."
                    : "Refund unavailable."}
            </p>
          )}
          {error ? (
            <p className="rounded-lg border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/5 px-3 py-2 text-xs font-medium text-[color:var(--danger)]">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-lg bg-[color:var(--sage)]/12 px-3 py-2 text-xs font-medium text-[color:var(--ink)]">
              {success}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 lg:col-span-2">
          <p className="eyebrow">Refund history</p>
          {refunds === null ? (
            <p className="text-xs font-medium">Reading refunds…</p>
          ) : refundsUnavailable ? (
            <p className="rounded-lg border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/5 px-3 py-2 text-xs font-medium text-[color:var(--danger)]">
              Could not read the refund history for this charge. Close and reopen the row to
              try again - this is not the same as there being none.
            </p>
          ) : refunds.length === 0 ? (
            <p className="text-xs font-medium">No refund has been attempted on this charge.</p>
          ) : (
            <>
              {/* A refund that came back `failed` moves no money and leaves no
                  trace on the ledger row, so the only person who ever found out
                  was the attendee, when they asked where their money was. Put
                  it at the top of the history and say what is owed. */}
              {stoppedRefunds.length > 0 ? (
                <p className="rounded-lg border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/5 px-3 py-2 text-xs font-medium leading-5 text-[color:var(--danger)]">
                  {stoppedRefunds.length === 1
                    ? "One refund on this charge did not go through"
                    : `${stoppedRefunds.length} refunds on this charge did not go through`}
                  , so {refundTarget} is still waiting on{" "}
                  {formatMoney(
                    stoppedRefunds.reduce((sum, r) => sum + r.amountCents, 0),
                    row.currency,
                  )}
                  . Read each one below before issuing another.
                </p>
              ) : null}
              <ul className="space-y-2">
                {refunds.map((r) => {
                  const stopped = r.status === "failed" || r.status === "canceled";
                  return (
                    <li
                      key={r.id}
                      className={`rounded-xl px-3 py-2 ${
                        stopped
                          ? "border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/5"
                          : "border border-[color:var(--mist)] bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-semibold tabular-nums text-[color:var(--ink)]">
                          {formatMoney(r.amountCents, r.currency)}
                        </span>
                        <Badge tone={refundStatusTone(r.status)}>
                          {r.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[12.5px] leading-5">
                        {dateTimeFormatter.format(new Date(r.createdAt))} · issued by{" "}
                        {r.initiatedBy ? r.initiatedBy.displayName : "no admin recorded"}
                        {r.reason ? ` · reason: ${r.reason.replace(/_/g, " ")}` : ""}
                      </p>
                      {r.failureReason ? (
                        <p className="mt-1 break-words font-mono text-[11.5px] leading-5 text-[color:var(--danger)]">
                          {r.failureReason}
                        </p>
                      ) : null}
                      {r.status !== "succeeded" ? (
                        <p className="mt-1 text-[12.5px] font-medium leading-5 text-[color:var(--ink)]">
                          {stopped
                            ? "Stripe stopped this one, so the money never left. It has to be issued again - here, or in the Stripe Dashboard."
                            : "Stripe has not settled this one yet. Run Sync from Stripe to pick up the outcome before issuing another."}
                        </p>
                      ) : null}
                      <p className="mt-1 break-all font-mono text-[11px] text-[color:var(--slate)]">
                        {r.stripeRefundId}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    // A charge id is ~28 unbreakable characters. Held next to a fixed 140px
    // label on a 380px phone it ran straight off the side, and because html and
    // body carry overflow-x: clip there was no sideways scroll to go and find
    // it - the end of the id an admin came here to read was simply gone. Stack
    // the label above the value on small screens and let the value wrap.
    <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-[140px_1fr] sm:gap-3">
      <span className="font-semibold text-[color:var(--slate)]">{k}</span>
      {/* Stripe IDs stay mono - they're data literals, not label voice - and
          break mid-token, since they have nowhere else to break. */}
      <span
        className={`min-w-0 text-[color:var(--ink)] ${mono ? "break-all font-mono" : "break-words font-medium"}`}
      >
        {v}
      </span>
    </div>
  );
}

function PayoutsView({ payouts }: { payouts: AdminPayoutRow[] }) {
  if (payouts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--paper)] px-6 py-12 text-center">
        <p className="text-sm text-[color:var(--slate)]">
          No payouts synced yet. Run <strong>Sync from Stripe</strong> to pull recent
          payouts from connected accounts.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-visible rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
      <div className="hidden grid-cols-[1fr_1.6fr_1fr_1fr_1fr_1.2fr] gap-4 border-b border-[color:var(--line)] px-5 py-3 text-xs font-semibold text-[color:var(--slate)] lg:grid">
        <span>Created</span>
        <span>Merchant</span>
        <span>Amount</span>
        <span>Status</span>
        <span>Arrival</span>
        <span>Payout</span>
      </div>
      {payouts.map((p) => (
        <div
          key={p.id}
          className="grid gap-3 border-b border-[color:var(--line)] px-5 py-4 text-sm text-[color:var(--slate)] last:border-0 lg:grid-cols-[1fr_1.6fr_1fr_1fr_1fr_1.2fr] lg:items-center"
        >
          <span>{dateOnlyFormatter.format(new Date(p.createdAt))}</span>
          <div>
            <p className="font-semibold text-[color:var(--ink)]">{p.merchantName ?? "—"}</p>
            <p className="font-mono text-[11px]">
              {truncate(p.stripeConnectAccountId)}
            </p>
          </div>
          <p className="font-semibold text-[color:var(--ink)]">
            {formatMoney(p.amountCents, p.currency)}
          </p>
          <div>
            <Badge tone={payoutStatusTone(p.status)}>
              {p.status.replace("_", " ")}
            </Badge>
            {p.failureMessage ? (
              <p className="mt-1 text-[11px]">{p.failureMessage}</p>
            ) : null}
          </div>
          <span className="text-xs">
            {p.arrivalDate ? dateOnlyFormatter.format(new Date(p.arrivalDate)) : "—"}
            {p.bankLast4 ? ` · •${p.bankLast4}` : ""}
          </span>
          <span className="font-mono text-[11px]">{truncate(p.stripePayoutId, 10, 4)}</span>
        </div>
      ))}
    </div>
  );
}

function ConnectAccountsView({ accounts }: { accounts: AdminConnectAccountRow[] }) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--paper)] px-6 py-12 text-center">
        <p className="text-sm text-[color:var(--slate)]">
          No merchants have a Stripe Connect account yet.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-visible rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
      <div className="hidden grid-cols-[1.6fr_1fr_1fr_1fr_1.2fr] gap-4 border-b border-[color:var(--line)] px-5 py-3 text-xs font-semibold text-[color:var(--slate)] lg:grid">
        <span>Merchant</span>
        <span>Charges</span>
        <span>Payouts</span>
        <span>Details</span>
        <span>Connect account</span>
      </div>
      {accounts.map((a) => (
        <div
          key={a.merchantProfileId}
          className="grid gap-3 border-b border-[color:var(--line)] px-5 py-4 text-sm text-[color:var(--slate)] last:border-0 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1.2fr] lg:items-center"
        >
          <div>
            <Link
              href={`/admin/merchants/${a.merchantProfileId}`}
              className="font-semibold text-[color:var(--ink)] hover:underline"
            >
              {a.businessName}
            </Link>
            <p className="text-[11px]">
              {a.verificationStatus}
            </p>
          </div>
          <CapabilityBadge enabled={a.chargesEnabled} label="charges" />
          <CapabilityBadge enabled={a.payoutsEnabled} label="payouts" />
          <CapabilityBadge enabled={a.detailsSubmitted} label="details" />
          <span className="font-mono text-xs">{truncate(a.stripeConnectAccountId, 10, 4)}</span>
        </div>
      ))}
    </div>
  );
}

function CapabilityBadge({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span className="inline-flex w-fit">
      <Badge tone={enabled ? "sage" : "neutral"}>
        {enabled ? `${label} on` : `${label} off`}
      </Badge>
    </span>
  );
}
