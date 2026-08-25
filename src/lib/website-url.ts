// The optional merchant website field - ONE rule, shared by the signup wizard
// and /api/merchant, the way src/lib/abn.ts and src/lib/au-phone.ts already are.
//
// The rule used to live only on the server, so a host who typed
// "http://mybusiness.com.au" (or a hostname with no dot) passed every step and
// was bounced on Documents with a message about a field two routes away. Two
// changes fix that class: an explicit http:// is now UPGRADED to https:// the
// same way a bare hostname is, rather than rejected, and what remains - a value
// that isn't a domain at all - is checked in the wizard too.

/**
 * Normalise a typed website into the stored https:// URL. Returns `{ url }` on
 * success ("" for an empty field, which is allowed - the field is optional) or
 * `{ error }` with the message to show the host.
 */
export function normalizeWebsiteUrl(value: string): { url?: string; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { url: "" };

  // A bare hostname and an explicit http:// both become https://. Nobody types
  // a scheme meaning "please serve this insecurely", and rejecting it only ever
  // cost the host a round trip through a form they had already left.
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed.replace(/^http:\/\//i, "https://")
    : `https://${trimmed}`;

  try {
    // Always https by construction above, so there is no scheme check left to
    // fail - what remains is "is this actually a domain".
    const parsed = new URL(withProtocol);

    if (!parsed.hostname.includes(".")) {
      return { error: "Enter a valid website domain, like https://www.google.com." };
    }

    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return { url: `${parsed.protocol}//${parsed.host}${path}${parsed.search}${parsed.hash}` };
  } catch {
    return { error: "Enter a valid website URL, like https://www.google.com." };
  }
}

/** The wizard's per-step check: the message to show, or null when it's fine. */
export function validateWebsiteUrl(value: string): string | null {
  return normalizeWebsiteUrl(value).error ?? null;
}
