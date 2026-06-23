import Link from "next/link";
import { auth } from "@/auth";
import { EventExplorer } from "@/components/event-explorer";
import { EventCard } from "@/components/event-card";
import {
  getEventsForExplore,
  getPersonalizedDiscovery,
  getProfileStatus,
} from "@/lib/event-repository";

export const metadata = {
  title: "Discover | Click",
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
  // Confirmed when registered but not waitlisted — drives the "View your
  // booking" → unlocked-page link vs the waitlist state on each card.
  const bookingStatusFor = (id: string): "confirmed" | "waitlisted" | undefined =>
    registeredSet.has(id)
      ? waitlistedSet.has(id)
        ? "waitlisted"
        : "confirmed"
      : undefined;

  return (
    <main className="paper-noise fit-viewport min-h-screen bg-[color:var(--champagne)] text-[color:var(--ink)]">
      {personalized && personalized.events.length > 0 ? (
        <section className="py-8 pl-4 pr-0 sm:py-10 sm:pl-6">
          {/* Heading stays bounded (mirrors the explorer's right margin); the
              rail below bleeds to the right viewport edge so cards peek
              off-screen. */}
          <div className="mr-4 flex flex-wrap items-end justify-between gap-3 sm:mr-6">
            <div>
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                {personalized.fallback ? "Editorial picks" : "For you"}
              </p>
              <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
                {personalized.heading}
              </h2>
              <p className="mt-1 text-sm font-medium text-[color:var(--mauve)]">
                {personalized.blurb}
              </p>
            </div>
            {personalized.fallback ? (
              <Link
                href="/profile/edit"
                className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hover:bg-[color:var(--rose)]"
              >
                Add interests
              </Link>
            ) : null}
          </div>
          <div className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pr-4 [scrollbar-width:thin] sm:pr-6">
            {personalized.events.map((event) => (
              <div key={event.id} className="w-[19rem] shrink-0 snap-start sm:w-[21rem]">
                <EventCard
                  event={event}
                  compact
                  bookmarked={bookmarkedSet.has(event.id)}
                  registered={registeredSet.has(event.id)}
                  bookingStatus={bookingStatusFor(event.id)}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="bg-[color:var(--champagne)] py-8 pl-4 pr-0 sm:py-10 sm:pl-6">
        <EventExplorer
          events={events}
          bookmarkedEventIds={profileStatus?.bookmarkedEventIds ?? []}
          registeredEventIds={profileStatus?.registeredEventIds ?? []}
          waitlistedEventIds={profileStatus?.waitlistedEventIds ?? []}
        />
      </section>
    </main>
  );
}
