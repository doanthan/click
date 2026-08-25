// The event-length options, shared by every surface that writes events.ends_at.
//
// It lives here rather than inside the create wizard because the merchant event
// EDIT form now offers the same choice (for an event that is not yet live and
// holds no seats), and two copies of this list would drift: a duration offered
// on one surface and missing from the other produces an ends_at the other
// surface cannot round-trip back into its own dropdown, so the field silently
// resets to a value the host never picked.
//
// Values are minutes, as strings, because both consumers bind them straight to
// a <select> whose value is a string.
export const DURATION_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours" },
  { value: "150", label: "2.5 hours" },
  { value: "180", label: "3 hours" },
  { value: "240", label: "4 hours" },
  { value: "300", label: "5 hours" },
  { value: "360", label: "6 hours" },
  { value: "480", label: "8 hours" },
];

/** The default when nothing is stored or the stored value is unusable. */
export const DEFAULT_DURATION_MINUTES = 120;

/**
 * Snap an arbitrary minute count to the nearest option. An event created before
 * this list existed (or through the API) can carry any duration at all, and a
 * <select> handed a value with no matching <option> renders BLANK - which reads
 * as "no duration set" and, if saved, would write the first option instead of
 * what the event actually runs for.
 */
export function nearestDurationValue(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return String(DEFAULT_DURATION_MINUTES);
  }
  let best = DURATION_OPTIONS[0];
  for (const option of DURATION_OPTIONS) {
    if (Math.abs(Number(option.value) - minutes) < Math.abs(Number(best.value) - minutes)) {
      best = option;
    }
  }
  return best.value;
}
