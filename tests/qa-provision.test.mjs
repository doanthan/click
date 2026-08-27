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

test("host onboarding and Stripe readiness are modeled as separate states", () => {
  const personas = readFileSync(path.join(root, "src/lib/qa-personas.ts"), "utf8");
  const provision = readFileSync(path.join(root, "src/lib/qa-provision.ts"), "utf8");

  assert.match(personas, /detailsSubmitted: boolean;/);
  assert.match(personas, /onboardingComplete: boolean;/);
  assert.match(
    personas,
    /email: "theo@click\.local"[\s\S]{0,900}chargesEnabled: false,[\s\S]{0,200}onboardingComplete: false/,
    "the approved-host onboarding persona must still need the Click walkthrough",
  );
  assert.match(
    personas,
    /email: "leila@click\.local"[\s\S]{0,900}chargesEnabled: false,[\s\S]{0,200}onboardingComplete: true/,
    "a host must be able to finish Click onboarding without enabling Stripe",
  );
  assert.match(provision, /merchant\.detailsSubmitted/);
  assert.match(provision, /merchant\.onboardingComplete/);
});

test("quick switching preserves progress while fresh start resets one persona", () => {
  const provision = readFileSync(path.join(root, "src/lib/qa-provision.ts"), "utf8");
  const actions = readFileSync(path.join(root, "src/app/login/actions.ts"), "utf8");

  assert.match(actions, /signInAsTestAccount[\s\S]{0,700}provisionQaPersona\(email\)/);
  assert.match(
    actions,
    /startTestScenario[\s\S]{0,500}provisionQaPersona\(persona\.email, \{ resetTarget: true \}\)/,
  );
  assert.match(
    provision,
    /if \(options\.resetTarget\) \{\s*await deletePersonaData\(client, target\.email\)/,
  );
  assert.doesNotMatch(
    provision,
    /if \(!options\.resetTarget\) await deletePersonaData/,
    "a quick switch to the blank-start persona must not erase completed onboarding",
  );
  assert.match(
    provision,
    /options\.resetTarget && event\.attendeeEmails\.includes\(target\.email\)[\s\S]{0,80}\? \[target\.email\]/,
    "fresh start may restore only the selected person's shared attendance",
  );
});

test("a per-persona reset keeps its delete scope inside click.local", () => {
  const provision = readFileSync(path.join(root, "src/lib/qa-provision.ts"), "utf8");
  const deletion = provision.slice(
    provision.indexOf("async function deletePersonaData"),
    provision.indexOf("export async function provisionQaPersona"),
  );

  assert.match(deletion, /delete from events/);
  assert.match(deletion, /delete from profiles/);
  assert.match(deletion, /email = \$1::citext and email like '%@click\.local'/);
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

test("a past-dated seed room is re-dated on every switch, not only on a reset", () => {
  // The post-event roster only opens between event_end + 2h and event_end + 48h.
  // Gated on resetTarget alone, the one room that surface has aged out ~48h after
  // the last reset and stayed dead until someone happened to reset its owner - which
  // is exactly how "the clicking mechanic doesn't work" gets reported.
  const provision = readFileSync(path.join(root, "src/lib/qa-provision.ts"), "utf8");
  assert.match(
    provision,
    /const refreshOwnedSeed =\s*\n\s*event\.daysFromNow < 0 \|\|/,
    "a room dated in the past must refresh regardless of resetTarget",
  );
});

test("a per-persona reset never deletes the shared seed catalogue", () => {
  // event_attendees.event_id and clicks.event_id are both ON DELETE CASCADE, so
  // deleting a QA_EVENTS room takes every other tester's seats and clicks with it -
  // including real signups who booked one during UAT.
  const provision = readFileSync(path.join(root, "src/lib/qa-provision.ts"), "utf8");
  const deletion = provision.slice(
    provision.indexOf("async function deletePersonaData"),
    provision.indexOf("export async function provisionQaPersona"),
  );
  assert.match(deletion, /slug <> all\(\$2::text\[\]\)/, "seed slugs must be exempt");
  assert.match(deletion, /QA_EVENTS\.map\(\(event\) => event\.slug\)/);
});

test("a re-dated seed room converges on the owner QA_EVENTS declares", () => {
  // The insert only fires when the slug is missing, so without this a room that
  // changed hands in QA_EVENTS keeps its old host forever and the declared owner's
  // console is empty. coalesce keeps the row count meaning "the slug exists".
  const provision = readFileSync(path.join(root, "src/lib/qa-provision.ts"), "utf8");
  assert.match(provision, /with owner as \(/);
  assert.match(provision, /host_profile_id = coalesce\(\s*\n?\s*\(select profile_id from owner\), host_profile_id\)/);
  assert.match(provision, /merchant_profile_id = coalesce\(\s*\n?\s*\(select merchant_id from owner\), merchant_profile_id\)/);
});

test("a persona reset keeps a Stripe Connect account a human onboarded", () => {
  // merchant_profiles.profile_id is `on delete cascade`, so the profile DELETE in
  // deletePersonaData drops the merchant row and every ON CONFLICT trick with it.
  // Without an explicit capture-before-delete, "start fresh" also meant "walk the
  // paid host back through Stripe's hosted onboarding" - and until someone did,
  // merchant-hosted paid checkout had no connected account to route the
  // destination charge to.
  const provision = readFileSync(path.join(root, "src/lib/qa-provision.ts"), "utf8");
  const capture = provision.indexOf("captureRealConnect(client, target.email)");
  const remove = provision.indexOf("deletePersonaData(client, target.email)");
  assert.ok(capture > -1, "expected the connect-account capture to be found");
  assert.ok(remove > -1, "expected the persona delete to be found");
  assert.ok(capture < remove, "the connect account must be captured BEFORE the delete cascades it");

  // The captured account has to reach the write, or it was only read for show.
  assert.match(
    provision,
    /writePersona\(client, target, Boolean\(options\.resetTarget\), preservedConnect\)/,
    "the preserved account must be passed into writePersona",
  );
  // Status booleans ride with the id. A real account next to charges_enabled=false
  // leaves the host unable to sell until the next account webhook happens to land.
  assert.match(
    provision,
    /const connect = preservedConnect \?\? \{/,
    "preserved connect state must win over the persona declaration wholesale",
  );
});

test("no QA persona fakes a Stripe Connect account", () => {
  // A placeholder acct_ id is truthy, so seeding one next to charges_enabled=true
  // cleared the app's payout gate and then handed the placeholder to Stripe as
  // transfer_data.destination - a 403 the buyer saw as a raw 500. It also ticked
  // the merchant portal's payments step green, hiding the very Connect CTA a
  // tester needed to fix it. A host is either genuinely onboarded or plainly not.
  const personas = readFileSync(path.join(root, "src/lib/qa-personas.ts"), "utf8");
  const fakeIds = [...personas.matchAll(/stripeAccountId:\s*"([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(fakeIds, [], "personas must not hardcode a Stripe account id");

  // And no merchant block may claim capabilities it has no account for.
  for (const block of personas.matchAll(/merchant:\s*\{([\s\S]*?)\n {4}\},/g)) {
    const body = block[1];
    if (!/stripeAccountId:\s*null/.test(body)) continue;
    for (const flag of ["chargesEnabled", "payoutsEnabled", "detailsSubmitted"]) {
      assert.match(
        body,
        new RegExp(`${flag}:\\s*false`),
        `${flag} must be false when the persona has no connected account`,
      );
    }
  }
});
