"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MerchantEventSummary } from "@/lib/event-repository";
import { Icon, Tag } from "./ds";
import {
  CapacityMeter,
  StatusPill,
  mCard,
  merchantEventDisplayStatus,
} from "./merchant-ds";
import { formatPriceLabel } from "@/lib/amounts";

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Sydney",
});

const timeFormatter = new Intl.DateTimeFormat("en-AU", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Sydney",
});

// "Sat, 31 May, 6:30 pm - 8:30 pm" when the event has a known end, else just
// the start. Mirrors formatEventTimeRange() used on the public cards.
function formatWhen(startsAt: string, endsAt: string | null) {
  const start = dateFormatter.format(new Date(startsAt));
  if (!endsAt) return start;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return start;
  return `${start} - ${timeFormatter.format(end)}`;
}

function isPast(event: MerchantEventSummary) {
  return new Date(event.endsAt ?? event.startsAt).getTime() < Date.now();
}

// The status the merchant actually needs to read, in precedence order:
// Rejected beats Ended (being "not live" matters more than being over, #193),
// Cancelled beats everything, and a full live event reads "Full".

// "YYYY-MM" for the event start, computed in the same Australia/Sydney timezone
// the calendar grid uses - otherwise a late-night event slips into the wrong
// month relative to what the merchant sees on the calendar.
function monthKeyInSydney(startsAt: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(startsAt));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

const monthLabelFormatter = new Intl.DateTimeFormat("en-AU", {
  month: "long",
  year: "numeric",
  timeZone: "Australia/Sydney",
});

function monthKeyLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  // Anchor mid-month at noon UTC so the Sydney-formatted label can't drift to an
  // adjacent month.
  return monthLabelFormatter.format(new Date(Date.UTC(year, month - 1, 15, 12)));
}

type StatusFilter =
  | "upcoming"
  | "all"
  | "live"
  | "pending"
  | "rejected"
  | "cancelled"
  | "past";
type SortKey = "date-asc" | "date-desc";

// h-11 (44px), matching .ck-input and the DS's stated minimum touch target -
// these were 36px, hand-rolled around the primitive that already gets it right.
const selectClass =
  "h-11 rounded-xl border border-[color:var(--mist-strong)] bg-[color:var(--paper)] px-3 text-[13px] font-medium text-[color:var(--ink)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--purple)]";

// Written out in full (not interpolated) so Tailwind's source scanner sees them.
const HEAD_GRID = "grid grid-cols-[2.2fr_1.6fr_1fr_0.8fr_0.9fr]";
const ROW_GRID = "grid md:grid-cols-[2.2fr_1.6fr_1fr_0.8fr_0.9fr]";

export function MerchantEventsPanel({
  events,
  filterable = false,
}: {
  events: MerchantEventSummary[];
  filterable?: boolean;
}) {
  const [query, setQuery] = useState("");
  // Defaults to UPCOMING, not All. The tab is the host's working surface, and
  // "All / date-asc" opened it on their oldest events - past, cancelled and
  // rejected included - with tonight's event somewhere down the page. There was
  // no upcoming view at all, so the single most useful one had to be assembled
  // by hand on every visit. "All" is still one tap away.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("upcoming");
  const [sort, setSort] = useState<SortKey>("date-asc");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  // Distinct YYYY-MM keys actually present in the events, newest first, so the
  // dropdown only ever offers months the merchant really has events in.
  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const event of events) keys.add(monthKeyInSydney(event.startsAt));
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [events]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = events.filter((event) => {
      if (
        statusFilter === "upcoming" &&
        (isPast(event) || event.status === "Cancelled" || event.status === "Rejected")
      ) {
        return false;
      }
      if (statusFilter === "past" && !isPast(event)) return false;
      if (statusFilter === "live" && (event.status !== "Live" || isPast(event))) return false;
      if (statusFilter === "pending" && event.status !== "Pending") return false;
      if (statusFilter === "rejected" && event.status !== "Rejected") return false;
      if (statusFilter === "cancelled" && event.status !== "Cancelled") return false;
      if (monthFilter !== "all" && monthKeyInSydney(event.startsAt) !== monthFilter) return false;
      if (!q) return true;
      return (
        event.title.toLowerCase().includes(q) ||
        event.suburb.toLowerCase().includes(q) ||
        event.category.toLowerCase().includes(q) ||
        event.locationName.toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      const diff = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      return sort === "date-asc" ? diff : -diff;
    });
    return list;
  }, [events, query, statusFilter, sort, monthFilter]);

  if (events.length === 0) {
    return (
      <div className={`${mCard} p-6`}>
        <p className="font-display text-base font-semibold text-[color:var(--ink)]">
          You haven&apos;t created any events yet.
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--slate)]">
          Every new event lands in pending status until it passes review - then it&apos;s live on
          Discover.
        </p>
      </div>
    );
  }

  // Rejected earns a tab of its own because it is the only status with WORK
  // attached: the event page carries the admin's reason and a one-tap resubmit.
  // Without it a declined event was unreachable from this list - Upcoming hides
  // it by design (see the filter above), and finding it under "All" meant
  // knowing to look there and then reading a badge on every row.
  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: "upcoming", label: "Upcoming" },
    { key: "all", label: "All" },
    { key: "live", label: "Live" },
    { key: "pending", label: "Pending" },
    { key: "rejected", label: "Rejected" },
    { key: "cancelled", label: "Cancelled" },
    { key: "past", label: "Past" },
  ];

  return (
    <div className="space-y-3.5">
      {filterable ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-10 min-w-[14rem] flex-1 items-center gap-2 rounded-xl border border-[color:var(--mist-strong)] bg-[color:var(--paper)] px-3 sm:max-w-[280px] sm:flex-none">
            <Icon name="search" size={16} className="text-[color:var(--slate)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events"
              className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-[color:var(--ink)] outline-none placeholder:text-[color:var(--slate)]"
            />
          </div>

          {/* Selected filter = Deep Purple fill, no tick - the fill IS the signal. */}
          <div className="ckRail flex gap-1.5 overflow-x-auto">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setStatusFilter(t.key)}
                aria-pressed={statusFilter === t.key}
                // The pill stays the DS's 30px tag; the BUTTON around it is
                // 44px tall, so the thumb target meets the floor without
                // redrawing a primitive. -my-1.5 keeps the rail's height.
                className="-my-[7px] flex h-11 flex-none items-center py-[7px]"
              >
                <Tag selected={statusFilter === t.key} className="ck-tag--select h-[30px] px-3.5">
                  {t.label}
                </Tag>
              </button>
            ))}
          </div>

          <label className="sr-only" htmlFor="merchant-events-month">
            Filter by month
          </label>
          <select
            id="merchant-events-month"
            aria-label="Filter by month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className={selectClass}
          >
            <option value="all">All months</option>
            {monthOptions.map((key) => (
              <option key={key} value={key}>
                {monthKeyLabel(key)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setSort((s) => (s === "date-asc" ? "date-desc" : "date-asc"))}
            className={`${selectClass} inline-flex items-center gap-1.5 hover:bg-[color:var(--lavender-100)]`}
          >
            Date {sort === "date-asc" ? "↑" : "↓"}
          </button>
        </div>
      ) : null}

      <div className={`${mCard} overflow-hidden`}>
        <div
          className={`${HEAD_GRID} gap-3.5 border-b border-[color:var(--mist)] bg-[color:var(--lavender-100)] px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--ink-faint)] max-md:hidden`}
        >
          <span>Event</span>
          <span>When</span>
          <span>Confirmed</span>
          <span>Waitlist</span>
          <span>Status</span>
        </div>

        {visible.length === 0 ? (
          <p className="px-5 py-7 text-[13.5px] text-[color:var(--slate)]">
            No events match - clear the search or filters.
          </p>
        ) : (
          visible.map((event, i) => (
            <Link
              key={event.slug}
              href={`/merchant/events/${event.slug}`}
              className={`${ROW_GRID} gap-3 px-5 py-3.5 transition-colors hover:bg-[color:var(--lavender-100)] md:items-center ${
                i > 0 ? "border-t border-[color:var(--mist)]" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-semibold text-[color:var(--ink)]">
                  {event.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-[color:var(--slate)]">
                  {event.locationName}, {event.suburb} · {formatPriceLabel(event.priceCents)} ·{" "}
                  {event.category}
                </p>
              </div>

              <p className="text-[13px] text-[color:var(--ink-soft)]">
                {formatWhen(event.startsAt, event.endsAt)}
              </p>

              {/* CapacityMeter is the ONE way capacity renders. */}
              <CapacityMeter confirmed={event.confirmed} cap={event.capacity} />

              {/* Below md the five cells stack and the header strip that names
                  them is hidden, so this rendered as a naked digit between a
                  capacity meter and a status badge - a "3" with no referent -
                  and the empty state rendered a bare "-", which reads as a
                  rendering fault rather than "nobody is waiting". So: label it
                  inline on phones, and say nothing at all when it is zero. The
                  "-" placeholder only earns its place inside a real column. */}
              {event.waitlisted > 0 ? (
                <p className="text-[13.5px] font-semibold text-[color:var(--ink)]">
                  {event.waitlisted}
                  <span className="font-medium text-[color:var(--slate)] md:hidden">
                    {" "}
                    on the waitlist
                  </span>
                </p>
              ) : (
                <p className="hidden text-[13.5px] text-[color:var(--ink-faint)] md:block">
                  -
                </p>
              )}

              <span>
                <StatusPill status={merchantEventDisplayStatus(event)} />
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
