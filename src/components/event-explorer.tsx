"use client";

import { useMemo, useState } from "react";
import { categories, type EventItem } from "@/lib/click-data";
import { EventCard } from "./event-card";
import { Pill } from "./click-ui";

type DateWindow = "7" | "30" | "all";
type LocationStatus = "idle" | "requesting" | "shared" | "denied" | "unsupported";

const suburbs = [
  "All Sydney",
  "Barangaroo",
  "Surry Hills",
  "Newtown",
  "Marrickville",
  "Camperdown",
  "The Rocks",
];

const referenceDate = new Date("2026-05-06T00:00:00+10:00");

function daysUntil(startsAt: string) {
  const eventDate = new Date(startsAt);
  const milliseconds = eventDate.getTime() - referenceDate.getTime();
  return Math.ceil(milliseconds / 86_400_000);
}

function dateWindowLabel(dateWindow: DateWindow) {
  if (dateWindow === "7") return "next 7 days";
  if (dateWindow === "30") return "next 30 days";
  return "any upcoming date";
}

function mapQuery(locationQuery: string, suburb: string) {
  if (locationQuery.trim()) return `${locationQuery.trim()} Sydney NSW`;
  if (suburb !== "All Sydney") return `${suburb} Sydney NSW`;
  return "Sydney NSW events";
}

export function EventExplorer({ events }: { events: EventItem[] }) {
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationQuery, setLocationQuery] = useState("Sydney CBD");
  const [selectedSuburb, setSelectedSuburb] = useState("All Sydney");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [dateWindow, setDateWindow] = useState<DateWindow>("7");
  const [distanceKm, setDistanceKm] = useState(10);

  const filteredEvents = useMemo(() => {
    return events
      .filter((event) => {
        const eventDays = daysUntil(event.startsAt);
        const matchesDate =
          dateWindow === "all" ||
          (dateWindow === "7" && eventDays >= 0 && eventDays <= 7) ||
          (dateWindow === "30" && eventDays >= 0 && eventDays <= 30);
        const matchesCategory =
          selectedCategory === "All" || event.category === selectedCategory;
        const matchesSuburb =
          selectedSuburb === "All Sydney" || event.suburb === selectedSuburb;
        const matchesDistance = event.distanceKm <= distanceKm;

        return matchesDate && matchesCategory && matchesSuburb && matchesDistance;
      })
      .sort((left, right) => {
        const leftDate = new Date(left.startsAt).getTime();
        const rightDate = new Date(right.startsAt).getTime();
        return left.distanceKm - right.distanceKm || leftDate - rightDate;
      });
  }, [dateWindow, distanceKm, events, selectedCategory, selectedSuburb]);

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

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[0.86fr_1.14fr]">
      <aside className="h-fit rounded-lg border border-black/10 bg-white p-5 shadow-sm lg:sticky lg:top-28">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between lg:flex-col">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#f65858]">
              Find events around me
            </p>
            <h3 className="mt-2 text-4xl font-black leading-none">
              Share location or search a suburb.
            </h3>
            <p className="mt-3 text-sm font-bold leading-6 text-[#1f1f1f]/65">
              Click can use your browser location to rank nearby events. This demo
              falls back to Sydney sample distances.
            </p>
          </div>
          <button
            type="button"
            onClick={requestLocation}
            className="min-h-12 shrink-0 rounded-full bg-[#f65858] px-5 text-sm font-black text-white shadow-sm"
          >
            {locationStatus === "requesting" ? "Requesting..." : "Share my location"}
          </button>
        </div>

        <div className="mt-5 rounded-lg border border-black/10 bg-[#fffdf7] p-4">
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
            Search location
            <input
              value={locationQuery}
              onChange={(event) => setLocationQuery(event.target.value)}
              className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
              placeholder="Bondi, Parramatta, Sydney CBD"
            />
          </label>

          <label className="grid gap-2 text-sm font-black">
            Filter by suburb
            <select
              value={selectedSuburb}
              onChange={(event) => setSelectedSuburb(event.target.value)}
              className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
            >
              {suburbs.map((suburb) => (
                <option key={suburb}>{suburb}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-black">
            Category
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
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
                  className={`rounded-full border border-black/10 px-4 py-2 text-sm font-black ${
                    dateWindow === value ? "bg-[#1f1f1f] text-white" : "bg-white text-[#1f1f1f]"
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
              className="accent-[#f65858]"
            />
          </label>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-black/10 bg-[#fffdf7] shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
            <span className="text-xs font-black uppercase tracking-[0.16em]">
              Sample Google map
            </span>
            <span className="rounded-full bg-[#d8f3ef] px-3 py-1 text-xs font-black">
              Sydney
            </span>
          </div>
          <div
            aria-label="Sample map showing filtered Sydney events"
            className="relative h-72 overflow-hidden bg-[#E8F2EA]"
          >
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,130,148,0.1)_1px,transparent_1px),linear-gradient(rgba(0,130,148,0.1)_1px,transparent_1px)] bg-[size:44px_44px]" />
            <div className="absolute left-[-8%] top-[24%] h-8 w-[118%] rotate-[-11deg] rounded-full bg-white shadow-sm" />
            <div className="absolute left-[12%] top-[-10%] h-[125%] w-8 rotate-[18deg] rounded-full bg-white shadow-sm" />
            <div className="absolute left-[44%] top-[-8%] h-[120%] w-7 rotate-[-4deg] rounded-full bg-white shadow-sm" />
            <div className="absolute bottom-[22%] left-[-12%] h-7 w-[124%] rotate-[8deg] rounded-full bg-white shadow-sm" />
            <div className="absolute right-4 top-4 rounded-lg border border-[#1f1f1f]/20 bg-white px-3 py-2 text-xs font-black text-[#1f1f1f] shadow">
              + / -
            </div>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute left-4 top-4 rounded-lg border border-[#1f1f1f]/20 bg-white px-3 py-2 text-xs font-black text-[#1A73E8] shadow"
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
                  <div className="rounded-full border border-black/10 bg-[#f65858] px-3 py-1 text-xs font-black text-white shadow-sm">
                    {index + 1}
                  </div>
                  <div className="mx-auto h-3 w-3 rotate-45 border-b border-r border-black/10 bg-[#f65858]" />
                </div>
              );
            })}
            <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-[#1f1f1f]/15 bg-white/92 p-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1f1f1f]/45">
                Map preview
              </p>
              <p className="mt-1 text-sm font-black text-[#1f1f1f]">
                {filteredEvents.length} filtered events around {selectedSuburb}.
              </p>
            </div>
          </div>
        </div>
      </aside>

      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#f65858]">
              Events around me
            </p>
            <h2 className="mt-2 text-5xl font-black leading-none">
              {filteredEvents.length} events in the {dateWindowLabel(dateWindow)}.
            </h2>
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
            }}
            className="rounded-full border border-black/10 bg-[#d8f3ef] px-4 py-2 text-sm font-black"
          >
            Events around me in the next 7 days
          </button>
          <button
            type="button"
            onClick={() => {
              setDateWindow("30");
              setDistanceKm(25);
              setSelectedSuburb("All Sydney");
            }}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-black"
          >
            Events around me in the next 30 days
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("Relationships");
              setDateWindow("30");
            }}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-black"
          >
            Relationship events nearby
          </button>
        </div>

        {filteredEvents.length > 0 ? (
          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-lg border border-black/10 bg-white p-8 shadow-sm">
            <p className="text-4xl font-black leading-none">
              No events match those filters.
            </p>
            <p className="mt-3 text-sm font-bold leading-6 text-[#1f1f1f]/65">
              Try a wider distance, all Sydney, or the next 30 days.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
