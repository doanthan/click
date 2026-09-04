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

type PostcodeEntry = { s: string; l: string[] };

const TABLE = raw as Record<string, PostcodeEntry>;

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
