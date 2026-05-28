"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";

// `@mapbox/search-js-react` touches `document` at import time, so we can't
// bundle it into the SSR pass. next/dynamic with `ssr: false` lazy-loads it on
// the client only.
const SearchBox = dynamic(
  () => import("@mapbox/search-js-react").then((m) => m.SearchBox),
  {
    ssr: false,
    loading: () => (
      <input
        disabled
        placeholder="Loading address search…"
        className="w-full rounded-lg border-2 border-[color:var(--line)] bg-[color:var(--champagne)]/60 px-4 py-3 text-sm font-bold text-[color:var(--mauve)]"
      />
    ),
  },
);

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export type MapboxPlace = {
  lat: number;
  lng: number;
  /** Name of the picked POI or address (e.g. "Bar Lucia" or "12 Macquarie St"). */
  name: string;
  /** Full formatted address line. */
  address: string;
  /** Best-effort suburb / locality. */
  suburb: string;
};

type RetrieveContextEntry = { name?: string } | undefined;

type RetrieveFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    full_address?: string;
    place_formatted?: string;
    address?: string;
    context?: {
      place?: RetrieveContextEntry;
      locality?: RetrieveContextEntry;
      neighborhood?: RetrieveContextEntry;
      district?: RetrieveContextEntry;
      region?: RetrieveContextEntry;
      postcode?: RetrieveContextEntry;
      country?: RetrieveContextEntry;
    };
  };
};

// Pull the most useful "suburb-ish" label off the context, in the order
// Mapbox uses for Australian addresses.
function suburbFrom(feature: RetrieveFeature): string {
  const ctx = feature.properties?.context;
  return (
    ctx?.locality?.name ??
    ctx?.place?.name ??
    ctx?.neighborhood?.name ??
    ctx?.district?.name ??
    ""
  );
}

export function MapboxAutocomplete({
  value,
  onValueChange,
  onSelect,
  placeholder = "Search address or venue",
  proximity,
  country = "AU",
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (place: MapboxPlace) => void;
  placeholder?: string;
  proximity?: { lat: number; lng: number };
  country?: string;
  className?: string;
}) {
  const handleRetrieve = useCallback(
    (res: unknown) => {
      const feature = (res as { features?: RetrieveFeature[] } | undefined)
        ?.features?.[0];
      if (!feature?.geometry?.coordinates) return;
      const [lng, lat] = feature.geometry.coordinates;
      const props = feature.properties ?? {};
      onSelect({
        lat,
        lng,
        name: props.name ?? props.address ?? "",
        address: props.full_address ?? props.place_formatted ?? props.name ?? "",
        suburb: suburbFrom(feature),
      });
    },
    [onSelect],
  );

  if (!TOKEN) {
    // Graceful degradation when the token is missing: plain controlled input.
    return (
      <input
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={`${placeholder} (set NEXT_PUBLIC_MAPBOX_TOKEN)`}
        className={
          className ??
          "w-full rounded-lg border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-sm font-bold text-[color:var(--ink)] outline-none focus:border-[color:var(--rose)]"
        }
      />
    );
  }

  return (
    <div className={className}>
      <SearchBox
        accessToken={TOKEN}
        value={value}
        onChange={onValueChange}
        onRetrieve={handleRetrieve}
        placeholder={placeholder}
        options={{
          country,
          language: "en",
          ...(proximity ? { proximity: { lng: proximity.lng, lat: proximity.lat } } : {}),
        }}
        theme={{
          variables: {
            colorPrimary: "#FF6978",
            colorText: "#340068",
            colorBackground: "#FFFCF9",
            colorBackgroundHover: "#fff6f7",
            border: "2px solid #340068",
            borderRadius: "0.5rem",
            boxShadow: "none",
            fontFamily: "inherit",
            unit: "16px",
          },
        }}
      />
    </div>
  );
}
