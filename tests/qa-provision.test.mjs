import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("QA seed events are never written as an ON CONFLICT upsert", () => {
  // prevent_merchant_event_overlap is a BEFORE INSERT trigger, so it runs BEFORE
  // the conflict is resolved, with new.id freshly defaulted - it sees the row
  // already sitting on that slug as a different event of the same merchant
  // covering the same two hours and raises "merchant has an overlapping live
  // event". An `insert into events ... on conflict (slug) do update` therefore
  // succeeds exactly once and throws on every provision after it. That is not a
  // recoverable error either: the switcher renders in the root layout, ABOVE
  // app/error.tsx, so the throw escapes to Next's bare "This page couldn't load"
  // page and every persona switch dies there until someone resets the QA data.
  const provision = readFileSync(path.join(root, "src/lib/qa-provision.ts"), "utf8");
  assert.ok(provision.includes("insert into events"), "expected the events insert to be found");
  assert.doesNotMatch(
    provision,
    /on conflict\s*\(\s*slug\s*\)/i,
    "qa-provision.ts must update-then-insert events, never upsert them by slug",
  );
});

test("a failed QA seed event cannot abort the persona switch", () => {
  // A host persona that hand-created an event over the seed slot trips the same
  // overlap guard legitimately. The personas are the point of the switcher and
  // the demo catalogue is garnish, so each seed event writes inside its own
  // savepoint - otherwise one unwritable demo event 500s every role change.
  const provision = readFileSync(path.join(root, "src/lib/qa-provision.ts"), "utf8");
  assert.match(provision, /savepoint qa_seed_event/, "seed events need their own savepoint");
  assert.match(
    provision,
    /rollback to savepoint qa_seed_event/,
    "a failed seed event must roll back to its savepoint, not abort the transaction",
  );
});

test("every provisioned persona carries the three fields the gates read", () => {
  // The personas were seeded with a suburb and a bio and nothing else, which
  // LOOKED complete and was not:
  //   * birth_date is half of onboardingComplete AND the trust boundary in
  //     assertBookingEligible, so every RSVP, checkout and waitlist join was
  //     refused with "finish setting up your profile";
  //   * profiles.age is the click layer's own 18+ gate (MIN_CLICK_AGE), read
  //     independently of birth_date, and a NULL age fails it;
  //   * photo_url is a hard requirement of the discovery pool - clicking is a
  //     face-first decision, so a photoless persona is invisible AND cannot send.
  // A persona that cannot book or click is not a test account.
  const personas = readFileSync(path.join(root, "src/lib/qa-personas.ts"), "utf8");
  const provision = readFileSync(path.join(root, "src/lib/qa-provision.ts"), "utf8");

  assert.match(personas, /birthDate: string \| null;/, "personas need a birthDate field");
  assert.match(personas, /photoUrl: string \| null;/, "personas need a photoUrl field");
  for (const column of ["birth_date", "age", "photo_url"]) {
    assert.ok(
      provision.includes(`${column},`) || provision.includes(`${column} =`),
      `the profiles upsert must write ${column}`,
    );
  }
  // age is DERIVED from birth_date in SQL, never a second hand-maintained
  // number - a persona seeded before a birthday would otherwise sit a year
  // stale and the two gates would disagree about the same person.
  assert.match(
    provision,
    /extract\(year from age\(\$7::date\)\)::int/,
    "age must be derived from birth_date in SQL, not stored separately",
  );
  // Every persona that is provisioned at all (suburb non-null) needs both.
  const entries = personas.split("email: \"").slice(1);
  for (const entry of entries) {
    const email = entry.slice(0, entry.indexOf('"'));
    if (/suburb: null/.test(entry.slice(0, entry.indexOf("merchant:")))) continue;
    assert.match(entry, /birthDate: "\d{4}-\d{2}-\d{2}"/, `${email} needs a birthDate`);
    assert.match(entry, /photoUrl: "\//, `${email} needs a resolvable photoUrl`);
  }
});

test("an approved QA host has the same auto-publish state as a real approval", () => {
  const provision = readFileSync(path.join(root, "src/lib/qa-provision.ts"), "utf8");
  assert.match(provision, /auto_approve_events/);
  assert.match(provision, /merchant\.verificationStatus === "approved"/);
});

test("a re-provision never stamps over a photo the tester uploaded", () => {
  // provisionQaPersona runs on EVERY persona switch. Uploading an avatar is
  // itself part of UAT, so overwriting photo_url unconditionally would silently
  // undo the thing that was just tested. The seeded face exists only so the
  // discovery pool has something to show before one is uploaded.
  const provision = readFileSync(path.join(root, "src/lib/qa-provision.ts"), "utf8");
  assert.match(
    provision,
    /photo_url = case\s*\n\s*when profiles\.photo_url is null or profiles\.photo_url = ''/,
    "photo_url must only be seeded when the persona has none",
  );
});

test("the post-event click roster has an event it can actually offer", () => {
  // Process 2 opens between event_end + 2h and event_end + 48h, for people who
  // attended. Nothing in the UI can produce that state - you cannot RSVP to a
  // room that has already happened - so a past event with seeded attendance is
  // the only way that surface is reachable during UAT.
  const personas = readFileSync(path.join(root, "src/lib/qa-personas.ts"), "utf8");
  const provision = readFileSync(path.join(root, "src/lib/qa-provision.ts"), "utf8");
  assert.match(personas, /daysFromNow: -\d/, "one QA event must be dated in the past");
  assert.match(personas, /attendeeEmails: \[\s*\n?\s*"/, "the past event needs seeded attendees");
  assert.match(
    provision,
    /insert into event_attendees[\s\S]*?on conflict \(event_id, profile_id\) do nothing/,
    "attendance seeding must be idempotent",
  );
});

test("every persona photo points at a file that exists", () => {
  // A persona's photoUrl is not decoration - the discovery pool refuses a
  // profile whose photo does not resolve, so a typo'd filename quietly takes
  // that persona out of the click surface AND renders a broken image in the
  // header. av-17.jpg was exactly that: the generated set stops at av-16.
  const personas = readFileSync(path.join(root, "src/lib/qa-personas.ts"), "utf8");
  const referenced = [...personas.matchAll(/photoUrl: "([^"]+)"/g)].map((m) => m[1]);
  assert.ok(referenced.length >= 8, "expected every non-blank persona to carry a photo");
  for (const url of referenced) {
    assert.ok(url.startsWith("/"), `${url} must be a root-relative path so resolveAvatarImage accepts it`);
    assert.ok(
      existsSync(path.join(root, "public", url)),
      `${url} is referenced by a persona but does not exist in public/`,
    );
  }
});
