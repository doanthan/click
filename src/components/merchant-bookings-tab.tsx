import Link from "next/link";
import type { Session } from "next-auth";
import { Badge } from "@/components/ds";
import { MerchantEmpty, SectionLabel, StatusPill, mCard } from "@/components/merchant-ds";
import { MerchantAttendeesPanel } from "@/components/merchant-attendees-panel";
import {
  MERCHANT_DOOR_LIST_CAP,
  getMerchantAllAttendees,
} from "@/lib/event-repository";
import { CreateEventButton, TabHeader } from "./merchant-portal-shared";

export async function BookingsTabAsync({
  session,
}: {
  session: Session | null;
}) {
  const attendees = await getMerchantAllAttendees(session);

  // Per-event summary.
  const grouped = new Map<string, typeof attendees>();
  // The owning event's publish status, so a rejected/cancelled event is flagged
  // here rather than looking like a normal live booking list (#193).
  const eventStatusBySlug = new Map<string, string>();
  for (const a of attendees) {
    const list = grouped.get(a.eventSlug) ?? [];
    list.push(a);
    grouped.set(a.eventSlug, list);
    eventStatusBySlug.set(a.eventSlug, a.eventStatus);
  }

  return (
    <div className="space-y-7 py-8">
      <TabHeader
        eyebrow="Bookings"
        title="Everyone booked across your events."
        body="Per-event counts up top; search, check in, or export the full door list below."
      />

      {attendees.length === 0 ? (
        <MerchantEmpty
          icon="users"
          title="No one's booked in yet."
          body="As people RSVP, they appear here - grouped by event up top, with a full door list to check in and export below."
          action={<CreateEventButton />}
        />
      ) : null}

      {grouped.size > 0 ? (
        <section className="space-y-3 rise-soft rise-d1">
          <SectionLabel>By event</SectionLabel>
          <ul className="grid gap-2.5 lg:grid-cols-2">
            {Array.from(grouped.entries()).map(([slug, list]) => {
              const confirmed = list.filter((a) => a.status === "confirmed").length;
              const waitlisted = list.filter((a) => a.status === "waitlisted").length;
              const cancelled = list.filter((a) => a.status === "cancelled").length;
              // Past events stay in the bookings list (no time filter on the
              // query) so a merchant can always review who attended - flag them
              // "Ended" so it's clear the door list is historical, not live.
              // eslint-disable-next-line react-hooks/purity -- async server component, evaluated once per request
              const hasEnded = new Date(list[0].eventStartsAt).getTime() < Date.now();
              // Surface a rejected/cancelled event so the merchant knows this
              // event is NOT live (#193). Takes precedence over "Ended".
              const eventStatus = eventStatusBySlug.get(slug) ?? "live";
              const notLive =
                eventStatus === "rejected" || eventStatus === "cancelled" ? eventStatus : null;

              return (
                <li key={slug} className={`${mCard} flex flex-wrap items-center gap-3 px-4 py-3.5`}>
                  <div className="min-w-0 flex-[1_1_150px]">
                    <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--ink-faint)]">
                      Event
                    </p>
                    <Link
                      href={`/merchant/events/${slug}`}
                      className="font-display block truncate text-[15.5px] font-semibold leading-tight text-[color:var(--ink)] hover:text-[color:var(--purple)]"
                    >
                      {list[0].eventTitle}
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {notLive ? <StatusPill status={notLive} /> : null}
                    {!notLive && hasEnded ? <StatusPill status="ended" /> : null}
                    {/* Lavender = confirmed bookings; Amber = waiting. */}
                    <Badge tone="lavender">{confirmed} confirmed</Badge>
                    {waitlisted > 0 ? <Badge tone="amber">{waitlisted} waitlist</Badge> : null}
                    {cancelled > 0 ? <Badge tone="neutral">{cancelled} cancelled</Badge> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {attendees.length > 0 ? (
        <section className="space-y-3 rise-soft rise-d2">
          <SectionLabel>All attendees</SectionLabel>
          <p className="text-[13.5px] leading-relaxed text-[color:var(--slate)]">
            Ticket-holders and their +1s, together. Check people in on the day, or
            export the door list to CSV.
          </p>
          {/* A truncated door list that says nothing is worse than a slow one:
              it exports to CSV and goes to a door short of the people at the
              end of it. Say so, and say which end got cut. */}
          {attendees.length >= MERCHANT_DOOR_LIST_CAP ? (
            <p
              role="status"
              className="rounded-xl border border-[color-mix(in_srgb,var(--amber)_38%,transparent)] bg-[color-mix(in_srgb,var(--amber)_9%,var(--paper))] px-4 py-3 text-[13px] leading-relaxed text-[color:var(--ink-soft)]"
            >
              Showing your most recent {MERCHANT_DOOR_LIST_CAP} seats. Older events
              are not in this list or its CSV - open an event from the Events tab
              for its own full door list.
            </p>
          ) : null}
          <MerchantAttendeesPanel rows={attendees} />
        </section>
      ) : null}
    </div>
  );
}
