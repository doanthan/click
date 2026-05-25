"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { MerchantAllAttendeesRow } from "@/lib/event-repository";
import { toggleAttendeeCheckInAction } from "@/app/merchant/actions";
import { Pill } from "./click-ui";

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

  function checkIn(row: MerchantAllAttendeesRow) {
    const next = !row.checkedInAt;
    const form = new FormData();
    form.set("attendee_id", row.attendeeId);
    form.set("next", String(next));
    startTransition(async () => {
      try {
        await toggleAttendeeCheckInAction(form);
        toast.success(next ? `Checked in ${row.displayName}.` : `Undid check-in for ${row.displayName}.`);
      } catch {
        toast.error("Could not update check-in. Try again.");
      }
    });
  }

  return (
    <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] hard-shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search by name, email, event…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-sm font-semibold outline-none focus:bg-[color:var(--champagne)]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)]"
          >
            <option value="all">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="waitlisted">Waitlisted</option>
            <option value="cancelled">Cancelled</option>
            <option value="pending_payment">Pending payment</option>
          </select>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] max-w-[16rem]"
          >
            <option value="all">All events</option>
            {eventOptions.map(([slug, title]) => (
              <option key={slug} value={slug}>
                {title}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Export CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="p-6 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          No attendees match your filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-[color:var(--line)] bg-[color:var(--peach)] text-[color:var(--surface-deep)]">
              <tr>
                <Th>Event</Th>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th>RSVP</Th>
                <Th>Check-in</Th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[color:var(--line-soft)]">
              {filtered.map((r) => (
                <tr key={r.attendeeId}>
                  <Td>
                    <div className="font-bold text-[color:var(--ink)]">
                      {r.eventTitle}
                    </div>
                    <div className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                      {dateTimeFormatter.format(new Date(r.eventStartsAt))}
                    </div>
                  </Td>
                  <Td className="font-bold">{r.displayName}</Td>
                  <Td className="font-mono text-xs break-all">{r.email}</Td>
                  <Td>
                    <Pill tone={statusTone(r.status)}>{r.status}</Pill>
                  </Td>
                  <Td className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                    {dateTimeFormatter.format(new Date(r.rsvpAt))}
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => checkIn(r)}
                      disabled={isPending}
                      className={`rounded-full border-2 border-[color:var(--line)] px-3 py-1 text-xs font-bold uppercase tracking-wide hard-shadow-sm ${
                        r.checkedInAt
                          ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                          : "bg-[color:var(--cream)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                      } disabled:opacity-60`}
                    >
                      {r.checkedInAt ? "✓ Checked in" : "Check in"}
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function statusTone(status: string): "peach" | "rose" | "cream" | "ink" {
  if (status === "confirmed") return "peach";
  if (status === "waitlisted") return "rose";
  if (status === "cancelled") return "cream";
  return "ink";
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em]">
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}
