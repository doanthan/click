import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AroundMeMap, type MapSpot } from "@/components/around-me-map";
import { getEventsForExplore, getProfileStatus, measureExploreFrom } from "@/lib/event-repository";
import { redirectIfNotOnboarded } from "@/lib/onboarding-gate";
import { distanceOriginForSuburb } from "@/lib/postcode";

export const metadata = {
  title: "What's around you",
  description: "Click events near you, on a map.",
};

export default async function AroundMePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/around-me");
  }

  const [catalogue, profileStatus] = await Promise.all([
    getEventsForExplore(),
    getProfileStatus(session),
  ]);
  redirectIfNotOnboarded(profileStatus, "/around-me");

  // Measured from the member's postcode, as on /discover (bug board #305).
  const home = distanceOriginForSuburb(profileStatus.suburb);
  const timeOf = (iso: string) => new Date(iso).getTime();
  // Nearest first, soonest breaking ties; events with no distance go last. A
  // copy, because the catalogue array is shared for the request.
  const events = [...measureExploreFrom(catalogue, home)].sort(
    (a, b) =>
      (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY) ||
      timeOf(a.startsAt) - timeOf(b.startsAt),
  );

  // A pin is the centre of the suburb the card already names, never the venue.
  // Until someone holds a seat the spec allows "suburb only" (runbook B5 item 5),
  // and getEventsForExplore has already kept every venue coordinate on the
  // server, so this page has no venue to leak. Events sharing a postcode share a
  // pin. An event whose suburb isn't in the postcode table stays in the list and
  // off the map.
  const spots = new Map<string, MapSpot>();
  for (const event of events) {
    const centre = distanceOriginForSuburb(event.suburb);
    if (!centre) continue;
    const key = `${centre.lat},${centre.lng}`;
    const spot = spots.get(key) ?? { key, lat: centre.lat, lng: centre.lng, suburbs: [], eventIds: [] };
    if (!spot.suburbs.includes(event.suburb)) spot.suburbs.push(event.suburb);
    spot.eventIds.push(event.id);
    spots.set(key, spot);
  }

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page pt-6">
        <h1 className="font-display text-[length:var(--text-h1)] leading-[1.25] font-semibold tracking-[-0.02em]">
          What&apos;s around you
        </h1>
        <p className="mt-1 text-sm font-medium text-[color:var(--slate)]">
          Pins mark the suburb, not the venue - the venue shows when you RSVP.
        </p>

        <AroundMeMap
          events={events}
          // Insertion order follows `events`, so the nearest pins come first.
          spots={[...spots.values()]}
          home={home ? { lat: home.lat, lng: home.lng } : null}
          degraded={Boolean(catalogue.degraded)}
          bookmarkedEventIds={profileStatus.bookmarkedEventIds}
          registeredEventIds={profileStatus.registeredEventIds}
          waitlistedEventIds={profileStatus.waitlistedEventIds}
        />
      </div>
    </main>
  );
}
