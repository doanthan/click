"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Map, { GeolocateControl, Marker, NavigationControl } from "react-map-gl/mapbox";
import type { EventItem } from "@/lib/click-data";
import { haversineKm, type LatLng } from "@/lib/geo";
import { Button, Icon } from "./ds";
import { EmptyState } from "./empty-state";
import { EventCard } from "./event-card";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STYLE = "mapbox://styles/mapbox/streets-v12";
// Only used when there is nothing at all to frame.
const FALLBACK_CENTRE = { lat: -33.8688, lng: 151.2093 };

/** One pin: the centre of a suburb that has events. Never a venue. */
export type MapSpot = LatLng & { key: string; suburbs: string[]; eventIds: string[] };

// mapbox-gl gives every marker wrapper role="img" + "Map marker" unless it
// already has them, and an img role hides the pin's button - its label and its
// pressed state - from screen readers.
type MarkerHandle = { getElement(): HTMLElement } | null;
const exposePinButton = (marker: MarkerHandle) => {
  marker?.getElement().removeAttribute("role");
  marker?.getElement().removeAttribute("aria-label");
};
const labelHome = (marker: MarkerHandle) => marker?.getElement().setAttribute("aria-label", "Your suburb");

// Open on home and the pins within NEAR_KM of it - what's around you, not the
// whole city, which at phone width zooms out far enough to stack the inner
// suburbs' pins on top of each other. Nothing that close: home and the nearest
// pin (`spots` arrive nearest first). Anything further is a pan or zoom away.
const NEAR_KM = 10;

function openingView(home: LatLng | null, spots: MapSpot[]) {
  const near = home ? spots.filter((spot) => haversineKm(home, spot) <= NEAR_KM) : spots;
  const points = [...(home ? [home] : []), ...(near.length > 0 ? near : spots.slice(0, 1))];
  if (points.length === 0) return { longitude: FALLBACK_CENTRE.lng, latitude: FALLBACK_CENTRE.lat, zoom: 11 };
  if (points.length === 1) return { longitude: points[0].lng, latitude: points[0].lat, zoom: 13 };
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  return {
    bounds: [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ] as [[number, number], [number, number]],
    fitBoundsOptions: { padding: 56, maxZoom: 14 },
  };
}

export function AroundMeMap({
  events,
  spots,
  home,
  degraded,
  bookmarkedEventIds,
  registeredEventIds,
  waitlistedEventIds,
}: {
  events: EventItem[];
  spots: MapSpot[];
  home: LatLng | null;
  degraded: boolean;
  bookmarkedEventIds: string[];
  registeredEventIds: string[];
  waitlistedEventIds: string[];
}) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = spots.find((spot) => spot.key === selectedKey) ?? null;
  const shown = selected ? events.filter((event) => selected.eventIds.includes(event.id)) : events;

  const bookmarked = new Set(bookmarkedEventIds);
  const registered = new Set(registeredEventIds);
  const waitlisted = new Set(waitlistedEventIds);

  return (
    <>
      <div className="relative mt-5 h-[min(56vh,520px)] min-h-[300px] overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--line)] bg-[color:var(--lav-bg)] shadow-[var(--shadow-sm)]">
        {TOKEN ? (
          <Map
            mapboxAccessToken={TOKEN}
            mapStyle={STYLE}
            initialViewState={openingView(home, spots)}
            style={{ width: "100%", height: "100%" }}
            // Two fingers to pan on touch, so a swipe over the map still
            // scrolls the page down to the list.
            cooperativeGestures
            onClick={() => setSelectedKey(null)}
          >
            <NavigationControl position="top-right" showCompass={false} />
            {/* Opt-in: the browser asks only when this is tapped, and the
                position stays on the device. */}
            <GeolocateControl position="top-right" fitBoundsOptions={{ maxZoom: 13 }} />

            {home ? (
              <Marker ref={labelHome} longitude={home.lng} latitude={home.lat} style={{ pointerEvents: "none" }}>
                {/* A halo, so it still shows round a pin in the same suburb. */}
                <span
                  aria-hidden
                  className="grid size-12 place-items-center rounded-full bg-[color:color-mix(in_srgb,var(--lavender)_50%,transparent)]"
                >
                  <span className="size-3 rounded-full bg-[color:var(--purple)] ring-2 ring-[color:var(--paper)]" />
                </span>
              </Marker>
            ) : null}

            {spots.map((spot) => {
              const active = spot.key === selectedKey;
              const count = spot.eventIds.length;
              return (
                <Marker
                  key={spot.key}
                  ref={exposePinButton}
                  longitude={spot.lng}
                  latitude={spot.lat}
                  style={active ? { zIndex: 1 } : undefined}
                  onClick={(e) => {
                    // Keep the map's own click (which clears the selection) out of it.
                    e.originalEvent.stopPropagation();
                    setSelectedKey(active ? null : spot.key);
                  }}
                >
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-label={`${spot.suburbs.join(", ")} - ${count} ${count === 1 ? "event" : "events"}`}
                    className={`font-display grid size-9 place-items-center rounded-full text-[13px] font-semibold tabular-nums shadow-[var(--shadow-sm)] transition-transform duration-150 hover:scale-110 ${
                      active
                        ? "scale-110 bg-[color:var(--purple)] text-[color:var(--champagne)] ring-2 ring-[color:var(--paper)]"
                        : "bg-[color:var(--paper)] text-[color:var(--purple)] ring-[1.5px] ring-[color:var(--purple)]"
                    }`}
                  >
                    {count}
                  </button>
                </Marker>
              );
            })}
          </Map>
        ) : (
          <p className="grid h-full place-items-center px-6 text-center text-sm text-[color:var(--slate)]">
            The map isn&apos;t available right now - everything near you is listed below.
          </p>
        )}

        {TOKEN && home ? (
          <span className="pointer-events-none absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--paper)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--ink)] shadow-[var(--shadow-xs)]">
            <span aria-hidden className="size-2.5 rounded-full bg-[color:var(--purple)]" />
            Your suburb
          </span>
        ) : null}
      </div>

      <section className="mt-7">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h2 className="font-display text-[length:var(--text-h2)] leading-tight font-semibold tracking-[-0.02em]">
            {selected ? selected.suburbs.join(" · ") : home ? "Nearest to you" : "Everything on now"}
          </h2>
          {selected ? (
            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              className="font-display inline-flex min-h-11 items-center gap-1.5 text-[13.5px] font-semibold text-[color:var(--purple)] hover:underline"
            >
              <Icon name="x" size={15} stroke={2.2} />
              Show everything
            </button>
          ) : null}
        </div>
        <p role="status" aria-live="polite" className="mt-1 text-sm font-medium text-[color:var(--slate)]">
          {shown.length} {shown.length === 1 ? "event" : "events"}
          {!selected && spots.length > 0 ? " - tap a pin to see one suburb" : ""}
        </p>

        {shown.length > 0 ? (
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                bookmarked={bookmarked.has(event.id)}
                registered={registered.has(event.id)}
                bookingStatus={
                  registered.has(event.id) ? (waitlisted.has(event.id) ? "waitlisted" : "confirmed") : undefined
                }
                // From the member's postcode, which needs no label; from the CBD it has to say so.
                distanceOrigin={home ? undefined : "CBD"}
              />
            ))}
          </div>
        ) : degraded ? (
          // Same words as Discover: a catalogue blip must never read as "no events".
          <EmptyState
            className="mt-5"
            eyebrow="One moment"
            icon={<Icon name="compass" size={26} stroke={1.7} />}
            title="We couldn't load events just now."
            body="This is on us, not on you - the catalogue is still there. Give it a moment and try again."
            action={
              <Button variant="secondary" size="sm" onClick={() => router.refresh()}>
                Try again
              </Button>
            }
          />
        ) : (
          <EmptyState
            className="mt-5"
            eyebrow="Just getting started"
            icon={<Icon name="compass" size={26} stroke={1.7} />}
            title="The first events are on their way."
            body="New things to do land here every week. Check back soon, or host the first one yourself."
            actionHref="/merchant/signup"
            actionLabel="Host an event"
          />
        )}
      </section>
    </>
  );
}
