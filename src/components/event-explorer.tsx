"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { categories, categorySlug, type EventItem } from "@/lib/click-data";
import { haversineKm, roundKm, type LatLng } from "@/lib/geo";
import { EventTileCard } from "./event-tile-card";
import { FilterSelect } from "./filter-select";
import { MapboxAutocomplete } from "./mapbox-autocomplete";

// Top of the radius slider. At the max we treat it as "any distance" so people
// far from the events (or who just want everything) aren't filtered to nothing.
const MAX_DISTANCE_KM = 50;

type DateWindow = "7" | "30" | "all";
type LocationStatus = "idle" | "requesting" | "shared" | "denied" | "unsupported";

function daysUntil(startsAt: string, referenceTime: number) {
  const eventDate = new Date(startsAt);
  const milliseconds = eventDate.getTime() - referenceTime;
  return Math.ceil(milliseconds / 86_400_000);
}

export function EventExplorer({
  events,
  bookmarkedEventIds = [],
}: {
  events: EventItem[];
  bookmarkedEventIds?: string[];
  registeredEventIds?: string[];
}) {
  const bookmarkedSet = useMemo(() => new Set(bookmarkedEventIds), [bookmarkedEventIds]);
  const router = useRouter();
  const pathname = usePathname();
  const urlParams = useSearchParams();
  const initialTag = urlParams?.get("tag") ?? "";

  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  // The user's real coordinates once they share location. When set, every
  // event's distance is recomputed from here instead of from Sydney CBD.
  const [userCoords, setUserCoords] = useState<LatLng | null>(null);
  const [locationQuery, setLocationQuery] = useState("Sydney CBD");
  const [selectedSuburb, setSelectedSuburb] = useState("All Sydney");
  const [dateWindow, setDateWindow] = useState<DateWindow>("all");
  const [distanceKm, setDistanceKm] = useState(MAX_DISTANCE_KM);
  const [tagFilter, setTagFilter] = useState(initialTag);
  const skipFirstSync = useRef(true);

  const todayTime = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }, []);

  const suburbs = useMemo(
    () => ["All Sydney", ...Array.from(new Set(events.map((event) => event.suburb))).sort()],
    [events],
  );

  // Recompute each event's distance from the user's shared location. Without a
  // location we keep the server's distance-from-CBD value.
  const locatedEvents = useMemo(() => {
    if (!userCoords) return events;
    return events.map((event) => ({
      ...event,
      distanceKm: roundKm(haversineKm(userCoords, { lat: event.lat, lng: event.lng })),
    }));
  }, [events, userCoords]);

  const filteredEvents = useMemo(() => {
    const normalizedTag = tagFilter.trim().toLowerCase();

    return locatedEvents
      .filter((event) => {
        const eventDays = daysUntil(event.startsAt, todayTime);
        const matchesDate =
          dateWindow === "all" ||
          (dateWindow === "7" && eventDays >= 0 && eventDays <= 7) ||
          (dateWindow === "30" && eventDays >= 0 && eventDays <= 30);
        const matchesSuburb =
          selectedSuburb === "All Sydney" || event.suburb === selectedSuburb;
        const matchesDistance =
          distanceKm >= MAX_DISTANCE_KM || event.distanceKm <= distanceKm;
        const matchesTag =
          !normalizedTag ||
          event.tags.some((tag) => tag.toLowerCase() === normalizedTag);

        return matchesDate && matchesSuburb && matchesDistance && matchesTag;
      })
      .sort((left, right) => {
        // Nearest first, breaking ties by soonest. This keeps the category
        // rows feeling spatially relevant without needing a sort selector.
        const distanceDelta = left.distanceKm - right.distanceKm;
        if (distanceDelta !== 0) return distanceDelta;
        return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
      });
  }, [
    dateWindow,
    distanceKm,
    locatedEvents,
    selectedSuburb,
    tagFilter,
    todayTime,
  ]);

  // Group filtered events under their category. We render every category that
  // actually appears on a live event — known categories first (canonical
  // order from click-data), then any others (e.g. admin-added categories like
  // "Nightlife") appended alphabetically. Driving the rails off the real data
  // instead of a hardcoded list means no live event is ever silently dropped
  // just because its category isn't in the static list. Categories with no
  // events (after filtering) still drop out so we don't render empty rails.
  const groupedByCategory = useMemo(() => {
    const known = categories.filter((c) => c !== "All");
    const present = Array.from(new Set(filteredEvents.map((event) => event.category)));
    const orderedCategories = [
      ...known.filter((category) => present.includes(category)),
      ...present.filter((category) => !known.includes(category)).sort(),
    ];
    return orderedCategories
      .map((category) => ({
        category,
        events: filteredEvents.filter((event) => event.category === category),
      }))
      .filter((group) => group.events.length > 0);
  }, [filteredEvents]);

  // Sync tag filter to URL so deep links from /events?tag=… still work.
  useEffect(() => {
    if (skipFirstSync.current) {
      skipFirstSync.current = false;
      return;
    }
    const next = new URLSearchParams();
    if (tagFilter.trim()) next.set("tag", tagFilter.trim());
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [tagFilter, router, pathname]);

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unsupported");
      return;
    }

    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus("shared");
        setLocationQuery("Your current location");
        setSelectedSuburb("All Sydney");
      },
      () => {
        setLocationStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }

  function clearLocation() {
    setUserCoords(null);
    setLocationStatus("idle");
    setLocationQuery("Sydney CBD");
  }

  function resetFilters() {
    setSelectedSuburb("All Sydney");
    setDateWindow("all");
    setDistanceKm(MAX_DISTANCE_KM);
    setTagFilter("");
  }

  const totalCount = filteredEvents.length;
  const distanceLabel =
    distanceKm >= MAX_DISTANCE_KM ? "Any distance" : `${distanceKm} km`;
  const locationLabel = userCoords ? "from you" : "from Sydney CBD";

  return (
    <div className="flex flex-col gap-8">
      {/* Compact filter bar — only suburb, date, and distance from location.
          Right margin keeps the chrome bounded while the rails below bleed
          to the viewport edge. */}
      <section className="mr-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--cream)] p-5 shadow-sm sm:mr-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[color:var(--rose)]">
              Discover events
            </p>
            <h1 className="mt-1 text-3xl font-black leading-none sm:text-4xl">
              Browse what&apos;s on around you.
            </h1>
            <p className="mt-2 text-sm font-bold text-[color:var(--mauve)]">
              {totalCount} {totalCount === 1 ? "event" : "events"} matching your filters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={requestLocation}
              className="min-h-11 rounded-full bg-[color:var(--rose)] px-5 text-sm font-black text-[color:var(--on-deep)] shadow-sm hover:opacity-90"
            >
              {locationStatus === "requesting"
                ? "Locating…"
                : userCoords
                  ? "Update location"
                  : "Share my location"}
            </button>
            {userCoords ? (
              <button
                type="button"
                onClick={clearLocation}
                className="min-h-11 rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
              >
                Use Sydney CBD
              </button>
            ) : null}
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-11 rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--mauve)]">
            Location
            <MapboxAutocomplete
              value={locationQuery}
              onValueChange={setLocationQuery}
              onSelect={(place) => {
                // Picking a place mirrors GPS sharing — we centre the radius on
                // the selected address so every distance is relative to it.
                setUserCoords({ lat: place.lat, lng: place.lng });
                setLocationStatus("shared");
                setLocationQuery(place.suburb || place.name || place.address);
                setSelectedSuburb("All Sydney");
              }}
              placeholder="Bondi, Parramatta, Sydney CBD"
            />
          </label>

          <div className="grid gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--mauve)]">
            Suburb
            <FilterSelect
              ariaLabel="Filter by suburb"
              value={selectedSuburb}
              onChange={setSelectedSuburb}
              options={suburbs.map((suburb) => ({ value: suburb, label: suburb }))}
            />
          </div>

          <div className="grid gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--mauve)]">
            Date
            <FilterSelect
              ariaLabel="Filter by date"
              value={dateWindow}
              onChange={(next) => setDateWindow(next as DateWindow)}
              options={[
                { value: "7", label: "Next 7 days" },
                { value: "30", label: "Next 30 days" },
                { value: "all", label: "Any upcoming date" },
              ]}
            />
          </div>

          <label className="grid gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--mauve)]">
            <span className="flex items-center justify-between">
              <span>Distance</span>
              <span className="text-[color:var(--rose)] normal-case tracking-normal">
                {distanceLabel}
                <span className="ml-1 text-[10px] font-bold text-[color:var(--mauve)]">
                  {locationLabel}
                </span>
              </span>
            </span>
            <input
              type="range"
              min={2}
              max={MAX_DISTANCE_KM}
              step={1}
              value={distanceKm}
              onChange={(event) => setDistanceKm(Number(event.target.value))}
              className="mt-2 accent-[color:var(--rose)]"
            />
          </label>
        </div>

        {tagFilter ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-2 text-sm font-bold text-[color:var(--ink)]">
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--mauve)]">
              Tag filter
            </span>
            <span>#{tagFilter}</span>
            <button
              type="button"
              onClick={() => setTagFilter("")}
              className="ml-auto rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            >
              Clear
            </button>
          </div>
        ) : null}
      </section>

      {/* Category sections — one horizontal-scroll rail per category that has
          matching events. Hidden scrollbar keeps the rails feeling like
          ClassBento/Airbnb browse rows. */}
      {groupedByCategory.length > 0 ? (
        <div className="flex flex-col gap-10">
          {groupedByCategory.map(({ category, events: categoryEvents }) => (
            <section key={category}>
              {/* Heading row stays bounded — mirrors the filter card's right margin.
                  The title links to the dedicated /categories/<slug> browse page. */}
              <div className="mr-4 flex items-baseline justify-between gap-3 sm:mr-6">
                <Link
                  href={`/categories/${categorySlug(category)}`}
                  className="group/heading inline-flex items-baseline gap-2 text-2xl font-black text-[color:var(--ink)] hover:text-[color:var(--punch)] sm:text-3xl"
                >
                  {category}
                  <span
                    aria-hidden
                    className="text-lg transition-transform group-hover/heading:translate-x-1 sm:text-xl"
                  >
                    →
                  </span>
                </Link>
                <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                  {categoryEvents.length} {categoryEvents.length === 1 ? "event" : "events"}
                </span>
              </div>
              {/* Horizontal rail bleeds to the right viewport edge so cards
                  peek off-screen — signals "more inventory" instantly. */}
              <div className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pr-4 [scrollbar-width:thin] sm:pr-6">
                {categoryEvents.map((event) => (
                  <div key={event.id} className="shrink-0 snap-start">
                    <EventTileCard
                      event={event}
                      bookmarked={bookmarkedSet.has(event.id)}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mr-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-8 text-center shadow-sm sm:mr-6">
          <p className="text-3xl font-black leading-none text-[color:var(--ink)]">
            No events match those filters.
          </p>
          <p className="mt-3 text-sm font-bold text-[color:var(--mauve)]">
            Try a wider distance, all Sydney, or the next 30 days.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-5 rounded-full bg-[color:var(--surface-deep)] px-5 py-3 text-sm font-black text-[color:var(--on-deep)] hover:opacity-90"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
