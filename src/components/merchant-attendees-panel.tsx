"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { MerchantAllAttendeesRow } from "@/lib/event-repository";
import {
  toggleAttendeeCheckInAction,
  toggleGuestCheckInAction,
} from "@/app/merchant/actions";
import { Avatar, Button, Icon } from "./ds";
import { StatusPill, mCard } from "./merchant-ds";

const dateTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function csvEscape(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// h-11 (44px), matching .ck-input and the DS's stated minimum touch target.
// This is the door-running surface; nothing on it should be under the floor.
const selectClass =
  "h-11 rounded-xl border border-[color:var(--mist-strong)] bg-[color:var(--paper)] px-3 text-[13px] font-medium text-[color:var(--ink)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--purple)]";

// Written out in full (not interpolated) so Tailwind's source scanner sees it.
const ROW_GRID = "grid-cols-[1.4fr_1.8fr_1.4fr_1fr_1.1fr_0.9fr]";

export function MerchantAttendeesPanel({ rows }: { rows: MerchantAllAttendeesRow[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  const eventOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of rows) set.set(r.eventSlug, r.eventTitle);
    return Array.from(set.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (eventFilter !== "all" && r.eventSlug !== eventFilter) return false;
      if (!q) return true;
      return (
        r.displayName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.eventTitle.toLowerCase().includes(q)
      );
    });
  }, [rows, query, statusFilter, eventFilter]);

  function exportCsv() {
    const header = [
      "Event",
      "Event date",
      "Name",
      "Seat",
      "Email",
      "Status",
      "RSVP at",
      "Checked in at",
    ].join(",");
    const lines = filtered.map((r) =>
      [
        csvEscape(r.eventTitle),
        csvEscape(r.eventStartsAt),
        csvEscape(r.displayName),
        // A printed door list has to distinguish the person who booked from the
        // +1 they brought - they are different rows against different tables.
        csvEscape(r.kind === "guest" ? "+1 guest" : "Ticket"),
        csvEscape(r.email),
        csvEscape(r.status),
        csvEscape(r.rsvpAt),
        csvEscape(r.checkedInAt ?? ""),
      ].join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `click-attendees-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} attendee${filtered.length === 1 ? "" : "s"}.`);
  }

  // The two seat kinds check in against different tables - a ticket-holder
  // writes event_attendees.checked_in_at, a +1 writes guest_spots.attended - so
  // the row's `kind` picks the action. Same button, same toast, same undo.
  function checkIn(row: MerchantAllAttendeesRow) {
    const next = !row.checkedInAt;
    const form = new FormData();
    form.set("next", String(next));
    form.set("event_slug", row.eventSlug);
    if (row.kind === "guest") {
      form.set("guest_id", row.attendeeId);
    } else {
      form.set("attendee_id", row.attendeeId);
    }
    startTransition(async () => {
      try {
        if (row.kind === "guest") {
          await toggleGuestCheckInAction(form);
        } else {
          await toggleAttendeeCheckInAction(form);
        }
        toast.success(next ? `Checked in ${row.displayName}.` : `Undid check-in for ${row.displayName}.`);
      } catch {
        toast.error("Could not update check-in. Try again.");
      }
    });
  }

  // Check-in is money-good/present → Sage (the `mutual` button variant). Offered
  // ONLY on confirmed attendees (locked decision); everyone else shows a status.
  // A plain function, not a nested component - a nested one would get a fresh
  // identity every render and remount the button mid-transition.
  function checkInCell(row: MerchantAllAttendeesRow) {
    if (row.status !== "confirmed") {
      return <StatusPill status={row.status} />;
    }
    // size="md" (44px), not "sm" (36px): see the note on CheckInButton in
    // check-in-toggle.tsx. Same control, same thumb, same door.
    return row.checkedInAt ? (
      <Button variant="mutual" size="md" onClick={() => checkIn(row)} disabled={isPending}>
        <Icon name="check" size={14} stroke={2.6} />
        In
      </Button>
    ) : (
      <Button variant="secondary" size="md" onClick={() => checkIn(row)} disabled={isPending}>
        Check in
      </Button>
    );
  }

  return (
    <div className={`${mCard} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[color:var(--mist)] px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-11 min-w-[15rem] items-center gap-2 rounded-xl border border-[color:var(--mist-strong)] bg-[color:var(--paper)] px-3">
            <Icon name="search" size={16} className="text-[color:var(--slate)]" />
            <input
              type="search"
              placeholder="Search name or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-[color:var(--ink)] outline-none placeholder:text-[color:var(--slate)]"
            />
          </div>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectClass}
          >
            <option value="all">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="waitlisted">Waitlisted</option>
            <option value="cancelled">Cancelled</option>
            <option value="pending_payment">Pending payment</option>
          </select>
          <select
            aria-label="Filter by event"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className={`${selectClass} max-w-[16rem]`}
          >
            <option value="all">All events</option>
            {eventOptions.map(([slug, title]) => (
              <option key={slug} value={slug}>
                {title}
              </option>
            ))}
          </select>
        </div>
        <Button variant="secondary" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
          <Icon name="share" size={15} />
          Export CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="px-5 py-7 text-[13.5px] text-[color:var(--slate)]">No attendees match.</p>
      ) : (
        <>
          {/* Mobile: stacked rows so hosts can check people in on a phone at the
              door without horizontal-scrolling a 6-column table. */}
          <ul className="md:hidden">
            {filtered.map((r, i) => (
              <li
                key={r.attendeeId}
                className={`flex items-center gap-3 px-4 py-3.5 ${
                  i > 0 ? "border-t border-[color:var(--mist)]" : ""
                }`}
              >
                <Avatar name={r.displayName} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[color:var(--ink)]">
                    {r.displayName}
                  </div>
                  <div className="truncate text-xs text-[color:var(--slate)]">
                    {r.eventTitle} · {dateTimeFormatter.format(new Date(r.rsvpAt))}
                  </div>
                </div>
                {checkInCell(r)}
              </li>
            ))}
          </ul>

          {/* Desktop: the full door list. */}
          <div className="hidden md:block">
            <div
              className={`grid ${ROW_GRID} gap-3.5 border-b border-[color:var(--mist)] bg-[color:var(--lavender-100)] px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--ink-faint)]`}
            >
              <span>Name</span>
              <span>Email</span>
              <span>Event</span>
              <span>Status</span>
              <span>RSVP</span>
              <span>Check-in</span>
            </div>
            {filtered.map((r, i) => (
              <div
                key={r.attendeeId}
                className={`grid ${ROW_GRID} items-center gap-3.5 px-5 py-3 ${
                  i > 0 ? "border-t border-[color:var(--mist)]" : ""
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={r.displayName} size={30} />
                  <span className="truncate text-[13.5px] font-semibold text-[color:var(--ink)]">
                    {r.displayName}
                  </span>
                </span>
                <span className="truncate text-[12.5px] text-[color:var(--slate)]">
                  {r.email || "+1 seat - no email on file"}
                </span>
                <span className="truncate text-[12.5px] text-[color:var(--ink-soft)]">
                  {r.eventTitle}
                </span>
                <span>
                  <StatusPill status={r.status} />
                </span>
                <span className="text-[12.5px] text-[color:var(--slate)]">
                  {dateTimeFormatter.format(new Date(r.rsvpAt))}
                </span>
                <span>{checkInCell(r)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
