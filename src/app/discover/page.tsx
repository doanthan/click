import { auth } from "@/auth";
import { EventExplorer } from "@/components/event-explorer";
import { getEventsForExplore, getProfileStatus } from "@/lib/event-repository";

export const metadata = {
  title: "Discover | Click",
  description: "Browse local Click events near you by suburb, date, and vibe.",
};

const proofStats = [
  ["18", "Sydney suburbs"],
  ["64", "weekly events"],
  ["4 hr", "card refresh"],
];

export default async function DiscoverPage() {
  const session = await auth();
  const [events, profileStatus] = await Promise.all([
    getEventsForExplore(),
    session?.user ? getProfileStatus(session) : null,
  ]);

  return (
    <main className="paper-noise fit-viewport min-h-screen overflow-hidden bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <section className="border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-end lg:py-14">
          <div className="min-w-0">
            <span className="sticker sticker--peach">Sydney social calendar</span>
            <h1 className="font-display mt-6 max-w-[23rem] text-[2.75rem] font-light leading-[0.96] tracking-tight sm:max-w-4xl sm:text-6xl lg:text-7xl">
              Find your people through things worth leaving the house for.
            </h1>
            <p className="mt-5 max-w-[22rem] text-base font-bold leading-7 text-[color:var(--mauve)] sm:max-w-2xl sm:text-lg">
              Browse what&apos;s on near you: friends in Marrickville, a CrossFit
              crew, weekend walks, singles dinners, pottery nights, or a
              low-pressure way to meet locals nearby.
            </p>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {proofStats.map(([value, label]) => (
              <div
                key={label}
                className="rounded-lg border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4 hard-shadow-sm"
              >
                <p className="font-display text-4xl font-light italic leading-none text-[color:var(--rose)]">
                  {value}
                </p>
                <p className="font-mono mt-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
