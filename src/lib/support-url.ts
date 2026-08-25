/**
 * Keep a reported page URL pointing at us.
 *
 * POST /api/support/ticket is open to signed-out visitors on purpose, and both
 * `url` and `fullUrl` are read straight out of the `client_metadata` field the
 * reporter supplies. Both end up inside an `=HYPERLINK("…","…")` in column A of
 * the operators' Google Sheet triage board (src/lib/support-sheets.ts:259-262).
 *
 * `sheetStr` already doubles quotes there, so the formula cannot be broken out
 * of. What it does not constrain is the DESTINATION: an anonymous report could
 * put any https:// host in that cell and have it render, in our own board, in
 * our own styling, as the page the bug was filed on. The person who clicks it
 * is a Click operator with an admin session.
 *
 * So: absolute URLs on our own host pass through whole. Anything pointing
 * somewhere else is reduced to its path and query, which is the part triage
 * actually needs ("which page was this?") and is not a link off our board.
 * Relative values pass through untouched - they were never a destination.
 *
 * Host, not origin: behind the proxy/CDN (letsclick.app is served via both www
 * and apex, see next.config.ts) the request's own scheme is not reliably the
 * public one, so comparing full origins would downgrade legitimate reports.
 */
export function keepOwnOriginUrl(
  value: string | null | undefined,
  requestHost: string | null | undefined,
): string | null {
  if (!value) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    // Not absolute - a pathname like "/events/foo". Nothing to point anywhere.
    return value;
  }

  // A non-http scheme in a cell that becomes a link: javascript:, data:, file:.
  // Sheets refuses most of them, but the value is also rendered as the link TEXT,
  // so it should not survive into the board at all.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return parsed.pathname || null;
  }

  if (requestHost && parsed.host === requestHost) return parsed.href;

  return `${parsed.pathname}${parsed.search}`;
}
