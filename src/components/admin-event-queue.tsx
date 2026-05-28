"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AdminEventRow } from "@/lib/event-repository";
import type { EventStatus } from "@/lib/click-data";
import type { Region } from "@/lib/geo";

type StatusFilter = "all" | EventStatus;
type RegionFilter = "all" | Region;
type DateFilter = "all" | "upcoming" | "past";

const PAGE_SIZE = 10;

const regionOrder: RegionFilter[] = ["all", "Sydney", "Melbourne", "Other"];
const dateOrder: { value: DateFilter; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
];

function regionTone(region: Region) {
  if (region === "Sydney") return "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
  if (region === "Melbourne") return "bg-[color:var(--rose)] text-[color:var(--surface-deep)]";
  return "bg-[color:var(--cream)] text-[color:var(--ink)]";
}

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const statusOrder: StatusFilter[] = ["all", "Pending", "Live", "Featured", "Waitlist", "Locked"];

function statusTone(status: EventStatus) {
  if (status === "Pending") return "bg-[color:var(--rose)] text-[color:var(--surface-deep)]";
  if (status === "Live") return "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
  if (status === "Featured") return "bg-[color:var(--ink)] text-[color:var(--champagne)]";
  if (status === "Waitlist") return "bg-[color:var(--cream)] text-[color:var(--ink)]";
  return "bg-[color:var(--champagne)] text-[color:var(--ink)]";
}

export function AdminEventQueue({ events }: { events: AdminEventRow[] }) {
  const [rows, setRows] = useState(events);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  // Default to upcoming — that's the queue admins almost always want.
  const [dateFilter, setDateFilter] = useState<DateFilter>("upcoming");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Filter setters reset to page 1 so users never land on an empty page.
  // (We do this inline rather than via an effect — keeps state changes
  // batched and avoids the set-state-in-effect lint rule.)
  function setFilterAndReset(v: StatusFilter) { setFilter(v); setPage(1); }
  function setRegionAndReset(v: RegionFilter) { setRegionFilter(v); setPage(1); }
  function setDateAndReset(v: DateFilter)     { setDateFilter(v);   setPage(1); }
  function setQueryAndReset(v: string)        { setQuery(v);        setPage(1); }

  const counts = useMemo(() => {
    const map = new Map<StatusFilter, number>();
    map.set("all", rows.length);
    for (const event of rows) {
      map.set(event.status, (map.get(event.status) ?? 0) + 1);
    }
    return map;
  }, [rows]);

  const regionCounts = useMemo(() => {
    const map = new Map<RegionFilter, number>();
    map.set("all", rows.length);
    for (const event of rows) {
      map.set(event.region, (map.get(event.region) ?? 0) + 1);
    }
    return map;
  }, [rows]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    // Snapshot "now" each time filters change. We don't need minute-level
    // freshness — admins reload often, and a stale boundary is harmless.
    // eslint-disable-next-line react-hooks/purity -- intentional snapshot inside memo
    const now = Date.now();
    return rows.filter((event) => {
      if (filter !== "all" && event.status !== filter) return false;
      if (regionFilter !== "all" && event.region !== regionFilter) return false;
      if (dateFilter !== "all") {
        const startsMs = new Date(event.startsAt).getTime();
        if (Number.isFinite(startsMs)) {
          if (dateFilter === "upcoming" && startsMs < now) return false;
          if (dateFilter === "past" && startsMs >= now) return false;
        }
      }
      if (!search) return true;
      return (
        event.title.toLowerCase().includes(search) ||
        event.host.toLowerCase().includes(search) ||
        event.category.toLowerCase().includes(search) ||
        (event.suburb?.toLowerCase().includes(search) ?? false)
      );
    });
  }, [rows, filter, regionFilter, dateFilter, query]);

  // Clamp page if the filtered set shrank under us (e.g. approve flips a row
  // out of view). Cheap and deterministic — no effect needed.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

  async function approve(eventId: string) {
    setMessage("");
    setBusyId(eventId);

    try {
      const response = await fetch(
        `/api/admin/events/${encodeURIComponent(eventId)}/approve`,
        { method: "POST" },
      );
      const payload = (await response.json()) as { event?: { title?: string }; error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Approval failed.");
        return;
      }

      setRows((current) =>
        current.map((event) =>
          event.id === eventId ? { ...event, status: "Live" } : event,
        ),
      );
      setMessage(`${payload.event?.title ?? "Event"} is now live.`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {statusOrder.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilterAndReset(option)}
              className={`rounded-full border-2 border-[color:var(--line)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider hard-shadow-sm transition ${
                filter === option
                  ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
                  : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
              }`}
            >
              {option === "all" ? "All" : option}{" "}
              <span className="opacity-60">({counts.get(option) ?? 0})</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQueryAndReset(event.target.value)}
          placeholder="Search title, host, suburb, category…"
          className="w-full rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-medium text-[color:var(--ink)] placeholder:text-[color:var(--mauve)]/70 sm:w-72"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          When
        </span>
        {dateOrder.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setDateAndReset(option.value)}
            className={`rounded-full border-2 border-[color:var(--line)] px-3 py-1 text-[0.65rem] font-black uppercase tracking-wider hard-shadow-sm transition ${
              dateFilter === option.value
                ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
                : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          Region
        </span>
        {regionOrder.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setRegionAndReset(option)}
            className={`rounded-full border-2 border-[color:var(--line)] px-3 py-1 text-[0.65rem] font-black uppercase tracking-wider hard-shadow-sm transition ${
              regionFilter === option
                ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
                : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
            }`}
          >
            {option === "all" ? "All" : option}{" "}
            <span className="opacity-60">({regionCounts.get(option) ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
        <div className="hidden grid-cols-[1.35fr_0.8fr_0.7fr_0.9fr_0.7fr_0.9fr] gap-4 bg-[color:var(--surface-deep)] px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--on-deep)] md:grid">
          <span>Event</span>
          <span>Status</span>
          <span>Category</span>
          <span>Starts</span>
          <span>Going</span>
          <span>Action</span>
        </div>
        {message ? (
          <p className="border-b border-[color:var(--line)] bg-[color:var(--peach)] px-5 py-3 text-sm font-black text-[color:var(--surface-deep)]">
            {message}
          </p>
        ) : null}
        {filtered.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm font-bold text-[color:var(--mauve)]">
            No events match this filter.
          </p>
        ) : (
          pageRows.map((event) => {
            const isExpanded = expanded === event.id;
            const startsAt = new Date(event.startsAt);
            const startsLabel = Number.isNaN(startsAt.getTime())
              ? "—"
              : dateFormatter.format(startsAt);

            return (
              <div
                key={event.id}
                className="border-b border-[color:var(--line)] last:border-0"
              >
                <div className="grid gap-3 px-5 py-4 text-sm font-medium text-[color:var(--mauve)] md:grid-cols-[1.35fr_0.8fr_0.7fr_0.9fr_0.7fr_0.9fr] md:items-center">
                  <div className="text-left">
                    <Link
                      href={`/events/${event.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-black text-[color:var(--ink)] underline-offset-2 hover:underline"
                      title="Open event in a new tab"
                    >
                      {event.title}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        width="13"
                        height="13"
                        fill="none"
                        className="opacity-70"
                      >
                        <path
                          d="M14 5h5v5M19 5l-9 9M5 5h6M5 12v7h14v-7"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="sr-only">(opens in a new tab)</span>
                    </Link>
                    <p className="text-xs font-medium text-[color:var(--mauve)]">
                      Hosted by {event.host}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.65rem] font-black uppercase tracking-wider">
                      <span
                        className={`inline-flex rounded-full border-2 border-[color:var(--line)] px-2 py-0.5 ${regionTone(event.region)}`}
                      >
                        {event.region}
                      </span>
                      {event.suburb ? (
                        <span className="text-[color:var(--mauve)]">· {event.suburb}</span>
                      ) : null}
                    </p>
                  </div>
                  <span>
                    <span
                      className={`inline-flex rounded-full border-2 border-[color:var(--line)] px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider ${statusTone(event.status)}`}
                    >
                      {event.status}
                    </span>
                  </span>
                  <span>{event.category}</span>
                  <span>{startsLabel}</span>
                  <span className="font-bold text-[color:var(--ink)]">
                    {event.attendees}/{event.capacity}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {event.status === "Pending" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => approve(event.id)}
                          disabled={busyId === event.id}
                          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-4 py-1.5 text-xs font-black uppercase tracking-wider text-[color:var(--champagne)] hard-shadow-sm disabled:opacity-60"
                        >
                          {busyId === event.id ? "Approving…" : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpanded(isExpanded ? null : event.id)}
                          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--cream)]"
                        >
                          {isExpanded ? "Hide" : "Inspect"}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setExpanded(isExpanded ? null : event.id)}
                        className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-1.5 text-xs font-black uppercase tracking-wider text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--cream)]"
                      >
                        {isExpanded ? "Hide" : "Inspect"}
                      </button>
                    )}
                  </div>
                </div>
                {isExpanded ? (
                  <dl className="grid gap-3 border-t border-dashed border-[color:var(--line)] bg-[color:var(--cream)]/40 px-5 py-4 text-xs font-bold uppercase tracking-wider text-[color:var(--mauve)] sm:grid-cols-4">
                    <div>
                      <dt className="opacity-60">Slug</dt>
                      <dd className="mt-1 font-mono text-[color:var(--ink)]">{event.id}</dd>
                    </div>
                    <div>
                      <dt className="opacity-60">Booking model</dt>
                      <dd className="mt-1 text-[color:var(--ink)]">{event.booking}</dd>
                    </div>
                    <div>
                      <dt className="opacity-60">Capacity</dt>
                      <dd className="mt-1 text-[color:var(--ink)]">
                        {event.capacity} seats · {event.attendees} confirmed
                      </dd>
                    </div>
                    <div>
                      <dt className="opacity-60">Starts</dt>
                      <dd className="mt-1 text-[color:var(--ink)]">{startsLabel}</dd>
                    </div>
                    <div className="sm:col-span-4">
                      <dt className="opacity-60">Where</dt>
                      <dd className="mt-1 normal-case tracking-normal text-[color:var(--ink)]">
                        <span className="font-black uppercase tracking-wider">{event.region}</span>
                        {event.suburb ? ` · ${event.suburb}` : ""}
                        {event.locationName ? ` · ${event.locationName}` : ""}
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            );
          })
        )}
        {filtered.length > PAGE_SIZE ? (
          <nav
            aria-label="Pagination"
            className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[color:var(--line)] bg-[color:var(--cream)]/40 px-5 py-3"
          >
            <p className="text-[0.7rem] font-black uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              Showing {pageStart}–{pageEnd} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--cream)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                ← Prev
              </button>
              <span className="font-mono text-xs font-black text-[color:var(--ink)]">
                {safePage} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={safePage >= pageCount}
                className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--cream)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                Next →
              </button>
            </div>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
