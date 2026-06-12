"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MerchantEventSummary } from "@/lib/event-repository";
import { Pill } from "./click-ui";

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

// "Sat, May 31, 6:30 PM – 8:30 PM" when the event has a known end, else just
// the start. Mirrors formatEventTimeRange() used on the public cards.
function formatWhen(startsAt: string, endsAt: string | null) {
  const start = dateFormatter.format(new Date(startsAt));
  if (!endsAt) return start;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return start;
  return `${start} – ${timeFormatter.format(end)}`;
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

function statusTone(status: MerchantEventSummary["status"]): "rose" | "peach" | "cream" | "ink" {
  if (status === "Pending") return "rose";
  if (status === "Waitlist") return "peach";
  if (status === "Locked") return "ink";
  return "cream";
}

function isPast(event: MerchantEventSummary) {
  return new Date(event.endsAt ?? event.startsAt).getTime() < Date.now();
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
      <article className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6">
        <p className="text-base font-bold">You haven&apos;t created any events yet.</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
          Use the form below — every new event lands in pending status until
          admin approves it.
        </p>
      </article>
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
    <div className="space-y-4">
      {filterable ? (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events…"
            className="min-w-[12rem] flex-1 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] placeholder:text-[color:var(--mauve)] focus:outline-none focus:ring-2 focus:ring-[color:var(--rose)]"
          />
          <div className="flex flex-wrap gap-1.5">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setStatusFilter(t.key)}
                className={`rounded-full border-2 border-[color:var(--line)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide hard-shadow-sm ${
                  statusFilter === t.key
                    ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                    : "bg-[color:var(--cream)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                }`}
              >
                {t.label}
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
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)] focus:outline-none focus:ring-2 focus:ring-[color:var(--rose)]"
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
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
          >
            Date {sort === "date-asc" ? "↑" : "↓"}
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
        <div className="grid grid-cols-[1.4fr_0.9fr_0.7fr_0.7fr_0.7fr] gap-3 border-b-2 border-[color:var(--line)] bg-[color:var(--surface-deep)] px-5 py-3 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--on-deep)]/80 max-md:hidden">
          <span>Event</span>
          <span>When</span>
          <span>Confirmed</span>
          <span>Waitlist</span>
          <span>Status</span>
        </div>

        {visible.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm font-semibold text-[color:var(--mauve)]">
            No events match your filters.
          </p>
        ) : (
          visible.map((event) => {
            const filled = Math.min((event.confirmed / event.capacity) * 100, 100);
            const isFull = event.confirmed >= event.capacity;
            const past = isPast(event);
            const statusLabel =
              event.status === "Cancelled"
                ? "Cancelled"
                : past
                  ? "Ended"
                  : isFull && event.status === "Live"
                    ? "Full"
                    : event.status;

            return (
              <Link
                key={event.slug}
                href={`/merchant/events/${event.slug}`}
                className="grid gap-3 border-t-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-4 transition hover:bg-[color:var(--peach)]/30 md:grid-cols-[1.4fr_0.9fr_0.7fr_0.7fr_0.7fr] md:items-center"
              >
                <div>
                  <p className="text-sm font-bold text-[color:var(--ink)]">{event.title}</p>
                  <p className="mt-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                    {event.suburb} · {formatPrice(event.priceCents)} · {event.category}
                  </p>
                </div>

                <p className="text-sm font-semibold text-[color:var(--mauve)]">
                  {formatWhen(event.startsAt, event.endsAt)}
                </p>

                <div>
                  <p className="text-sm font-bold text-[color:var(--ink)]">
                    {event.confirmed} / {event.capacity}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full border border-[color:var(--line)] bg-[color:var(--cream)]">
                    <div
                      className={`h-full ${isFull ? "bg-[color:var(--ink)]" : "bg-[color:var(--rose)]"}`}
                      style={{ width: `${filled}%` }}
                    />
                  </div>
                </div>

                <p className="text-sm font-semibold text-[color:var(--mauve)]">
                  {event.waitlisted > 0 ? `${event.waitlisted} waiting` : "—"}
                </p>

                <Pill tone={past || event.status === "Cancelled" ? "cream" : statusTone(event.status)}>
                  {statusLabel}
                </Pill>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
