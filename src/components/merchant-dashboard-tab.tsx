import Link from "next/link";
import { MetricCard, Pill } from "@/components/click-ui";
import { MerchantCalendar } from "@/components/merchant-calendar";
import { MerchantEventsPanel } from "@/components/merchant-events-panel";
import {
  CreateEventButton,
  TabHeader,
  formatPrice,
  type MerchantEvent,
} from "./merchant-portal-shared";

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
    (event) => new Date(event.startsAt).getTime() >= now,
  );
  const upcomingCount = upcoming.length;

  // Analytics summary (folded in from the old Analytics tab).
  const totalConfirmed = merchantEvents.reduce((sum, e) => sum + e.confirmed, 0);
  const totalCapacity = merchantEvents.reduce((sum, e) => sum + e.capacity, 0);
  const totalRevenueCents = merchantEvents.reduce(
    (sum, e) => sum + e.priceCents * e.confirmed,
    0,
  );
  const totalWaitlisted = merchantEvents.reduce((sum, e) => sum + e.waitlisted, 0);
  const fillRate = totalCapacity > 0 ? Math.round((totalConfirmed / totalCapacity) * 100) : 0;

  // First-run welcome: shown only while the merchant has zero events. It
  // disappears on its own once the first event is created.
  const showWelcome = merchantEvents.length === 0;

  return (
    <div className="space-y-8 py-10">
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
        body="Snapshot of bookings and revenue across all your events, plus the calendar below."
        action={<CreateEventButton />}
      />

      {/* Analytics overview — booking + revenue snapshot across all events. */}
      {!showWelcome ? (
        <section>
          <p className="eyebrow">This month at a glance</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <MetricCard label="Upcoming" value={upcomingCount.toString()} tone="pink" />
            <MetricCard label="Confirmed RSVPs" value={totalConfirmed.toString()} tone="aqua" />
            <MetricCard label="Fill rate" value={`${fillRate}%`} tone="white" />
            <MetricCard label="Revenue" value={formatPrice(totalRevenueCents)} tone="white" />
          </div>
          {totalWaitlisted > 0 ? (
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
              + {totalWaitlisted} on waitlist across your events
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Hosts are people too — nudge them onto the attendee side. Sits high
          on the dashboard (bug board #147: it used to hide at the very bottom
          and went unnoticed). Always shown while they haven't finished attendee
          onboarding; once onboarded it stays until their first booking. */}
      {!attendeeOnboarded || attendingCount === 0 ? (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--peach)]/40 p-6 hard-shadow-sm">
          <div>
            <p className="eyebrow">Want to attend events too?</p>
            <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-[color:var(--mauve)]">
              {attendeeOnboarded
                ? "Your host account can also book and attend events on Click. Browse what’s on near you."
                : "Set up your attendee profile in a couple of minutes to start booking events as a guest."}
            </p>
          </div>
          <Link
            href={attendeeOnboarded ? "/discover" : "/onboarding"}
            className="inline-flex shrink-0 items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-[color:var(--champagne)] hard-shadow-sm hover:bg-[color:var(--rose)] hover:text-[color:var(--surface-deep)]"
          >
            {attendeeOnboarded ? "Browse events →" : "Set up attendee profile →"}
          </Link>
        </section>
      ) : null}

      {/* Your events — quick list of what's coming up, with a create CTA. This
          is the primary working surface, so it sits above the calendar. */}
      {merchantEvents.length > 0 ? (
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Your events</p>
              <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                {upcomingCount > 0
                  ? "Next events on your calendar — click any row to manage attendees."
                  : "No upcoming events. Create one to start taking bookings."}
              </p>
            </div>
            <Link
              href="/merchant?tab=events"
              className="inline-flex shrink-0 items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
            >
              View all events →
            </Link>
          </div>
          <div className="mt-6">
            {upcomingCount > 0 ? (
              <MerchantEventsPanel events={upcoming.slice(0, 5)} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6">
                <p className="text-sm font-medium leading-6 text-[color:var(--mauve)]">
                  Your past events are in the Events tab. Ready for the next one?
                </p>
                <CreateEventButton />
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section>
        <p className="eyebrow">Calendar</p>
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Each day shows your events and how many people have booked. Click any
          chip to see attendees.
        </p>
        <div className="mt-6">
          <MerchantCalendar events={merchantEvents} monthParam={monthParam} />
        </div>
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
    <section className="grid gap-6 lg:grid-cols-2">
      {/* Monthly revenue + bookings trend */}
      <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
        <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          Revenue & bookings by month
        </span>
        {/* Columns must STRETCH to the 160px row (no items-end here): the bar
            wrapper is flex-1 of the column, and the bars' % heights resolve
            against it. With items-end the columns collapsed to label height
            and every bar rendered 0px tall (bug board #158). */}
        <div className="mt-5 flex items-stretch justify-between gap-2" style={{ height: "160px" }}>
          {months.map((m) => (
            <div
              key={m.label}
              className="group relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1 focus:outline-none"
              tabIndex={0}
              role="img"
              aria-label={`${m.label}: ${m.revenueCents === 0 ? "$0" : formatPrice(m.revenueCents)} revenue, ${m.confirmed} booking${m.confirmed === 1 ? "" : "s"}`}
            >
              {/* Branded hover/focus popover — matches the admin trend chart, and
                  surfaces the bookings count the native title used to carry. */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[color:var(--line)] bg-[color:var(--cream)] px-2 py-1 text-center opacity-0 transition-opacity duration-150 hard-shadow-sm group-hover:opacity-100 group-focus-within:opacity-100">
                <span className="block font-condensed text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[color:var(--mauve)]">
                  {m.label}
                </span>
                <span className="block font-condensed text-[0.74rem] font-bold tabular-nums text-[color:var(--rose)]">
                  {m.revenueCents === 0 ? "$0" : formatPrice(m.revenueCents)}
                </span>
                <span className="block font-condensed text-[0.74rem] font-bold tabular-nums text-[color:var(--ink)]">
                  {m.confirmed} booking{m.confirmed === 1 ? "" : "s"}
                </span>
              </div>
              <span className="font-mono text-[0.6rem] font-bold tabular-nums text-[color:var(--ink)]">
                {m.revenueCents === 0 ? "$0" : formatPrice(m.revenueCents)}
              </span>
              <div className="flex w-full flex-1 items-end justify-center gap-1">
                <div
                  className="w-1/2 rounded-t bg-[color:var(--rose)]"
                  style={{ height: `${Math.max((m.revenueCents / maxRevenue) * 100, 3)}%` }}
                />
                <div
                  className="w-1/2 rounded-t bg-[color:var(--ink)]"
                  style={{ height: `${Math.max((m.confirmed / maxConfirmed) * 100, 3)}%` }}
                />
              </div>
              <span className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[color:var(--mauve)]">
                {m.label}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-4 font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[color:var(--mauve)]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-[color:var(--rose)]" /> Revenue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-[color:var(--ink)]" /> Bookings
          </span>
        </div>
      </div>

      {/* Category mix */}
      <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
        <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          Bookings by category
        </span>
        <ul className="mt-5 space-y-3">
          {categories.map((c) => (
            <li key={c.category}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-bold text-[color:var(--ink)]">{c.category}</span>
                <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  {c.confirmed}
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-[color:var(--peach-soft)]">
                <div
                  className="h-2 rounded-full bg-[color:var(--rose)]"
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
  const max = Math.max(...merchantEvents.map((e) => e.confirmed), 1);
  return (
    <section className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
      <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
        Confirmed RSVPs per event
      </span>
      <ul className="mt-5 space-y-3">
        {merchantEvents.slice(0, 10).map((e) => {
          const pct = Math.round((e.confirmed / max) * 100);
          return (
            <li key={e.slug}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-bold text-[color:var(--ink)] truncate">
                  {e.status === "Pending" ? "· " : ""}
                  {e.suburb} · {e.category}
                </span>
                <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  {e.confirmed}/{e.capacity}
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-[color:var(--peach-soft)]">
                <div
                  className="h-2 rounded-full bg-[color:var(--rose)]"
                  style={{ width: `${Math.max(pct, 4)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Setup-completion bar shown on the dashboard until the merchant has finished
// onboarding: approved → payments connected → first event created. It disappears
// once all three are done. The "Connect payments" step is required before event
// creation (the create wizard + createEventForMerchant both gate on it), so this
// is the merchant's one-glance "what's left before I can publish" tracker.
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
    { label: "Business approved", done: true, href: undefined as string | undefined },
    {
      label: payoutsEnabled
        ? "Payments connected"
        : chargesEnabled
          ? "Finish payout setup"
          : "Connect payments",
      done: chargesEnabled,
      href: "/merchant/onboarding/payouts",
    },
    {
      label: "Create your first event",
      done: hasEvents,
      href: chargesEnabled ? "/merchant/events/create" : undefined,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  if (completed === steps.length) return null;

  const pct = Math.round((completed / steps.length) * 100);
  // The next thing to action — first incomplete step that has somewhere to go.
  const nextStep = steps.find((s) => !s.done && s.href);

  return (
    <section className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--peach-soft)] p-5 hard-shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
            ✷ Finish setting up · {completed}/{steps.length}
          </p>
          <p className="mt-1 text-sm font-bold text-[color:var(--ink)]">
            {chargesEnabled
              ? "You're nearly there — create your first event."
              : "Connect payments to start publishing events."}
          </p>
        </div>
        {nextStep ? (
          <Link
            href={nextStep.href!}
            className="inline-flex shrink-0 rounded-full border-2 border-[color:var(--surface-deep)] bg-[color:var(--rose)] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[color:var(--on-deep)] hard-shadow-sm hover:bg-[color:var(--ink)]"
          >
            {nextStep.label} →
          </Link>
        ) : null}
      </div>

      <div className="mt-4 h-2 w-full rounded-full bg-[color:var(--champagne)]">
        <div
          className="h-2 rounded-full bg-[color:var(--rose)] transition-all"
          style={{ width: `${Math.max(pct, 6)}%` }}
        />
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((step) => (
          <li
            key={step.label}
            className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-bold ${
              step.done
                ? "border-[color:var(--line)] bg-[color:var(--champagne)] text-[color:var(--ink)]"
                : "border-dashed border-[color:var(--line)] bg-transparent text-[color:var(--mauve)]"
            }`}
          >
            <span aria-hidden>{step.done ? "✓" : "○"}</span>
            <span className="truncate">{step.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function WelcomeToClick({ businessName }: { businessName: string }) {
  const steps = [
    {
      n: "01",
      title: "Create your first event.",
      body: "Pick a date, capacity, and price in the 5-step wizard — submissions go live the moment they pass admin review.",
    },
    {
      n: "02",
      title: "Share the link.",
      body: "Every event gets a public page on Discover. Post it to your socials or DM regulars; RSVPs flow straight into Bookings.",
    },
    {
      n: "03",
      title: "Run the door.",
      body: "Open Bookings on the day to check people in, message no-shows, or export a CSV. Payouts land in Finances after the event wraps.",
    },
  ];

  return (
    <section className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--peach-soft)] p-6 hard-shadow-sm sm:p-8">
      <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
        ✷ Welcome to Click
      </span>
      <h2 className="font-display mt-3 text-3xl font-light leading-[1.04] text-[color:var(--ink)] sm:text-4xl">
        You&apos;re in, {businessName}.
      </h2>
      <p className="mt-4 max-w-prose text-sm font-medium leading-6 text-[color:var(--mauve)]">
        Your merchant profile is approved. This portal is where you spin up
        events, watch RSVPs roll in, and get paid. Here&apos;s the three-step lap
        so you know the room.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Pill tone="rose">Approved host</Pill>
        <Pill tone="peach">No events yet</Pill>
        <Pill>Free + paid supported</Pill>
      </div>
      <ol className="mt-6 grid gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <li
            key={step.n}
            className="flex gap-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm"
          >
            <span className="font-display shrink-0 text-3xl font-light leading-none text-[color:var(--rose)]">
              {step.n}
            </span>
            <div className="min-w-0">
              <p className="font-display text-xl font-light leading-tight text-[color:var(--ink)]">
                {step.title}
              </p>
              <p className="mt-1.5 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/merchant/events/create"
          className="inline-flex rounded-full border-2 border-[color:var(--surface-deep)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
        >
          Create your first event →
        </Link>
        <Link
          href="/merchant?tab=settings"
          className="inline-flex rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
        >
          Read the FAQ
        </Link>
      </div>
    </section>
  );
}
