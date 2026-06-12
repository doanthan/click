"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { categories, categorySlug, type EventItem } from "@/lib/click-data";
import { haversineKm, roundKm, type LatLng } from "@/lib/geo";
import { EventCard } from "./event-card";
import { FilterSelect } from "./filter-select";
import { MapboxAutocomplete } from "./mapbox-autocomplete";

// Top of the radius control. At the max we treat it as "any distance" so people
// far from the events (or who just want everything) aren't filtered to nothing.
const MAX_DISTANCE_KM = 50;

// Tap-friendly radius presets — replaces a fiddly range slider that's painful
// on touch. The last entry maps to MAX_DISTANCE_KM ("any distance").
const DISTANCE_OPTIONS = [2, 5, 10, 25, MAX_DISTANCE_KM] as const;

// Emoji glyphs for the top category nav. Keys match the canonical category
// names in click-data; unmapped (e.g. admin-added) categories fall back to a
// neutral pin so the bar never renders a blank chip.
const CATEGORY_ICONS: Record<string, string> = {
  Social: "🎉",
  Fitness: "🏋️",
  Relationships: "💞",
  Food: "🍽️",
  Creative: "🎨",
  Career: "💼",
  Community: "🤝",
  Family: "🧸",
  Games: "🎲",
  Learning: "📚",
  Nightlife: "🌃",
  Outdoors: "🏞️",
  Sports: "⚽",
  Travel: "✈️",
  Wellness: "🧘",
};
const CATEGORY_ICON_FALLBACK = "📍";

type DateWindow = "today" | "tomorrow" | "weekend" | "7" | "30" | "all";
type SortMode = "soonest" | "nearest" | "popular";
type TimeOfDay = "all" | "day" | "night";
type ViewMode = "rails" | "grid";
type LocationStatus = "idle" | "requesting" | "shared" | "denied" | "unsupported";

function daysUntil(startsAt: string, referenceTime: number) {
  const eventDate = new Date(startsAt);
  const milliseconds = eventDate.getTime() - referenceTime;
  return Math.ceil(milliseconds / 86_400_000);
}

// Whether an event falls within the selected date window. "weekend" = the
// upcoming Sat/Sun (today counts if it's already the weekend).
function matchesDateWindow(startsAt: string, dateWindow: DateWindow, todayTime: number) {
  if (dateWindow === "all") return true;
  const eventDays = daysUntil(startsAt, todayTime);
  if (eventDays < 0) return false;
  if (dateWindow === "7") return eventDays <= 7;
  if (dateWindow === "30") return eventDays <= 30;
  if (dateWindow === "today") return eventDays === 0;
  if (dateWindow === "tomorrow") return eventDays === 1;
  if (dateWindow === "weekend") {
    const day = new Date(startsAt).getDay(); // 0 Sun … 6 Sat
    const isWeekendDay = day === 6 || day === 0;
    // Within the next 7 days and lands on Sat/Sun.
    return isWeekendDay && eventDays <= 7;
  }
  return true;
}

// Day vs night by local start hour. Evening (5pm+) reads as "night time".
function isNightEvent(startsAt: string) {
  return new Date(startsAt).getHours() >= 17;
}

function isFreeEvent(event: EventItem) {
  return !event.price || event.price.trim().toLowerCase() === "free";
}

export function EventExplorer({
  events,
  bookmarkedEventIds = [],
  registeredEventIds = [],
  waitlistedEventIds = [],
}: {
  events: EventItem[];
  bookmarkedEventIds?: string[];
  registeredEventIds?: string[];
  waitlistedEventIds?: string[];
}) {
  const bookmarkedSet = useMemo(() => new Set(bookmarkedEventIds), [bookmarkedEventIds]);
  const registeredSet = useMemo(() => new Set(registeredEventIds), [registeredEventIds]);
  const waitlistedSet = useMemo(() => new Set(waitlistedEventIds), [waitlistedEventIds]);
  // Confirmed = registered but not waitlisted. Lets each card link a confirmed
  // attendee to their unlocked event page instead of guessing from fullness.
  const bookingStatusFor = (id: string): "confirmed" | "waitlisted" | undefined =>
    registeredSet.has(id)
      ? waitlistedSet.has(id)
        ? "waitlisted"
        : "confirmed"
      : undefined;
  const router = useRouter();
  const pathname = usePathname();
  const urlParams = useSearchParams();
  const initialTag = urlParams?.get("tag") ?? "";
  const initialCategory = urlParams?.get("category") ?? "";

  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  // The user's real coordinates once they share location. When set, every
  // event's distance is recomputed from here instead of from Sydney CBD.
  const [userCoords, setUserCoords] = useState<LatLng | null>(null);
  const [locationQuery, setLocationQuery] = useState("Sydney CBD");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSuburb, setSelectedSuburb] = useState("All Sydney");
  const [dateWindow, setDateWindow] = useState<DateWindow>("all");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("all");
  const [freeOnly, setFreeOnly] = useState(false);
  const [distanceKm, setDistanceKm] = useState(MAX_DISTANCE_KM);
  const [sortMode, setSortMode] = useState<SortMode>("nearest");
  const [viewMode, setViewMode] = useState<ViewMode>("rails");
  const [tagFilter, setTagFilter] = useState(initialTag);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
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
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return locatedEvents
      .filter((event) => {
        const matchesDate = matchesDateWindow(event.startsAt, dateWindow, todayTime);
        const matchesTime =
          timeOfDay === "all" ||
          (timeOfDay === "night" ? isNightEvent(event.startsAt) : !isNightEvent(event.startsAt));
        const matchesFree = !freeOnly || isFreeEvent(event);
        const matchesSuburb =
          selectedSuburb === "All Sydney" || event.suburb === selectedSuburb;
        const matchesDistance =
          distanceKm >= MAX_DISTANCE_KM || event.distanceKm <= distanceKm;
        const matchesTag =
          !normalizedTag ||
          event.tags.some((tag) => tag.toLowerCase() === normalizedTag);
        const matchesCategory = !categoryFilter || event.category === categoryFilter;
        const matchesSearch =
          !normalizedSearch ||
          [event.title, event.host, event.category, event.suburb, event.location, ...event.tags]
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch);

        return (
          matchesDate &&
          matchesTime &&
          matchesFree &&
          matchesSuburb &&
          matchesDistance &&
          matchesTag &&
          matchesCategory &&
          matchesSearch
        );
      })
      .sort((left, right) => {
        if (sortMode === "popular") {
          if (right.attendees !== left.attendees) return right.attendees - left.attendees;
          return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
        }
        if (sortMode === "soonest") {
          const timeDelta =
            new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
          if (timeDelta !== 0) return timeDelta;
          return left.distanceKm - right.distanceKm;
        }
        // "nearest" (default): closest first, breaking ties by soonest.
        const distanceDelta = left.distanceKm - right.distanceKm;
        if (distanceDelta !== 0) return distanceDelta;
        return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
      });
  }, [
    categoryFilter,
    dateWindow,
    timeOfDay,
    freeOnly,
    distanceKm,
    locatedEvents,
    searchQuery,
    selectedSuburb,
    sortMode,
    tagFilter,
    todayTime,
  ]);

  // Predefined categories that actually have events (computed from the full
  // set so the bar stays stable as other filters change), in canonical order,
  // with any admin-added categories appended. Powers the icon nav at the top.
  // Top category nav shows the full predefined set (with icons) so people can
  // always browse by category, even categories that currently have no live
  // event — plus any admin-added categories that do appear on events.
  const availableCategories = useMemo(() => {
    const present = new Set(events.map((event) => event.category));
    const known = categories.filter((c) => c !== "All");
    const extra = Array.from(present)
      .filter((c) => !categories.includes(c))
      .sort();
    return [...known, ...extra];
  }, [events]);

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
    if (categoryFilter) next.set("category", categoryFilter);
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [tagFilter, categoryFilter, router, pathname]);

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
    setSearchQuery("");
    setSelectedSuburb("All Sydney");
    setDateWindow("all");
    setDistanceKm(MAX_DISTANCE_KM);
    setTagFilter("");
    setCategoryFilter("");
  }

  const totalCount = filteredEvents.length;
  const locationLabel = userCoords ? "from you" : "from Sydney CBD";

  // Active, removable filter chips — gives an at-a-glance summary of what's
  // narrowing the results, the way modern marketplaces do.
  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (searchQuery.trim()) {
    activeChips.push({ key: "search", label: `“${searchQuery.trim()}”`, clear: () => setSearchQuery("") });
  }
  if (selectedSuburb !== "All Sydney") {
    activeChips.push({ key: "suburb", label: selectedSuburb, clear: () => setSelectedSuburb("All Sydney") });
  }
  if (dateWindow !== "all") {
    const dateLabels: Record<Exclude<DateWindow, "all">, string> = {
      today: "Today",
      tomorrow: "Tomorrow",
      weekend: "This weekend",
      "7": "Next 7 days",
      "30": "Next 30 days",
    };
    activeChips.push({
      key: "date",
      label: dateLabels[dateWindow],
      clear: () => setDateWindow("all"),
    });
  }
  if (timeOfDay !== "all") {
    activeChips.push({
      key: "time",
      label: timeOfDay === "night" ? "Night time" : "Daytime",
      clear: () => setTimeOfDay("all"),
    });
  }
  if (freeOnly) {
    activeChips.push({ key: "free", label: "Free only", clear: () => setFreeOnly(false) });
  }
  if (distanceKm < MAX_DISTANCE_KM) {
    activeChips.push({
      key: "distance",
      label: `Within ${distanceKm} km ${locationLabel}`,
      clear: () => setDistanceKm(MAX_DISTANCE_KM),
    });
  }
  if (tagFilter.trim()) {
    activeChips.push({ key: "tag", label: `#${tagFilter.trim()}`, clear: () => setTagFilter("") });
  }
  if (categoryFilter) {
    activeChips.push({ key: "category", label: categoryFilter, clear: () => setCategoryFilter("") });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Category quick-nav — predefined categories with icons. Horizontal
          scroll on narrow screens; each chip toggles a category filter. */}
      {availableCategories.length > 0 ? (
        <nav aria-label="Browse by category" className="mr-4 sm:mr-6">
          <ul className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
            <li>
              <button
                type="button"
                aria-pressed={categoryFilter === ""}
                onClick={() => setCategoryFilter("")}
                className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-bold transition ${
                  categoryFilter === ""
                    ? "border-[color:var(--rose)] bg-[color:var(--rose)] text-[color:var(--on-deep)]"
                    : "border-[color:var(--line)] bg-[color:var(--cream)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                }`}
              >
                <span aria-hidden>✨</span> All
              </button>
            </li>
            {availableCategories.map((category) => {
              const active = categoryFilter === category;
              return (
                <li key={category}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategoryFilter(active ? "" : category)}
                    className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-bold transition ${
                      active
                        ? "border-[color:var(--rose)] bg-[color:var(--rose)] text-[color:var(--on-deep)]"
                        : "border-[color:var(--line)] bg-[color:var(--cream)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                    }`}
                  >
                    <span aria-hidden>{CATEGORY_ICONS[category] ?? CATEGORY_ICON_FALLBACK}</span>
                    {category}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {/* Filter bar. Right margin keeps the chrome bounded while the rails
          below bleed to the viewport edge. */}
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
          </div>
        </div>

        {/* Keyword search — the primary entry point people reach for first. */}
        <div className="relative mt-5">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--mauve)]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search events, hosts, or interests…"
            aria-label="Search events"
            className="min-h-12 w-full rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)] pl-12 pr-4 text-base font-semibold text-[color:var(--ink)] placeholder:font-medium placeholder:text-[color:var(--mauve)] focus:border-[color:var(--rose)] focus:outline-none focus:ring-2 focus:ring-[color:var(--rose)]/30"
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                { value: "today", label: "Today" },
                { value: "tomorrow", label: "Tomorrow" },
                { value: "weekend", label: "This weekend" },
                { value: "7", label: "Next 7 days" },
                { value: "30", label: "Next 30 days" },
                { value: "all", label: "Any upcoming date" },
              ]}
            />
          </div>

          <div className="grid gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--mauve)]">
            Time
            <FilterSelect
              ariaLabel="Filter by time of day"
              value={timeOfDay}
              onChange={(next) => setTimeOfDay(next as TimeOfDay)}
              options={[
                { value: "all", label: "Any time" },
                { value: "day", label: "Daytime" },
                { value: "night", label: "Night time" },
              ]}
            />
          </div>

          <div className="grid gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--mauve)]">
            Sort by
            <FilterSelect
              ariaLabel="Sort events"
              value={sortMode}
              onChange={(next) => setSortMode(next as SortMode)}
              options={[
                { value: "nearest", label: "Nearest first" },
                { value: "soonest", label: "Soonest first" },
                { value: "popular", label: "Trending (most popular)" },
              ]}
            />
          </div>
        </div>

        {/* Quick toggles — free events + trending shortcut. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={freeOnly}
            onClick={() => setFreeOnly((v) => !v)}
            className={`min-h-9 rounded-full border px-4 text-sm font-bold transition ${
              freeOnly
                ? "border-[color:var(--rose)] bg-[color:var(--rose)] text-[color:var(--on-deep)]"
                : "border-[color:var(--line)] bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            }`}
          >
            Free only
          </button>
          <button
            type="button"
            aria-pressed={sortMode === "popular"}
            onClick={() => setSortMode((s) => (s === "popular" ? "nearest" : "popular"))}
            className={`min-h-9 rounded-full border px-4 text-sm font-bold transition ${
              sortMode === "popular"
                ? "border-[color:var(--rose)] bg-[color:var(--rose)] text-[color:var(--on-deep)]"
                : "border-[color:var(--line)] bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            }`}
          >
            🔥 Trending
          </button>
        </div>

        {/* Distance presets — tap targets beat a slider on touch. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--mauve)]">
            Distance {locationLabel}
          </span>
          {DISTANCE_OPTIONS.map((option) => {
            const active = distanceKm === option;
            const label = option >= MAX_DISTANCE_KM ? "Any" : `${option} km`;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => setDistanceKm(option)}
                className={`min-h-9 rounded-full border px-4 text-sm font-bold transition ${
                  active
                    ? "border-[color:var(--rose)] bg-[color:var(--rose)] text-[color:var(--on-deep)]"
                    : "border-[color:var(--line)] bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Active filter chips + view toggle (always shown — the toggle lives here). */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[color:var(--line-soft)] pt-4">
            {activeChips.length > 0 ? (
              <>
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.clear}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)] py-1.5 pl-3 pr-2 text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                  >
                    {chip.label}
                    <span aria-hidden className="text-[color:var(--mauve)]">×</span>
                    <span className="sr-only">Remove filter</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-full px-3 py-1.5 text-sm font-bold text-[color:var(--rose)] underline-offset-2 hover:underline"
                >
                  Clear all
                </button>
              </>
            ) : (
              <span className="text-sm font-semibold text-[color:var(--mauve)]">
                No filters applied — showing everything nearby.
              </span>
            )}

            {/* View toggle: category rails vs a flat grid of all matches. */}
            <div className="ml-auto inline-flex rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)] p-1">
              {(
                [
                  { value: "rails", label: "By category" },
                  { value: "grid", label: "All events" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={viewMode === option.value}
                  onClick={() => setViewMode(option.value)}
                  className={`min-h-8 rounded-full px-3 text-xs font-black uppercase tracking-[0.1em] transition ${
                    viewMode === option.value
                      ? "bg-[color:var(--surface-deep)] text-[color:var(--on-deep)]"
                      : "text-[color:var(--mauve)] hover:text-[color:var(--ink)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
      </section>

      {totalCount === 0 ? (
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
      ) : viewMode === "grid" ? (
        // Flat responsive grid of every match — ClassBento-style browse.
        <div className="mr-4 grid grid-cols-1 gap-x-5 gap-y-8 sm:mr-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              compact
              bookmarked={bookmarkedSet.has(event.id)}
              registered={registeredSet.has(event.id)}
              bookingStatus={bookingStatusFor(event.id)}
            />
          ))}
        </div>
      ) : (
        // Category sections — one horizontal-scroll rail per category that has
        // matching events. Cards peek off the right edge to signal more.
        <div className="flex flex-col gap-10">
          {groupedByCategory.map(({ category, events: categoryEvents }) => (
            <section key={category}>
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
              <div className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pr-4 [scrollbar-width:thin] sm:pr-6">
                {categoryEvents.map((event) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
