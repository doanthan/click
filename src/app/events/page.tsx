import { auth } from "@/auth";
import { EventExplorer } from "@/components/event-explorer";
import { getEventsForExplore, getProfileStatus } from "@/lib/event-repository";

export const metadata = {
  title: "Events | Click",
  description: "Click events, RSVP states, hosted cards, and discovery filters.",
};

export default async function EventsPage() {
  const session = await auth();
  const [events, profileStatus] = await Promise.all([
    getEventsForExplore(),
    session?.user ? getProfileStatus(session) : null,
  ]);

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <section className="bg-[color:var(--champagne)] py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
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
