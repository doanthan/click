"use client";

import { useMemo, useState } from "react";
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map,
  Pin,
} from "@vis.gl/react-google-maps";
import type { EventItem } from "@/lib/click-data";

const SYDNEY = { lat: -33.8688, lng: 151.2093 };
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

function averageCenter(events: EventItem[]) {
  const located = events.filter((event) => event.lat && event.lng);
  if (located.length === 0) return SYDNEY;
  const sum = located.reduce(
    (acc, event) => ({ lat: acc.lat + event.lat, lng: acc.lng + event.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / located.length, lng: sum.lng / located.length };
}

export function EventMap({
  events,
  selectedSuburb,
  searchQuery,
  mapsUrl,
}: {
  events: EventItem[];
  selectedSuburb: string;
  searchQuery: string;
  mapsUrl: string;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [activeId, setActiveId] = useState<string | null>(null);

  // Re-center whenever the set of events changes (suburb/search/filters).
  const center = useMemo(() => averageCenter(events), [events]);
  const centerKey = `${center.lat.toFixed(3)},${center.lng.toFixed(3)}`;

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
        {apiKey ? (
          <APIProvider apiKey={apiKey}>
            <Map
              key={centerKey}
              defaultCenter={center}
              defaultZoom={12}
              mapId={MAP_ID}
              gestureHandling="greedy"
              disableDefaultUI={false}
              className="h-full w-full"
            >
              {events.map((event, index) => (
                <AdvancedMarker
                  key={event.id}
                  position={{ lat: event.lat, lng: event.lng }}
                  onClick={() => setActiveId(event.id)}
                >
                  <Pin
                    background="#FF6978"
                    glyphColor="#FFF8EE"
                    borderColor="#340068"
                  >
                    <span className="text-[11px] font-black">{index + 1}</span>
                  </Pin>
                </AdvancedMarker>
              ))}

              {activeId
                ? (() => {
                    const event = events.find((item) => item.id === activeId);
                    if (!event) return null;
                    return (
                      <InfoWindow
                        position={{ lat: event.lat, lng: event.lng }}
                        onCloseClick={() => setActiveId(null)}
                        pixelOffset={[0, -36]}
                      >
                        <div className="max-w-[200px] text-[color:var(--ink)]">
                          <p className="text-sm font-black leading-tight">
                            {event.title}
                          </p>
                          <p className="mt-1 text-xs">{event.location}</p>
                          <p className="mt-0.5 text-xs text-[color:var(--mauve)]">
                            {event.date} · {event.time}
                          </p>
                          <a
                            href={`/events/${event.id}`}
                            className="mt-2 inline-block text-xs font-black text-[#1A73E8]"
                          >
                            View event →
                          </a>
                        </div>
                      </InfoWindow>
                    );
                  })()
                : null}
            </Map>

            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute left-3 top-3 z-10 rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-2 text-xs font-black text-[#1A73E8] shadow"
            >
              Open in Maps
            </a>
          </APIProvider>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#E8F2EA] px-6 text-center">
            <p className="text-sm font-black text-[color:var(--ink)]">
              Add a Google Maps API key to load the map
            </p>
            <p className="text-xs text-[color:var(--mauve)]">
              Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in your{" "}
              <code>.env</code> file, then restart the dev server.
            </p>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-2 text-xs font-black text-[#1A73E8] shadow"
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
