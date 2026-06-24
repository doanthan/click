"use client";

import Link from "next/link";
import {
  useDeferredValue,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type {
  AdminConnectAccountRow,
  AdminPayoutRow,
  AdminTransactionRow,
} from "@/lib/event-repository";
import { EmptyState } from "@/components/empty-state";

// /admin/transactions client UI:
// • A 30-day default view of payment_transactions joined with event + attendee
//   + merchant. Filters: status pill, free-text search, merchant select.
// • KPI stickers across the top reflect the currently-filtered set so admins
//   can sanity-check what they're looking at, not raw totals.
// • Three tabs: Transactions (default), Payouts, Connect accounts.
// • "Sync from Stripe" button (top right) calls /api/admin/transactions/sync
//   and reloads the route on completion. Counts are shown briefly.
// • Row click opens an inline detail drawer with refund history + a refund
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
type Tab = "transactions" | "payouts" | "accounts";
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

function statusTone(status: string) {
  switch (status) {
    case "paid":
      return "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
    case "partially_refunded":
      return "bg-[color:var(--cream)] text-[color:var(--ink)]";
    case "refunded":
      return "bg-[color:var(--ink)] text-[color:var(--champagne)]";
    case "failed":
      return "bg-[color:var(--rose)] text-[color:var(--surface-deep)]";
    default:
      return "bg-[color:var(--champagne)] text-[color:var(--ink)]";
  }
}

function payoutStatusTone(status: string) {
  switch (status) {
    case "paid":
      return "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
    case "in_transit":
      return "bg-[color:var(--cream)] text-[color:var(--ink)]";
    case "failed":
      return "bg-[color:var(--rose)] text-[color:var(--surface-deep)]";
    case "canceled":
      return "bg-[color:var(--ink)] text-[color:var(--champagne)]";
    default:
      return "bg-[color:var(--champagne)] text-[color:var(--ink)]";
  }
}

function truncate(value: string | null, head = 8, tail = 4) {
  if (!value) return "—";
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function AdminTransactionsTable({
  initialTransactions,
  initialPayouts,
  connectAccounts,
  defaultDateFrom,
}: {
  initialTransactions: AdminTransactionRow[];
  initialPayouts: AdminPayoutRow[];
  connectAccounts: AdminConnectAccountRow[];
  defaultDateFrom: string;
}) {
  void defaultDateFrom;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("transactions");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [payouts] = useState(initialPayouts);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [merchantFilter, setMerchantFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncing, startSync] = useTransition();

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
      const net =
        t.transferAmountCents != null
          ? t.transferAmountCents
          : t.amountCents - (t.applicationFeeCents ?? 0);
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

  function runSync() {
    setSyncMessage("Syncing…");
    startSync(async () => {
      try {
        const res = await fetch("/api/admin/transactions/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sinceDays: 7, scope: "all" }),
        });
        const body = (await res.json()) as {
          ok?: boolean;
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
        setSyncMessage(
          `Synced: ${c.chargesSeen} charges seen · ${c.transactionsUpdated} txns updated · ${c.refundsUpserted} refunds · ${c.payoutsUpserted} payouts · ${c.accountsUpdated}/${c.accountsScanned} accounts · ${c.bookingsReconciled ?? 0} bookings confirmed`,
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
          <span className="sticker sticker--cream tilt-l-1 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--surface-deep)]" />
            Transactions
          </span>
          <h1 className="font-display mt-3 text-4xl font-bold leading-tight tracking-[-0.025em] text-[color:var(--ink)]">
            Stripe ledger
          </h1>
          <p className="mt-1 max-w-xl text-sm font-medium text-[color:var(--mauve)]">
            Last 30 days from <code className="font-mono">payment_transactions</code>. Use{" "}
            <strong>Sync from Stripe</strong> to backfill anything the webhook missed.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <button
            type="button"
            onClick={runSync}
            disabled={syncing}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm transition hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)] disabled:opacity-60"
          >
            {syncing ? "Syncing…" : "Sync from Stripe"}
          </button>
          {syncMessage ? (
            <p className="max-w-md text-right text-[0.7rem] font-bold text-[color:var(--mauve)]">
              {syncMessage}
            </p>
          ) : null}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Gross volume (filtered)" value={formatMoney(kpis.gross, "AUD")} note={`${kpis.paidCount} paid txns`} tilt="tilt-r-1" tone="peach" />
        <Kpi label="Refunded" value={formatMoney(kpis.refunded, "AUD")} note="includes partial refunds" tilt="tilt-l-1" tone="rose" />
        <Kpi label="Net to merchants" value={formatMoney(kpis.net, "AUD")} note="gross minus refunds" tilt="tilt-r-1" tone="cream" />
        <Kpi label="Platform fees" value={formatMoney(kpis.fees, "AUD")} note="from Stripe Connect" tilt="tilt-l-1" tone="champagne" />
      </section>

      <nav className="flex gap-2">
        {(
          [
            ["transactions", `Transactions (${transactions.length})`],
            ["payouts", `Payouts (${payouts.length})`],
            ["accounts", `Connect accounts (${connectAccounts.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-full border-2 border-[color:var(--line)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider hard-shadow-sm transition ${
              tab === value
                ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
                : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
            }`}
          >
            {label}
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
                    className={`rounded-full border-2 border-[color:var(--line)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider hard-shadow-sm transition ${
                      status === option.value
                        ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
                        : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
                    }`}
                  >
                    {option.label} <span className="opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={merchantFilter}
                onChange={(e) => setMerchantFilter(e.target.value)}
                className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-medium text-[color:var(--ink)]"
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
                className="w-full rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-medium text-[color:var(--ink)] placeholder:text-[color:var(--mauve)]/70 sm:w-80"
              />
            </div>
          </div>

          <div className="overflow-visible rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
            <div className="hidden grid-cols-[1.1fr_1.4fr_1.3fr_1.1fr_0.9fr_0.9fr_0.9fr_0.4fr] gap-4 bg-[color:var(--surface-deep)] px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--on-deep)] lg:grid">
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
                      ? "Nothing here for the current status, merchant or search. Clear the filters to see the full 30-day ledger."
                      : "No payment_transactions in the last 30 days. Run Sync from Stripe to backfill anything the webhook missed."
                  }
                  tone="rose"
                  action={
                    filtersActive ? (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--on-deep)] transition hard-shadow-sm hover:bg-black active:translate-y-px"
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
                      className="grid w-full gap-3 px-5 py-4 text-left text-sm font-medium text-[color:var(--mauve)] transition-colors hover:bg-[color:var(--cream)] lg:grid-cols-[1.1fr_1.4fr_1.3fr_1.1fr_0.9fr_0.9fr_0.9fr_0.4fr] lg:items-center"
                    >
                      <div>
                        <p className="font-black text-[color:var(--ink)]">
                          {d.dateLabel}
                        </p>
                        <p className="text-[0.65rem] uppercase tracking-wider">
                          {d.timeLabel}
                        </p>
                      </div>
                      <div>
                        <p className="font-black text-[color:var(--ink)]">
                          {t.eventTitle ?? "—"}
                        </p>
                        <p className="text-xs">{t.attendeeName ?? "(unknown)"}</p>
                        <p className="text-[0.65rem]">{t.attendeeEmail ?? ""}</p>
                      </div>
                      <div>
                        <p className="font-bold text-[color:var(--ink)]">
                          {t.merchantName ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="font-black text-[color:var(--ink)]">
                          {d.amountLabel}
                        </p>
                        <p className="text-[0.65rem] uppercase tracking-wider">{t.currency}</p>
                      </div>
                      <div>
                        <p className="text-[0.7rem]">
                          fee {d.feeLabel}
                        </p>
                        <p className="text-[0.7rem] font-bold text-[color:var(--ink)]">
                          net {d.netLabel}
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-[color:var(--ink)]">
                          {d.refundedLabel}
                        </p>
                      </div>
                      <div>
                        <span
                          className={`inline-flex rounded-full border-2 border-[color:var(--line)] px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider ${statusTone(t.status)}`}
                        >
                          {t.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="text-right text-[0.65rem] font-mono text-[color:var(--mauve)]">
                        {d.piLabel}
                      </div>
                    </button>

                    {isOpen ? (
                      <TransactionDetail
                        row={t}
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
        </>
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
  tilt,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tilt: string;
  tone: "peach" | "rose" | "cream" | "champagne";
}) {
  const bg =
    tone === "peach"
      ? "bg-[color:var(--peach)]"
      : tone === "rose"
        ? "bg-[color:var(--rose)]"
        : tone === "cream"
          ? "bg-[color:var(--cream)]"
          : "bg-[color:var(--champagne)]";
  return (
    <div className={`rounded-2xl border-2 border-[color:var(--line)] px-5 py-4 hard-shadow-sm ${bg} ${tilt}`}>
      <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[color:var(--surface-deep)]/80">
        {label}
      </p>
      <p className="font-display mt-1 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
        {value}
      </p>
      <p className="mt-1 text-[0.7rem] font-bold text-[color:var(--surface-deep)]/80">{note}</p>
    </div>
  );
}

// Inline detail drawer rendered under an expanded transaction row.
function TransactionDetail({
  row,
  onRefundComplete,
}: {
  row: AdminTransactionRow;
  onRefundComplete: (refundedAmountCents: number, newStatus: string) => void;
}) {
  const refundable = Math.max(row.amountCents - row.refundedAmountCents, 0);
  const [amount, setAmount] = useState<string>((refundable / 100).toFixed(2));
  const [reason, setReason] = useState<RefundReason | "">("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const refundable_lt_total = row.refundedAmountCents > 0;

  async function submit() {
    setError(null);
    setSuccess(null);
    const cents = Math.round(Number(amount.replace(/[^0-9.]/g, "")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Amount must be a positive number.");
      return;
    }
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
      setSuccess(
        `Refunded ${formatMoney(cents, row.currency)} — new status: ${body.refund.newStatus.replace("_", " ")}.`,
      );
      onRefundComplete(body.refund.refundedAmountCents, body.refund.newStatus);
      const newRefundable = Math.max(row.amountCents - body.refund.refundedAmountCents, 0);
      setAmount((newRefundable / 100).toFixed(2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const canRefund = refundable > 0 && (row.status === "paid" || row.status === "partially_refunded");

  return (
    <div className="border-t-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-5 text-sm text-[color:var(--mauve)]">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-[color:var(--ink)]">
            Details
          </p>
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
                <Link className="font-bold underline" href={`/events/${row.eventSlug}`}>
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
                  className="font-bold underline"
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
                  className="font-bold underline"
                  href={`/admin/members/${row.attendeeId}`}
                >
                  {row.attendeeName ?? row.attendeeEmail ?? "Open profile"}
                </Link>
              }
            />
          ) : null}
        </div>
        <div className="space-y-3">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-[color:var(--ink)]">
            Refund
          </p>
          {canRefund ? (
            <>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <label className="block text-xs font-bold text-[color:var(--ink)]">
                  Amount ({row.currency})
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1 w-full rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 font-mono text-sm font-bold"
                  />
                </label>
                <label className="block text-xs font-bold text-[color:var(--ink)]">
                  Reason
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as RefundReason | "")}
                    className="mt-1 w-full rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-medium"
                  >
                    <option value="">— select —</option>
                    <option value="requested_by_customer">Requested by customer</option>
                    <option value="duplicate">Duplicate</option>
                    <option value="fraudulent">Fraudulent</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="self-end rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)] disabled:opacity-60"
                >
                  {submitting ? "Refunding…" : "Issue refund"}
                </button>
              </div>
              <p className="text-[0.7rem] font-bold">
                Refundable: {formatMoney(refundable, row.currency)}{" "}
                {refundable_lt_total ? `(of ${formatMoney(row.amountCents, row.currency)})` : null}
              </p>
            </>
          ) : (
            <p className="text-[0.75rem] font-bold">
              {row.status === "refunded"
                ? "Fully refunded — no remaining balance."
                : row.status === "failed"
                  ? "Charge failed — nothing to refund."
                  : row.status === "pending"
                    ? "Charge not yet captured — refund unavailable."
                    : "Refund unavailable."}
            </p>
          )}
          {error ? (
            <p className="rounded-lg border-2 border-[color:var(--rose)] bg-[color:var(--rose)]/10 px-3 py-2 text-xs font-bold text-[color:var(--ink)]">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-lg border-2 border-[color:var(--peach)] bg-[color:var(--peach)]/30 px-3 py-2 text-xs font-bold text-[color:var(--ink)]">
              {success}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Detail({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-xs">
      <span className="font-black uppercase tracking-wider text-[color:var(--mauve)]">{k}</span>
      <span className={`text-[color:var(--ink)] ${mono ? "font-mono" : "font-medium"}`}>{v}</span>
    </div>
  );
}

function PayoutsView({ payouts }: { payouts: AdminPayoutRow[] }) {
  if (payouts.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] px-6 py-12 text-center hard-shadow-sm">
        <p className="font-bold text-[color:var(--mauve)]">
          No payouts synced yet. Run <strong>Sync from Stripe</strong> to pull recent
          payouts from connected accounts.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-visible rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
      <div className="hidden grid-cols-[1fr_1.6fr_1fr_1fr_1fr_1.2fr] gap-4 bg-[color:var(--surface-deep)] px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--on-deep)] lg:grid">
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
          className="grid gap-3 border-b border-[color:var(--line)] px-5 py-4 text-sm font-medium text-[color:var(--mauve)] last:border-0 lg:grid-cols-[1fr_1.6fr_1fr_1fr_1fr_1.2fr] lg:items-center"
        >
          <span>{dateOnlyFormatter.format(new Date(p.createdAt))}</span>
          <div>
            <p className="font-black text-[color:var(--ink)]">{p.merchantName ?? "—"}</p>
            <p className="text-[0.65rem] font-mono">
              {truncate(p.stripeConnectAccountId)}
            </p>
          </div>
          <p className="font-bold text-[color:var(--ink)]">
            {formatMoney(p.amountCents, p.currency)}
          </p>
          <div>
            <span
              className={`inline-flex rounded-full border-2 border-[color:var(--line)] px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider ${payoutStatusTone(p.status)}`}
            >
              {p.status.replace("_", " ")}
            </span>
            {p.failureMessage ? (
              <p className="mt-1 text-[0.65rem]">{p.failureMessage}</p>
            ) : null}
          </div>
          <span className="text-[0.75rem]">
            {p.arrivalDate ? dateOnlyFormatter.format(new Date(p.arrivalDate)) : "—"}
            {p.bankLast4 ? ` · •${p.bankLast4}` : ""}
          </span>
          <span className="font-mono text-[0.65rem]">{truncate(p.stripePayoutId, 10, 4)}</span>
        </div>
      ))}
    </div>
  );
}

function ConnectAccountsView({ accounts }: { accounts: AdminConnectAccountRow[] }) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] px-6 py-12 text-center hard-shadow-sm">
        <p className="font-bold text-[color:var(--mauve)]">
          No merchants have a Stripe Connect account yet.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-visible rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
      <div className="hidden grid-cols-[1.6fr_1fr_1fr_1fr_1.2fr] gap-4 bg-[color:var(--surface-deep)] px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--on-deep)] lg:grid">
        <span>Merchant</span>
        <span>Charges</span>
        <span>Payouts</span>
        <span>Details</span>
        <span>Connect account</span>
      </div>
      {accounts.map((a) => (
        <div
          key={a.merchantProfileId}
          className="grid gap-3 border-b border-[color:var(--line)] px-5 py-4 text-sm font-medium text-[color:var(--mauve)] last:border-0 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1.2fr] lg:items-center"
        >
          <div>
            <Link
              href={`/admin/merchants/${a.merchantProfileId}`}
              className="font-black text-[color:var(--ink)] hover:underline"
            >
              {a.businessName}
            </Link>
            <p className="text-[0.65rem] uppercase tracking-wider">
              {a.verificationStatus}
            </p>
          </div>
          <CapabilityBadge enabled={a.chargesEnabled} label="charges" />
          <CapabilityBadge enabled={a.payoutsEnabled} label="payouts" />
          <CapabilityBadge enabled={a.detailsSubmitted} label="details" />
          <span className="font-mono text-[0.7rem]">{truncate(a.stripeConnectAccountId, 10, 4)}</span>
        </div>
      ))}
    </div>
  );
}

function CapabilityBadge({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full border-2 border-[color:var(--line)] px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider ${
        enabled
          ? "bg-[color:var(--peach)] text-[color:var(--surface-deep)]"
          : "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
      }`}
    >
      <span className={`size-1.5 rounded-full ${enabled ? "bg-[color:var(--surface-deep)]" : "bg-[color:var(--champagne)]"}`} />
      {enabled ? `${label} on` : `${label} off`}
    </span>
  );
}
