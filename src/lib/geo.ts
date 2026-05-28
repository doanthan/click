export type LatLng = { lat: number; lng: number };

// Great-circle distance in kilometres between two points (Haversine).
// Mirrors `distanceKmFromSydney` in event-repository.ts but takes both points,
// so the client can rank events against the user's real location.
export function haversineKm(a: LatLng, b: LatLng): number {
  const radiusKm = 6371;
  const latDelta = ((b.lat - a.lat) * Math.PI) / 180;
  const lngDelta = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// One decimal place, matching how distances are stored/displayed elsewhere.
export function roundKm(km: number): number {
  return Math.round(km * 10) / 10;
}

// Click currently operates in Sydney and Melbourne; everything else is bucketed
// as "Other" until a third market launches. Add the new region here when it does.
export type Region = "Sydney" | "Melbourne" | "Other";

// Bounding boxes are intentionally wide — Greater Sydney reaches Penrith,
// Greater Melbourne reaches Geelong/Frankston. Tighter than this and legitimate
// outer-ring events fall to "Other".
const sydneyBox = { latMin: -34.3, latMax: -33.4, lngMin: 150.3, lngMax: 151.6 };
const melbourneBox = { latMin: -38.5, latMax: -37.3, lngMin: 144.3, lngMax: 145.7 };

export function regionFromCoords(lat: number | null, lng: number | null): Region {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return "Other";
  if (lat >= sydneyBox.latMin && lat <= sydneyBox.latMax && lng >= sydneyBox.lngMin && lng <= sydneyBox.lngMax) {
    return "Sydney";
  }
  if (lat >= melbourneBox.latMin && lat <= melbourneBox.latMax && lng >= melbourneBox.lngMin && lng <= melbourneBox.lngMax) {
    return "Melbourne";
  }
  return "Other";
}

// Suburb-name fallback for legacy rows missing coords. The seed data only ever
// stamps Sydney coords, so most callers will hit the coord path; this catches
// hand-entered events where the merchant left lat/lng blank.
const melbourneSuburbPattern = /\b(melbourne|fitzroy|carlton|st\s*kilda|richmond|brunswick|south\s*yarra|prahran|footscray|collingwood|docklands|southbank|geelong|frankston)\b/i;
const sydneySuburbPattern = /\b(sydney|barangaroo|surry\s*hills|newtown|redfern|bondi|marrickville|parramatta|chatswood|manly|penrith|the\s*rocks|potts\s*point|paddington|darlinghurst|leichhardt|glebe|pyrmont)\b/i;

export function regionFromSuburb(suburb: string | null | undefined): Region {
  if (!suburb) return "Other";
  if (melbourneSuburbPattern.test(suburb)) return "Melbourne";
  if (sydneySuburbPattern.test(suburb)) return "Sydney";
  return "Other";
}

export function regionForEvent(input: {
  lat: number | null;
  lng: number | null;
  suburb: string | null;
}): Region {
  const fromCoords = regionFromCoords(input.lat, input.lng);
  if (fromCoords !== "Other") return fromCoords;
  return regionFromSuburb(input.suburb);
}
