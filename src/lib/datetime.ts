// Time-zone helpers for event scheduling.
//
// The merchant create/edit wizard uses <input type="datetime-local">, which
// emits a bare wall-clock string like "2026-06-08T09:00" with NO timezone
// designator. `new Date("2026-06-08T09:00")` parses that in the *server's* local
// zone - which is UTC on Vercel - so a 9:00 AM Sydney event gets stored as
// 09:00 UTC (= 7:00/8:00 PM Sydney). That's the "I made it an AM event but it
// shows as PM" bug, and it also shifts events onto the wrong calendar day.
//
// Everything in this app is authored and displayed in Sydney time, so we
// interpret bare datetime-local strings as Sydney wall time and convert to the
// correct UTC instant before persisting.

export const APP_TIME_ZONE = "Australia/Sydney";

// The offset (ms to add to a UTC instant to get wall-clock time) of `timeZone`
// at the given UTC instant. Positive for zones east of UTC (Sydney ≈ +10/+11h).
function timeZoneOffsetMs(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  // `hour` can come back as 24 at midnight in some engines; normalise to 0.
  const hour = map.hour === 24 ? 0 : map.hour;
  const asIfUtc = Date.UTC(map.year, map.month - 1, map.day, hour, map.minute, map.second);
  return asIfUtc - utcMs;
}

// Whether a string already carries a timezone designator (trailing Z, or a
// ±HH:mm / ±HHmm offset). Such strings are already absolute instants.
function hasTimeZoneDesignator(value: string): boolean {
  return /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value.trim());
}

// Parse an event start string into a UTC Date.
//
// - Bare datetime-local ("2026-06-08T09:00" / with seconds) → interpreted as
//   Sydney wall time.
// - Anything with an explicit offset or Z → parsed as-is (already absolute).
// - Unparseable input → Invalid Date (callers already guard on getTime() NaN).
export function parseEventStart(value: string, timeZone: string = APP_TIME_ZONE): Date {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return new Date(NaN);

  if (hasTimeZoneDesignator(trimmed)) {
    return new Date(trimmed);
  }

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!match) {
    // Not the shape we expect - fall back to native parsing rather than crash.
    return new Date(trimmed);
  }

  const [, y, mo, d, h, mi, s] = match;
  // First approximation: treat the wall-clock components as if they were UTC.
  const wallAsUtc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    s ? Number(s) : 0,
  );
  // The real UTC instant is the wall time minus the zone's offset. Compute the
  // offset at the approximate instant, then refine once to settle DST edges.
  const offset1 = timeZoneOffsetMs(wallAsUtc, timeZone);
  let utc = wallAsUtc - offset1;
  const offset2 = timeZoneOffsetMs(utc, timeZone);
  if (offset2 !== offset1) {
    utc = wallAsUtc - offset2;
  }
  return new Date(utc);
}

/**
 * The inverse of parseEventStart: a stored UTC instant back into the bare
 * "YYYY-MM-DDTHH:mm" wall-clock string an <input type="datetime-local"> shows.
 *
 * Needed by the merchant event EDIT form, which pre-fills a start time that
 * parseEventStart will read back. Doing it with toISOString().slice(0, 16)
 * would hand the input UTC, so a 7pm Sydney event would open the editor
 * reading 9am (or 8am, across the DST boundary) - and simply saving the form
 * without touching the field would MOVE the event ten hours.
 */
export function formatEventStartLocal(
  value: Date | string,
  timeZone: string = APP_TIME_ZONE,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  // Same midnight quirk timeZoneOffsetMs guards against: some engines render
  // hour 24 rather than 00, which datetime-local rejects outright.
  const hour = map.hour === "24" ? "00" : map.hour;
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}`;
}
