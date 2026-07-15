"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MerchantEventSummary } from "@/lib/event-repository";
import { Icon, Tag } from "./ds";
import { CapacityMeter, StatusPill, mCard } from "./merchant-ds";

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

const priceFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

function formatPrice(cents: number) {
  if (cents === 0) return "Free";
  return priceFormatter.format(cents / 100);
}

function isPast(event: MerchantEventSummary) {
  return new Date(event.endsAt ?? event.startsAt).getTime() < Date.now();
}

// The status the merchant actually needs to read, in precedence order:
// Rejected beats Ended (being "not live" matters more than being over, #193),
// Cancelled beats everything, and a full live event reads "Full".
function displayStatus(event: MerchantEventSummary): string {
  if (event.status === "Cancelled") return "cancelled";
  if (event.status === "Rejected") return "rejected";
  if (isPast(event)) return "ended";
  if (event.confirmed >= event.capacity && event.status === "Live") return "full";
  return event.status;
}

// "YYYY-MM" for the event start, computed in the same Australia/Sydney timezone
// the calendar grid uses — otherwise a late-night event slips into the wrong
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

type StatusFilter = "all" | "live" | "pending" | "cancelled" | "past";
type SortKey = "date-asc" | "date-desc";

const selectClass =
  "h-9 rounded-xl border border-[color:var(--mist-strong)] bg-[color:var(--paper)] px-3 text-[13px] font-medium text-[color:var(--ink)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--purple)]";

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
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
      if (statusFilter === "past" && !isPast(event)) return false;
      if (statusFilter === "live" && (event.status !== "Live" || isPast(event))) return false;
      if (statusFilter === "pending" && event.status !== "Pending") return false;
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

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "live", label: "Live" },
    { key: "pending", label: "Pending" },
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
                className="flex-none"
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
                  {event.locationName}, {event.suburb} · {formatPrice(event.priceCents)} ·{" "}
                  {event.category}
                </p>
              </div>

              <p className="text-[13px] text-[color:var(--ink-soft)]">
                {formatWhen(event.startsAt, event.endsAt)}
              </p>

              {/* CapacityMeter is the ONE way capacity renders. */}
              <CapacityMeter confirmed={event.confirmed} cap={event.capacity} />

              <p
                className={`text-[13.5px] ${
                  event.waitlisted > 0
                    ? "font-semibold text-[color:var(--ink)]"
                    : "text-[color:var(--ink-faint)]"
                }`}
              >
                {event.waitlisted > 0 ? event.waitlisted : "-"}
              </p>

              <span>
                <StatusPill status={displayStatus(event)} />
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
