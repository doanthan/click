/**
 * Australian postcode → suburb lookup.
 *
 * Backed by `au-postcodes.json` (compact, server-only - never import this
 * module into a client component or the 300 KB table ships to the browser).
 * The data is a trimmed slice of the open `matthewproctor/australianpostcodes`
 * set: postal-only / delivery-centre localities removed, suburb names
 * title-cased and de-duplicated per postcode.
 *
 * Shape: `{ "2204": { "s": "NSW", "l": ["Marrickville", "Marrickville South"] } }`
 */

import raw from "./au-postcodes.json";
// Same source, australian_postcodes.csv: the mean of Lat_precise/Long_precise
// over the localities au-postcodes.json keeps for each postcode, to 3 decimals.
// (Its plain lat/long columns are one rough point per postcode - 2000's sits
// in the harbour.) Shape: `{ "2204": [-33.909, 151.151] }`.
import centroids from "./au-postcode-centroids.json";
import { placeForStoredSuburb, regionFromPostcode, type LatLng, type StoredSuburbPlace } from "./geo";

type PostcodeEntry = { s: string; l: string[] };

const TABLE = raw as Record<string, PostcodeEntry>;
const CENTROIDS = centroids as unknown as Record<string, [number, number]>;

export type PostcodeLookup = {
  postcode: string;
  state: string;
  suburbs: string[];
};

const POSTCODE_RE = /^\d{4}$/;

export function isValidPostcode(code: string): boolean {
  return POSTCODE_RE.test(code.trim());
}

/**
 * Returns the state + suburbs for a 4-digit AU postcode, or `null` if the
 * postcode is malformed or not in the table.
 */
export function lookupPostcode(code: string): PostcodeLookup | null {
  const postcode = code.trim();
  if (!isValidPostcode(postcode)) return null;
  const entry = TABLE[postcode];
  if (!entry) return null;
  return { postcode, state: entry.s, suburbs: entry.l };
}

/** Inside or outside the attendee pilot, for a profiles.suburb value - see placeForStoredSuburb. */
export function placeForSuburb(stored: string | null | undefined): StoredSuburbPlace {
  return placeForStoredSuburb(stored, TABLE);
}

let postcodesByName: Map<string, string[]> | null = null;

/**
 * Where a member's distances are measured from (bug board #305): the centre of
 * the postcode behind profiles.suburb, which holds a suburb name or the code
 * itself. A name in several postcodes (Richmond, Epping) takes a pilot one
 * first, the same call placeForStoredSuburb makes. null when the value is empty
 * or unknown - the caller measures from Sydney CBD instead.
 */
export function distanceOriginForSuburb(
  stored: string | null | undefined,
): (LatLng & { label: string }) | null {
  const value = (stored ?? "").trim();
  if (!value) return null;

  let codes: string[];
  if (isValidPostcode(value)) {
    codes = [value];
  } else {
    if (!postcodesByName) {
      postcodesByName = new Map();
      for (const [postcode, entry] of Object.entries(TABLE)) {
        for (const name of entry.l) {
          const key = name.toLowerCase();
          postcodesByName.set(key, [...(postcodesByName.get(key) ?? []), postcode]);
        }
      }
    }
    codes = postcodesByName.get(value.toLowerCase()) ?? [];
  }

  const code =
    codes.find((c) => CENTROIDS[c] && regionFromPostcode(c) === "Sydney") ?? codes.find((c) => CENTROIDS[c]);
  if (!code) return null;
  const [lat, lng] = CENTROIDS[code];
  const label = isValidPostcode(value)
    ? value
    : (TABLE[code].l.find((name) => name.toLowerCase() === value.toLowerCase()) ?? value);
  return { lat, lng, label };
}
