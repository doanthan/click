"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pill } from "@/components/click-ui";
import type { MerchantAttendeeRow } from "@/lib/event-repository";

type Props = {
  eventSlug: string;
  eventTitle: string;
  attendees: MerchantAttendeeRow[];
};

const rsvpDateFormatter = new Intl.DateTimeFormat("en-AU", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Sydney",
});

function attendeeRowTone(status: MerchantAttendeeRow["status"]) {
  if (status === "confirmed") return "cream" as const;
  if (status === "waitlisted") return "peach" as const;
  return "ink" as const;
}

function escapeCsv(value: string | null | undefined) {
  if (value == null) return "";
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function MerchantAttendees({ eventSlug, eventTitle, attendees }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(attendees);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const checkedInCount = rows.filter((row) => row.checkedInAt).length;

  async function toggleCheckIn(attendee: MerchantAttendeeRow) {
    setPendingId(attendee.attendeeId);
    const nextChecked = !attendee.checkedInAt;

    try {
      const response = await fetch(
        `/api/merchant/attendees/${attendee.attendeeId}/check-in`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkedIn: nextChecked }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Couldn't update check-in.");
        return;
      }

      setRows((current) =>
        current.map((row) =>
          row.attendeeId === attendee.attendeeId
            ? { ...row, checkedInAt: data.checkedInAt }
            : row,
        ),
      );
      toast.success(nextChecked ? "Checked in." : "Check-in cleared.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setPendingId(null);
    }
  }

  function exportCsv() {
    const header = ["Name", "Email", "Status", "RSVP at", "Checked in at"];
    const lines = [
      header.join(","),
      ...rows.map((row) =>
        [
          row.displayName,
          row.email,
          row.status,
          row.rsvpAt,
          row.checkedInAt ?? "",
        ]
          .map(escapeCsv)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${eventSlug}-attendees.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("CSV exported.");
  }

  if (rows.length === 0) {
    return (
      <p className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-5 text-sm font-semibold text-[color:var(--mauve)]">
        When attendees RSVP they appear here so you can check them in and export the list.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-[color:var(--mauve)]">
          {checkedInCount} / {rows.length} checked in
        </p>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[color:var(--champagne)] hard-shadow-sm hover:bg-[color:var(--ink-deep)]"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
        <div className="grid grid-cols-[1.2fr_1.2fr_0.6fr_0.7fr_0.6fr] gap-3 border-b-2 border-[color:var(--line)] bg-[color:var(--surface-deep)] px-5 py-3 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--on-deep)]/80 max-md:hidden">
          <span>Name</span>
          <span>Email</span>
          <span>RSVP&apos;d</span>
          <span>Status</span>
          <span>Check-in</span>
        </div>
        {rows.map((attendee) => {
          const isBusy = pendingId === attendee.attendeeId;
          const isCheckedIn = !!attendee.checkedInAt;
          return (
            <div
              key={attendee.attendeeId}
              className="grid gap-3 border-t-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-4 md:grid-cols-[1.2fr_1.2fr_0.6fr_0.7fr_0.6fr] md:items-center"
            >
              <p className="text-sm font-bold text-[color:var(--ink)]">
                {attendee.displayName}
              </p>
              <p className="break-all font-mono text-[0.75rem] text-[color:var(--mauve)]">
                {attendee.email}
              </p>
              <p className="text-sm font-semibold text-[color:var(--mauve)]">
                {rsvpDateFormatter.format(new Date(attendee.rsvpAt))}
              </p>
              <Pill tone={attendeeRowTone(attendee.status)}>{attendee.status}</Pill>
              <button
                type="button"
                onClick={() => toggleCheckIn(attendee)}
                disabled={isBusy || attendee.status !== "confirmed"}
                aria-pressed={isCheckedIn}
                title={eventTitle}
                className={
                  isCheckedIn
                    ? "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[color:var(--champagne)]"
                    : "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[color:var(--surface-deep)] disabled:opacity-50"
                }
              >
                {isBusy ? "…" : isCheckedIn ? "Checked ✓" : "Check in"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
