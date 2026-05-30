"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Marker,
  NavigationControl,
  Popup,
  type MapRef,
} from "react-map-gl/mapbox";
import type { AdminEventRow } from "@/lib/event-repository";
import type { EventStatus } from "@/lib/click-data";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STYLE = "mapbox://styles/mapbox/streets-v12";
const SYDNEY = { lat: -33.8856, lng: 151.21 };

// Hex equivalents of the brand status tones used in the table pills, so a
// marker reads the same status at a glance on the map.
const STATUS_HEX: Record<EventStatus, { bg: string; fg: string }> = {
  Pending: { bg: "#FF6978", fg: "#1A1036" },
  Live: { bg: "#FFB29B", fg: "#1A1036" },
  Featured: { bg: "#340068", fg: "#F7E1B5" },
  Waitlist: { bg: "#FFF1D6", fg: "#340068" },
  Locked: { bg: "#F7E1B5", fg: "#340068" },
  Rejected: { bg: "#8C7A9E", fg: "#FFFCF9" },
  Cancelled: { bg: "#C9B8D6", fg: "#340068" },
};

const popupDateFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

type Located = AdminEventRow & { lat: number; lng: number };

function hasCoords(event: AdminEventRow): event is Located {
  return typeof event.lat === "number" && typeof event.lng === "number";
}

export function AdminEventsMap({ events }: { events: AdminEventRow[] }) {
  const mapRef = useRef<MapRef | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const located = useMemo(() => events.filter(hasCoords), [events]);

  const center = useMemo(() => {
    if (located.length === 0) return SYDNEY;
    const sum = located.reduce(
      (acc, e) => ({ lat: acc.lat + e.lat, lng: acc.lng + e.lng }),
      { lat: 0, lng: 0 },
    );
    return { lat: sum.lat / located.length, lng: sum.lng / located.length };
  }, [located]);

  // Re-fit the viewport whenever the located set changes (filters in the queue
  // flow straight through to here), so every visible pin stays in frame.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || located.length === 0) return;
    if (located.length === 1) {
      map.flyTo({ center: [located[0].lng, located[0].lat], zoom: 14, duration: 500 });
      return;
    }
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const e of located) {
      minLng = Math.min(minLng, e.lng);
      maxLng = Math.max(maxLng, e.lng);
      minLat = Math.min(minLat, e.lat);
      maxLat = Math.max(maxLat, e.lat);
    }
    map.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: 56, maxZoom: 15, duration: 500 },
    );
  }, [located]);

  const activeEvent = activeId ? located.find((e) => e.id === activeId) ?? null : null;
  const missing = events.length - located.length;

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[color:var(--line)] bg-[color:var(--surface-deep)] px-5 py-3">
        <span className="text-xs font-black uppercase tracking-[0.16em] text-[color:var(--on-deep)]">
          Events map
        </span>
        <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-3 py-1 text-[0.65rem] font-black uppercase tracking-wider text-[color:var(--surface-deep)]">
          {located.length} mapped{missing > 0 ? ` · ${missing} without coords` : ""}
        </span>
      </div>

      <div className="relative h-[32rem]">
        {TOKEN ? (
          <Map
            ref={mapRef}
            mapboxAccessToken={TOKEN}
            mapStyle={STYLE}
            initialViewState={{ longitude: center.lng, latitude: center.lat, zoom: 12 }}
            style={{ width: "100%", height: "100%" }}
            attributionControl={false}
          >
            <NavigationControl position="top-right" showCompass={false} />

            {located.map((event) => {
              const tone = STATUS_HEX[event.status];
              return (
                <Marker
                  key={event.id}
                  longitude={event.lng}
                  latitude={event.lat}
                  anchor="bottom"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setActiveId(event.id);
                  }}
                >
                  <button
                    type="button"
                    aria-label={`${event.title} — ${event.status}`}
                    title={`${event.title} · ${event.suburb ?? ""}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[color:var(--ink)] text-[0.6rem] font-black shadow transition hover:scale-110"
                    style={{ backgroundColor: tone.bg, color: tone.fg }}
                  >
                    {event.attendees}
                  </button>
                </Marker>
              );
            })}

            {activeEvent ? (
              <Popup
                longitude={activeEvent.lng}
                latitude={activeEvent.lat}
                anchor="bottom"
                offset={30}
                closeButton
                closeOnClick={false}
                onClose={() => setActiveId(null)}
                maxWidth="260px"
              >
                <div className="text-[color:var(--ink)]">
                  <p className="text-sm font-black leading-tight">{activeEvent.title}</p>
                  <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-[color:var(--mauve)]">
                    {activeEvent.status} · {activeEvent.category}
                  </p>
                  {activeEvent.address ? (
                    <p className="mt-1 text-xs">{activeEvent.address}</p>
                  ) : activeEvent.locationName ? (
                    <p className="mt-1 text-xs">{activeEvent.locationName}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-[color:var(--mauve)]">
                    {popupDateFormatter.format(new Date(activeEvent.startsAt))} ·{" "}
                    {activeEvent.attendees}/{activeEvent.capacity} going
                  </p>
                  <Link
                    href={`/events/${activeEvent.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-black text-[#1A73E8]"
                  >
                    View event ↗
                  </Link>
                </div>
              </Popup>
            ) : null}
          </Map>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-black text-[color:var(--ink)]">
              Add a Mapbox public token to load the map
            </p>
            <p className="text-xs text-[color:var(--mauve)]">
              Paste your <code>pk.*</code> token as <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in{" "}
              <code>.env.local</code> and restart the dev server.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
