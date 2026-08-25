import Link from "next/link";
import { auth } from "@/auth";
import { EventExplorer } from "@/components/event-explorer";
import { EventCard } from "@/components/event-card";
import { getEventsForExplore, getPersonalizedDiscovery, getProfileStatus } from "@/lib/event-repository";

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

  const bookmarkedSet = new Set(profileStatus?.bookmarkedEventIds ?? []);
  const registeredSet = new Set(profileStatus?.registeredEventIds ?? []);
  const waitlistedSet = new Set(profileStatus?.waitlistedEventIds ?? []);
  // Confirmed when registered but not waitlisted - drives the "You're going"
  // → unlocked-page link vs the waitlist state on each card.
  const bookingStatusFor = (id: string): "confirmed" | "waitlisted" | undefined =>
    registeredSet.has(id) ? (waitlistedSet.has(id) ? "waitlisted" : "confirmed") : undefined;

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      {personalized && personalized.events.length > 0 ? (
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
            {personalized.events.map((event, index) => (
              <div key={event.id} className="w-[19rem] shrink-0 snap-start sm:w-[21rem]">
                <EventCard
                  event={event}
                  bookmarked={bookmarkedSet.has(event.id)}
                  registered={registeredSet.has(event.id)}
                  bookingStatus={bookingStatusFor(event.id)}
                  // This rail sits ABOVE the grid, so its first cover is the LCP
                  // on a signed-in load.
                  priority={index === 0}
                  // Server-rendered, so there is never a shared location here -
                  // the distance is always from the CBD and has to say so, the
                  // same way the grid's cards do.
                  distanceOrigin="CBD"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="ck-page pt-6">
        <EventExplorer
          events={events}
          degraded={Boolean(events.degraded)}
          bookmarkedEventIds={profileStatus?.bookmarkedEventIds ?? []}
          registeredEventIds={profileStatus?.registeredEventIds ?? []}
          waitlistedEventIds={profileStatus?.waitlistedEventIds ?? []}
        />
      </section>
    </main>
  );
}
