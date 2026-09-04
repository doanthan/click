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

// Bounding boxes are intentionally wide - Greater Sydney reaches Penrith,
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

// Postcode → region, for surfaces that only collect a 4-digit AU postcode (e.g.
// attendee onboarding) and have no coordinates. The Greater Sydney ranges below
// are chosen to track the wide `sydneyBox` above: metro core, plus the Macarthur
// and Penrith/Blue Mountains/Hawkesbury outer rings. Central Coast, Wollongong,
// Newcastle and everything else fall to "Other" - i.e. outside the current
// Sydney pilot. Melbourne is best-effort metro-core only (not load-bearing).
type PostcodeRange = readonly [number, number];
const SYDNEY_POSTCODE_RANGES: readonly PostcodeRange[] = [
  [2000, 2234], // Sydney metropolitan (city, east, inner west, north shore,
                // northern beaches, Sutherland, St George, Canterbury-Bankstown,
                // Hills, Parramatta, Blacktown, Liverpool, Hornsby)
  [2555, 2574], // Macarthur (Camden, Campbelltown, Picton)
  [2745, 2786], // Penrith, Blue Mountains, Hawkesbury (Windsor, Richmond)
];
const MELBOURNE_POSTCODE_RANGES: readonly PostcodeRange[] = [
  [3000, 3207], // Melbourne metropolitan core
  [3211, 3220], // Geelong corridor
  [3750, 3810], // outer north / south-east (Whittlesea, Pakenham)
  [3910, 3944], // Frankston / Mornington Peninsula
];

// NSW PO-box / business-district range. Not a suburb anyone lives in, but a
// legitimate registered business address, so it counts as inside the pilot for
// merchant signup. Deliberately NOT part of SYDNEY_POSTCODE_RANGES: those drive
// regionFromPostcode, and a PO box is not a region an attendee is "in".
const NSW_PO_BOX_RANGE: PostcodeRange = [1000, 1999];

export const PILOT_AREA_LABEL = "Greater Sydney";

/**
 * The ONE answer to "is this address inside the launch pilot?".
 *
 * There were two, and they disagreed. The merchant wizard used 2000-2249 /
 * 2555-2574 / 2740-2786 with no state check, while the server used NSW plus
 * 2000-2234 / 1000-1999. So a host in Camden (2570), Campbelltown (2560) or
 * Penrith (2750) saw no out-of-pilot notice on the form, submitted, was told
 * "in the admin queue... within 1 business day", and then received an email
 * saying Click isn't live in their suburb - two contradictory messages and
 * nothing they could do about either. The admin bell said "outside pilot" for a
 * host the form had treated as inside it.
 *
 * Resolved toward the wider, already-documented Greater Sydney ranges in
 * SYDNEY_POSTCODE_RANGES rather than the server's narrower list: those outer
 * rings are genuinely Sydney, and the form had been promising them for longer.
 * The NSW requirement is kept from the server side - every range here is a NSW
 * range, so a non-NSW state alongside one of them is a mis-filled form.
 */
export function isWithinSydneyPilot(
  state: string | null | undefined,
  postcode: string | null | undefined,
): boolean {
  if (state && state !== "NSW") return false;
  if (!postcode || !/^\d{4}$/.test(postcode.trim())) return false;
  const code = Number.parseInt(postcode.trim(), 10);
  return [...SYDNEY_POSTCODE_RANGES, NSW_PO_BOX_RANGE].some(
    ([lo, hi]) => code >= lo && code <= hi,
  );
}

export function regionFromPostcode(postcode: string | null | undefined): Region {
  if (!postcode) return "Other";
  const code = Number.parseInt(postcode.trim(), 10);
  if (!Number.isInteger(code)) return "Other";
  if (SYDNEY_POSTCODE_RANGES.some(([lo, hi]) => code >= lo && code <= hi)) return "Sydney";
  if (MELBOURNE_POSTCODE_RANGES.some(([lo, hi]) => code >= lo && code <= hi)) return "Melbourne";
  return "Other";
}
