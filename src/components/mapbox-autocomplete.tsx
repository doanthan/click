"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef } from "react";

// `@mapbox/search-js-react` touches `document` at import time, so it can't be
// bundled into the SSR pass. next/dynamic with `ssr: false` lazy-loads it on
// the client only.
//
// As you type (and on blur after a pick), the SearchBox aborts each superseded
// request via `AbortController.abort()` (no reason). On some paths the aborted
// work escapes as a benign unhandled rejection — `AbortError: signal is aborted
// without reason` — which Next's dev overlay paints as a "Runtime AbortError".
// That's swallowed globally in `src/instrumentation-client.ts`, which registers
// an `unhandledrejection` handler before Next's overlay does (component code
// can't win that registration race, but the instrumentation hook can).
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

// Fully static, so define it once at module scope. The SearchBox wrapper keys a
// `useEffect` on `theme`; a fresh object literal per render would re-assign the
// theme on every keystroke and add churn to the underlying web component.
const SEARCH_BOX_THEME = {
  // Match the surrounding TextInput / StateSelect chrome exactly:
  // rounded-xl (0.75rem), 2px ink border, champagne fill, cream hover,
  // semibold ink text, px-4 py-3 padding, no shadow.
  variables: {
    colorPrimary: "#E8674C",
    colorText: "#3B2F81",
    colorBackground: "#FFFFFF",
    colorBackgroundHover: "#F1ECFB",
    colorBackgroundActive: "#F1ECFB",
    border: "2px solid #3B2F81",
    borderRadius: "0.75rem",
    boxShadow: "none",
    padding: "0.75em 1em",
    fontFamily: "inherit",
    fontWeight: "600",
    fontWeightSemibold: "700",
    fontWeightBold: "700",
    lineHeight: "1.5",
    unit: "16px",
  },
  // The variables above style the wrapper. To make the typed value
  // ("48 Spencer Road") render with the same weight/colour as
  // "Cecil Hills" in the field next door, override the inner .Input
  // directly and brand the placeholder. The magnifier is hidden so
  // the Street field doesn't stand out from the icon-less neighbours.
  cssText: `
    .SearchBox .SearchIcon { display: none; }
    .SearchBox .Input {
      font-weight: 600;
      color: var(--purple);
      letter-spacing: 0;
    }
    .SearchBox .Input::placeholder {
      font-weight: 500;
      color: var(--mauve);
      opacity: 1;
    }
    .Results, .ResultsList, .Suggestion, .SuggestionName {
      color: var(--purple);
      font-weight: 600;
    }
    .SuggestionDesc { color: var(--mauve); font-weight: 500; }
  `,
};

export type MapboxPlace = {
  lat: number;
  lng: number;
  /** Name of the picked POI or address (e.g. "Bar Lucia" or "12 Macquarie St"). */
  name: string;
  /** Full formatted address line. */
  address: string;
  /** Just the street line, e.g. "42 Crown Street". */
  street: string;
  /** Best-effort suburb / locality. */
  suburb: string;
  /** Region/state code, e.g. "NSW" (best-effort). */
  state: string;
  /** Postcode (best-effort). */
  postcode: string;
};

type RetrieveContextEntry =
  | { name?: string; region_code?: string; short_code?: string }
  | undefined;

type RetrieveFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    full_address?: string;
    place_formatted?: string;
    address?: string;
    address_line1?: string;
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

// Pull the 2-3 letter state/region code (e.g. "NSW") off the region context.
// Mapbox exposes it as `region_code`, or as a `short_code` like "AU-NSW".
function stateFrom(feature: RetrieveFeature): string {
  const region = feature.properties?.context?.region;
  if (!region) return "";
  if (region.region_code) return region.region_code.toUpperCase();
  if (region.short_code) {
    const parts = region.short_code.split("-");
    return (parts[parts.length - 1] ?? "").toUpperCase();
  }
  return "";
}

function postcodeFrom(feature: RetrieveFeature): string {
  return feature.properties?.context?.postcode?.name ?? "";
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
  const boxRef = useRef<HTMLDivElement>(null);

  // Stable options object — a fresh literal each render would re-assign
  // `.options` on the SearchBox (it keys a useEffect on the prop) every
  // keystroke, churning the underlying web component.
  const options = useMemo(
    () => ({
      country,
      language: "en",
      ...(proximity ? { proximity: { lng: proximity.lng, lat: proximity.lat } } : {}),
    }),
    [country, proximity?.lat, proximity?.lng], // eslint-disable-line react-hooks/exhaustive-deps
  );

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
        street: props.address_line1 ?? props.address ?? props.name ?? "",
        suburb: suburbFrom(feature),
        state: stateFrom(feature),
        postcode: postcodeFrom(feature),
      });
      // After a pick the SearchBox keeps its (now stale) suggestion list and
      // re-opens it whenever the input regains focus — and focus bounces back
      // to the input as soon as the just-clicked suggestion element is hidden.
      // Blur the input so the dropdown stays closed; the SearchBox's own
      // `focusout` handler then runs hideResults().
      requestAnimationFrame(() => {
        boxRef.current?.querySelector("input")?.blur();
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
    <div className={className} ref={boxRef}>
      <SearchBox
        accessToken={TOKEN}
        value={value}
        onChange={onValueChange}
        onRetrieve={handleRetrieve}
        placeholder={placeholder}
        options={options}
        theme={SEARCH_BOX_THEME}
      />
    </div>
  );
}
