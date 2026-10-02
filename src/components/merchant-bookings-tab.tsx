import Link from "next/link";
import type { Session } from "next-auth";
import { Badge } from "@/components/ds";
import { MerchantEmpty, SectionLabel, StatusPill, mCard } from "@/components/merchant-ds";
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
      {/* Bug board #316: no all-events attendee table here any more - who is
          coming, and checking them in, lives on each event's own page. */}
      <TabHeader
        eyebrow="Bookings"
        title="Everyone booked across your events."
        body="How each event is filling. Open one to see who's coming and check people in at the door."
      />

      {attendees.length === 0 ? (
        <MerchantEmpty
          icon="users"
          title="No one's booked in yet."
          body="As people RSVP, their events appear here with a count. Open an event for its door list."
          action={<CreateEventButton />}
        />
      ) : null}

      {/* The counts below come from the most recent seats only. A count that is
          short and says nothing is worse than one that says so. */}
      {attendees.length >= MERCHANT_DOOR_LIST_CAP ? (
        <p
          role="status"
          className="rounded-xl border border-[color-mix(in_srgb,var(--amber)_38%,transparent)] bg-[color-mix(in_srgb,var(--amber)_9%,var(--paper))] px-4 py-3 text-[13px] leading-relaxed text-[color:var(--ink-soft)]"
        >
          Counting your most recent {MERCHANT_DOOR_LIST_CAP} seats, so older events may be
          missing here. Open an event from the Events tab for its full door list.
        </p>
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
    </div>
  );
}
