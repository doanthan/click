"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { categories, type EventItem } from "@/lib/click-data";
import { haversineKm, roundKm, type LatLng } from "@/lib/geo";
import { Button, CategoryCircle, Icon, categoryGlyphKey } from "./ds";
import { EmptyState } from "./empty-state";
import { EventCard } from "./event-card";
import { MapboxAutocomplete } from "./mapbox-autocomplete";
import { ModalShell } from "./modal-shell";
import { Reveal } from "./reveal";

// Top of the radius control. At the max we treat it as "any distance" so people
// far from the events (or who just want everything) aren't filtered to nothing.
const MAX_DISTANCE_KM = 50;

// Tap-friendly radius presets - replaces a fiddly range slider that's painful
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

const TIME_OPTIONS: Array<[TimeOfDay, string]> = [
  ["all", "Any time"],
  ["day", "Daytime"],
  ["night", "Night time"],
];

const SORT_OPTIONS: Array<[SortMode, string]> = [
  ["nearest", "Nearest"],
  ["soonest", "Soonest"],
  ["popular", "Trending"],
];

// Bucket by CALENDAR DAY in the venue timezone - the same wall date the card
// prints (formatted Australia/Sydney server-side). The old millisecond delta ran
// through Math.ceil, so tonight's 7pm event was 0.79 days and rounded up into
// "Tomorrow", while a real tomorrow-evening event scored 2 and matched neither.
const sydneyDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Sydney",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Days since the epoch for the Sydney calendar date of `value`. */
function sydneyDayIndex(value: string | Date) {
  const [year, month, day] = sydneyDayFormat.format(new Date(value)).split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

// Whether an event falls within the selected date window. "weekend" = the
// upcoming Sat/Sun (today counts if it's already the weekend).
function matchesDateWindow(startsAt: string, dateWindow: DateWindow, todayIndex: number) {
  if (dateWindow === "all") return true;
  const eventDays = sydneyDayIndex(startsAt) - todayIndex;
  if (eventDays < 0) return false;
  if (dateWindow === "7") return eventDays <= 7;
  if (dateWindow === "30") return eventDays <= 30;
  if (dateWindow === "today") return eventDays === 0;
  if (dateWindow === "tomorrow") return eventDays === 1;
  if (dateWindow === "weekend") {
    // Epoch day 0 was a Thursday, so +4 maps the index onto 0 Sun … 6 Sat.
    const day = (sydneyDayIndex(startsAt) + 4) % 7;
    const isWeekendDay = day === 6 || day === 0;
    // Bounded by the Sunday that CLOSES the coming weekend, not by a flat 7
    // days. The flat window contradicted the label every Fri/Sat/Sun: asked on
    // a Saturday it also returned next Saturday (exactly 7 days out), so "This
    // weekend" listed two weekends.
    const todayDay = (todayIndex + 4) % 7;
    const daysToSunday = todayDay === 0 ? 0 : 7 - todayDay;
    return isWeekendDay && eventDays <= daysToSunday;
  }
  return true;
}

// Day vs night by the SYDNEY start hour. Evening (5pm+) reads as "night time".
// getHours() would bucket in the viewer's own zone while the card beside it
// prints Sydney time, so a 6pm Sydney event read as "Daytime" to anyone west of
// here - the filter disagreeing with the label it was filtering on.
const SYDNEY_HOUR = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  hour: "numeric",
  hour12: false,
});
function isNightEvent(startsAt: string) {
  return Number(SYDNEY_HOUR.format(new Date(startsAt))) >= 17;
}

// "Low Pressure" and "low-pressure" are the same filter.
function slugifyTag(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
      // 44px on touch (these are the most-tapped controls on the page), back to
      // the compact 36px in the desktop sidebar where the pointer is precise.
      className={`font-display inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[13.5px] whitespace-nowrap transition-colors lg:min-h-9 ${
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
  degraded = false,
  bookmarkedEventIds = [],
  registeredEventIds = [],
  waitlistedEventIds = [],
}: {
  events: EventItem[];
  /** We could not read the catalogue - distinct from "the catalogue is empty". */
  degraded?: boolean;
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
  // Every filter round-trips through the URL, not just these four. Browsing is
  // the most repeated thing anyone does here, and Back used to drop free /
  // time-of-day / distance / suburb / sort on the floor: you tapped one event,
  // came back, and re-narrowed the list by hand every time.
  const requestedTime = urlParams?.get("time") ?? "all";
  const initialTime = TIME_OPTIONS.some(([value]) => value === requestedTime)
    ? (requestedTime as TimeOfDay)
    : "all";
  const requestedSort = urlParams?.get("sort") ?? "soonest";
  const initialSort = SORT_OPTIONS.some(([value]) => value === requestedSort)
    ? (requestedSort as SortMode)
    : "soonest";
  const initialFree = urlParams?.get("free") === "1";
  const initialSuburb = urlParams?.get("suburb") ?? "All Sydney";
  const requestedDistance = Number(urlParams?.get("km"));
  const initialDistance =
    Number.isFinite(requestedDistance) && requestedDistance > 0 && requestedDistance <= MAX_DISTANCE_KM
      ? requestedDistance
      : MAX_DISTANCE_KM;

  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  // The user's real coordinates once they share location. When set, every
  // event's distance is recomputed from here instead of from Sydney CBD.
  const [userCoords, setUserCoords] = useState<LatLng | null>(null);
  const [locationQuery, setLocationQuery] = useState("Sydney CBD");
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedSuburb, setSelectedSuburb] = useState(initialSuburb);
  const [dateWindow, setDateWindow] = useState<DateWindow>(initialDate);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(initialTime);
  const [freeOnly, setFreeOnly] = useState(initialFree);
  const [distanceKm, setDistanceKm] = useState<number>(initialDistance);
  // Default to "soonest", not "nearest": until someone shares a location we
  // measure from Sydney CBD, so "Nearest" would silently rank an event on a
  // guess about where they are. Sharing a location switches it (see below) -
  // that's the point of tapping it.
  const [sortMode, setSortMode] = useState<SortMode>(initialSort);
  const [tagFilter, setTagFilter] = useState(initialTag);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [sheetOpen, setSheetOpen] = useState(false);
  const skipFirstSync = useRef(true);
  // What we last wrote to the URL ourselves. A change that does NOT match this
  // came from outside (a tag link, Back/Forward) and must be adopted.
  const lastWritten = useRef<string | null>(null);

  const todayIndex = useMemo(() => sydneyDayIndex(new Date()), []);

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
      // An event with no pinned coordinates has no distance from anywhere -
      // recomputing it from the CBD fallback would just move the wrong number.
      // Coordinates are also withheld on this surface for anyone who has not
      // booked (B5 item 5 - suburb only), so when they are null we keep the
      // server's distance rather than measuring to (0, 0). It is measured from
      // the CBD instead of from here, which is coarser than the user asked for
      // but never wrong by more than the CBD offset.
      distanceKm:
        event.distanceKm == null || event.lat == null || event.lng == null
          ? event.distanceKm
          : roundKm(haversineKm(userCoords, { lat: event.lat, lng: event.lng })),
    }));
  }, [events, userCoords]);

  const filteredEvents = useMemo(() => {
    const normalizedTag = slugifyTag(tagFilter);
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return locatedEvents
      .filter((event) => {
        const matchesDate = matchesDateWindow(event.startsAt, dateWindow, todayIndex);
        const matchesTime =
          timeOfDay === "all" ||
          (timeOfDay === "night" ? isNightEvent(event.startsAt) : !isNightEvent(event.startsAt));
        const matchesFree = !freeOnly || isFreeEvent(event);
        const matchesSuburb = selectedSuburb === "All Sydney" || event.suburb === selectedSuburb;
        // An unpinned event cannot satisfy "within 2 km". It used to pass every
        // distance filter by reading as 0 km.
        const matchesDistance =
          distanceKm >= MAX_DISTANCE_KM ||
          (event.distanceKm != null && event.distanceKm <= distanceKm);
        // Compared as slugs on BOTH sides. Tags render as labels now, but every
        // link already in the wild - and every tag chip that writes ?tag= -
        // carries whichever form the page had at the time, so normalising both
        // is what keeps "low-pressure" and "Low Pressure" the same filter.
        const matchesTag =
          !normalizedTag || event.tags.some((tag) => slugifyTag(tag) === normalizedTag);
        const matchesCategory = !categoryFilter || event.category === categoryFilter;
        const matchesSearch =
          !normalizedSearch ||
          // event.location is deliberately empty on this surface - the venue
          // name no longer ships to the client (see getEventsForExplore), and a
          // searchable hidden venue would be a probing oracle anyway.
          [event.title, event.host, event.category, event.suburb, ...event.tags]
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
        // Events with no distance sort LAST rather than first - as 0 km they
        // used to win "Nearest" outright.
        const leftKm = left.distanceKm ?? Number.POSITIVE_INFINITY;
        const rightKm = right.distanceKm ?? Number.POSITIVE_INFINITY;
        if (sortMode === "soonest") {
          const timeDelta = new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
          if (timeDelta !== 0) return timeDelta;
          return leftKm - rightKm;
        }
        // "nearest" (default): closest first, breaking ties by soonest.
        const distanceDelta = leftKm - rightKm;
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
    todayIndex,
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
  //
  // DEBOUNCED, because router.replace re-runs the page on the server: every
  // keystroke used to cost a full RSC round trip (and the discover page's DB
  // queries with it) for a filter that is entirely client-side. The list itself
  // updates instantly off `searchQuery`; only the shareable URL waits.
  useEffect(() => {
    if (skipFirstSync.current) {
      skipFirstSync.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const next = new URLSearchParams();
      if (tagFilter.trim()) next.set("tag", tagFilter.trim());
      if (categoryFilter) next.set("category", categoryFilter);
      if (searchQuery.trim()) next.set("q", searchQuery.trim());
      if (dateWindow !== "all") next.set("date", dateWindow);
      if (timeOfDay !== "all") next.set("time", timeOfDay);
      if (freeOnly) next.set("free", "1");
      if (selectedSuburb !== "All Sydney") next.set("suburb", selectedSuburb);
      if (distanceKm !== MAX_DISTANCE_KM) next.set("km", String(distanceKm));
      if (sortMode !== "soonest") next.set("sort", sortMode);
      const queryString = next.toString();
      lastWritten.current = queryString;
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    }, 350);
    return () => clearTimeout(timer);
  }, [
    tagFilter,
    categoryFilter,
    searchQuery,
    dateWindow,
    timeOfDay,
    freeOnly,
    selectedSuburb,
    distanceKm,
    sortMode,
    router,
    pathname,
  ]);

  // The other direction. Without this, tapping "#dumplings" inside a card's
  // quick view on /discover pushed ?tag=dumplings and the grid behind it never
  // moved - and the next filter change silently wiped the tag back out.
  const incomingTag = urlParams?.get("tag") ?? "";
  const incomingCategory = urlParams?.get("category") ?? "";
  const incomingSearch = urlParams?.get("q") ?? "";
  const incomingDate = urlParams?.get("date") ?? "all";
  useEffect(() => {
    const current = urlParams?.toString() ?? "";
    // Ignore the echo of our own debounced write.
    if (current === lastWritten.current) return;
    setTagFilter(incomingTag);
    setCategoryFilter(incomingCategory);
    setSearchQuery(incomingSearch);
    setDateWindow(
      DATE_OPTIONS.some(([value]) => value === incomingDate) ? (incomingDate as DateWindow) : "all",
    );
    const incomingTime = urlParams?.get("time") ?? "all";
    setTimeOfDay(
      TIME_OPTIONS.some(([value]) => value === incomingTime) ? (incomingTime as TimeOfDay) : "all",
    );
    const incomingSort = urlParams?.get("sort") ?? "soonest";
    setSortMode(
      SORT_OPTIONS.some(([value]) => value === incomingSort) ? (incomingSort as SortMode) : "soonest",
    );
    setFreeOnly(urlParams?.get("free") === "1");
    setSelectedSuburb(urlParams?.get("suburb") ?? "All Sydney");
    const incomingKm = Number(urlParams?.get("km"));
    setDistanceKm(
      Number.isFinite(incomingKm) && incomingKm > 0 && incomingKm <= MAX_DISTANCE_KM
        ? incomingKm
        : MAX_DISTANCE_KM,
    );
    lastWritten.current = current;
  }, [urlParams, incomingTag, incomingCategory, incomingSearch, incomingDate]);

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
        // Now that distance means something real, rank by it.
        setSortMode("nearest");
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

  // Applied-filter chips - the removable summary of what's narrowing the results.
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
  // Category and search narrow the list as hard as anything above, and neither
  // used to leave a mark: on a phone the category row scrolls away, so the grid
  // was filtered with nothing on screen saying so and no way to undo it.
  if (categoryFilter) {
    chips.push({ key: "category", label: categoryFilter, clear: () => setCategoryFilter("") });
  }
  if (searchQuery.trim()) {
    chips.push({
      key: "q",
      label: `"${searchQuery.trim()}"`,
      clear: () => setSearchQuery(""),
    });
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
            // Picking a place mirrors GPS sharing - we centre the radius on the
            // selected address so every distance is relative to it.
            setUserCoords({ lat: place.lat, lng: place.lng });
            setLocationStatus("shared");
            setLocationQuery(place.suburb || place.name || place.address);
            setSelectedSuburb("All Sydney");
            setSortMode("nearest");
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
        {/* Both of these states were computed and never rendered, so tapping
            "Use my location" and declining the browser prompt left a button
            that simply did nothing, with no way to tell a refusal from a
            failure. The typed suburb above is the real fallback - say so. */}
        {locationStatus === "denied" || locationStatus === "unsupported" ? (
          <p role="status" className="mt-2 text-[12.5px] leading-[1.5] text-[color:var(--slate)]">
            {locationStatus === "denied"
              ? "We don't have location permission, so distances are measured from Sydney CBD. Type a suburb above to measure from there instead."
              : "This browser can't share a location, so distances are measured from Sydney CBD. Type a suburb above to measure from there instead."}
          </p>
        ) : null}
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

  // An empty catalogue and an over-narrow filter look identical to the count
  // but need opposite copy: "clear filters" is nonsense advice when there was
  // nothing to filter in the first place, and the button would be a no-op.
  const nothingToShow = events.length === 0;

  const results =
    totalCount > 0 ? (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filteredEvents.map((event, index) => (
          /* Keyed on the event, not the index, so a filter change re-keys the
             row: cards that survive keep their .is-in and stay put, cards that
             are new to the result set mount hidden and fade up as the observer
             catches them. That IS the filter transition - there is no separate
             one. min-w-0 has to move up here with the wrapper: the Reveal div is
             now the grid item, and a grid item defaults to min-width:auto, which
             is what blows a column out when a title cannot shrink.
             The stagger is per ROW (index % 3), not per card - a flat index*n
             over a 60-card result set would park the last card behind three
             seconds of delay. */
          <Reveal key={event.id} delay={(index % 3) * 60} className="min-w-0">
            <EventCard
              event={event}
              bookmarked={bookmarkedSet.has(event.id)}
              registered={registeredSet.has(event.id)}
              bookingStatus={bookingStatusFor(event.id)}
              distanceOrigin={userCoords ? undefined : "CBD"}
              // The first row is above the fold at every breakpoint and holds the
              // LCP image. EventCard already took the prop; nothing ever passed it,
              // so the largest thing on the page was lazy-loaded.
              priority={index < 3}
            />
          </Reveal>
        ))}
      </div>
    ) : degraded ? (
      // A Supabase blip used to render as "Click has no events", which is the
      // single most trust-destroying thing this page can say to a first-time
      // visitor. Search and the filters stay mounted so a retry is one tap.
      <div className="rounded-[var(--radius-xl)] bg-[color:var(--lav-bg)] px-6 py-12 text-center">
        <Icon name="compass" size={32} stroke={1.7} className="mx-auto text-[color:var(--purple-400)]" />
        <h3 className="font-display mt-3.5 text-[17px] font-semibold text-[color:var(--ink)]">
          We couldn&apos;t load events just now.
        </h3>
        <p className="mx-auto mt-2 max-w-[380px] text-sm leading-relaxed text-[color:var(--slate)]">
          This is on us, not on you - the catalogue is still there. Give it a moment and try again.
        </p>
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => router.refresh()}>
            Try again
          </Button>
        </div>
      </div>
    ) : nothingToShow ? (
      <EmptyState
        eyebrow="Just getting started"
        icon={<Icon name="compass" size={26} stroke={1.7} />}
        title="The first events are on their way."
        body="New things to do land here every week. Check back soon, or host the first one yourself."
        actionHref="/merchant/signup"
        actionLabel="Host an event"
      />
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
        {degraded
          ? "Hang tight - we're having trouble reaching the catalogue."
          : nothingToShow
          ? "Fresh events land here every week."
          : `${events.length} ${events.length === 1 ? "event" : "events"} on Click right now.`}
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
          disc; selected fills purple. Never an emoji, never a per-category hue.
          Hidden while the catalogue is empty - sixteen category discs above a
          "no events yet" panel are sixteen taps that all lead nowhere. */}
      {!nothingToShow && availableCategories.length > 0 ? (
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
            button → bottom sheet carries the same controls. With an empty
            catalogue there is nothing to narrow, so the whole rig stands down. */}
        {!nothingToShow ? (
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
        ) : null}

        <div className="min-w-0 flex-1">
          <div className={`mb-4 flex items-center justify-between gap-3 ${nothingToShow ? "hidden" : ""}`}>
            <span
              role="status"
              aria-live="polite"
              className="text-sm font-semibold text-[color:var(--ink)]"
            >
              {totalCount} {totalCount === 1 ? "event" : "events"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-expanded={sheetOpen}
                className={`font-display inline-flex min-h-11 items-center gap-1.5 rounded-xl border-[1.5px] px-3.5 text-[13.5px] font-semibold lg:hidden ${
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
                  className="font-display h-11 appearance-none rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] pr-8 pl-3.5 text-[13px] font-semibold text-[color:var(--ink)] lg:h-9"
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
                  {/* -m-[13px] p-[13px] grows the target to 44px without moving
                      the disc or growing the chip: the negative margin cancels
                      the padding, so the button still occupies 18px of the
                      chip's layout and only its hit area spills over. The disc
                      itself was the whole target before - 18px, on the control
                      that undoes a filter, next to 44px buttons everywhere else. */}
                  <button
                    type="button"
                    onClick={chip.clear}
                    aria-label={`Remove ${chip.label} filter`}
                    className="-m-[13px] flex p-[13px]"
                  >
                    <span className="flex size-[18px] items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--purple)_14%,transparent)]">
                      <Icon name="x" size={11} stroke={2.6} />
                    </span>
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={resetAll}
                className="font-display px-1 text-[13px] font-semibold text-[color:var(--slate)] hover:underline"
              >
                Clear all
              </button>
            </div>
          ) : null}

          {results}
        </div>
      </div>

      {/* Mobile filters - a bottom sheet with a grab handle, Reset / ✕ / scrim
          close, and a sticky "Show N events" apply. */}
      {/* ModalShell owns Escape, the Tab trap, the scroll lock and focus
          restore. The hand-rolled version here claimed aria-modal while doing
          none of them, so a keyboard user opening Filters on a phone was
          stranded and the results scrolled away underneath. */}
      {sheetOpen ? (
        <ModalShell
          onClose={() => setSheetOpen(false)}
          label="Filters"
          align="end"
          zIndex={70}
          className="lg:hidden"
          /* ModalShell ships no entrance by design (see its header); rise-soft
             is additive here, never the thing that makes the sheet visible. */
          cardClassName="w-full rise-soft"
        >
          <div
            className="flex max-h-[86dvh] w-full flex-col overflow-hidden rounded-t-[var(--radius-2xl)] bg-[color:var(--paper)] shadow-[var(--shadow-lg)]"
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
        </ModalShell>
      ) : null}
    </div>
  );
}
