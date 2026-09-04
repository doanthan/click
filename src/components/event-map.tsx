"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Popup,
  Source,
  type LayerProps,
  type MapRef,
} from "react-map-gl/mapbox";
import type { FeatureCollection } from "geojson";
import type { EventItem } from "@/lib/click-data";
import type { LatLng } from "@/lib/geo";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STYLE = "mapbox://styles/mapbox/streets-v12";
const SYDNEY = { lat: -33.8688, lng: 151.2093 };

// A pinned event: one the caller is allowed to see coordinates for. Explore withholds
// lat/lng for anyone without a seat (21 §B5.5 - a pin IS the address), so an unpinned
// event simply has nothing to plot and drops off the map rather than landing at (0,0).
type PinnedEvent = EventItem & { lat: number; lng: number };

const isPinned = (event: EventItem): event is PinnedEvent =>
  typeof event.lat === "number" && typeof event.lng === "number";

function averageCenter(events: EventItem[]) {
  const located = events.filter(isPinned);
  if (located.length === 0) return SYDNEY;
  const sum = located.reduce(
    (acc, event) => ({ lat: acc.lat + event.lat, lng: acc.lng + event.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / located.length, lng: sum.lng / located.length };
}

// Approximate a true-km circle as a polygon. A circle paint-layer uses pixel
// units, which would shrink/grow with zoom - a polygon keeps the radius honest
// at every scale.
function circlePolygon(
  center: LatLng,
  radiusKm: number,
  steps = 96,
): FeatureCollection {
  const earthR = 6371;
  const coords: [number, number][] = [];
  const latRad = (center.lat * Math.PI) / 180;
  for (let i = 0; i <= steps; i++) {
    const a = (i * 360) / steps;
    const theta = (a * Math.PI) / 180;
    const dLat = ((radiusKm / earthR) * Math.cos(theta) * 180) / Math.PI;
    const dLng =
      ((radiusKm / earthR) * Math.sin(theta) * 180) /
      Math.PI /
      Math.cos(latRad);
    coords.push([center.lng + dLng, center.lat + dLat]);
  }
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [coords] },
      },
    ],
  };
}

const radiusFill: LayerProps = {
  id: "radius-fill",
  type: "fill",
  paint: {
    "fill-color": "#E8674C",
    "fill-opacity": 0.12,
  },
};

const radiusOutline: LayerProps = {
  id: "radius-outline",
  type: "line",
  paint: {
    "line-color": "#3B2F81",
    "line-width": 2,
    "line-opacity": 0.7,
  },
};

export function EventMap({
  events,
  selectedSuburb,
  searchQuery,
  mapsUrl,
  userCoords = null,
  radiusKm = null,
}: {
  events: EventItem[];
  selectedSuburb: string;
  searchQuery: string;
  mapsUrl: string;
  userCoords?: LatLng | null;
  radiusKm?: number | null;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const eventsCenter = useMemo(() => averageCenter(events), [events]);
  const center = userCoords ?? eventsCenter;

  const radiusGeoJSON = useMemo(
    () => (userCoords && radiusKm ? circlePolygon(userCoords, radiusKm) : null),
    [userCoords, radiusKm],
  );

  // Fit the map to the radius circle when the user shares location or moves
  // the slider. If there's no radius, just recenter.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (userCoords && radiusKm) {
      // Same math as circlePolygon but only the four cardinal points.
      const earthR = 6371;
      const dLat = ((radiusKm / earthR) * 180) / Math.PI;
      const dLng = dLat / Math.cos((userCoords.lat * Math.PI) / 180);
      map.fitBounds(
        [
          [userCoords.lng - dLng, userCoords.lat - dLat],
          [userCoords.lng + dLng, userCoords.lat + dLat],
        ],
        { padding: 32, duration: 600 },
      );
    } else if (userCoords) {
      map.flyTo({ center: [userCoords.lng, userCoords.lat], duration: 600 });
    }
  }, [userCoords, radiusKm]);

  const activeEvent = activeId ? events.find((e) => e.id === activeId) ?? null : null;

  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] px-4 py-3">
        <span className="text-xs font-black uppercase tracking-[0.16em]">
          Events map
        </span>
        <span className="rounded-full bg-[color:var(--peach)] px-3 py-1 text-xs font-black">
          {events.length} matches
        </span>
      </div>

      <div className="relative h-72">
        {TOKEN ? (
          <>
            <Map
              ref={mapRef}
              mapboxAccessToken={TOKEN}
              mapStyle={STYLE}
              initialViewState={{
                longitude: center.lng,
                latitude: center.lat,
                zoom: 12,
              }}
              style={{ width: "100%", height: "100%" }}
              attributionControl={false}
            >
              <NavigationControl position="top-right" showCompass={false} />

              {radiusGeoJSON ? (
                <Source id="radius" type="geojson" data={radiusGeoJSON}>
                  <Layer {...radiusFill} />
                  <Layer {...radiusOutline} />
                </Source>
              ) : null}

              {userCoords ? (
                <Marker longitude={userCoords.lng} latitude={userCoords.lat} anchor="bottom">
                  <div
                    title="Your location"
                    className="flex h-7 items-center rounded-full border-2 border-[color:var(--champagne)] bg-[color:var(--ink)] px-2 text-[0.6rem] font-black uppercase tracking-wider text-[color:var(--peach)] shadow"
                  >
                    YOU
                  </div>
                </Marker>
              ) : null}

              {events.map((event, index) =>
                isPinned(event) ? (
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
                    aria-label={`${event.title} marker`}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--rose)] text-[0.7rem] font-black text-[color:var(--surface-deep)] shadow hover:scale-110"
                  >
                    {index + 1}
                  </button>
                </Marker>
                ) : null,
              )}

              {activeEvent && isPinned(activeEvent) ? (
                <Popup
                  longitude={activeEvent.lng}
                  latitude={activeEvent.lat}
                  anchor="bottom"
                  offset={32}
                  closeButton={true}
                  closeOnClick={false}
                  onClose={() => setActiveId(null)}
                >
                  <div className="max-w-[220px] text-[color:var(--ink)]">
                    <p className="text-sm font-black leading-tight">
                      {activeEvent.title}
                    </p>
                    <p className="mt-1 text-xs">{activeEvent.location}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--mauve)]">
                      {activeEvent.date} · {activeEvent.time}
                    </p>
                    <a
                      href={`/events/${activeEvent.id}`}
                      className="mt-2 inline-block text-xs font-black text-[color:var(--coral)]"
                    >
                      View event →
                    </a>
                  </div>
                </Popup>
              ) : null}
            </Map>

            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute left-3 top-3 z-10 rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-2 text-xs font-black text-[color:var(--coral)] shadow"
            >
              Open in Maps
            </a>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[color:var(--lav-bg)] px-6 text-center">
            <p className="text-sm font-black text-[color:var(--ink)]">
              Add a Mapbox public token to load the map
            </p>
            <p className="text-xs text-[color:var(--mauve)]">
              Paste your <code>pk.*</code> token as{" "}
              <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in <code>.env.local</code> and
              restart the dev server.
            </p>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-2 text-xs font-black text-[color:var(--coral)] shadow"
            >
              Open in Maps
            </a>
          </div>
        )}
      </div>

      <div className="border-t border-[color:var(--line)] px-4 py-3">
        <p className="text-sm font-black text-[color:var(--ink)]">
          {events.length} filtered events around {selectedSuburb}
          {searchQuery ? ` for "${searchQuery}"` : ""}.
        </p>
      </div>
    </div>
  );
}
