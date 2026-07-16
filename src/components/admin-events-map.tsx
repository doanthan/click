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

// Mirrors the DS badge vocabulary used by the restyled queue table (soft
// status tint + AA ink), so a marker reads the same status in both views.
const STATUS_HEX: Record<EventStatus, { bg: string; fg: string }> = {
  Pending: { bg: "color-mix(in srgb, var(--amber) 16%, var(--paper))", fg: "var(--amber-ink)" },
  Live: { bg: "color-mix(in srgb, var(--sage) 14%, var(--paper))", fg: "var(--sage-ink)" },
  Featured: { bg: "var(--purple)", fg: "var(--champagne)" },
  Waitlist: { bg: "color-mix(in srgb, var(--amber) 10%, var(--paper))", fg: "var(--amber-ink)" },
  Locked: { bg: "var(--amber)", fg: "var(--ink)" },
  Rejected: { bg: "color-mix(in srgb, var(--coral) 12%, var(--paper))", fg: "var(--coral-ink)" },
  Cancelled: { bg: "var(--mist)", fg: "var(--ink)" },
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
  // Gate the fit-bounds effect on the map actually being ready. On first mount
  // (and every table→map toggle, which remounts this component) the effect runs
  // before react-map-gl has populated mapRef, so getMap() is null and the fit
  // is skipped — leaving every pin parked off-screen at the initial centroid.
  // onLoad flips this true once the map exists, re-running the effect to fit.
  const [mapReady, setMapReady] = useState(false);

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
    if (!mapReady) return;
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
  }, [located, mapReady]);

  const activeEvent = activeId ? located.find((e) => e.id === activeId) ?? null : null;
  const missing = events.length - located.length;

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] bg-[color:var(--paper)] px-5 py-3">
        <span className="eyebrow">Events map</span>
        <span className="rounded-full bg-[color:var(--lavender-100)] px-3 py-1 text-[12px] font-semibold leading-none text-[color:var(--purple-700)]">
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
            onLoad={() => setMapReady(true)}
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
                    aria-label={`${event.title} - ${event.status}`}
                    title={`${event.title} · ${event.suburb ?? ""}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[0.6rem] font-semibold shadow-[var(--shadow-sm)] ring-2 ring-white transition hover:scale-110"
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
                  <p className="text-sm font-semibold leading-tight">{activeEvent.title}</p>
                  <p className="mt-0.5 text-xs font-medium text-[color:var(--slate)]">
                    {activeEvent.status} · {activeEvent.category}
                  </p>
                  {activeEvent.address ? (
                    <p className="mt-1 text-xs">{activeEvent.address}</p>
                  ) : activeEvent.locationName ? (
                    <p className="mt-1 text-xs">{activeEvent.locationName}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-[color:var(--slate)]">
                    {popupDateFormatter.format(new Date(activeEvent.startsAt))} ·{" "}
                    {activeEvent.attendees}/{activeEvent.capacity} going
                  </p>
                  <Link
                    href={`/events/${activeEvent.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-semibold text-[color:var(--purple)]"
                  >
                    View event ↗
                  </Link>
                </div>
              </Popup>
            ) : null}
          </Map>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-semibold text-[color:var(--ink)]">
              Add a Mapbox public token to load the map
            </p>
            <p className="text-xs text-[color:var(--slate)]">
              Paste your <code>pk.*</code> token as <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in{" "}
              <code>.env.local</code> and restart the dev server.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
