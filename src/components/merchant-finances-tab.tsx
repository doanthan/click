import type { Session } from "next-auth";
import { after } from "next/server";
import { Avatar, Badge, ButtonLink, Icon } from "@/components/ds";
import { MerchantEmpty, StatCard, mCard } from "@/components/merchant-ds";
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
  formatMoney,
} from "./merchant-portal-shared";

// Payout-status row at the top of the Finances tab. Drives a five-state badge
// from the cached Connect capability columns and surfaces the right CTA for
// each state - same source of truth as the dashboard banner so the two views
// never disagree. Colour roles: Sage = money-good (connected), Amber = waiting,
// neutral = not started. Never a status colour on the CTA itself.
function PayoutStatusCard({
  connect,
}: {
  connect: MerchantFinancesSummary["connect"];
}) {
  const state = !connect.hasAccount
    ? {
        tone: "neutral" as const,
        label: "Not set up",
        body: "Connect a Stripe account to accept paid bookings and get paid out automatically.",
      }
    : !connect.detailsSubmitted
      ? {
          tone: "amber" as const,
          label: "Onboarding incomplete",
          body: "Pick up where you left off in the hosted Stripe flow to finish connecting your bank.",
        }
      : !connect.chargesEnabled
        ? {
            tone: "amber" as const,
            label: "Verification pending",
            body: "Stripe is reviewing your details. Once approved, paid events will accept bookings.",
          }
        : !connect.payoutsEnabled
          ? {
              tone: "amber" as const,
              label: "Charging only",
              body: "You can charge for events, but payouts to your bank aren't enabled yet - finish payout setup in Stripe.",
            }
          : {
              tone: "sage" as const,
              label: "Connected",
              // Nothing in this codebase sets payout_schedule on the connected
              // account, so the cadence is whatever Stripe defaults to for the
              // host's country - naming a schedule we do not set was a promise
              // we could not keep. Stripe owns it, so point at Stripe.
              body: "Payments route to your connected account. Stripe pays out to your bank on its own schedule - you can see and change it in your Stripe dashboard.",
            };

  const ready = connect.hasAccount && connect.chargesEnabled;

  return (
    <div className={`${mCard} flex flex-wrap items-center gap-3.5 px-5 py-4`}>
      <span
        className={`flex size-10 flex-none items-center justify-center rounded-xl ${
          state.tone === "sage"
            ? "bg-[color-mix(in_srgb,var(--sage)_14%,var(--paper))] text-[color:var(--sage)]"
            : "bg-[color:var(--lavender-100)] text-[color:var(--purple)]"
        }`}
      >
        <Icon name={state.tone === "sage" ? "check" : "lock"} size={19} />
      </span>
      <div className="min-w-[180px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14.5px] font-semibold text-[color:var(--ink)]">Payouts</span>
          <Badge tone={state.tone}>{state.label}</Badge>
        </div>
        <p className="mt-0.5 text-[13px] leading-relaxed text-[color:var(--slate)]">{state.body}</p>
      </div>
      <div className="shrink-0">
        {ready ? (
          <StripeDashboardButton />
        ) : (
          <ButtonLink
            href={`/merchant/onboarding/payouts?returnTo=${encodeURIComponent("/merchant?tab=finances")}`}
            size="sm"
          >
            {connect.hasAccount ? "Continue setup" : "Connect Stripe"}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

// Recent Stripe payouts from the connected account. Populated by the `payout.*`
// webhook in stripe-sync.ts; older history lives in the Express dashboard, one
// click away via <StripeDashboardButton />.
function RecentPayoutsCard({
  payouts,
}: {
  payouts: MerchantFinancesSummary["recentPayouts"];
}) {
  return (
    <div className={`${mCard} flex flex-col gap-3 px-5 py-4`}>
      <span className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-[color:var(--ink-faint)]">
        Recent payouts
      </span>
      {payouts.length === 0 ? (
        <p className="text-[13.5px] leading-relaxed text-[color:var(--slate)]">
          No payouts yet - Stripe pays out once you have a connected balance.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {payouts.map((p, i) => (
            <li
              key={p.id}
              className={`flex flex-wrap items-center justify-between gap-3 ${
                i < payouts.length - 1 ? "border-b border-[color:var(--mist)] pb-2.5" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold tabular-nums text-[color:var(--ink)]">
                  {formatMoney(p.amountCents)}
                </p>
                <p className="text-xs text-[color:var(--slate)]">
                  {p.arrivalDate
                    ? dateTimeFormatter.format(new Date(p.arrivalDate))
                    : "Pending arrival"}
                  {p.bankLast4 ? ` · bank ····${p.bankLast4}` : ""}
                </p>
              </div>
              {/* Sage = money-good (paid). Anything else is still waiting. */}
              <Badge tone={p.status === "paid" ? "sage" : "amber"}>{p.status}</Badge>
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
  // Deferred with after() so the Stripe round-trip never blocks first paint -
  // we render the DB summary immediately and the reconcile runs after the
  // response is flushed (and, unlike a bare fire-and-forget, after() keeps it
  // anchored to the request on serverless so it's guaranteed to run). The
  // webhook + api/cron/reconcile-payments sweep remain the primary paths.
  after(() => reconcilePendingTransactionsForMerchant(session).catch(() => {}));
  const finances = await getMerchantFinancesSummary(session);

  const hasRevenue = finances.collectedCents > 0;

  return (
    <div className="space-y-6 py-8">
      <TabHeader
        eyebrow="Finances"
        title="Payouts + revenue."
        body="Paid events route through Stripe; free events never appear here."
        action={<MerchantFinancesExport />}
      />

      <div className="rise-soft rise-d1">
        <PayoutStatusCard connect={finances.connect} />
      </div>

      {/* Money is never "Free" - a $0 tile is "$0" with the scope in its note.
          The first three tiles reconcile left to right: what buyers paid, minus
          Click's cut, is what reaches the host's bank. That is the whole point
          of the row - "Paid out - to your bank" used to sit on the GROSS buyer
          charge, so a host budgeted on a number Stripe never deposited. */}
      <div className="grid gap-3 rise-soft rise-d2 sm:grid-cols-2 md:grid-cols-4">
        <StatCard
          hero
          label="Collected"
          value={formatMoney(finances.collectedCents)}
          note={hasRevenue ? "buyers paid, after refunds" : "free events so far"}
        />
        <StatCard
          label="Click fee"
          value={formatMoney(finances.platformFeeCents)}
          note="commission + booking fee"
        />
        <StatCard
          label="Your net"
          value={formatMoney(finances.netCents)}
          note="reaches your Stripe balance"
        />
        <StatCard
          label="Refunded"
          value={formatMoney(finances.refundedCents)}
          note="all time"
        />
      </div>

      <div className="grid gap-3 rise-soft rise-d3 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <MerchantFinancesAnalytics monthlyRevenue={finances.monthlyRevenue} />
        <RecentPayoutsCard payouts={finances.recentPayouts} />
      </div>

      {finances.recentTransactions.length === 0 ? (
        <MerchantEmpty
          icon="ticket"
          title="Paid bookings will land here."
          body="Once someone pays for one of your paid events, the charge shows up here and rolls into the totals above. Free events never appear in Finances."
        />
      ) : (
        <div className={`${mCard} overflow-hidden`}>
          <div className="border-b border-[color:var(--mist)] px-5 py-3 text-[11.5px] font-bold uppercase tracking-[0.09em] text-[color:var(--ink-faint)]">
            Recent transactions
          </div>
          <ul>
            {finances.recentTransactions.map((t, i) => (
              <li
                key={t.id}
                className={`flex flex-wrap items-center gap-3 px-5 py-3 ${
                  i > 0 ? "border-t border-[color:var(--mist)]" : ""
                }`}
              >
                <Avatar name={t.eventTitle} size={30} />
                <div className="min-w-0 flex-[1_1_140px]">
                  <p className="truncate text-[13.5px] font-semibold text-[color:var(--ink)]">
                    {t.eventTitle}
                  </p>
                  <p className="text-xs text-[color:var(--slate)]">
                    {dateTimeFormatter.format(new Date(t.createdAt))}
                  </p>
                </div>
                <span className="text-[13.5px] font-semibold tabular-nums text-[color:var(--ink)]">
                  {formatMoney(t.amountCents)}
                </span>
                <Badge tone={t.status === "paid" ? "sage" : t.status === "refunded" ? "neutral" : "amber"}>
                  {t.status}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
