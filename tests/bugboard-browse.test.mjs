// Bug board rows from 2026-09-29 about browsing: the Discover sort, distance
// and suburb list, and the landing page. Source assertions - these are
// components (and a JSON-importing module) that cannot be imported into
// node:test - plus a sanity check on the postcode coordinates.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("Discover can sort by price, free first", () => {
  // Bug board #307: "sort by price?".
  const explorer = read("src/components/event-explorer.tsx");
  assert.match(explorer, /type SortMode = "soonest" \| "nearest" \| "popular" \| "price";/);
  assert.match(explorer, /\["price", "Lowest price"\],/);
  assert.match(explorer, /if \(sortMode === "price"\) \{\s*const priceDelta = priceCentsOf\(left\) - priceCentsOf\(right\);/);

  // priceCentsOf reads the card's label back into cents, and the label is
  // formatPriceLabel's - pin both ends so a new label format can't silently
  // sort everything as free.
  assert.match(explorer, /if \(isFreeEvent\(event\)\) return 0;\s*const amount = Number\(event\.price\.replace\(\/\[\^0-9\.\]\/g, ""\)\);/);
  const amounts = read("src/lib/amounts.ts");
  assert.match(amounts, /if \(cents <= 0\) return "Free";\s*return formatMoney\(cents, currency\);/);
});

test("the landing page carries no Click persona", () => {
  // Bug board #308: "Remove click persona from the landing page". The quiz
  // block is gone, and so is the no-events state's pitch for the same quiz.
  const home = read("src/app/page.tsx");
  assert.doesNotMatch(home, /HomeQuiz|home-quiz|getLatestPersonaForSession/);
  assert.doesNotMatch(home, /\/quiz\/personality|vibe quiz|Pick your vibe/);
  assert.equal(existsSync(path.join(root, "src/components/home-quiz.tsx")), false);
  // The Personality quiz itself became part of the Click quiz, and its old URL
  // forwards there (tests/perceived-speed.test.mjs pins the redirect).
  assert.equal(existsSync(path.join(root, "src/app/quiz/personality/page.tsx")), false);
  assert.ok(existsSync(path.join(root, "src/app/quiz/life/page.tsx")));
});

test("a member's distances on Discover are measured from their postcode", () => {
  // Bug board #305: "the distance should be from the User's Postcode", not CBD.
  const page = read("src/app/discover/page.tsx");
  assert.match(page, /const origin = distanceOriginForSuburb\(profileStatus\?\.suburb\);/);
  assert.match(page, /events=\{measureExploreFrom\(events, origin\)\}/);
  assert.match(page, /const railEvents = measureExploreFrom\(personalized\?\.events \?\? \[\], origin\);/);
  assert.match(page, /distanceOrigin=\{origin \? undefined : "CBD"\}/);

  // The measuring happens on the server, and the payload still carries no venue.
  const repo = read("src/lib/event-repository.ts");
  assert.match(repo, /const listed: EventItem = \{ \.\.\.event, location: "", lat: null, lng: null \};/);
  assert.match(repo, /exploreVenues\.set\(listed, \{ lat: event\.lat, lng: event\.lng \}\);/);
  // Whole km: the origin is a postcode centre the member can move.
  assert.match(repo, /distanceKm: Math\.max\(1, Math\.round\(haversineKm\(origin, venue\)\)\)/);

  // A name in several postcodes resolves to the pilot one first.
  const postcode = read("src/lib/postcode.ts");
  assert.match(postcode, /codes\.find\(\(c\) => CENTROIDS\[c\] && regionFromPostcode\(c\) === "Sydney"\)/);
});

test("the postcode centres land where the suburbs are", () => {
  const centroids = JSON.parse(read("src/lib/au-postcode-centroids.json"));
  const table = JSON.parse(read("src/lib/au-postcodes.json"));
  const km = ([lat1, lng1], [lat2, lng2]) => {
    const rad = (d) => (d * Math.PI) / 180;
    const h =
      Math.sin(rad(lat2 - lat1) / 2) ** 2 +
      Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };
  const cbd = [-33.8688, 151.2093];
  // The dataset's plain lat/long put 2000 in the harbour, 3.6 km east.
  assert.ok(km(cbd, centroids["2000"]) < 1, "2000 is the CBD");
  assert.ok(Math.abs(km(cbd, centroids["2204"]) - 7) < 1.5, "Marrickville is ~7 km out");
  assert.ok(Math.abs(km(cbd, centroids["2150"]) - 20) < 2, "Parramatta is ~20 km out");
  // Every metro postcode has a centre, and none is flung outside Sydney.
  for (const code of Object.keys(table).filter((c) => c >= "2000" && c <= "2234")) {
    assert.ok(centroids[code], `${code} has a centre`);
    assert.ok(km(cbd, centroids[code]) < 80, `${code} is in Sydney`);
  }
});

test("Discover has no suburb list, and no location control it cannot honour", () => {
  // Bug board #306: "the suburb list can get out of hand really quickly".
  const explorer = read("src/components/event-explorer.tsx");
  assert.doesNotMatch(explorer, /Filter by suburb|selectedSuburb|All Sydney/);
  // Venue coordinates never reach the client, so "Use my location" and the
  // Where box could only relabel CBD distances "from you".
  assert.doesNotMatch(explorer, /navigator\.geolocation|<MapboxAutocomplete|userCoords|requestLocation/);
  assert.match(explorer, /label=\{`Distance from \$\{distanceLabel\}`\}/);
  assert.match(explorer, /distanceOrigin=\{distanceFrom \? undefined : "CBD"\}/);
});

test("event cards show a circle per person going, ending in +N", () => {
  // Bug board #310/#332: the stack held only the (at most 3) photos, so its "+N"
  // could never appear, and people without a photo were left out of it.
  const card = read("src/components/event-card.tsx");
  assert.match(
    card,
    /const goingFaces = Array\.from\(\{ length: goingCount \}, \(_, i\) => \(\{\s*src: event\.attendeeAvatars\?\.\[i\] \?\? null,\s*\}\)\);/,
  );
  // The privacy floor stays: no faces until three are going.
  assert.match(card, /\{goingCount >= 3 \? \(\s*<AvatarStack people=\{goingFaces\} max=\{4\}/);
  const repo = read("src/lib/event-repository.ts");
  assert.equal(repo.match(/-- Four: the card's face stack shows four circles \(bug board #310\)\.\s*limit 4/g)?.length, 2);
});

test("a photo that fails to load shows the no-photo disc, not a broken image", () => {
  // Bug board #319: photos broken on the event page (Storage was refusing them).
  const avatar = read("src/components/ds.tsx").split("export function Avatar(")[1].split("export function AvatarStack(")[0];
  assert.match(avatar, /\{silhouette\}[\s\S]*?<img src=\{avatarSrc\} alt=""/);
  assert.match(avatar, /position: "absolute", inset: 0/);
});

test("Discover's category discs wrap instead of scrolling sideways", () => {
  // Bug board #318: "Don't scroll the category icons / Move to next row".
  const explorer = read("src/components/event-explorer.tsx");
  assert.match(explorer, /<nav aria-label="Browse by category" className="mt-5 -mx-1 flex flex-wrap gap-1\.5 px-1 pb-1">/);
});

test("Discover shows results a dozen at a time", () => {
  // Bug board #324: "apply pagination for >5 rows?".
  const explorer = read("src/components/event-explorer.tsx");
  assert.match(explorer, /const SHOWN_STEP = 12;/);
  assert.match(explorer, /filteredEvents\.slice\(0, shownCount\)\.map\(/);
  assert.match(explorer, /setShownCount\(\(n\) => n \+ SHOWN_STEP\)/);
});

test("a waitlisted member sees RSVP on a card that has room again", () => {
  // Bug board #333: "joined waitlist" with 2 spots open.
  const modal = read("src/components/event-detail-modal.tsx");
  assert.match(modal, /const waitingOnFullEvent = registered && fallbackStatus === "waitlisted" && isWaitlistMode;/);
  assert.match(modal, /\? waitingOnFullEvent\s*\? "Joined waitlist"\s*: "RSVP"/);
  assert.match(modal, /ckBtn\(waitingOnFullEvent \? "pending" : "primary", "sm"\)/);
});
