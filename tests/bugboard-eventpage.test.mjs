import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// The real helper - Node strips the types on import.
import { attendeeFomoSignals } from "../src/lib/attendee-fomo.ts";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const repo = read("src/lib/event-repository.ts");
const preview = read("src/components/event-attendee-preview.tsx");

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
    "3 open to dating",
  ]);
  // Mutual opt-in: a friends-only viewer never sees the dating count.
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
