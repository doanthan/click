// Bug board, admin cluster: #274 (members page scales), #248/#264 (out-of-area
// waitlist + CSV), #276/#277 (mutual clicks to nights out, and where they stall).
//
// Pure modules (geo's place lookup, csv) are imported and exercised against the
// real postcode table. The rest sits behind Next's server runtime and a pg pool,
// so it is pinned with source assertions on the clause that would have to be
// deleted to bring the bug back - same split as host-journey.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { placeForStoredSuburb } from "../src/lib/geo.ts";
import { csvCell, toCsv } from "../src/lib/csv.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const table = JSON.parse(read("src/lib/au-postcodes.json"));

const slice = (source, start, end) => {
  const from = source.indexOf(start);
  assert.ok(from > -1, `expected ${start}`);
  const to = source.indexOf(end, from + start.length);
  return source.slice(from, to === -1 ? undefined : to);
};

/* ---------------- #248/#264: who is out of area ---------------- */

test("a stored suburb inside the pilot is not out of area", () => {
  assert.equal(placeForStoredSuburb("Marrickville", table).area, "pilot");
  assert.equal(placeForStoredSuburb("  marrickville ", table).area, "pilot");
  // Legacy rows hold the raw code onboarding was given.
  assert.equal(placeForStoredSuburb("2204", table).area, "pilot");
  // The outer rings are Greater Sydney too.
  assert.equal(placeForStoredSuburb("Penrith", table).area, "pilot");
});

test("a place beyond the pilot is out of area, with the postcodes it can mean", () => {
  const burnley = placeForStoredSuburb("Burnley", table);
  assert.equal(burnley.area, "outside");
  assert.deepEqual(burnley.postcodes, ["3121"]);
  assert.deepEqual(burnley.states, ["VIC"]);

  assert.equal(placeForStoredSuburb("Wollongong", table).area, "outside");
  assert.equal(placeForStoredSuburb("3121", table).area, "outside");
  assert.deepEqual(placeForStoredSuburb("3121", table).states, ["VIC"]);
});

test("a name shared with a Sydney suburb counts as Sydney, not the waitlist", () => {
  // Richmond is 2753 NSW and 3121 VIC. The name alone cannot tell them apart,
  // and emailing a Sydney member "Click has reached your city" is the worse miss.
  assert.equal(placeForStoredSuburb("Richmond", table).area, "pilot");
});

test("nothing to go on is unknown, never out of area", () => {
  assert.equal(placeForStoredSuburb(null, table).area, "unknown");
  assert.equal(placeForStoredSuburb("   ", table).area, "unknown");
  assert.equal(placeForStoredSuburb("Sydney CBD", table).area, "unknown");
});

test("the out-of-area view and the CSV use the same rule, and the CSV is admin-only", () => {
  const repo = read("src/lib/event-repository.ts");
  const members = slice(repo, "export async function getAdminMembers", "\nexport async function");
  assert.match(members, /if \(filter\.outsidePilot\)/);
  assert.match(members, /await outsidePilotSuburbs\(pool\)/);

  const exportFn = slice(repo, "export async function getOutOfAreaMembersForExport", "\n/**");
  assert.match(exportFn, /await requireAdminProfile\(session\)/, "a bulk email export re-checks the admin");
  assert.match(exportFn, /await outsidePilotSuburbs\(pool\)/);
  assert.match(exportFn, /deleted_at is null/);
  assert.match(exportFn, /not is_banned/);

  const helper = slice(repo, "async function outsidePilotSuburbs", "\n/**");
  assert.match(helper, /placeForSuburb\(suburb\)\.area === "outside"/);

  const route = read("src/app/api/admin/members/out-of-area/route.ts");
  assert.match(route, /isAdminEmail\(session\.user\.email\)/);
  assert.match(route, /"private, no-store"/);
  assert.match(route, /toCsv\(/);
});

/* ---------------- CSV cells ---------------- */

test("a CSV cell can never run as a spreadsheet formula", () => {
  // Display names are the member's own free text.
  assert.equal(csvCell("=HYPERLINK(\"x\")"), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell("+61 400"), "'+61 400");
  assert.equal(csvCell("@me"), "'@me");
  assert.equal(csvCell("-1"), "'-1");
  assert.equal(csvCell("Mia"), "Mia");
  assert.equal(csvCell("Chen, Mia"), '"Chen, Mia"');
  assert.equal(csvCell('Mia "M"'), '"Mia ""M"""');
  assert.equal(toCsv([["a", "b"], ["c", "d"]]), "﻿a,b\r\nc,d\r\n");
});

/* ---------------- #274: the members list scales ---------------- */

test("the members list is one server-side page, with the filters in the URL", () => {
  const repo = read("src/lib/event-repository.ts");
  const members = slice(repo, "export async function getAdminMembers", "\nexport async function");
  // Role, event and totals are SQL, not a filter over a loaded window.
  assert.match(members, /profile\.role = \$\$\{pageParams\.length\}::user_role/);
  assert.match(members, /group by profile\.role/);
  assert.match(members, /from event_participants_v seat/);
  assert.match(members, /limit \$\$\{pageParams\.length - 1\} offset \$\$\{pageParams\.length\}/);
  // The per-member event history no longer rides along on every row.
  assert.doesNotMatch(members, /jsonb_agg/);

  const page = read("src/app/admin/members/page.tsx");
  assert.match(page, /searchParams/);
  assert.match(page, /outsidePilot: filters\.area === "outside"/);
  assert.match(page, /offset: \(requestedPage - 1\) \* PAGE_SIZE/);

  const table = read("src/components/admin-members-table.tsx");
  assert.match(table, /import Form from "next\/form"/);
  assert.doesNotMatch(table, /useDeferredValue|searchMembers/, "no in-browser filtering of a loaded window");
});

/* ---------------- #276/#277: clicks to nights out ---------------- */

test("a night out together is counted the way the mutual sweep counts it", () => {
  const repo = read("src/lib/event-repository.ts");
  const outcomes = slice(repo, "export async function getAdminClickOutcomes", "\nexport async function");
  // The event's real roster (a claimed +1 counts), a night that happened, and
  // after the click - the night that introduced a post-event pair is not them
  // going out together.
  assert.match(outcomes, /from event_participants_v a/);
  assert.match(outcomes, /coalesce\(e\.ends_at, e\.starts_at\) >= m\.mutual_at/);
  assert.match(outcomes, /e\.status <> 'cancelled'/);
  // Pairs, not mutual rows: one pair can click more than once.
  assert.match(outcomes, /count\(distinct \(user_a_id, user_b_id\)\) filter \(where went\)/);
  // The stall buckets split live mutuals by their plan.
  assert.match(outcomes, /p\.status in \('pending', 'accepted'\)/);
  assert.match(outcomes, /live_plan = 'pending'/);
  assert.match(outcomes, /live_plan = 'accepted'/);

  const page = read("src/app/admin/page.tsx");
  assert.match(page, /getAdminClickOutcomes\(\)/);
});

/* ---------------- #309: what "Confirmed RSVPs" counts ---------------- */

test("the Confirmed RSVPs card says a cancelled booking is not in it", () => {
  // Bug board #309: "confirmed, but what if they cancelled?". It is not counted:
  // the card reads status = 'confirmed', and each way a booking ends moves the
  // row to 'cancelled'. The card now says what it counts.
  const repo = read("src/lib/event-repository.ts");
  const metrics = slice(repo, "export async function getAdminMetrics", "\n}\n");
  assert.match(metrics, /from event_attendees\s+where status = 'confirmed'/);
  for (const fn of [
    "export async function cancelRegistration(",
    "async function cancelEvent(",
    "export async function settleRefundedBooking(",
  ]) {
    assert.match(slice(repo, fn, "\n}\n"), /update event_attendees\s+set status = 'cancelled'/, fn);
  }

  const page = read("src/app/admin/page.tsx");
  assert.match(
    page,
    /label="Confirmed RSVPs"[\s\S]{0,120}hint="All-time bookings, minus any that were cancelled\. Doesn't include \+1s\."/,
  );
  assert.match(read("src/components/click-ui.tsx"), /\{hint \? <p className=/);
});

/* ---------------- #313/#314: the tag manager ---------------- */

test("a tag's category is picked from the existing list, never typed", () => {
  // Bug board #313. A typed category was created on save (the tag upsert writes
  // tag_categories), so a typo became a new public category and "fitness"
  // renamed "Fitness" for every event matched on the name.
  const manager = read("src/components/admin-tag-manager.tsx");
  const field = slice(manager, '<span className="eyebrow">Category</span>', "</label>");
  assert.match(field, /<select/);
  assert.doesNotMatch(field, /<input|<datalist/);
  assert.match(field, /<option value="" disabled>/);
  // The hosts' list plus the categories already on tags (internal Life, Music),
  // uncapped.
  assert.match(manager, /\.\.\.categoryOptions,/);
  assert.doesNotMatch(manager, /\.slice\(0, 20\)/);
  const page = read("src/app/admin/tags/page.tsx");
  assert.match(page, /<AdminTagManager[\s\S]*?categories=\{categories\.map\(\(category\) => category\.name\)\}/);
});

test("tags sort by category, A-Z or most used", () => {
  // Bug board #314.
  const manager = read("src/components/admin-tag-manager.tsx");
  assert.match(manager, /\["az", "A-Z"\]/);
  assert.match(manager, /\["usage", "Most used"\]/);
  assert.match(manager, /sortBy === "usage"\s*\? b\.usageCount - a\.usageCount/);
  assert.match(manager, /\}, \[rows, query, typeFilter, sortBy\]\);/);
});
