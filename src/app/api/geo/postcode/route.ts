/**
 * GET /api/geo/postcode?code=2204
 *
 * Resolves a 4-digit Australian postcode to its state + the suburbs that share
 * it, so the profile-edit form can offer a "type a postcode, pick your suburb"
 * flow. Backed by the bundled `src/lib/postcode.ts` table (no external call),
 * so it's fast and works offline.
 *
 * Returns:
 *   200 { postcode, state, suburbs: string[] } — known postcode
 *   400 { error }                              — missing / malformed code
 *   404 { error }                              — well-formed but unknown postcode
 */

import { NextResponse } from "next/server";
import { isValidPostcode, lookupPostcode } from "@/lib/postcode";

export function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.trim() ?? "";

  if (!isValidPostcode(code)) {
    return NextResponse.json(
      { error: "Provide a 4-digit Australian postcode." },
      { status: 400 },
    );
  }

  const match = lookupPostcode(code);
  if (!match) {
    return NextResponse.json(
      { error: "We don't recognise that postcode." },
      { status: 404 },
    );
  }

  // Suburbs change about as often as the postal map — let the edge cache hold
  // the answer for a day.
  return NextResponse.json(match, {
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
  });
}
