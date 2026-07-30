import Link from "next/link";
import { ButtonLink, Icon } from "@/components/ds";
import {
  CapacityMeter,
  InfoNote,
  MerchantEmpty,
  SectionLabel,
  StatCard,
  StatusPill,
  mCard,
  mTint,
} from "@/components/merchant-ds";
import { MerchantCalendar } from "@/components/merchant-calendar";
import {
  CreateEventButton,
  TabHeader,
  formatMoney,
  type MerchantEvent,
} from "./merchant-portal-shared";

const whenFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Sydney",
});

const monthFormatter = new Intl.DateTimeFormat("en-AU", {
  month: "long",
  timeZone: "Australia/Sydney",
});

export function DashboardTab({
  merchantEvents,
  monthParam,
  businessName,
  payoutsEnabled,
  chargesEnabled,
  attendeeOnboarded,
  attendingCount,
}: {
  merchantEvents: MerchantEvent[];
  monthParam?: string;
  businessName: string;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  attendeeOnboarded: boolean;
  attendingCount: number;
}) {
  // eslint-disable-next-line react-hooks/purity -- async server component, evaluated once per request
  const now = Date.now();
  const upcoming = merchantEvents.filter(
    (event) =>
      event.status !== "Cancelled" &&
      event.status !== "Rejected" &&
      new Date(event.startsAt).getTime() >= now,
  );
  const upcomingCount = upcoming.length;

  const totalConfirmed = merchantEvents.reduce((sum, e) => sum + e.confirmed, 0);
  const totalRevenueCents = merchantEvents.reduce(
    (sum, e) => sum + e.priceCents * e.confirmed,
    0,
  );
  const totalWaitlisted = merchantEvents.reduce((sum, e) => sum + e.waitlisted, 0);

  // Fill rate is scoped to UPCOMING events ONLY - blending it with sold-out past
  // events flatters the number into meaninglessness (a host can't act on a past
  // event's fill). "-" when there's nothing upcoming to fill.
  const upcomingCapacity = upcoming.reduce((sum, e) => sum + e.capacity, 0);
  const upcomingConfirmed = upcoming.reduce((sum, e) => sum + e.confirmed, 0);
  const fillRate =
    upcomingCapacity > 0 ? `${Math.round((upcomingConfirmed / upcomingCapacity) * 100)}%` : "-";

  // Whether any paid event has ever sold - drives the honest revenue scope note.
  const hasPaidEvent = merchantEvents.some((e) => e.priceCents > 0);
  const nextEvent = upcoming
    .slice()
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

  const showWelcome = merchantEvents.length === 0;
  const monthLabel = monthFormatter.format(new Date(now));

  // ONE "Create event" CTA in the content column. A brand-new host gets it in
  // the welcome card (the thing they're actually reading); everyone else gets it
  // in the page header. It is never in both, and never also in a banner.
  const headerAction = showWelcome ? undefined : <CreateEventButton />;

  return (
    <div className="space-y-7 py-8">
      <SetupProgress
        chargesEnabled={chargesEnabled}
        payoutsEnabled={payoutsEnabled}
        hasEvents={merchantEvents.length > 0}
      />
      {showWelcome ? <WelcomeToClick businessName={businessName} /> : null}

      <TabHeader
        eyebrow="Overview"
        title={
          upcomingCount > 0
            ? `${upcomingCount} upcoming event${upcomingCount === 1 ? "" : "s"}.`
            : "Your hosting dashboard."
        }
        body="Bookings and revenue across all your events, plus the month's calendar below."
        action={headerAction}
      />

      {!showWelcome ? (
        <section className="space-y-2.5">
          <SectionLabel>{monthLabel} at a glance</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {/* Exactly ONE hero (Deep Purple) tile in the row. */}
            <StatCard
              hero
              label="Upcoming"
              value={String(upcomingCount)}
              note={
                nextEvent
                  ? `next: ${whenFormatter.format(new Date(nextEvent.startsAt))}`
                  : "none scheduled yet"
              }
            />
            <StatCard
              label="Confirmed RSVPs"
              value={String(totalConfirmed)}
              note="all events to date"
            />
            <StatCard
              label="Fill rate"
              value={fillRate}
              note={upcomingCapacity > 0 ? "upcoming events only" : "no upcoming events"}
            />
            {/* Money is never "Free": $0 with the scope spelled out. */}
            <StatCard
              label="Revenue"
              value={formatMoney(totalRevenueCents)}
              note={
                totalRevenueCents > 0
                  ? "paid events to date"
                  : hasPaidEvent
                    ? "no paid bookings yet"
                    : "free events so far"
              }
            />
          </div>
          {totalWaitlisted > 0 ? (
            <p className="text-xs text-[color:var(--slate)]">
              + {totalWaitlisted} on the waitlist across your events
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Hosts are people too - nudge them onto the attendee side. Sits high on
          the dashboard (bug board #147: it used to hide at the very bottom). */}
      {!attendeeOnboarded || attendingCount === 0 ? (
        <section
          className={`${mTint} flex flex-wrap items-center justify-between gap-4 px-5 py-4`}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[color:var(--ink)]">
              Want to attend events too?
            </p>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[color:var(--ink-soft)]">
              {attendeeOnboarded
                ? "Your host account can also book and attend events on Click. Browse what's on near you."
                : "Set up your attendee profile in a couple of minutes to start booking events as a guest."}
            </p>
          </div>
          <ButtonLink
            href={attendeeOnboarded ? "/discover" : "/onboarding"}
            variant="secondary"
            size="sm"
          >
            {attendeeOnboarded ? "Browse events" : "Set up attendee profile"}
            <Icon name="arrowR" size={15} />
          </ButtonLink>
        </section>
      ) : null}

      {/* Your events - the primary working surface, so it sits above the calendar. */}
      {merchantEvents.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionLabel>Your events</SectionLabel>
            <ButtonLink href="/merchant?tab=events" variant="ghost" size="sm">
              View all events
            </ButtonLink>
          </div>
          {upcomingCount > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {upcoming.slice(0, 6).map((event) => (
                <Link
                  key={event.slug}
                  href={`/merchant/events/${event.slug}`}
                  className={`${mCard} flex flex-col gap-2.5 p-4 transition-shadow hover:shadow-[var(--shadow-md)]`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display min-w-0 text-[15.5px] font-semibold leading-[1.25] text-[color:var(--ink)]">
                      {event.title}
                    </span>
                    <StatusPill status={event.status} />
                  </div>
                  <span className="truncate text-[12.5px] text-[color:var(--slate)]">
                    {whenFormatter.format(new Date(event.startsAt))} · {event.locationName},{" "}
                    {event.suburb}
                  </span>
                  <CapacityMeter
                    confirmed={event.confirmed}
                    cap={event.capacity}
                    maxWidth={null}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <MerchantEmpty
              title="No upcoming events."
              body="Your past events are in the Events tab. Ready for the next one?"
            />
          )}
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionLabel>Calendar</SectionLabel>
        <MerchantCalendar events={merchantEvents} monthParam={monthParam} />
      </section>

      {merchantEvents.length > 0 ? (
        <MerchantTrends merchantEvents={merchantEvents} />
      ) : null}

      {merchantEvents.length > 0 ? (
        <ConfirmedRsvpChart merchantEvents={merchantEvents} />
      ) : null}
    </div>
  );
}

// Trend + pattern visualisations folded into the dashboard: monthly revenue &
// bookings over time (so a merchant can see whether they're growing) and a
// category mix breakdown. Computed from the already-loaded merchantEvents — no
// extra query. Months are bucketed in Sydney time to line up with the calendar.
function MerchantTrends({
  merchantEvents,
}: {
  merchantEvents: MerchantEvent[];
}) {
  const monthKeyFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
  });
  const monthLabelFormatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    month: "short",
    year: "2-digit",
  });

  // Bucket events by Sydney month.
  const byMonth = new Map<
    string,
    { label: string; revenueCents: number; confirmed: number; events: number; sort: number }
  >();
  for (const e of merchantEvents) {
    const d = new Date(e.startsAt);
    const key = monthKeyFormatter.format(d); // e.g. "2026-06"
    const entry =
      byMonth.get(key) ??
      {
        label: monthLabelFormatter.format(d),
        revenueCents: 0,
        confirmed: 0,
        events: 0,
        sort: Number(key.replace("-", "")),
      };
    entry.revenueCents += e.priceCents * e.confirmed;
    entry.confirmed += e.confirmed;
    entry.events += 1;
    byMonth.set(key, entry);
  }
  // Most recent 6 months that have events, chronological.
  const months = Array.from(byMonth.values())
    .sort((a, b) => a.sort - b.sort)
    .slice(-6);
  const maxRevenue = Math.max(...months.map((m) => m.revenueCents), 1);
  const maxConfirmed = Math.max(...months.map((m) => m.confirmed), 1);
  const latestKey = months.length ? months[months.length - 1].label : "";

  // Category mix.
  const byCategory = new Map<string, number>();
  for (const e of merchantEvents) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.confirmed);
  }
  const categories = Array.from(byCategory.entries())
    .map(([category, confirmed]) => ({ category, confirmed }))
    .sort((a, b) => b.confirmed - a.confirmed)
    .slice(0, 6);
  const maxCategory = Math.max(...categories.map((c) => c.confirmed), 1);

  return (
    <section className="grid gap-3 lg:grid-cols-2">
      {/* Monthly revenue + bookings trend */}
      <div className={`${mCard} p-5`}>
        <span className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-[color:var(--ink-faint)]">
          Revenue & bookings by month
        </span>
        {/* Columns must STRETCH to the row height (no items-end here): the bar
            wrapper is flex-1 of the column, and the bars' % heights resolve
            against it. With items-end the columns collapsed to label height and
            every bar rendered 0px tall (bug board #158). */}
        <div className="mt-5 flex items-stretch justify-between gap-2" style={{ height: "150px" }}>
          {months.map((m) => (
            <div
              key={m.label}
              className="group relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1 focus:outline-none"
              tabIndex={0}
              role="img"
              aria-label={`${m.label}: ${formatMoney(m.revenueCents)} revenue, ${m.confirmed} booking${m.confirmed === 1 ? "" : "s"}`}
            >
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-xl bg-[color:var(--paper)] px-2.5 py-1.5 text-center opacity-0 shadow-[var(--shadow-md)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                <span className="block text-[11px] font-semibold text-[color:var(--slate)]">
                  {m.label}
                </span>
                <span className="font-display block text-[13px] font-semibold tabular-nums text-[color:var(--purple)]">
                  {formatMoney(m.revenueCents)}
                </span>
                <span className="block text-[12px] tabular-nums text-[color:var(--ink)]">
                  {m.confirmed} booking{m.confirmed === 1 ? "" : "s"}
                </span>
              </div>
              <span className="text-[11px] font-semibold tabular-nums text-[color:var(--slate)]">
                {formatMoney(m.revenueCents)}
              </span>
              <div className="flex w-full flex-1 items-end justify-center gap-1">
                <div
                  className={`w-1/2 rounded-t ${m.label === latestKey ? "bg-[color:var(--purple-600)]" : "bg-[color:var(--lavender-300)]"}`}
                  style={{ height: `${Math.max((m.revenueCents / maxRevenue) * 100, 3)}%` }}
                />
                <div
                  className="w-1/2 rounded-t bg-[color:var(--purple-200)]"
                  style={{ height: `${Math.max((m.confirmed / maxConfirmed) * 100, 3)}%` }}
                />
              </div>
              <span className="text-[11px] text-[color:var(--ink-faint)]">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-4 text-[11.5px] text-[color:var(--slate)]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-[color:var(--lavender-300)]" /> Revenue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-[color:var(--purple-200)]" /> Bookings
          </span>
        </div>
      </div>

      {/* Category mix */}
      <div className={`${mCard} p-5`}>
        <span className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-[color:var(--ink-faint)]">
          Bookings by category
        </span>
        <ul className="mt-5 space-y-3">
          {categories.map((c) => (
            <li key={c.category}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-semibold text-[color:var(--ink)]">
                  {c.category}
                </span>
                <span className="text-[12.5px] tabular-nums text-[color:var(--slate)]">
                  {c.confirmed}
                </span>
              </div>
              <div className="mt-1.5 h-[5px] w-full overflow-hidden rounded-full bg-[color:var(--lavender-100)]">
                <div
                  className="h-full rounded-full bg-[color:var(--purple-500)]"
                  style={{ width: `${Math.max((c.confirmed / maxCategory) * 100, 4)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// Per-event RSVP bar list, folded in from the old Analytics tab.
function ConfirmedRsvpChart({
  merchantEvents,
}: {
  merchantEvents: MerchantEvent[];
}) {
  return (
    <section className={`${mCard} p-5`}>
      <span className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-[color:var(--ink-faint)]">
        Confirmed RSVPs per event
      </span>
      <ul className="mt-5 space-y-3.5">
        {merchantEvents.slice(0, 10).map((e) => (
          <li key={e.slug} className="flex items-center justify-between gap-4">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--ink)]">
              {e.title}
              <span className="ml-1.5 font-normal text-[color:var(--slate)]">
                {e.suburb} · {e.category}
              </span>
            </span>
            {/* CapacityMeter is the single way capacity renders - including here. */}
            <CapacityMeter confirmed={e.confirmed} cap={e.capacity} maxWidth={120} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// Setup-completion bar shown on the dashboard until the merchant has finished
// onboarding: approved → payments connected → first event created. It disappears
// once all three are done. Its action is ONLY ever "Connect payments" — the
// "create your first event" CTA belongs to the welcome card / page header, and
// stacking a third copy here is exactly the duplication the DS bans.
function SetupProgress({
  chargesEnabled,
  payoutsEnabled,
  hasEvents,
}: {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  hasEvents: boolean;
}) {
  const steps = [
    { label: "Business approved", done: true },
    {
      label: payoutsEnabled
        ? "Payments connected"
        : chargesEnabled
          ? "Finish payout setup"
          : "Connect payments",
      done: chargesEnabled,
    },
    { label: "Create your first event", done: hasEvents },
  ];

  const completed = steps.filter((s) => s.done).length;
  if (completed === steps.length) return null;

  const pct = Math.round((completed / steps.length) * 100);

  return (
    <section className={`${mTint} flex flex-col gap-3 px-5 py-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[color:var(--purple-700)]">
            Finish setting up · {completed}/{steps.length}
          </p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--ink)]">
            {chargesEnabled
              ? "You're nearly there - create your first event."
              : "Connect payments to start publishing events."}
          </p>
        </div>
        {!chargesEnabled ? (
          <ButtonLink href="/merchant/onboarding/payouts" size="sm">
            Connect payments
          </ButtonLink>
        ) : null}
      </div>

      <span className="block h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--paper)]">
        <span
          className="block h-full rounded-full bg-[color:var(--purple-500)]"
          style={{ width: `${Math.max(pct, 6)}%` }}
        />
      </span>

      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((step) => (
          <li
            key={step.label}
            className={`flex items-center gap-2 rounded-xl bg-[color:var(--paper)] px-3 py-2.5 text-[13px] ${
              step.done
                ? "font-medium text-[color:var(--ink)]"
                : "text-[color:var(--slate)]"
            }`}
          >
            <span
              className={`flex size-[19px] flex-none items-center justify-center rounded-full ${
                step.done ? "bg-[color:var(--sage)] text-white" : "bg-[color:var(--lavender-100)]"
              }`}
            >
              {step.done ? (
                <Icon name="check" size={12} stroke={2.6} />
              ) : (
                <span className="size-1.5 rounded-full bg-[color:var(--purple-400)]" />
              )}
            </span>
            <span className="truncate">{step.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// First-run welcome, shown only while the merchant has zero events. This card
// owns the screen's single "Create event" CTA while it's up.
function WelcomeToClick({ businessName }: { businessName: string }) {
  const steps = [
    {
      n: "01",
      title: "Create your first event.",
      body: "Pick a date, capacity, and price in the 5-step wizard. Submissions go live the moment they pass review.",
    },
    {
      n: "02",
      title: "Share the link.",
      body: "Every event gets a public page on Discover. Post it to your socials - RSVPs flow straight into Bookings.",
    },
    {
      n: "03",
      title: "Run the door.",
      body: "Open Bookings on the day to check people in or export a CSV. Payouts land in Finances after the event wraps.",
    },
  ];

  return (
    <section className={`${mCard} p-6 sm:p-7`}>
      <p className="eyebrow">Welcome to Click</p>
      <h2 className="font-display mt-2.5 text-[26px] font-semibold leading-[1.15] tracking-[-0.01em] text-[color:var(--ink)] sm:text-[30px]">
        You&apos;re in, {businessName}.
      </h2>
      <p className="mt-2.5 max-w-prose text-sm leading-relaxed text-[color:var(--slate)]">
        Your merchant profile is approved. This portal is where you spin up events, watch RSVPs
        roll in, and get paid. Here&apos;s the three-step lap so you know the room.
      </p>

      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <li key={step.n} className={`${mTint} flex gap-3.5 p-4`}>
            <span className="font-display shrink-0 text-2xl font-semibold leading-none text-[color:var(--purple-400)] tabular-nums">
              {step.n}
            </span>
            <div className="min-w-0">
              <p className="font-display text-[15px] font-semibold leading-tight text-[color:var(--ink)]">
                {step.title}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--slate)]">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-5">
        <InfoNote icon="info">
          Hosting on Click is <b className="font-semibold text-[color:var(--purple-700)]">free</b>{" "}
          during the Sydney pilot. Free events skip Stripe entirely; paid events route through it
          and pay out monthly.
        </InfoNote>
      </div>

      <div className="mt-5 flex flex-wrap gap-2.5">
        <CreateEventButton size="md" />
        <ButtonLink href="/merchant?tab=settings" variant="secondary">
          Read the FAQ
        </ButtonLink>
      </div>
    </section>
  );
}
