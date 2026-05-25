"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { categories, type EventItem } from "@/lib/click-data";
import { EventCard } from "./event-card";
import { Pill } from "./click-ui";

const PAGE_SIZE = 12;

type DateWindow = "7" | "30" | "all";
type LocationStatus = "idle" | "requesting" | "shared" | "denied" | "unsupported";
type SortMode = "recommended" | "soonest" | "nearest" | "popular";

function daysUntil(startsAt: string, referenceTime: number) {
  const eventDate = new Date(startsAt);
  const milliseconds = eventDate.getTime() - referenceTime;
  return Math.ceil(milliseconds / 86_400_000);
}

function dateWindowLabel(dateWindow: DateWindow) {
  if (dateWindow === "7") return "next 7 days";
  if (dateWindow === "30") return "next 30 days";
  return "any upcoming date";
}

function eventCountHeading(count: number, dateWindow: DateWindow) {
  if (dateWindow === "all") return `${count} upcoming events.`;
  return `${count} events in the ${dateWindowLabel(dateWindow)}.`;
}

function mapQuery(locationQuery: string, suburb: string) {
  if (locationQuery.trim()) return `${locationQuery.trim()} Sydney NSW`;
  if (suburb !== "All Sydney") return `${suburb} Sydney NSW`;
  return "Sydney NSW events";
}

export function EventExplorer({
  events,
  bookmarkedEventIds = [],
  registeredEventIds = [],
}: {
  events: EventItem[];
  bookmarkedEventIds?: string[];
  registeredEventIds?: string[];
}) {
  const bookmarkedSet = useMemo(() => new Set(bookmarkedEventIds), [bookmarkedEventIds]);
  const registeredSet = useMemo(() => new Set(registeredEventIds), [registeredEventIds]);
  const router = useRouter();
  const pathname = usePathname();
  const urlParams = useSearchParams();
  const initialCategory = urlParams?.get("category") ?? "All";
  const initialSearch = urlParams?.get("search") ?? "";
  const initialTag = urlParams?.get("tag") ?? "";
  const initialPage = Math.max(1, Number.parseInt(urlParams?.get("page") ?? "1", 10) || 1);

  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationQuery, setLocationQuery] = useState("Sydney CBD");
  const [searchQuery, setSearchQuery] = useState(
    initialSearch || (initialTag ? `#${initialTag}` : ""),
  );
  const [selectedSuburb, setSelectedSuburb] = useState("All Sydney");
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [dateWindow, setDateWindow] = useState<DateWindow>("all");
  const [distanceKm, setDistanceKm] = useState(25);
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [tagFilter, setTagFilter] = useState(initialTag);
  const [page, setPage] = useState(initialPage);
  const skipFirstSync = useRef(true);

  const todayTime = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }, []);

  const suburbs = useMemo(
    () => ["All Sydney", ...Array.from(new Set(events.map((event) => event.suburb))).sort()],
    [events],
  );

  const filteredEvents = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const normalizedTag = tagFilter.trim().toLowerCase();

    return events
      .filter((event) => {
        const eventDays = daysUntil(event.startsAt, todayTime);
        const matchesDate =
          dateWindow === "all" ||
          (dateWindow === "7" && eventDays >= 0 && eventDays <= 7) ||
          (dateWindow === "30" && eventDays >= 0 && eventDays <= 30);
        const matchesCategory =
          selectedCategory === "All" || event.category === selectedCategory;
        const matchesSuburb =
          selectedSuburb === "All Sydney" || event.suburb === selectedSuburb;
        const matchesDistance = event.distanceKm <= distanceKm;
        const matchesTag =
          !normalizedTag ||
          event.tags.some((t) => t.toLowerCase() === normalizedTag);
        const searchableText = [
          event.title,
          event.group,
          event.host,
          event.category,
          event.location,
          event.suburb,
          event.price,
          event.description,
          event.relationshipGoal,
          event.tags.join(" "),
          event.lifeSignals.join(" "),
        ]
          .join(" ")
          .toLowerCase();
        const matchesSearch =
          !normalizedSearch || searchableText.includes(normalizedSearch);

        return (
          matchesDate &&
          matchesCategory &&
          matchesSuburb &&
          matchesDistance &&
          matchesSearch &&
          matchesTag
        );
      })
      .sort((left, right) => {
        const leftDate = new Date(left.startsAt).getTime();
        const rightDate = new Date(right.startsAt).getTime();

        if (sortMode === "soonest") return leftDate - rightDate;
        if (sortMode === "nearest") return left.distanceKm - right.distanceKm;
        if (sortMode === "popular") {
          return right.attendees / right.capacity - left.attendees / left.capacity;
        }

        return left.distanceKm - right.distanceKm || leftDate - rightDate;
      });
  }, [
    dateWindow,
    distanceKm,
    events,
    searchQuery,
    selectedCategory,
    selectedSuburb,
    sortMode,
    tagFilter,
    todayTime,
  ]);

  // Sync filters to URL (category, search, tag, page).
  useEffect(() => {
    if (skipFirstSync.current) {
      skipFirstSync.current = false;
      return;
    }
    const next = new URLSearchParams();
    if (selectedCategory && selectedCategory !== "All") next.set("category", selectedCategory);
    if (searchQuery.trim()) next.set("search", searchQuery.trim());
    if (tagFilter.trim()) next.set("tag", tagFilter.trim());
    if (page > 1) next.set("page", String(page));
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [selectedCategory, searchQuery, tagFilter, page, router, pathname]);

  // Reset to page 1 whenever filters change. React docs pattern: track the
  // previous filter snapshot in state and adjust during render.
  const filterFingerprint = `${selectedCategory}|${searchQuery}|${tagFilter}|${selectedSuburb}|${dateWindow}|${distanceKm}|${sortMode}`;
  const [prevFingerprint, setPrevFingerprint] = useState(filterFingerprint);
  if (prevFingerprint !== filterFingerprint) {
    setPrevFingerprint(filterFingerprint);
    if (page !== 1) setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedEvents = filteredEvents.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    mapQuery(locationQuery, selectedSuburb),
  )}`;

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unsupported");
      return;
    }

    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      () => {
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

  function resetFilters() {
    setSearchQuery("");
    setSelectedSuburb("All Sydney");
    setSelectedCategory("All");
    setDateWindow("all");
    setDistanceKm(25);
    setSortMode("recommended");
    setTagFilter("");
    setPage(1);
  }

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[0.86fr_1.14fr]">
      <aside className="h-fit rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] p-5 shadow-sm lg:sticky lg:top-28">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between lg:flex-col">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[color:var(--rose)]">
              Find events around me
            </p>
            <h3 className="mt-2 text-4xl font-black leading-none">
              Search once, then refine fast.
            </h3>
            <p className="mt-3 text-sm font-bold leading-6 text-[color:var(--mauve)]">
              Try a plan, suburb, vibe, or food type. The list updates instantly
              and stays focused on nearby events.
            </p>
          </div>
          <button
            type="button"
            onClick={requestLocation}
            className="min-h-12 shrink-0 rounded-full bg-[color:var(--rose)] px-5 text-sm font-black text-[color:var(--on-deep)] shadow-sm"
          >
            {locationStatus === "requesting" ? "Requesting..." : "Share my location"}
          </button>
        </div>

        <div className="mt-5 rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] p-4">
          <p className="text-sm font-black">
            {locationStatus === "shared"
              ? "Location shared. Showing events around you."
              : locationStatus === "denied"
                ? "Location was not shared. Using Sydney CBD sample."
                : locationStatus === "unsupported"
                  ? "Browser location is unavailable. Using Sydney CBD sample."
                  : "Share location to unlock around-me ranking."}
          </p>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-black">
            What do you feel like doing?
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 font-bold outline-none focus:border-[color:var(--rose)]"
              placeholder="restaurant, dinner, free, friends, fitness"
            />
          </label>

          <div>
            <p className="text-sm font-black">Quick picks</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                {
                  label: "Restaurant meetup",
                  action: () => {
                    setSearchQuery("restaurant");
                    setSelectedCategory("Food");
                    setDateWindow("30");
                    setDistanceKm(10);
                  },
                },
                {
                  label: "Free nearby",
                  action: () => {
                    setSearchQuery("free");
                    setSelectedCategory("All");
                    setDateWindow("30");
                    setDistanceKm(10);
                  },
                },
                {
                  label: "Small groups",
                  action: () => {
                    setSearchQuery("low pressure");
                    setSelectedCategory("All");
                    setDateWindow("30");
                    setDistanceKm(25);
                  },
                },
                {
                  label: "Reset",
                  action: resetFilters,
                },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.action}
                  className="rounded-full border border-[color:var(--line)] bg-[color:var(--peach)] px-4 py-2 text-sm font-black"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <label className="grid gap-2 text-sm font-black">
            Search location
            <input
              value={locationQuery}
              onChange={(event) => setLocationQuery(event.target.value)}
              className="rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 font-bold outline-none focus:border-[color:var(--rose)]"
              placeholder="Bondi, Parramatta, Sydney CBD"
            />
          </label>

          <div>
            <p className="text-sm font-black">Category</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-black ${
                    selectedCategory === category
                      ? "bg-[color:var(--surface-deep)] text-[color:var(--on-deep)]"
                      : "bg-white text-[color:var(--ink)]"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <label className="grid gap-2 text-sm font-black">
            Filter by suburb
            <select
              value={selectedSuburb}
              onChange={(event) => setSelectedSuburb(event.target.value)}
              className="rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 font-bold outline-none focus:border-[color:var(--rose)]"
            >
              {suburbs.map((suburb) => (
                <option key={suburb}>{suburb}</option>
              ))}
            </select>
          </label>

          <div>
            <p className="text-sm font-black">When</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                ["7", "Next 7 days"],
                ["30", "Next 30 days"],
                ["all", "All dates"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDateWindow(value as DateWindow)}
                  className={`rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-black ${
                    dateWindow === value ? "bg-[color:var(--surface-deep)] text-[color:var(--on-deep)]" : "bg-white text-[color:var(--ink)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="grid gap-2 text-sm font-black">
            Distance: {distanceKm} km
            <input
              type="range"
              min="2"
              max="25"
              step="1"
              value={distanceKm}
              onChange={(event) => setDistanceKm(Number(event.target.value))}
              className="accent-[color:var(--rose)]"
            />
          </label>

          <label className="grid gap-2 text-sm font-black">
            Sort
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 font-bold outline-none focus:border-[color:var(--rose)]"
            >
              <option value="recommended">Recommended</option>
              <option value="soonest">Soonest first</option>
              <option value="nearest">Nearest first</option>
              <option value="popular">Almost full</option>
            </select>
          </label>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] px-4 py-3">
            <span className="text-xs font-black uppercase tracking-[0.16em]">
              Sample Google map
            </span>
            <span className="rounded-full bg-[color:var(--peach)] px-3 py-1 text-xs font-black">
              {filteredEvents.length} matches
            </span>
          </div>
          <div
            aria-label="Sample map showing filtered Sydney events"
            className="relative h-72 overflow-hidden bg-[#E8F2EA]"
          >
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,130,148,0.1)_1px,transparent_1px),linear-gradient(rgba(0,130,148,0.1)_1px,transparent_1px)] bg-[size:44px_44px]" />
            <div className="absolute left-[-8%] top-[24%] h-8 w-[118%] rotate-[-11deg] rounded-full bg-[color:var(--champagne)] shadow-sm" />
            <div className="absolute left-[12%] top-[-10%] h-[125%] w-8 rotate-[18deg] rounded-full bg-[color:var(--champagne)] shadow-sm" />
            <div className="absolute left-[44%] top-[-8%] h-[120%] w-7 rotate-[-4deg] rounded-full bg-[color:var(--champagne)] shadow-sm" />
            <div className="absolute bottom-[22%] left-[-12%] h-7 w-[124%] rotate-[8deg] rounded-full bg-[color:var(--champagne)] shadow-sm" />
            <div className="absolute right-4 top-4 rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-2 text-xs font-black text-[color:var(--ink)] shadow">
              + / -
            </div>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute left-4 top-4 rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-2 text-xs font-black text-[#1A73E8] shadow"
            >
              Open in Maps
            </a>
            {filteredEvents.slice(0, 4).map((event, index) => {
              const positions = [
                ["58%", "35%"],
                ["32%", "54%"],
                ["70%", "64%"],
                ["46%", "75%"],
              ];
              const [left, top] = positions[index] ?? ["50%", "50%"];

              return (
                <div
                  key={event.id}
                  className="absolute"
                  style={{ left, top, transform: "translate(-50%, -100%)" }}
                >
                  <div className="rounded-full border border-[color:var(--line)] bg-[color:var(--rose)] px-3 py-1 text-xs font-black text-[color:var(--on-deep)] shadow-sm">
                    {index + 1}
                  </div>
                  <div className="mx-auto h-3 w-3 rotate-45 border-b border-r border-[color:var(--line)] bg-[color:var(--rose)]" />
                </div>
              );
            })}
            <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)]/92 p-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--mauve)]">
                Map preview
              </p>
              <p className="mt-1 text-sm font-black text-[color:var(--ink)]">
                {filteredEvents.length} filtered events around {selectedSuburb}
                {searchQuery ? ` for "${searchQuery}"` : ""}.
              </p>
            </div>
          </div>
        </div>
      </aside>

      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[color:var(--rose)]">
              Events around me
            </p>
            <h2 className="mt-2 text-5xl font-black leading-none">
              {eventCountHeading(filteredEvents.length, dateWindow)}
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[color:var(--mauve)]">
              Showing {selectedCategory === "All" ? "all categories" : selectedCategory}
              {searchQuery ? ` matching "${searchQuery}"` : ""}, sorted by{" "}
              {sortMode === "recommended"
                ? "recommended fit"
                : sortMode === "soonest"
                  ? "soonest date"
                  : sortMode === "nearest"
                    ? "distance"
                    : "nearly full tables"}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="aqua">{distanceKm} km radius</Pill>
            <Pill>{selectedSuburb}</Pill>
            <Pill tone="pink">{selectedCategory}</Pill>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setDateWindow("7");
              setDistanceKm(10);
              setSelectedSuburb("All Sydney");
              setSelectedCategory("All");
              setSearchQuery("");
            }}
            className="rounded-full border border-[color:var(--line)] bg-[color:var(--peach)] px-4 py-2 text-sm font-black"
          >
            Events around me in the next 7 days
          </button>
          <button
            type="button"
            onClick={() => {
              setDateWindow("30");
              setDistanceKm(25);
              setSelectedSuburb("All Sydney");
              setSelectedCategory("All");
              setSearchQuery("");
            }}
            className="rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-black"
          >
            Events around me in the next 30 days
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("Relationships");
              setDateWindow("30");
              setSearchQuery("dinner");
            }}
            className="rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-black"
          >
            Relationship events nearby
          </button>
        </div>

        {tagFilter ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-sm font-bold text-[color:var(--ink)]">
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              Tag filter
            </span>
            <span>#{tagFilter}</span>
            <button
              type="button"
              onClick={() => setTagFilter("")}
              className="ml-auto rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            >
              Clear
            </button>
          </div>
        ) : null}

        {filteredEvents.length > 0 ? (
          <>
            <div className="mt-8 grid gap-6 xl:grid-cols-2">
              {pagedEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  bookmarked={bookmarkedSet.has(event.id)}
                  registered={registeredSet.has(event.id)}
                />
              ))}
            </div>

            {totalPages > 1 ? (
              <nav className="mt-8 flex items-center justify-between gap-3" aria-label="Pagination">
                <button
                  type="button"
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={safePage <= 1}
                  className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPage((p) => Math.min(totalPages, p + 1));
                    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={safePage >= totalPages}
                  className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </nav>
            ) : null}
          </>
        ) : (
          <div className="mt-8 rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] p-8 shadow-sm">
            <p className="text-4xl font-black leading-none">
              No events match those filters.
            </p>
            <p className="mt-3 text-sm font-bold leading-6 text-[color:var(--mauve)]">
              Try a wider distance, all Sydney, or the next 30 days.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-5 rounded-full bg-[color:var(--surface-deep)] px-5 py-3 text-sm font-black text-[color:var(--on-deep)]"
            >
              Reset filters
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
