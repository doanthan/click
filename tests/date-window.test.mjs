import assert from "node:assert/strict";
import test from "node:test";

// Mirrors the calendar-day bucketing in src/components/event-explorer.tsx.
// Bug board row 238: an event at 7pm tonight was scored Math.ceil(0.79) = 1 and
// filed under "Tomorrow", while a genuine tomorrow-evening event scored 2 and
// matched neither window.
const sydneyDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Sydney",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function sydneyDayIndex(value) {
  const [year, month, day] = sydneyDayFormat.format(new Date(value)).split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

const NOW = "2026-07-24T12:00:00+10:00"; // midday in Sydney

test("an event later today buckets as today, not tomorrow", () => {
  const today = sydneyDayIndex(NOW);
  assert.equal(sydneyDayIndex("2026-07-24T09:00:00+10:00") - today, 0);
  assert.equal(sydneyDayIndex("2026-07-24T19:00:00+10:00") - today, 0);
});

test("tomorrow evening buckets as tomorrow", () => {
  assert.equal(sydneyDayIndex("2026-07-25T19:00:00+10:00") - sydneyDayIndex(NOW), 1);
});

test("past events stay negative", () => {
  assert.equal(sydneyDayIndex("2026-07-23T19:00:00+10:00") - sydneyDayIndex(NOW), -1);
});

test("weekday mapping puts Sat at 6 and Sun at 0", () => {
  const weekday = (iso) => (sydneyDayIndex(iso) + 4) % 7; // epoch day 0 was a Thursday
  assert.equal(weekday("2026-07-25T12:00:00+10:00"), 6, "Saturday");
  assert.equal(weekday("2026-07-26T12:00:00+10:00"), 0, "Sunday");
  assert.equal(weekday("2026-07-27T12:00:00+10:00"), 1, "Monday");
});
