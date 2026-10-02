import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

// The real helper - Node strips the types on import.
import { attendeeFomoSignals, decadeOf, majorityDecade } from "../src/lib/attendee-fomo.ts";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const repo = read("src/lib/event-repository.ts");
const preview = read("src/components/event-attendee-preview.tsx");
const page = read("src/app/events/[slug]/page.tsx");
const quickView = read("src/components/event-detail-modal.tsx");

const fnBody = (source, start) => {
  const at = source.indexOf(start);
  assert.ok(at > -1, `${start} not found`);
  const end = source.indexOf("\nexport ", at + 1);
  return source.slice(at, end === -1 ? undefined : end);
};

test("who's going carries FOMO lines, and dating only for a dating viewer", () => {
  // Bug board #236/#258, within the DS privacy rails: nothing about the room
  // until three are going, and the romantic line only from three.
  const room = { confirmed: 6, topSharedInterest: { label: "Hiking", count: 2 }, datingCount: 3 };
  assert.deepEqual(attendeeFomoSignals({ ...room, viewerOpenToDating: true }), [
    "2 going also like Hiking",
    "A few singles are going",
  ]);
  // Mutual opt-in: a friends-only viewer never sees the singles line.
  assert.deepEqual(attendeeFomoSignals({ ...room, viewerOpenToDating: false }), [
    "2 going also like Hiking",
  ]);
  // Two open to dating is below the floor.
  assert.deepEqual(attendeeFomoSignals({ ...room, datingCount: 2, viewerOpenToDating: true }), [
    "2 going also like Hiking",
  ]);
  assert.deepEqual(
    attendeeFomoSignals({
      confirmed: 3,
      topSharedInterest: { label: "Pottery", count: 1 },
      datingCount: 0,
      viewerOpenToDating: true,
    }),
    ["1 person going also likes Pottery"],
  );
  // A two-person room says nothing about the people in it.
  assert.deepEqual(
    attendeeFomoSignals({
      confirmed: 2,
      topSharedInterest: { label: "Pottery", count: 2 },
      datingCount: 2,
      viewerOpenToDating: true,
    }),
    [],
  );
  // The event page prints its own headcount, so no fallback line here.
  assert.deepEqual(
    attendeeFomoSignals({ confirmed: 4, topSharedInterest: null, datingCount: 0, viewerOpenToDating: true }),
    [],
  );
});

test("the age line: the room's decade, only to a viewer in it, only from the floor", () => {
  // Click-mechanic Loom 2026-09-30: "if you're in your 30s... mostly in their 30s".
  assert.equal(decadeOf(34), 30);
  assert.equal(decadeOf(40), 40);
  assert.equal(decadeOf(19), null); // "in their 10s" is not a thing
  assert.equal(decadeOf(null), null);
  // A strict majority of known ages, and at least three people in it.
  assert.equal(majorityDecade([31, 34, 38, 25, null]), 30);
  assert.equal(majorityDecade([31, 34, 36, 25, 27, 28]), null); // a tie is not "mostly"
  assert.equal(majorityDecade([31, 34, null, null]), null); // two is below the floor
  assert.equal(majorityDecade([19, 18, 19, 31]), null); // teens never make a decade
  assert.equal(majorityDecade([]), null);

  const room = { confirmed: 5, topSharedInterest: null, datingCount: 0, viewerOpenToDating: false };
  assert.deepEqual(attendeeFomoSignals({ ...room, crowdDecade: 30, viewerDecade: 30 }), [
    "Most going are in their 30s",
  ]);
  // Never to someone outside it - a draw, not a warning off.
  assert.deepEqual(attendeeFomoSignals({ ...room, crowdDecade: 30, viewerDecade: 20 }), []);
  assert.deepEqual(attendeeFomoSignals({ ...room, crowdDecade: 30, viewerDecade: null }), []);
  // Nothing about the people below the floor.
  assert.deepEqual(attendeeFomoSignals({ ...room, confirmed: 2, crowdDecade: 30, viewerDecade: 30 }), []);
  // Its own line, never a tail on the interest line (the decade is the room's).
  assert.deepEqual(
    attendeeFomoSignals({
      ...room,
      topSharedInterest: { label: "Plants", count: 4 },
      datingCount: 3,
      viewerOpenToDating: true,
      crowdDecade: 30,
      viewerDecade: 30,
    }),
    ["4 going also like Plants", "Most going are in their 30s", "A few singles are going"],
  );
  // Both the event page and the radar hand the decades over.
  assert.match(preview, /crowdDecade: preview\.crowdDecade,\s*viewerDecade: preview\.viewerDecade,/);
  const radarBody = fnBody(repo, "export async function getRadarSignals");
  assert.match(radarBody, /crowdDecade: preview\.crowdDecade,\s*viewerDecade: preview\.viewerDecade,/);
  // Counted over the visible roster, from the birth date.
  const body = fnBody(repo, "export async function getEventAttendeePreview");
  assert.match(body, /coalesce\(extract\(year from age\(profile\.birth_date\)\)::int, profile\.age\) as age/);
  assert.match(body, /crowdDecade: majorityDecade\(rows\.map\(\(row\) => row\.age\)\)/);
});

test("the locked Who's going signs off with the DS line once people are going", () => {
  const locked = preview.slice(preview.indexOf("if (!viewerIsAttendee) {"), preview.indexOf("// Going (or managing it)"));
  assert.match(locked, /\{totalConfirmed > 0 \? \(/);
  assert.match(locked, /Same room, same reason - that&apos;s where you click\./);
});

test("almost full reads the same on the card, the quick-view and the page, with a coral bar", () => {
  // The card's rung (event-card.tsx: <= 8 left) now exists on both other surfaces.
  assert.match(page, /: seatsLeft <= 8\s*\? "Almost full"/);
  assert.match(quickView, /: seatsLeft <= 8\s*\? "Almost full"/);
  // DS CapacityMeter: Coral above 85% full, otherwise Purple. It had gone Ink.
  assert.match(page, /capacityPct >= 85 \? "bg-\[color:var\(--coral\)\]" : "bg-\[color:var\(--purple\)\]"/);
  assert.doesNotMatch(page, /capacityPct >= 85 \? "bg-\[color:var\(--ink\)\]"/);
});

test("the event page no longer carries the anonymity note", () => {
  // Bug board #233. The post-event card keeps its own at the click moment.
  assert.doesNotMatch(preview, /Clicking is anonymous/);
  assert.match(preview, /attendeeFomoSignals\(/);
});

test("shared tags on the roster are interest tags only", () => {
  // The life quiz writes "Recently single" / "New parent" into user_tags as
  // tag_type 'life'; the roster printed a shared one on a named card.
  const body = fnBody(repo, "export async function getEventAttendeePreview");
  assert.match(body, /left join tags shared_tag\s+on shared_tag\.id = ut\.tag_id\s+and shared_tag\.tag_type = 'interest'/);
});

test("who's going lists claimed +1s, the viewer's own card and named guests", () => {
  const participants = repo.slice(
    repo.indexOf("const WHO_IS_GOING_PARTICIPANTS"),
    repo.indexOf("export async function getEventAttendeePreview"),
  );
  // A claimed +1 has no attendee row; it joins the roster while the booking it
  // rides on is confirmed.
  assert.match(participants, /gs\.status = 'claimed'/);
  assert.match(participants, /purchaser_seat\.status = 'confirmed'/);
  assert.match(participants, /attendee\.visible_to_attendees/);
  assert.match(participants, /gs\.visible_to_attendees/);

  const body = fnBody(repo, "export async function getEventAttendeePreview");
  // Bug board #281: the viewer's own seat, found on either kind of seat.
  assert.match(body, /hidden_from_others/);
  assert.match(body, /gs\.claimed_profile_id = profile\.id/);
  // Bug board #284: named, unclaimed +1s as placeholders, hidden with their host.
  assert.match(body, /gs\.status = 'invited'/);
  assert.match(body, /purchaser\.default_attend_visibility and purchaser_seat\.visible_to_attendees/);
  assert.match(body, /b\.blocked_profile_id = purchaser\.id/);
  // The headcount counts the +1 seats too, once each.
  assert.match(body, /gs\.status <> 'cancelled'/);

  // The placeholder is not a link - there is no profile to open yet.
  const guestCard = preview.slice(preview.indexOf("guests.map("), preview.indexOf("remaining > 0"));
  assert.doesNotMatch(guestCard, /<Link/);
  assert.match(guestCard, /Guest of \$\{g\.hostFirstName\}/);
});

test("a renamed tag still attaches when a host picks it", () => {
  // Bug board #282/#291/#292: the picker sends labels, a rename keeps the slug.
  const create = fnBody(repo, "export async function createEventForMerchant");
  assert.match(create, /or lower\(tag\.label\) = input\.label/);
});

test("the capacity meter only calls people going 'going'", () => {
  // Bug board #302/#304: the meter's number counts every seat the booking gates
  // count - live checkout holds and waitlist offers included - and labelled all
  // of it "going", so it read "1 of 2 going" (and "Fully booked" beside one
  // person) with nobody else in Who's going. Held seats are named separately.
  const detail = fnBody(repo, "export async function getEventBySlug");
  assert.match(detail, /\)::text as held_seats,/);
  assert.match(detail, /seatsHeld: Number\(row\.held_seats\) \|\| 0,/);

  const page = read("src/app/events/[slug]/page.tsx");
  assert.match(page, /const seatsHeld = Math\.min\(event\.seatsHeld, seatsTaken\);/);
  assert.match(page, /const seatsGoing = seatsTaken - seatsHeld;/);
  assert.match(page, /`\$\{seatsGoing\} of \$\{event\.capacity\} going`/);
  assert.doesNotMatch(page, /`\$\{seatsTaken\} of \$\{event\.capacity\} going`/);
  assert.match(page, /seatsHeld > 0 \? ` · \$\{seatsHeld\} \$\{seatsHeld === 1 \? "spot" : "spots"\} held`/);
});

test("cancelling a booking with +1s says the +1 seats go too", () => {
  // Bug board #301: a +1 seat hangs off the buyer's booking, so cancelling the
  // booking cancels every +1 on it - and the confirm panel only showed the
  // refund. It now says so, and points at the per-seat cancel instead.
  const cancel = fnBody(repo, "export async function cancelRegistration");
  assert.match(cancel, /cancelGuestSeatsForTransaction\(client, row\.txn_id\)/);

  const page = read("src/app/events/[slug]/page.tsx");
  assert.match(page, /guestSeatCount=\{isRegistered \? myGuestSeats\.length : 0\}/);

  const button = read("src/components/event-registration-button.tsx");
  assert.match(button, /confirmKind === "booking" && guestSeatCount > 0/);
  assert.match(button, /This also cancels your \+1's seat\./);
  assert.match(button, /This also cancels your \$\{guestSeatCount\} \+1 seats\./);
});

test("the booking-cancel confirm names the +1s it cancels", () => {
  // Spec 19 §10.3: when named guests exist, the confirm dialog lists them. The
  // count alone (#301) didn't say whose seats were going.
  const page = read("src/app/events/[slug]/page.tsx");
  assert.match(page, /\(seat\.status === "invited" \|\| seat\.status === "claimed"\) && seat\.firstName\?\.trim\(\)/);
  assert.match(page, /guestNames=\{isRegistered \? guestNames : \[\]\}/);

  const button = read("src/components/event-registration-button.tsx");
  assert.match(button, /guestNames\.length > 0\s*\? namedGuestsCancelLine\(guestSeatCount, guestNames\)/);

  // The real helper: everything up to the component that follows it.
  const helper = ts.transpileModule(fnBody(button, "function namedGuestsCancelLine("), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const line = new Function(`${helper}\nreturn namedGuestsCancelLine;`)();
  const tail = "To hand back just one, use Cancel seat under Your +1s.";
  assert.equal(line(1, ["Sam"]), "This also cancels Sam's seat. To hand back just that seat, use Cancel seat under Your +1s.");
  assert.equal(line(2, ["Sam", "Priya"]), `This also cancels the seats for Sam and Priya. ${tail}`);
  assert.equal(line(3, ["Sam", "Priya"]), `This also cancels the seats for Sam, Priya and 1 unnamed +1. ${tail}`);
  assert.equal(line(3, ["Sam"]), `This also cancels the seats for Sam and 2 unnamed +1s. ${tail}`);
});
