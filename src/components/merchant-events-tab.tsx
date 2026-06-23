import { Pill } from "@/components/click-ui";
import { EmptyState } from "@/components/empty-state";
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
    <div className="space-y-10 py-10">
      <TabHeader
        eyebrow="My events"
        title="Events & venues."
        body="Filter by status and click any row to open attendees, edit, or cancel."
        action={<CreateEventButton />}
      />

      <MerchantEventsPanel events={events} filterable />

      <section>
        <p className="eyebrow">Venues</p>
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Distinct venues across all your events. A full venues table with
          capacity and floor plans lands with the venue-management migration.
        </p>
        {venues.length > 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <article
                key={`${venue.locationName}-${venue.suburb}`}
                className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm"
              >
                <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                  Venue
                </span>
                <h3 className="font-display mt-2 text-2xl font-semibold leading-tight">
                  {venue.locationName}
                </h3>
                <p className="mt-2 text-sm font-semibold text-[color:var(--mauve)]">
                  {venue.suburb}
                </p>
                <Pill tone="peach">
                  {venue.count} event{venue.count === 1 ? "" : "s"}
                </Pill>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-6"
            eyebrow="No venues yet"
            title="Your venues show up here."
            body="Venues are pulled from the events you host. Create your first event and its location will be listed here automatically."
            actionHref="/merchant/events/create"
            actionLabel="Create an event →"
          />
        )}
      </section>
    </div>
  );
}
