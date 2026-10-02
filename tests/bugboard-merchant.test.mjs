// Bug board, merchant cluster: rows 144, 223/273/278, 259, 261-263, 272/275.
//
// Same split as host-journey.test.mjs: the phone helpers are a pure module and
// are called for real; everything behind Next's server runtime is a SOURCE
// assertion that pins the clause which would have to be deleted to bring the
// bug back.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  auPhoneProgress,
  formatAuPhoneAsYouType,
  isValidAuPhone,
  normalizeAuPhone,
} from "../src/lib/au-phone.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const fnBody = (source, start) => {
  const at = source.indexOf(start);
  assert.ok(at > -1, `${start} not found`);
  return source.slice(at, source.indexOf("\nexport ", at + 1));
};

/* ---------------- #144 phone entry ---------------- */

test("the phone field regroups a half-typed number without adding or dropping a digit", () => {
  assert.equal(formatAuPhoneAsYouType("04123"), "0412 3");
  assert.equal(formatAuPhoneAsYouType("0412345678"), "0412 345 678");
  assert.equal(formatAuPhoneAsYouType("412345678"), "412 345 678");
  assert.equal(formatAuPhoneAsYouType("029646888"), "02 9646 888");
  assert.equal(formatAuPhoneAsYouType("296468888"), "2 9646 8888");
  assert.equal(formatAuPhoneAsYouType("1300123456"), "1300 123 456");
  assert.equal(formatAuPhoneAsYouType("131234"), "13 12 34");
  // An extra digit stays visible on the last group rather than vanishing.
  assert.equal(formatAuPhoneAsYouType("04123456789"), "0412 345 6789");
  // The +61 has its own box, so a pasted or autofilled country code goes.
  assert.equal(formatAuPhoneAsYouType("+61 412 345 678"), "412 345 678");
  assert.equal(formatAuPhoneAsYouType("0061 2 9646 8888"), "2 9646 8888");
});

test("a national number typed beside the +61 box, without its trunk 0, is valid", () => {
  assert.equal(normalizeAuPhone("2 9646 8888"), "0296468888");
  assert.equal(isValidAuPhone("2 9646 8888"), true);
  assert.equal(isValidAuPhone("3 9123 4567"), true);
  // The tester's own number is still one digit short, and still says so.
  assert.equal(isValidAuPhone("026447777"), false);
  assert.match(auPhoneProgress("026447777"), /Landline - 9 of 10 digits/);
});

test("the live hint counts a host through the number instead of erroring early", () => {
  assert.match(auPhoneProgress("04"), /Mobile - 2 of 10 digits/);
  assert.match(auPhoneProgress("412"), /Mobile - 3 of 9 digits/);
  assert.match(auPhoneProgress("1300 12"), /1300\/1800 number - 6 of 10 digits/);
  assert.match(auPhoneProgress("04123456789"), /11 digits, 10 is enough/);
  // 13 00 xx is a 1300 number being typed, never a finished 13 number.
  assert.equal(isValidAuPhone("1300 12"), false);
  assert.equal(isValidAuPhone("13 12 34"), true);
});

test("the signup phone field has a fixed +61 box and errors only once left", () => {
  const wizard = read("src/components/merchant-signup-wizard.tsx");
  const contact = fnBody(wizard, "export function ContactSection");
  assert.match(contact, />\s*\+61\s*</, "the +61 prefix box is gone");
  assert.match(contact, /autoComplete="tel-national"/);
  assert.match(contact, /formatAuPhoneAsYouType\(value\)/);
  assert.match(contact, /phoneTouched && phoneTyped && !phoneValid \? auPhoneHint/);
  assert.match(contact, /auPhoneProgress\(state\.phone\)/);
});

/* ---------------- #223 / #273 / #278 overlapping events ---------------- */

test("069 drops the trigger that refused a host's overlapping events", () => {
  const migration = read("database/069_allow_merchant_event_overlap.sql");
  assert.match(
    migration,
    /drop trigger if exists prevent_merchant_event_overlap_before_event_write on events;/,
  );
  assert.match(migration, /drop function if exists prevent_merchant_event_overlap\(\);/);
});

test("creating an overlapping event names the clash instead of refusing it", () => {
  const repo = read("src/lib/event-repository.ts");
  const create = fnBody(repo, "export async function createEventForMerchant");
  const check = create.indexOf("existing.status in ('pending', 'live', 'featured', 'locked', 'waitlist')");
  assert.ok(check > -1, "the overlap lookup is gone");
  assert.ok(check < create.indexOf("insert into events ("), "the overlap lookup must run before the insert");
  assert.match(create, /overlapsWith: overlap\.rows\[0\]/);

  const wizard = read("src/components/event-create-wizard.tsx");
  assert.match(wizard, /firstOverlap = firstOverlap \?\? payload\.event\?\.overlapsWith/);
  assert.match(wizard, /overlapNote \? \{ description: overlapNote, duration: 12000 \} : undefined/);
});

test("an admin can approve an overlapping event after a confirm", () => {
  const repo = read("src/lib/event-repository.ts");
  const admin = fnBody(repo, "export async function getAdminEvents");
  assert.match(admin, /as overlaps_with/);
  assert.match(admin, /overlapsWith: event\.overlaps_with/);
  // Until 069 runs, the trigger's raw message is translated, not surfaced.
  const approve = fnBody(repo, "export async function approveEventForAdmin");
  assert.match(approve, /isMerchantOverlapTriggerError\(error\)/);

  const queue = read("src/components/admin-event-queue.tsx");
  assert.match(queue, /event\.overlapsWith \? setOverlapTarget\(event\) : approve\(event\.id\)/);
  assert.match(queue, /confirmLabel="Approve anyway"/);
});

/* ---------------- #259 trust is visible after approval ---------------- */

test("approving a merchant shows them as trusted without a reload", () => {
  const repo = read("src/lib/event-repository.ts");
  const verify = fnBody(repo, "export async function updateMerchantVerificationForAdmin");
  assert.match(verify, /when \$2 = 'approved' then true/);
  assert.match(verify, /autoApproveEvents: merchant\.auto_approve_events/);

  const table = read("src/components/admin-merchants-table.tsx");
  assert.match(table, /autoApproveEvents: payload\.autoApproveEvents \?\? merchant\.autoApproveEvents/);
  assert.match(table, /"Trusted - no event review" : "Reviews every event"/);
  assert.match(table, /"Review every event" : "Trust merchant"/);
});

/* ---------------- #261 / #262 / #263 shorter wizard copy ---------------- */

test("the schedule and review steps stop re-explaining the host terms", () => {
  const wizard = read("src/components/event-create-wizard.tsx");
  const schedule = fnBody(wizard, "export function ScheduleSection");
  assert.doesNotMatch(schedule, /GST-inclusive/);
  assert.doesNotMatch(schedule, /Cancellations: a guest cancelling/);
  assert.match(schedule, /href="\/terms"/, "the terms stay one link away");
  assert.match(schedule, /Set up payouts/, "the one action that matters stays");

  const review = fnBody(wizard, "export function ReviewSection");
  assert.doesNotMatch(review, /This is how your event card will look on Click/);
  assert.match(review, /Your Discover card\. The venue stays hidden until someone has a seat\./);
});

/* ---------------- #272 / #275 tags required + tag requests ---------------- */

test("an event needs at least one tag, on both sides", () => {
  const wizard = read("src/components/event-create-wizard.tsx");
  const basics = wizard.slice(wizard.indexOf("if (step === 0)"), wizard.indexOf("if (step === 1)"));
  assert.match(basics, /parseTags\(v\.tags\)\.length === 0/);
  assert.doesNotMatch(wizard, /label="Tags \(optional\)"/);

  const repo = read("src/lib/event-repository.ts");
  const create = fnBody(repo, "export async function createEventForMerchant");
  const tagCheck = create.indexOf("Pick at least one tag");
  assert.ok(tagCheck > -1, "the server-side tag check is gone");
  assert.ok(tagCheck < create.indexOf("insert into events ("), "the tag check must run before the insert");
});

test("a host can request a tag without holding up their event", () => {
  const migration = read("database/068_tag_requests.sql");
  assert.match(migration, /create table if not exists tag_requests/);
  assert.match(migration, /where status = 'pending'/);

  const wizard = read("src/components/event-create-wizard.tsx");
  assert.match(wizard, /<TagRequestForm \/>/);
  const form = read("src/components/tag-request-form.tsx");
  assert.match(form, /fetch\("\/api\/merchant\/tag-requests"/);
  // Bug board #315: the same request from the portal's Settings tab.
  const settings = read("src/components/merchant-settings-tab.tsx");
  assert.match(settings, /<TagRequestForm context="settings" \/>/);

  const repo = read("src/lib/event-repository.ts");
  const request = fnBody(repo, "export async function requestTagForMerchant");
  assert.match(request, /select label from tags where slug = \$1/, "an existing tag must not be queued");
  assert.match(request, /on conflict do nothing/);
  assert.match(request, /where role = 'admin'/, "admins must hear about it");
});

test("the admin queue approves through the tag upsert and reads fail-soft", () => {
  const repo = read("src/lib/event-repository.ts");
  const decide = fnBody(repo, "export async function decideTagRequestForAdmin");
  assert.match(decide, /requireAdminProfile\(session\)/);
  // An existing tag is linked, never rewritten by createTagForAdmin's upsert,
  // and a quiz or music tag holding the name is refused rather than retyped.
  const lookup = decide.indexOf("select id::text, label, tag_type from tags where slug = $1");
  assert.ok(lookup > -1, "the existing-tag lookup is gone");
  assert.ok(lookup < decide.indexOf("createTagForAdmin("));
  assert.match(decide, /match\.tag_type !== "interest" && match\.tag_type !== "vibe"/);
  assert.match(decide, /insert into notifications/);

  // Before 068 is applied, /admin/tags still renders: an empty queue.
  const list = fnBody(repo, "export async function getTagRequestsForAdmin");
  assert.match(list, /isMissingTagRequestsTable\(error\)/);
  assert.match(list, /return \[\];/);

  const page = read("src/app/admin/tags/page.tsx");
  assert.match(page, /getTagRequestsForAdmin\(\)/);
  assert.match(page, /<AdminTagRequests/);
  assert.match(read("src/app/api/admin/tag-requests/[requestId]/route.ts"), /decideTagRequestForAdmin/);
  assert.match(read("src/app/api/merchant/tag-requests/route.ts"), /requestTagForMerchant/);
});

test("the host's events list pages past 20 rows", () => {
  // Bug board #317: "pagination if there are more than 20 rows?".
  const panel = read("src/components/merchant-events-panel.tsx");
  assert.match(panel, /const PAGE_SIZE = 20;/);
  assert.match(panel, /const pageRows = visible\.slice\(\(safePage - 1\) \* PAGE_SIZE, safePage \* PAGE_SIZE\);/);
  assert.match(panel, /pageRows\.map\(\(event, i\) =>/);
  assert.doesNotMatch(panel, /visible\.map\(/);
  // Each filter starts the list again from page 1.
  assert.equal(panel.match(/setPage\(1\);/g)?.length, 4);
  assert.match(panel, /\{visible\.length > PAGE_SIZE \? \(\s*<nav\s+aria-label="Pagination"/);
});
