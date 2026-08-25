import { Badge } from "@/components/ds";
import { MerchantEmpty, SectionLabel, mCard } from "@/components/merchant-ds";
import { MerchantEventsPanel } from "@/components/merchant-events-panel";
import {
  CreateEventButton,
  TabHeader,
  type MerchantEvent,
} from "./merchant-portal-shared";

export function EventsTab({
  events,
}: {
  events: MerchantEvent[];
}) {
  // Distinct venues, derived from events (folded in from the old Venues tab).
  const venues = Array.from(
    new Map(
      events.map((e) => [
        `${e.locationName}|${e.suburb}`,
        { locationName: e.locationName, suburb: e.suburb, count: 0 },
      ]),
    ).values(),
  );
  for (const e of events) {
    const v = venues.find((v) => v.locationName === e.locationName && v.suburb === e.suburb);
    if (v) v.count++;
  }

  return (
    <div className="space-y-7 py-8">
      {/* The screen's ONE "Create event" CTA. The empty states below never repeat it. */}
      <TabHeader
        eyebrow="My events"
        title="Events & venues."
        body="Filter by status; open any row to manage attendees, edit, or cancel."
        action={<CreateEventButton />}
      />

      <MerchantEventsPanel events={events} filterable />

      <section className="space-y-3 rise-soft rise-d1">
        <SectionLabel>Venues</SectionLabel>
        <p className="text-[13.5px] leading-relaxed text-[color:var(--slate)]">
          Distinct venues across your events - capacity and floor plans land with venue management.
        </p>
        {venues.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <article
                key={`${venue.locationName}-${venue.suburb}`}
                className={`${mCard} flex flex-col items-start gap-1.5 p-4`}
              >
                <span className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-[color:var(--ink-faint)]">
                  Venue
                </span>
                <h3 className="font-display text-[17px] font-semibold leading-tight text-[color:var(--ink)]">
                  {venue.locationName}
                </h3>
                <p className="text-[12.5px] text-[color:var(--slate)]">{venue.suburb}</p>
                <Badge tone="lavender">
                  {venue.count} {venue.count === 1 ? "event" : "events"}
                </Badge>
              </article>
            ))}
          </div>
        ) : (
          <MerchantEmpty
            icon="pin"
            title="Your venues show up here."
            body="Venues are pulled from the events you host. Create your first event and its location gets listed here automatically."
          />
        )}
      </section>
    </div>
  );
}
