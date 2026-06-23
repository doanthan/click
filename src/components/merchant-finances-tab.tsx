import Link from "next/link";
import type { Session } from "next-auth";
import { after } from "next/server";
import { MetricCard, Pill } from "@/components/click-ui";
import { EmptyState } from "@/components/empty-state";
import { MerchantFinancesExport } from "@/components/merchant-finances-export";
import { MerchantFinancesAnalytics } from "@/components/merchant-finances-analytics";
import { StripeDashboardButton } from "@/components/stripe-dashboard-button";
import {
  getMerchantFinancesSummary,
  type MerchantFinancesSummary,
} from "@/lib/event-repository";
import { reconcilePendingTransactionsForMerchant } from "@/lib/stripe-sync";
import {
  TabHeader,
  dateTimeFormatter,
  formatPrice,
} from "./merchant-portal-shared";

// Payout-status row at the top of the Finances tab. Drives a five-state badge
// from the cached Connect capability columns and surfaces the right CTA for
// each state — same source of truth as the dashboard banner so the two views
// never disagree.
function PayoutStatusCard({
  connect,
}: {
  connect: MerchantFinancesSummary["connect"];
}) {
  let badgeTone: "rose" | "peach" | "aqua" | "cream" = "rose";
  let badgeLabel = "Not set up";
  let body = "Connect a Stripe account to accept paid bookings and get paid out automatically.";

  if (!connect.hasAccount) {
    badgeTone = "rose";
    badgeLabel = "Not set up";
    body = "Connect a Stripe account to accept paid bookings and get paid out automatically.";
  } else if (!connect.detailsSubmitted) {
    badgeTone = "rose";
    badgeLabel = "Onboarding incomplete";
    body = "Pick up where you left off in the hosted Stripe flow to finish connecting your bank.";
  } else if (!connect.chargesEnabled) {
    badgeTone = "aqua";
    badgeLabel = "Verification pending";
    body = "Stripe is reviewing your details. Once approved, paid events will accept bookings.";
  } else if (!connect.payoutsEnabled) {
    badgeTone = "peach";
    badgeLabel = "Charging only";
    body = "You can charge for events, but payouts to your bank aren't enabled yet — finish payout setup in Stripe.";
  } else {
    badgeTone = "peach";
    badgeLabel = "Active";
    body = "Payments route to your connected account and pay out on the monthly schedule.";
  }

  // Action varies by state: not-yet-charging merchants go back to the
  // onboarding wizard; live merchants get a Stripe-dashboard deep link.
  const ready = connect.hasAccount && connect.chargesEnabled;

  return (
    <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] hard-shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              Payouts
            </span>
            <Pill tone={badgeTone}>{badgeLabel}</Pill>
          </div>
          <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            {body}
          </p>
        </div>
        <div className="shrink-0">
          {ready ? (
            <StripeDashboardButton />
          ) : (
            <Link
              href="/merchant/onboarding/payouts"
              className="inline-flex items-center justify-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
            >
              {connect.hasAccount ? "Continue setup →" : "Connect Stripe →"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// Recent Stripe payouts from the connected account. Populated by the
// `payout.*` webhook in stripe-sync.ts; older history lives in the Express
// dashboard, one click away via <StripeDashboardButton />.
function RecentPayoutsCard({
  payouts,
}: {
  payouts: MerchantFinancesSummary["recentPayouts"];
}) {
  return (
    <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] hard-shadow-sm">
      <div className="border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-3">
        <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          Recent payouts
        </span>
      </div>
      {payouts.length === 0 ? (
        <p className="p-6 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          No payouts yet — Stripe pays out monthly once you have a connected
          balance. Past payouts will show up here.
        </p>
      ) : (
        <ul className="divide-y-2 divide-[color:var(--line-soft)]">
          {payouts.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0">
                <p className="font-bold text-[color:var(--ink)]">
                  {p.arrivalDate
                    ? dateTimeFormatter.format(new Date(p.arrivalDate))
                    : "Pending arrival"}
                </p>
                {p.bankLast4 ? (
                  <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                    Bank ····{p.bankLast4}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <Pill tone={p.status === "paid" ? "peach" : "rose"}>{p.status}</Pill>
                <span className="font-bold text-[color:var(--ink)]">
                  {formatPrice(p.amountCents)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function FinancesTabAsync({
  session,
}: {
  session: Session | null;
}) {
  // Self-heal any pending rows whose Stripe session is actually paid/expired.
  // Deferred with after() so the Stripe round-trip never blocks first paint —
  // we render the DB summary immediately and the reconcile runs after the
  // response is flushed (and, unlike a bare fire-and-forget, after() keeps it
  // anchored to the request on serverless so it's guaranteed to run). The
  // webhook + api/cron/reconcile-payments sweep remain the primary paths.
  after(() => reconcilePendingTransactionsForMerchant(session).catch(() => {}));
  const finances = await getMerchantFinancesSummary(session);

  return (
    <div className="space-y-8 py-10">
      <TabHeader
        eyebrow="Finances"
        title="Payouts + revenue."
        body="Click-managed paid events route through Stripe. Free events don’t appear here."
        action={<MerchantFinancesExport />}
      />
      <PayoutStatusCard connect={finances.connect} />
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <MetricCard label="Total" value={formatPrice(finances.totalRevenueCents)} tone="pink" />
        <MetricCard label="Paid" value={formatPrice(finances.paidRevenueCents)} tone="aqua" />
        <MetricCard label="Pending" value={formatPrice(finances.pendingRevenueCents)} tone="white" />
        <MetricCard label="Refunded" value={formatPrice(finances.refundedRevenueCents)} tone="white" />
      </div>
      <MerchantFinancesAnalytics monthlyRevenue={finances.monthlyRevenue} />
      <RecentPayoutsCard payouts={finances.recentPayouts} />
      {finances.recentTransactions.length === 0 ? (
        <EmptyState
          eyebrow="No transactions yet"
          title="Paid bookings will land here."
          body="Once someone pays for one of your Click-managed paid events, the charge shows up here and rolls into the totals above. Free events never appear in Finances."
          actionHref="/merchant/events/create"
          actionLabel="Create a paid event →"
        />
      ) : (
        <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] hard-shadow-sm">
          <div className="border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-3">
            <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              Recent transactions
            </span>
          </div>
          <ul className="divide-y-2 divide-[color:var(--line-soft)]">
            {finances.recentTransactions.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="font-bold text-[color:var(--ink)] truncate">
                    {t.eventTitle}
                  </p>
                  <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                    {dateTimeFormatter.format(new Date(t.createdAt))}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Pill tone={t.status === "paid" ? "peach" : "rose"}>{t.status}</Pill>
                  <span className="font-bold text-[color:var(--ink)]">
                    {formatPrice(t.amountCents)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
