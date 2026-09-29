// Bug board #293 / #297: one People Card on every surface you meet people on,
// showing what you share. The intent gate is exercised for real; the rest are
// source assertions, like the other bug-board files - the only database this repo
// can reach is production, so each test pins the clause that would have to be
// deleted to bring the bug back.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// The real helper - Node strips the types on import.
import { soloIntentLabel } from "../src/lib/intent-label.ts";

const read = (file) => readFileSync(path.join(process.cwd(), file), "utf8");
// Comments removed, so a test is never satisfied by the comment explaining a rule.
const code = (src) => src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const repo = read("src/lib/event-repository.ts");
const slice = (start, end) => {
  const a = repo.indexOf(start);
  const b = repo.indexOf(end, a + start.length);
  assert.ok(a > -1 && b > a, `failed to slice ${start}`);
  return repo.slice(a, b);
};

const SURFACES = {
  "discovery + dashboard": "src/components/click-with-someone-user-card.tsx",
  "who was there": "src/components/post-event-click-card.tsx",
  "event attendee list": "src/components/event-attendee-preview.tsx",
  "your clicks": "src/app/people/page.tsx",
};

test("the intent line gates dating on the viewer and prefers a non-dating intent", () => {
  assert.equal(soloIntentLabel(["friendship"], false), "Here for friends");
  assert.equal(soloIntentLabel(["exploring"], false), "Here for the activities");
  assert.equal(soloIntentLabel(["dating"], false), null, "a friends-only viewer never sees a dating label");
  assert.equal(soloIntentLabel(["dating"], true), "Open to dating");
  assert.equal(soloIntentLabel(["dating", "networking"], true), "Here for networking");
  assert.equal(soloIntentLabel([], true), null);
  assert.equal(soloIntentLabel(["something-new"], true), null);
});

test("#293/#297: every surface renders the ONE People Card, never its own person markup", () => {
  for (const [surface, file] of Object.entries(SURFACES)) {
    const src = code(read(file));
    assert.match(src, /import \{ PeopleCard \} from "(\.\/|@\/components\/)people-card";/, `${surface} imports the shell`);
    assert.match(src, /<PeopleCard\b/, `${surface} renders the shell`);
    assert.doesNotMatch(src, /<Avatar\b/, `${surface} must not hand-roll the photo - the shell owns it`);
  }
});

test("the card's anatomy: one photo size per layout, commonality line, <=3 shared tags, no age", () => {
  const card = code(read("src/components/people-card.tsx"));
  assert.match(card, /export const PEOPLE_CARD_AVATAR = \{ row: 76, grid: 64 \} as const;/);
  assert.match(card, /<CommonalityLine c=\{hook\} \/>/);
  assert.match(card, /<TagRow tags=\{person\.sharedInterests\} max=\{3\}/);
  assert.doesNotMatch(card, /\bage\b/, "age lives on the profile, never on the card");
});

test("#297: who was there pairs the click with the View profile ghost and shows the intent", () => {
  const row = code(read("src/components/post-event-click-card.tsx"));
  const coAttendee = row.slice(row.indexOf("function CoAttendeeRow("));
  assert.match(coAttendee, /layout="grid"/);
  assert.match(coAttendee, /intent=\{person\.intentLabel\}/);
  assert.match(coAttendee, /View profile/);
});

test("#297: both post-event rosters carry the overlap, interest tags only, and never this night", () => {
  const fragment = slice("const POST_EVENT_ROSTER_OVERLAP = `", "`;");
  assert.match(fragment, /where theirs_tag\.profile_id = other\.id and tag\.tag_type = 'interest'/);
  assert.match(fragment, /and past_event\.id <> e\.id/, "the night is already the card's heading");
  assert.equal((repo.match(/\$\{POST_EVENT_ROSTER_OVERLAP\}/g) ?? []).length, 2, "dashboard + event page queries");
  // Raw intents never leave the server: the mapper sends one gated label.
  assert.equal(
    (repo.match(/intentLabel: soloIntentLabel\(row\.other_intents \?\? \[\], Boolean\(row\.viewer_dating_visible\)\)/g) ?? [])
      .length,
    2,
  );
  const type = slice("export type PostEventCoAttendee = {", "\n};");
  assert.doesNotMatch(code(type), /\bintents\b/);
});

test("#293: your clicks shows the photo, the reveal's intent line and shared interests", () => {
  const page = code(read("src/app/people/page.tsx"));
  assert.match(page, /photoUrl: mutual\.otherPhotoUrl,/, "the photo used to be dropped - initials only");
  assert.match(page, /sharedInterests: mutual\.sharedInterests,/);
  assert.match(page, /intent=\{mutual\.intentLabel\}/);
  const mutuals = slice("export async function getMutualClicksForSession(", "\n}\n");
  assert.match(mutuals, /where mine_tag\.profile_id = \$1::uuid and tag\.tag_type = 'interest'/);
  // The reveal's own sentence, through the ONE label helper /proposals' card uses too,
  // so the two Your clicks lists can never word the same pair two ways.
  assert.match(mutuals, /intentLabel: pairIntentLabel\(\s*intentLine\(row\.viewer_intent, row\.other_intent\),/);
  const label = slice("function pairIntentLabel(", "\n}\n");
  assert.match(label, /line\.replace\(\/\\\.\$\/, ""\)/, "worn as a label: no full stop");
  assert.match(label, /bothDating \? " · both open to dating" : ""/, "dating only when both opted in");
});
