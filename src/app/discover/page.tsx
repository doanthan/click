import Link from "next/link";
import { auth } from "@/auth";
import { EventExplorer } from "@/components/event-explorer";
import { EventCard } from "@/components/event-card";
import {
  getEventsForExplore,
  getPersonalizedDiscovery,
  getProfileStatus,
  measureExploreFrom,
} from "@/lib/event-repository";
import { distanceOriginForSuburb } from "@/lib/postcode";

export const metadata = {
  title: "Discover",
  description: "Browse local Click events near you by suburb, date, and vibe.",
};

export default async function DiscoverPage() {
  const session = await auth();
  const [events, profileStatus, personalized] = await Promise.all([
    getEventsForExplore(),
    session?.user ? getProfileStatus(session) : null,
    session?.user ? getPersonalizedDiscovery(session) : null,
  ]);

  // A member's distances are measured from their postcode, everyone else's from
  // Sydney CBD (bug board #305). Only the server can do it - the venue
  // coordinates never reach the browser.
  const origin = distanceOriginForSuburb(profileStatus?.suburb);
  const railEvents = measureExploreFrom(personalized?.events ?? [], origin);

  const bookmarkedSet = new Set(profileStatus?.bookmarkedEventIds ?? []);
  const registeredSet = new Set(profileStatus?.registeredEventIds ?? []);
  const waitlistedSet = new Set(profileStatus?.waitlistedEventIds ?? []);
  // Confirmed when registered but not waitlisted - drives the "You're going"
  // → unlocked-page link vs the waitlist state on each card.
  const bookingStatusFor = (id: string): "confirmed" | "waitlisted" | undefined =>
    registeredSet.has(id) ? (waitlistedSet.has(id) ? "waitlisted" : "confirmed") : undefined;

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      {personalized && railEvents.length > 0 ? (
        <section className="ck-page pt-6 pb-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-[length:var(--text-h2)] leading-tight font-semibold tracking-[-0.02em]">
                {personalized.heading}
              </h2>
              <p className="mt-1 text-sm font-medium text-[color:var(--slate)]">{personalized.blurb}</p>
            </div>
            {personalized.fallback ? (
              <Link
                href="/profile/edit"
                className="font-display text-[13.5px] font-semibold text-[color:var(--purple)] hover:underline"
              >
                Add interests →
              </Link>
            ) : null}
          </div>
          <div className="ckRail mt-4 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2">
            {railEvents.map((event, index) => (
              <div key={event.id} className="w-[19rem] shrink-0 snap-start sm:w-[21rem]">
                <EventCard
                  event={event}
                  bookmarked={bookmarkedSet.has(event.id)}
                  registered={registeredSet.has(event.id)}
                  bookingStatus={bookingStatusFor(event.id)}
                  // This rail sits ABOVE the grid, so its first cover is the LCP
                  // on a signed-in load.
                  priority={index === 0}
                  // From the member's postcode, which needs no label; from the
                  // CBD it has to say so, the same way the grid's cards do.
                  distanceOrigin={origin ? undefined : "CBD"}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="ck-page pt-6">
        <EventExplorer
          events={measureExploreFrom(events, origin)}
          degraded={Boolean(events.degraded)}
          distanceFrom={origin?.label ?? null}
          signedIn={Boolean(session?.user)}
          bookmarkedEventIds={profileStatus?.bookmarkedEventIds ?? []}
          registeredEventIds={profileStatus?.registeredEventIds ?? []}
          waitlistedEventIds={profileStatus?.waitlistedEventIds ?? []}
        />
      </section>
    </main>
  );
}
