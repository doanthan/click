import { auth } from "@/auth";
import { EventExplorer } from "@/components/event-explorer";
import { getEventsForExplore, getProfileStatus } from "@/lib/event-repository";

export const metadata = {
  title: "Discover | Click",
  description: "Browse local Click events near you by suburb, date, and vibe.",
};

export default async function DiscoverPage() {
  const session = await auth();
  const [events, profileStatus] = await Promise.all([
    getEventsForExplore(),
    session?.user ? getProfileStatus(session) : null,
  ]);

  return (
    <main className="paper-noise fit-viewport min-h-screen bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <section className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl min-w-0">
          <EventExplorer
            events={events}
            bookmarkedEventIds={profileStatus?.bookmarkedEventIds ?? []}
            registeredEventIds={profileStatus?.registeredEventIds ?? []}
          />
        </div>
      </section>
    </main>
  );
}
