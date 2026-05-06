"use client";

import { useState } from "react";
import type { AdminEventRow } from "@/lib/event-repository";

export function AdminEventQueue({ events }: { events: AdminEventRow[] }) {
  const [rows, setRows] = useState(events);
  const [message, setMessage] = useState("");

  async function approve(eventId: string) {
    setMessage("");

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
  }

  return (
    <div className="mt-10 overflow-hidden rounded-lg border border-black/10 bg-[#fffdf7] shadow-sm">
      <div className="hidden grid-cols-[1.35fr_0.7fr_0.7fr_0.7fr_0.8fr_0.8fr] gap-4 bg-[#1f1f1f] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white md:grid">
        <span>Event</span>
        <span>Category</span>
        <span>Status</span>
        <span>Booking</span>
        <span>Going</span>
        <span>Action</span>
      </div>
      {message ? (
        <p className="border-b border-black/10 bg-[#d8f3ef] px-4 py-3 text-sm font-black">
          {message}
        </p>
      ) : null}
      {rows.map((event) => (
        <div
          key={event.id}
          className="grid gap-3 border-b border-black/10 px-4 py-4 text-sm font-bold text-[#1f1f1f]/68 last:border-0 md:grid-cols-[1.35fr_0.7fr_0.7fr_0.7fr_0.8fr_0.8fr] md:items-center"
        >
          <span className="font-black text-[#1f1f1f]">{event.title}</span>
          <span>{event.category}</span>
          <span>{event.status}</span>
          <span>{event.booking}</span>
          <span>
            {event.attendees}/{event.capacity}
          </span>
          {event.status === "Pending" ? (
            <button
              type="button"
              onClick={() => approve(event.id)}
              className="w-fit rounded-full bg-[#1f1f1f] px-4 py-2 text-xs font-black text-white"
            >
              Approve
            </button>
          ) : (
            <span className="w-fit rounded-full border border-black/10 px-4 py-2 text-xs font-black">
              Inspect
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
