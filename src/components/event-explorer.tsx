"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { categories, type EventItem } from "@/lib/click-data";
import { haversineKm, roundKm, type LatLng } from "@/lib/geo";
import { Button, CategoryCircle, Icon, categoryGlyphKey } from "./ds";
import { EventCard } from "./event-card";
import { MapboxAutocomplete } from "./mapbox-autocomplete";

// Top of the radius control. At the max we treat it as "any distance" so people
// far from the events (or who just want everything) aren't filtered to nothing.
const MAX_DISTANCE_KM = 50;

// Tap-friendly radius presets — replaces a fiddly range slider that's painful
// on touch. The last entry maps to MAX_DISTANCE_KM ("any distance").
const DISTANCE_OPTIONS = [2, 5, 10, 25, MAX_DISTANCE_KM] as const;

type DateWindow = "today" | "tomorrow" | "weekend" | "7" | "30" | "all";
type SortMode = "soonest" | "nearest" | "popular";
type TimeOfDay = "all" | "day" | "night";
type LocationStatus = "idle" | "requesting" | "shared" | "denied" | "unsupported";

const DATE_OPTIONS: Array<[DateWindow, string]> = [
  ["all", "Any"],
  ["today", "Today"],
  ["tomorrow", "Tomorrow"],
  ["weekend", "This weekend"],
  ["7", "Next 7 days"],
  ["30", "Next 30 days"],
];

const SORT_OPTIONS: Array<[SortMode, string]> = [
  ["nearest", "Nearest"],
  ["soonest", "Soonest"],
  ["popular", "Trending"],
];

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

/** The DS filter pill: white + Mist hairline, and Deep Purple + a tick when on. */
function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`font-display inline-flex min-h-9 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[13.5px] whitespace-nowrap transition-colors ${
        active
          ? "border-[color:var(--purple)] bg-[color:var(--purple)] font-semibold text-[color:var(--champagne)]"
          : "border-[color:var(--line)] bg-[color:var(--paper)] font-medium text-[color:var(--ink-soft)] hover:border-[color:var(--slate)] hover:bg-[color:var(--lavender-100)]"
      }`}
    >
      {active ? <Icon name="check" size={14} stroke={2.6} /> : null}
      {children}
    </button>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="mb-2.5 text-xs font-semibold tracking-[0.08em] uppercase text-[color:var(--slate)]">{label}</p>
      {children}
    </div>
  );
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
  const initialSearch = urlParams?.get("q") ?? "";
  const requestedDate = urlParams?.get("date") ?? "all";
  const initialDate = DATE_OPTIONS.some(([value]) => value === requestedDate)
    ? (requestedDate as DateWindow)
    : "all";

  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  // The user's real coordinates once they share location. When set, every
  // event's distance is recomputed from here instead of from Sydney CBD.
  const [userCoords, setUserCoords] = useState<LatLng | null>(null);
  const [locationQuery, setLocationQuery] = useState("Sydney CBD");
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedSuburb, setSelectedSuburb] = useState("All Sydney");
  const [dateWindow, setDateWindow] = useState<DateWindow>(initialDate);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("all");
  const [freeOnly, setFreeOnly] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number>(MAX_DISTANCE_KM);
  const [sortMode, setSortMode] = useState<SortMode>("nearest");
  const [tagFilter, setTagFilter] = useState(initialTag);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [sheetOpen, setSheetOpen] = useState(false);
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
        const matchesSuburb = selectedSuburb === "All Sydney" || event.suburb === selectedSuburb;
        const matchesDistance = distanceKm >= MAX_DISTANCE_KM || event.distanceKm <= distanceKm;
        const matchesTag = !normalizedTag || event.tags.some((tag) => tag.toLowerCase() === normalizedTag);
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
          const timeDelta = new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
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

  // The category strip shows the full predefined set (so you can always browse
  // by category, even one with nothing live right now), plus any admin-added
  // category that actually appears on an event.
  const availableCategories = useMemo(() => {
    const present = new Set(events.map((event) => event.category));
    const known = categories.filter((c) => c !== "All");
    const extra = Array.from(present)
      .filter((c) => !categories.includes(c))
      .sort();
    return [...known, ...extra];
  }, [events]);

  // Sync tag/category to the URL so deep links from /events?tag=… still work.
  useEffect(() => {
    if (skipFirstSync.current) {
      skipFirstSync.current = false;
      return;
    }
    const next = new URLSearchParams();
    if (tagFilter.trim()) next.set("tag", tagFilter.trim());
    if (categoryFilter) next.set("category", categoryFilter);
    if (searchQuery.trim()) next.set("q", searchQuery.trim());
    if (dateWindow !== "all") next.set("date", dateWindow);
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [tagFilter, categoryFilter, searchQuery, dateWindow, router, pathname]);

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unsupported");
      return;
    }

    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationStatus("shared");
        setLocationQuery("Your current location");
        setSelectedSuburb("All Sydney");
      },
      () => setLocationStatus("denied"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }

  function resetFilters() {
    setSelectedSuburb("All Sydney");
    setDateWindow("all");
    setTimeOfDay("all");
    setFreeOnly(false);
    setDistanceKm(MAX_DISTANCE_KM);
    setTagFilter("");
  }

  function resetAll() {
    resetFilters();
    setSearchQuery("");
    setCategoryFilter("");
  }

  const totalCount = filteredEvents.length;
  const locationLabel = userCoords ? "from you" : "from Sydney CBD";

  const filterCount =
    (freeOnly ? 1 : 0) +
    (timeOfDay !== "all" ? 1 : 0) +
    (dateWindow !== "all" ? 1 : 0) +
    (distanceKm < MAX_DISTANCE_KM ? 1 : 0) +
    (selectedSuburb !== "All Sydney" ? 1 : 0) +
    (tagFilter.trim() ? 1 : 0);
  const anyFilter = filterCount > 0 || !!searchQuery.trim() || !!categoryFilter;

  // Applied-filter chips — the removable summary of what's narrowing the results.
  const chips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (selectedSuburb !== "All Sydney") {
    chips.push({ key: "suburb", label: selectedSuburb, clear: () => setSelectedSuburb("All Sydney") });
  }
  if (dateWindow !== "all") {
    chips.push({
      key: "date",
      label: DATE_OPTIONS.find(([v]) => v === dateWindow)![1],
      clear: () => setDateWindow("all"),
    });
  }
  if (timeOfDay !== "all") {
    chips.push({
      key: "time",
      label: timeOfDay === "night" ? "Night time" : "Daytime",
      clear: () => setTimeOfDay("all"),
    });
  }
  if (freeOnly) chips.push({ key: "free", label: "Free", clear: () => setFreeOnly(false) });
  if (distanceKm < MAX_DISTANCE_KM) {
    chips.push({ key: "distance", label: `${distanceKm} km`, clear: () => setDistanceKm(MAX_DISTANCE_KM) });
  }
  if (tagFilter.trim()) {
    chips.push({ key: "tag", label: tagFilter.trim(), clear: () => setTagFilter("") });
  }

  // The filter body is authored ONCE and rendered in both homes - the desktop
  // sidebar (>=1024) and the mobile bottom sheet - so the two can never drift.
  const filterBody = (
    <div>
      <FilterGroup label="Type">
        <div className="flex flex-wrap gap-2">
          <FilterPill active={freeOnly} onClick={() => setFreeOnly((v) => !v)}>
            Free
          </FilterPill>
          <FilterPill active={timeOfDay === "day"} onClick={() => setTimeOfDay((t) => (t === "day" ? "all" : "day"))}>
            Daytime
          </FilterPill>
          <FilterPill
            active={timeOfDay === "night"}
            onClick={() => setTimeOfDay((t) => (t === "night" ? "all" : "night"))}
          >
            Night time
          </FilterPill>
        </div>
      </FilterGroup>

      <FilterGroup label="Date">
        <div className="flex flex-wrap gap-2">
          {DATE_OPTIONS.map(([value, label]) => (
            <FilterPill key={value} active={dateWindow === value} onClick={() => setDateWindow(value)}>
              {label}
            </FilterPill>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label={`Distance ${locationLabel}`}>
        <div className="flex flex-wrap gap-2">
          {DISTANCE_OPTIONS.map((option) => (
            <FilterPill key={option} active={distanceKm === option} onClick={() => setDistanceKm(option)}>
              {option >= MAX_DISTANCE_KM ? "Any distance" : `${option} km`}
            </FilterPill>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Where">
        <MapboxAutocomplete
          value={locationQuery}
          onValueChange={setLocationQuery}
          onSelect={(place) => {
            // Picking a place mirrors GPS sharing — we centre the radius on the
            // selected address so every distance is relative to it.
            setUserCoords({ lat: place.lat, lng: place.lng });
            setLocationStatus("shared");
            setLocationQuery(place.suburb || place.name || place.address);
            setSelectedSuburb("All Sydney");
          }}
          placeholder="Bondi, Parramatta, Sydney CBD"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={requestLocation}
            className="font-display inline-flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--purple)] hover:underline"
          >
            <Icon name="pin" size={14} stroke={2} />
            {locationStatus === "requesting" ? "Locating…" : userCoords ? "Update location" : "Use my location"}
          </button>
        </div>
        <select
          aria-label="Filter by suburb"
          value={selectedSuburb}
          onChange={(e) => setSelectedSuburb(e.target.value)}
          className="mt-3 h-11 w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] px-3 text-sm text-[color:var(--ink)]"
        >
          {suburbs.map((suburb) => (
            <option key={suburb} value={suburb}>
              {suburb}
            </option>
          ))}
        </select>
      </FilterGroup>
    </div>
  );

  const results =
    totalCount > 0 ? (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filteredEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            bookmarked={bookmarkedSet.has(event.id)}
            registered={registeredSet.has(event.id)}
            bookingStatus={bookingStatusFor(event.id)}
          />
        ))}
      </div>
    ) : (
      <div className="rounded-[var(--radius-xl)] bg-[color:var(--lav-bg)] px-6 py-12 text-center">
        <Icon name="compass" size={32} stroke={1.7} className="mx-auto text-[color:var(--purple-400)]" />
        <h3 className="font-display mt-3.5 text-[17px] font-semibold text-[color:var(--ink)]">
          Nothing matches those filters.
        </h3>
        <p className="mx-auto mt-2 max-w-[360px] text-sm leading-relaxed text-[color:var(--slate)]">
          Try widening the date or distance - there&apos;s always more on next week.
        </p>
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" onClick={resetAll}>
            Clear filters
          </Button>
        </div>
      </div>
    );

  return (
    <div>
      <h1 className="font-display text-[length:var(--text-h1)] leading-[1.25] font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
        What&apos;s on near you
      </h1>
      <p className="mt-1 text-sm font-medium text-[color:var(--slate)]">
        {events.length} {events.length === 1 ? "event" : "events"} on this week.
      </p>

      {/* Search */}
      <label className="mt-4 flex h-12 w-full items-center gap-2.5 rounded-xl border-[1.5px] border-[color:var(--line)] bg-[color:var(--paper)] px-4 shadow-[var(--shadow-xs)] focus-within:border-[color:var(--purple)] focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--lavender)_42%,transparent)]">
        <Icon name="search" size={19} className="text-[color:var(--slate)]" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search events, venues, or interests…"
          aria-label="Search events"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-[color:var(--ink)] outline-none placeholder:text-[color:var(--slate)]"
        />
      </label>

      {/* The canonical category treatment: ONE purple line glyph on a lavender
          disc; selected fills purple. Never an emoji, never a per-category hue. */}
      {availableCategories.length > 0 ? (
        <nav aria-label="Browse by category" className="ckRail mt-5 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible">
          <button
            type="button"
            aria-pressed={categoryFilter === ""}
            onClick={() => setCategoryFilter("")}
            className="group shrink-0"
          >
            <CategoryCircle name="all" label="All" active={categoryFilter === ""} />
          </button>
          {availableCategories.map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={categoryFilter === category}
              onClick={() => setCategoryFilter(categoryFilter === category ? "" : category)}
              className="group shrink-0"
            >
              <CategoryCircle
                name={categoryGlyphKey(category)}
                label={category}
                active={categoryFilter === category}
              />
            </button>
          ))}
        </nav>
      ) : null}

      <div className="mt-5 flex items-start gap-9">
        {/* The filter sidebar appears only from 1024 up; below that the Filters
            button → bottom sheet carries the same controls. */}
        <aside className="sticky top-20 hidden w-[260px] shrink-0 lg:block">
          {filterBody}
          {anyFilter ? (
            <button
              type="button"
              onClick={resetAll}
              className="font-display inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[color:var(--purple)] hover:underline"
            >
              <Icon name="x" size={15} stroke={2.2} />
              Reset all
            </button>
          ) : null}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-[color:var(--ink)]">
              {totalCount} {totalCount === 1 ? "event" : "events"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className={`font-display inline-flex min-h-9 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[13.5px] font-semibold lg:hidden ${
                  filterCount
                    ? "border-[color:var(--purple)] bg-[color:var(--purple)] text-[color:var(--champagne)]"
                    : "border-[color:var(--line)] bg-[color:var(--paper)] text-[color:var(--ink-soft)]"
                }`}
              >
                <Icon name="filter" size={16} stroke={2} />
                Filters{filterCount ? ` · ${filterCount}` : ""}
              </button>
              <div className="relative inline-flex items-center">
                <select
                  aria-label="Sort events"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="font-display h-9 appearance-none rounded-full border border-[color:var(--line)] bg-[color:var(--paper)] pr-8 pl-3.5 text-[13px] font-semibold text-[color:var(--ink)]"
                >
                  {SORT_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      Sort · {label}
                    </option>
                  ))}
                </select>
                <Icon
                  name="chevD"
                  size={15}
                  className="pointer-events-none absolute right-2.5 text-[color:var(--slate)]"
                />
              </div>
            </div>
          </div>

          {chips.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <span
                  key={chip.key}
                  className="font-display inline-flex items-center gap-1.5 rounded-full bg-[color:var(--lavender-100)] py-1.5 pr-1.5 pl-3 text-[13px] font-semibold text-[color:var(--purple-700)]"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={chip.clear}
                    aria-label={`Remove ${chip.label} filter`}
                    className="flex size-[18px] items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--purple)_14%,transparent)]"
                  >
                    <Icon name="x" size={11} stroke={2.6} />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={resetFilters}
                className="font-display px-1 text-[13px] font-semibold text-[color:var(--slate)] hover:underline"
              >
                Clear all
              </button>
            </div>
          ) : null}

          {results}
        </div>
      </div>

      {/* Mobile filters — a bottom sheet with a grab handle, Reset / ✕ / scrim
          close, and a sticky "Show N events" apply. */}
      {sheetOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-[rgba(28,24,48,0.5)] lg:hidden"
          onClick={() => setSheetOpen(false)}
          role="presentation"
        >
          <div
            className="flex max-h-[86%] w-full flex-col overflow-hidden rounded-t-[var(--radius-2xl)] bg-[color:var(--paper)] shadow-[var(--shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
          >
            <div className="flex justify-center pt-2">
              <span className="h-[5px] w-10 rounded-full bg-[color:var(--mist-strong)]" />
            </div>
            <div className="flex items-center justify-between px-4 py-2">
              <button
                type="button"
                onClick={resetFilters}
                className="font-display min-h-11 text-[13.5px] font-semibold text-[color:var(--purple)]"
              >
                Reset
              </button>
              <h3 className="font-display text-[17px] font-semibold text-[color:var(--ink)]">Filters</h3>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close filters"
                className="flex size-11 items-center justify-center text-[color:var(--ink-soft)]"
              >
                <Icon name="x" size={20} stroke={2.2} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-2">{filterBody}</div>
            <div className="border-t border-[color:var(--line-soft)] bg-[color:var(--paper)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button size="lg" full onClick={() => setSheetOpen(false)}>
                Show {totalCount} {totalCount === 1 ? "event" : "events"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
