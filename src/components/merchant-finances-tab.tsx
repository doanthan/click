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
import { formatMoney } from "@/lib/amounts";
import { FINANCES_PERIOD_PHRASE, type FinancesPeriod } from "@/lib/finances-period";
import {
  TabHeader,
  dateTimeFormatter,
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
        body: "Connect a Stripe account to accept paid bookings and get paid after each event.",
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
            label: "Payments not on",
            body: "Paid events can't take bookings until Stripe switches payments on. See what Stripe still needs - often nothing, while it checks what you sent.",
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
              // We own the cadence now: payouts are manual on every host account
              // (holdPayouts) and api/cron/release-payouts sends each event's
              // earnings PAYOUT_RELEASE_DELAY_HOURS after it ends. The host
              // must not be told they can change it - the cron sets it back.
              body: "Payments route to your connected account and are held until your event has run. Each event's earnings go to your bank a couple of days after it ends - you can see every payout in your Stripe dashboard.",
            };

  const ready = connect.hasAccount && connect.chargesEnabled && connect.payoutsEnabled;
  // The Express dashboard opens for any account whose onboarding is done - so a
  // host whose payments Stripe has PAUSED keeps it. It used to vanish exactly
  // then, the one time they most needed their Stripe dashboard.
  const canOpenDashboard = connect.hasAccount && connect.detailsSubmitted;

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
      <div className="flex shrink-0 flex-wrap gap-2">
        {!ready ? (
          <ButtonLink
            href={`/merchant/onboarding/payouts?returnTo=${encodeURIComponent("/merchant?tab=finances")}`}
            size="sm"
          >
            {!connect.hasAccount
              ? "Connect Stripe"
              : connect.detailsSubmitted
                ? "See what Stripe needs"
                : "Continue setup"}
          </ButtonLink>
        ) : null}
        {canOpenDashboard ? <StripeDashboardButton /> : null}
      </div>
    </div>
  );
}

// The per-ACCOUNT half of "where is my money" (fix 25): each bank payout and
// what the bank has done with it, from Stripe. Written by releaseHeldPayouts and
// the `payout.*` webhook in stripe-sync.ts; older history lives in the Express
// dashboard, one click away via <StripeDashboardButton />.
const PAYOUT_STATUS_WORDS: Record<string, { label: string; tone: "sage" | "amber" | "coral" | "neutral" }> = {
  pending: { label: "On the way", tone: "amber" },
  in_transit: { label: "On the way", tone: "amber" },
  paid: { label: "Paid", tone: "sage" },
  failed: { label: "Failed", tone: "coral" },
  canceled: { label: "Cancelled", tone: "neutral" },
};
function RecentPayoutsCard({
  payouts,
}: {
  payouts: MerchantFinancesSummary["recentPayouts"];
}) {
  return (
    <div className={`${mCard} flex flex-col gap-3 px-5 py-4`}>
      <span className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-[color:var(--ink-faint)]">
        Bank payouts
      </span>
      {payouts.length === 0 ? (
        <p className="text-[13.5px] leading-relaxed text-[color:var(--slate)]">
          No payouts yet - each event&apos;s earnings go to your bank a couple of days after it ends.
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
                    ? `${p.status === "paid" ? "Arrived" : "Arrives"} ${dayFormatter.format(new Date(p.arrivalDate))}`
                    : "Arrival date to come"}
                  {p.bankLast4 ? ` · bank ····${p.bankLast4}` : ""}
                </p>
              </div>
              {/* Sage = money-good (paid), amber = on its way, coral = failed. */}
              <Badge tone={(PAYOUT_STATUS_WORDS[p.status] ?? PAYOUT_STATUS_WORDS.pending).tone}>
                {(PAYOUT_STATUS_WORDS[p.status] ?? PAYOUT_STATUS_WORDS.pending).label}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const dayFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Australia/Sydney",
});

// The per-EVENT half of "where is my money" (fix 25): each event's share and
// where it sits on the hold rule the payout run uses (eventMoneyState). Bank
// status is the payouts card's job - one payout can cover several events, so
// "paid" per event would be a guess.
function EventEarningsCard({
  events,
}: {
  events: MerchantFinancesSummary["eventEarnings"];
}) {
  if (events.length === 0) return null;
  return (
    <div className={`${mCard} flex flex-col gap-3 px-5 py-4`}>
      <span className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-[color:var(--ink-faint)]">
        Earnings by event
      </span>
      <p className="text-[12.5px] leading-relaxed text-[color:var(--slate)]">
        Held until a couple of days after each event (80 days at most), then sent in the next bank payout.
      </p>
      <ul className="flex flex-col gap-2.5">
        {events.map((e, i) => (
          <li
            key={e.eventSlug}
            className={`flex flex-wrap items-center justify-between gap-3 ${
              i < events.length - 1 ? "border-b border-[color:var(--mist)] pb-2.5" : ""
            }`}
          >
            <div className="min-w-0 flex-[1_1_160px]">
              <p className="truncate text-[13.5px] font-semibold text-[color:var(--ink)]">{e.eventTitle}</p>
              <p className="text-xs text-[color:var(--slate)]">{dayFormatter.format(new Date(e.startsAt))}</p>
            </div>
            <span className="text-[13.5px] font-semibold tabular-nums text-[color:var(--ink)]">
              {formatMoney(e.netCents)}
            </span>
            {e.state === "held" ? (
              <Badge tone="amber">
                {e.releaseAt ? `Held until ${dayFormatter.format(new Date(e.releaseAt))}` : "Held"}
              </Badge>
            ) : e.state === "held_for_refunds" ? (
              <Badge tone="neutral">
                {e.releaseAt ? `Held for refunds until ${dayFormatter.format(new Date(e.releaseAt))}` : "Held for refunds"}
              </Badge>
            ) : (
              <Badge tone="sage">Released</Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function FinancesTabAsync({
  session,
  period,
}: {
  session: Session | null;
  // Scopes the four tiles and the transaction list (bug board #331). The
  // revenue chart and the payouts card keep their own spans.
  period: FinancesPeriod;
}) {
  // Self-heal any pending rows whose Stripe session is actually paid/expired.
  // Deferred with after() so the Stripe round-trip never blocks first paint -
  // we render the DB summary immediately and the reconcile runs after the
  // response is flushed (and, unlike a bare fire-and-forget, after() keeps it
  // anchored to the request on serverless so it's guaranteed to run). The
  // webhook + api/cron/reconcile-payments sweep remain the primary paths.
  after(() => reconcilePendingTransactionsForMerchant(session).catch(() => {}));
  const finances = await getMerchantFinancesSummary(session, period);

  const hasRevenue = finances.collectedCents > 0;
  const scope = FINANCES_PERIOD_PHRASE[period];

  return (
    <div className="space-y-6 py-8">
      <TabHeader
        eyebrow="Finances"
        title="Sales + payouts."
        body="Paid events route through Stripe; free events never appear here."
        action={<MerchantFinancesExport key={period} period={period} />}
      />

      <div className="rise-soft rise-d1">
        <PayoutStatusCard connect={finances.connect} />
      </div>

      {/* Money is never "Free" - a $0 tile is "$0" with the scope in its note.
          The first three tiles reconcile left to right in the HOST's terms
          (fix 23): their ticket sales, minus Click's commission, is their net.
          The headline used to be the buyers' gross, booking fee included - a
          fee the host never receives - so it was not a number they recognised.
          The booking fee, when there is one, is a note under the row. */}
      <div className="grid gap-3 rise-soft rise-d2 sm:grid-cols-2 md:grid-cols-4">
        <StatCard
          hero
          label="Ticket sales"
          value={formatMoney(finances.ticketSalesCents)}
          note={
            hasRevenue
              ? "your ticket prices, after refunds"
              : period === "all"
                ? "free events so far"
                : `no paid bookings ${scope}`
          }
        />
        <StatCard
          label="Click commission"
          value={formatMoney(finances.commissionCents)}
          note="taken from each ticket"
        />
        <StatCard
          label="Your net"
          value={formatMoney(finances.netCents)}
          note="ticket sales minus commission"
        />
        <StatCard
          label="Refunded"
          value={formatMoney(finances.refundedCents)}
          note={scope}
        />
      </div>
      {finances.bookingFeeCents > 0 ? (
        <p className="-mt-3 text-[12.5px] text-[color:var(--slate)] rise-soft rise-d2">
          Guests also paid {formatMoney(finances.bookingFeeCents)} in booking fees {scope}, kept by Click - not part
          of your sales.
        </p>
      ) : null}

      <div className="grid gap-3 rise-soft rise-d3 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <MerchantFinancesAnalytics monthlyRevenue={finances.monthlyRevenue} />
        <div className="flex flex-col gap-3">
          <EventEarningsCard events={finances.eventEarnings} />
          <RecentPayoutsCard payouts={finances.recentPayouts} />
        </div>
      </div>

      {finances.recentTransactions.length === 0 && period !== "all" ? (
        <MerchantEmpty
          icon="ticket"
          title={`No paid bookings ${scope}.`}
          body="Pick another period above, or All time, to see the rest of your charges."
        />
      ) : finances.recentTransactions.length === 0 ? (
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
                    {t.eventTitle} · {dayFormatter.format(new Date(t.eventStartsAt))}
                  </p>
                  <p className="text-xs text-[color:var(--slate)]">
                    Booked {dateTimeFormatter.format(new Date(t.createdAt))} ·{" "}
                    {t.refundedCents > 0 ? "after refunds, " : ""}ticket {formatMoney(t.ticketCents)}
                    {t.bookingFeeCents > 0 ? ` + booking fee ${formatMoney(t.bookingFeeCents)}` : ""} · commission{" "}
                    {formatMoney(t.commissionCents)}
                    {t.refundedCents > 0 ? ` · refunded ${formatMoney(t.refundedCents)}` : ""}
                  </p>
                </div>
                <span className="text-right">
                  <span className="block text-[13.5px] font-semibold tabular-nums text-[color:var(--ink)]">
                    {formatMoney(t.netCents)}
                  </span>
                  <span className="block text-[11px] text-[color:var(--slate)]">your net</span>
                </span>
                <Badge tone={t.status === "paid" ? "sage" : t.status === "refunded" ? "neutral" : "amber"}>
                  {t.status === "partially_refunded" ? "part refunded" : t.status}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
