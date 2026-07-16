"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import { Icon } from "./ds";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STYLE = "mapbox://styles/mapbox/streets-v12";

// Single-venue map shown on the event page once the viewer has unlocked the
// exact location (confirmed attendee / admin / owner). Degrades to an
// "Open in Maps" link when no Mapbox token is configured.
export function EventVenueMap({
  lat,
  lng,
  label,
  mapsUrl,
}: {
  lat: number;
  lng: number;
  label: string;
  mapsUrl: string;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--line)]">
      <div className="relative h-44">
        {TOKEN ? (
          <Map
            mapboxAccessToken={TOKEN}
            mapStyle={STYLE}
            initialViewState={{ longitude: lng, latitude: lat, zoom: 14 }}
            style={{ width: "100%", height: "100%" }}
            attributionControl={false}
            scrollZoom={false}
          >
            <NavigationControl position="top-right" showCompass={false} />
            <Marker longitude={lng} latitude={lat} anchor="bottom">
              <span
                title={label}
                className="flex size-7 items-center justify-center rounded-full bg-[color:var(--purple)] text-[color:var(--champagne)] shadow-[var(--shadow-sm)]"
              >
                <Icon name="pin" size={15} />
              </span>
            </Marker>
          </Map>
        ) : (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-full flex-col items-center justify-center gap-1 bg-[color:var(--paper)] px-4 text-center"
          >
            <span className="text-sm font-semibold text-[color:var(--ink)]">
              Open the venue in Maps →
            </span>
            <span className="text-xs text-[color:var(--slate)]">
              {label}
            </span>
          </a>
        )}
        {TOKEN ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute left-2 top-2 z-10 rounded-lg bg-[color:var(--paper)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--ink)] shadow-[var(--shadow-sm)] hover:bg-[color:var(--lavender-100)]"
          >
            Open in Maps
          </a>
        ) : null}
      </div>
    </div>
  );
}
