import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const page = read("src/app/around-me/page.tsx");
const map = read("src/components/around-me-map.tsx");

test("the around-me map is for signed-in, onboarded members", () => {
  assert.match(page, /redirect\("\/login\?callbackUrl=\/around-me"\)/);
  assert.match(page, /redirectIfNotOnboarded\(profileStatus, "\/around-me"\)/);
  // Discover links to it for members only.
  assert.match(read("src/components/event-explorer.tsx"), /\{signedIn \? \(\s*<Link\s+href="\/around-me"/);
});

test("a pin is the centre of the suburb on the card, never the venue", () => {
  // Runbook B5 item 5: suburb only until the viewer holds a seat. A venue
  // coordinate here would drop a pin on the address the card withholds.
  assert.match(page, /const centre = distanceOriginForSuburb\(event\.suburb\);/);
  for (const [file, source] of [
    ["page", page],
    ["map", map],
  ]) {
    assert.doesNotMatch(source, /event\.(lat|lng)\b|exploreVenues/, `${file} must not read a venue coordinate`);
  }
  // Every coordinate the map plots is a spot (a suburb centre) or home (the
  // member's own postcode centre).
  const plotted = [...map.matchAll(/(?:longitude|latitude)=\{(\w+)\./g)].map((m) => m[1]);
  assert.deepEqual([...new Set(plotted)].sort(), ["home", "spot"]);
});

test("the map lights the Discover tab it was opened from", () => {
  for (const nav of ["src/components/header-nav.tsx", "src/components/mobile-bottom-nav.tsx"]) {
    assert.match(read(nav), /href === "\/discover" && \(pathname\.startsWith\("\/events\/"\) \|\| pathname === "\/around-me"\)/, nav);
  }
});
