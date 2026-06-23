import Link from "next/link";
import type { Session } from "next-auth";
import { Pill } from "@/components/click-ui";
import { EmptyState } from "@/components/empty-state";
import { MerchantAttendeesPanel } from "@/components/merchant-attendees-panel";
import { getMerchantAllAttendees } from "@/lib/event-repository";
import { TabHeader } from "./merchant-portal-shared";

export async function BookingsTabAsync({
  session,
}: {
  session: Session | null;
}) {
  const attendees = await getMerchantAllAttendees(session);

  // Per-event summary (folded in from the old Bookings tab).
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
    <div className="space-y-10 py-10">
      <TabHeader
        eyebrow="Bookings"
        title="Everyone booked across your events."
        body="Per-event status counts up top; toggle check-in or export the full door list below."
      />

      {attendees.length === 0 ? (
        <EmptyState
          eyebrow="No bookings yet"
          title="No one's booked in yet."
          body="As people RSVP to your events, they'll appear here — grouped by event up top, with a full door list to check in and export below. Publish an event to start taking bookings."
          actionHref="/merchant/events/create"
          actionLabel="Create an event →"
        />
      ) : null}

      {grouped.size > 0 ? (
        <section>
          <p className="eyebrow">By event</p>
          <ul className="mt-6 space-y-4">
            {Array.from(grouped.entries()).map(([slug, list]) => {
              const confirmed = list.filter((a) => a.status === "confirmed").length;
              const waitlisted = list.filter((a) => a.status === "waitlisted").length;
              const cancelled = list.filter((a) => a.status === "cancelled").length;
              // Past events stay in the bookings list (no time filter on the
              // query) so a merchant can always review who attended — flag them
              // "Ended" so it's clear the door list is historical, not live.
              // eslint-disable-next-line react-hooks/purity -- async server component, evaluated once per request
              const hasEnded = new Date(list[0].eventStartsAt).getTime() < Date.now();
              // Surface a rejected/cancelled event so the merchant knows this
              // event is NOT live (#193). Takes precedence over the "Ended" tag.
              const eventStatus = eventStatusBySlug.get(slug) ?? "live";
              const notLiveLabel =
                eventStatus === "rejected"
                  ? "Rejected"
                  : eventStatus === "cancelled"
                    ? "Cancelled"
                    : null;
              return (
                <li
                  key={slug}
                  className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                        Event {notLiveLabel ? `· ${notLiveLabel}` : hasEnded ? "· Ended" : ""}
                      </span>
                      <Link
                        href={`/merchant/events/${slug}`}
                        className="font-display block text-2xl font-semibold leading-tight hover:text-[color:var(--coral)]"
                      >
                        {list[0].eventTitle}
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {notLiveLabel ? <Pill tone="ink">Not live · {notLiveLabel}</Pill> : null}
                      {hasEnded ? <Pill tone="cream">Ended</Pill> : null}
                      <Pill tone="peach">{confirmed} confirmed</Pill>
                      <Pill tone="rose">{waitlisted} waitlist</Pill>
                      <Pill tone="cream">{cancelled} cancelled</Pill>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {attendees.length > 0 ? (
        <section>
          <p className="eyebrow">All attendees</p>
          <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            Toggle check-in on the day. Export to CSV for door lists.
          </p>
          <div className="mt-6">
            <MerchantAttendeesPanel rows={attendees} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
