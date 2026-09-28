// Bug board, dashboard cluster: #172 radar FOMO, #222 notification count,
// #242 honest empty state, #244 sideways scroll, #286 greeting hour, #288 the
// radar row's grammar.
//
// attendee-fomo.ts is pure and imported for real. Everything else sits behind
// Next's server runtime, so it is pinned by SOURCE assertion - each one on the
// clause that would have to be deleted to bring the bug back (the same split
// host-journey.test.mjs describes).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FOMO_FLOOR, attendeeFomoSignals } from "../src/lib/attendee-fomo.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

// The radar asks for the headcount fallback; the event page does not.
const radar = (room) =>
  attendeeFomoSignals({ topSharedInterest: null, datingCount: 0, viewerOpenToDating: false, countFallback: true, ...room });
const hiking = (count) => ({ label: "Hiking", count });

/* ---------------- #172 / #288: the radar line ---------------- */

test("an empty room gets no line, so the radar can fall back honestly", () => {
  assert.deepEqual(radar({ confirmed: 0 }), []);
});

test("below the privacy floor the line is a headcount, never what people are like", () => {
  assert.equal(FOMO_FLOOR, 3);
  assert.deepEqual(radar({ confirmed: 1, topSharedInterest: hiking(1) }), ["1 person going so far"]);
  assert.deepEqual(radar({ confirmed: 2, topSharedInterest: hiking(2) }), ["2 going so far"]);
});

test("from three going, the shared interest leads, with the verb agreeing", () => {
  assert.deepEqual(radar({ confirmed: 3, topSharedInterest: hiking(1) }), ["1 person going also likes Hiking"]);
  assert.deepEqual(radar({ confirmed: 5, topSharedInterest: hiking(2) }), ["2 going also like Hiking"]);
});

test("the dating count only reaches a dating-visible viewer, and only from three", () => {
  assert.deepEqual(radar({ confirmed: 4, datingCount: 3, viewerOpenToDating: true }), ["3 open to dating"]);
  assert.deepEqual(radar({ confirmed: 4, datingCount: 3, viewerOpenToDating: false }), ["4 going so far"]);
  assert.deepEqual(radar({ confirmed: 4, datingCount: 2, viewerOpenToDating: true }), ["4 going so far"]);
});

test("the dashboard rotates through rooms with people in them and asks the shared helper", () => {
  const dashboard = read("src/app/dashboard/page.tsx");
  assert.match(dashboard, /radarPool\.filter\(\(event\) => event\.attendees > 0\)/);
  assert.match(dashboard, /const fomoBySlug = await getRadarSignals\(rotatedRadar, session\);/);
  // The inline copy of the logic is gone - one builder for both surfaces.
  assert.doesNotMatch(dashboard, /going also like/);
});

test("the /people radar gets the same lines instead of none", () => {
  const people = read("src/app/people/page.tsx");
  assert.match(people, /const radarSignals = await getRadarSignals\(radarEvents, session\);/);
  assert.match(people, /<ClickRadar events=\{radarEvents\} fomoBySlug=\{radarSignals\} \/>/);
});

test("a radar row separates its line from the event name (DS: line → name)", () => {
  const radar = read("src/components/click-radar.tsx");
  assert.match(radar, /<span aria-hidden="true"> → <\/span>/);
});

/* ---------------- #242: the empty states tell the truth ---------------- */

test("an empty people pool never sends the member back to add interests", () => {
  const dashboard = read("src/app/dashboard/page.tsx");
  assert.doesNotMatch(dashboard, /title="Tell us what you're into\."/);
  assert.doesNotMatch(dashboard, /actionLabel="Add interests"/);
  assert.match(dashboard, /title="No one to show you just yet\."/);
});

test("the suggested rail only asks for interests from someone who has none", () => {
  const repo = read("src/lib/event-repository.ts");
  const copy = repo.slice(
    repo.indexOf("function personalizedDiscoveryCopy"),
    repo.indexOf("export async function getPersonalizedDiscovery"),
  );
  assert.match(copy, /tagCount === 0\s*\?\s*"Add a few interests/);
  // Both return paths (v1 and matching v2) go through it.
  const body = repo.slice(repo.indexOf("export async function getPersonalizedDiscovery"));
  assert.equal(
    body.slice(0, body.indexOf("export type EventCategory")).match(/personalizedDiscoveryCopy\(/g)?.length,
    2,
  );
});

/* ---------------- #286: the greeting reads Sydney's clock ---------------- */

test("the greeting hour is Sydney's, not the server's", () => {
  const dashboard = read("src/app/dashboard/page.tsx");
  assert.doesNotMatch(dashboard, /= new Date\(\)\.getHours\(\)/);
  assert.match(dashboard, /hourCycle: "h23", timeZone: APP_TIME_ZONE/);
  assert.match(dashboard, /const hourOfDay = Number\(sydneyHour\.format\(new Date\(\)\)\);/);
});

/* ---------------- #222: the inbox and the bell agree ---------------- */

test("the inbox carries the bell's unread total and says when it lists fewer", () => {
  const page = read("src/app/notifications/page.tsx");
  assert.match(page, /getUnreadNotificationCount\(session\)/);
  assert.match(page, /Unread · \{unreadCount\.toLocaleString\("en-AU"\)\}/);
  assert.match(page, /unreadCount > unread\.length/);
});

/* ---------------- #244: nothing drags the page sideways ---------------- */

test("a rail is the containing block for its own absolutely placed text", () => {
  // Without it, sr-only spans inside the dashboard's card rail laid out against
  // the document and dragged the page to 1333px wide at a 375px viewport.
  assert.match(read("src/app/globals.css"), /\.ckRail \{ position: relative;/);
});
