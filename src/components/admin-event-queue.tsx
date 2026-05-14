"use client";

import { useMemo, useState } from "react";
import type { AdminEventRow } from "@/lib/event-repository";
import type { EventStatus } from "@/lib/click-data";

type StatusFilter = "all" | EventStatus;

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
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = new Map<StatusFilter, number>();
    map.set("all", rows.length);
    for (const event of rows) {
      map.set(event.status, (map.get(event.status) ?? 0) + 1);
    }
    return map;
  }, [rows]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((event) => {
      if (filter !== "all" && event.status !== filter) return false;
      if (!search) return true;
      return (
        event.title.toLowerCase().includes(search) ||
        event.host.toLowerCase().includes(search) ||
        event.category.toLowerCase().includes(search)
      );
    });
  }, [rows, filter, query]);

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
              onClick={() => setFilter(option)}
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
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title, host, category…"
          className="w-full rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-medium text-[color:var(--ink)] placeholder:text-[color:var(--mauve)]/70 sm:w-72"
        />
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
          filtered.map((event) => {
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
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : event.id)}
                    className="text-left"
                  >
                    <p className="font-black text-[color:var(--ink)]">{event.title}</p>
                    <p className="text-xs font-medium text-[color:var(--mauve)]">
                      Hosted by {event.host}
                    </p>
                  </button>
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
                      <button
                        type="button"
                        onClick={() => approve(event.id)}
                        disabled={busyId === event.id}
                        className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-4 py-1.5 text-xs font-black uppercase tracking-wider text-[color:var(--champagne)] hard-shadow-sm disabled:opacity-60"
                      >
                        {busyId === event.id ? "Approving…" : "Approve"}
                      </button>
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
                  </dl>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
