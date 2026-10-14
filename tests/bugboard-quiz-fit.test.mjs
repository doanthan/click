import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// The real helper - Node strips the types on import.
import { isAlcoholLed, quizEventPrefs, quizMisfit, rankByQuizFit } from "../src/lib/quiz-fit.ts";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("quiz answers become an alcohol-free flag and the spec's travel range", () => {
  // Bug board #336's member: "It's alcohol-free" + "Up to ~20 minutes".
  assert.deepEqual(quizEventPrefs({ comfort: ["activity", "small-group", "alcohol-free"], distance: "twenty-minutes" }), {
    alcoholFree: true,
    maxKm: 7,
  });
  // TECH/08 §2 Section 4: 3 / 7 / 20 / 50 km.
  assert.equal(quizEventPrefs({ distance: "suburb" }).maxKm, 3);
  assert.equal(quizEventPrefs({ distance: "across-city" }).maxKm, 20);
  assert.equal(quizEventPrefs({ distance: "anywhere" }).maxKm, 50);
  // Nothing answered, "I'm easy", or no row at all asks nothing.
  assert.deepEqual(quizEventPrefs({ comfort: ["easy"] }), { alcoholFree: false, maxKm: null });
  assert.deepEqual(quizEventPrefs(undefined), { alcoholFree: false, maxKm: null });
});

test("a drink tag makes an event alcohol-led, on whole words only", () => {
  assert.equal(isAlcoholLed(["Wine Tasting"]), true);
  assert.equal(isAlcoholLed(["wine"]), true);
  assert.equal(isAlcoholLed(["Craft Beer"]), true);
  assert.equal(isAlcoholLed(["Cocktail Making", "Social"]), true);
  assert.equal(isAlcoholLed(["Pub Trivia"]), true);
  assert.equal(isAlcoholLed(["Ginger Beer Brewing"]), true);
  assert.equal(isAlcoholLed(["Barre", "Pottery", "Vegan Eats", "Ginger Snaps"]), false);
  assert.equal(isAlcoholLed([]), false);
});

test("misfit: 2 for alcohol-led when alcohol-free, 1 past the range from the member's own postcode", () => {
  const prefs = { alcoholFree: true, maxKm: 7 };
  assert.equal(quizMisfit({ tags: ["Pottery"], distanceKm: 7 }, prefs, true), 0);
  assert.equal(quizMisfit({ tags: ["Pottery"], distanceKm: 12 }, prefs, true), 1);
  assert.equal(quizMisfit({ tags: ["Wine"], distanceKm: 2 }, prefs, true), 2);
  assert.equal(quizMisfit({ tags: ["Wine"], distanceKm: 52 }, prefs, true), 3);
  // Measured from the CBD, not the member: distance says nothing about them.
  assert.equal(quizMisfit({ tags: ["Pottery"], distanceKm: 40 }, prefs, false), 0);
  // No distance never counts against an event.
  assert.equal(quizMisfit({ tags: ["Pottery"], distanceKm: null }, prefs, true), 0);
  // A member who didn't say alcohol-free sees wine like anything else.
  assert.equal(quizMisfit({ tags: ["Wine"], distanceKm: 2 }, { alcoholFree: false, maxKm: 7 }, true), 0);
});

test("ranking is stable, drops nothing, and sinks the wine tasting even when everything is far", () => {
  // The #336 tester lives ~50 km from every live event, so all of them are past
  // a 7 km range; the wine class must still go last instead of staying 4th.
  const prefs = { alcoholFree: true, maxKm: 7 };
  const soonest = [
    { id: "spin", tags: ["Wellness"], distanceKm: 50 },
    { id: "darts", tags: ["Games"], distanceKm: 50 },
    { id: "ai", tags: [], distanceKm: 50 },
    { id: "wine", tags: ["Wine Tasting", "Wine"], distanceKm: 52 },
    { id: "pottery", tags: [], distanceKm: 52 },
  ];
  const ranked = rankByQuizFit(soonest, (e) => quizMisfit(e, prefs, true)).map((e) => e.id);
  assert.deepEqual(ranked, ["spin", "darts", "ai", "pottery", "wine"]);

  const mixed = [
    { id: "nearWine", tags: ["Wine"], distanceKm: 2 },
    { id: "far", tags: [], distanceKm: 30 },
    { id: "near", tags: [], distanceKm: 3 },
  ];
  assert.deepEqual(
    rankByQuizFit(mixed, (e) => quizMisfit(e, prefs, true)).map((e) => e.id),
    ["near", "far", "nearWine"],
  );
  assert.deepEqual(rankByQuizFit([], () => 1), []);
});

test("every personalised surface and the Discover list rank by it", () => {
  const repo = read("src/lib/event-repository.ts");
  const body = repo.slice(repo.indexOf("export async function getPersonalizedDiscovery("));
  const fn = body.slice(0, body.indexOf("\nexport "));
  // Measured from the member's own postcode, the origin Discover uses.
  assert.match(fn, /const origin = distanceOriginForSuburb\(profileResult\.rows\[0\]\?\.suburb\);/);
  assert.match(fn, /quizMisfit\(event, quizPrefs, origin !== null\)/);
  // Ranked BEFORE the slice, on both rankers.
  assert.match(fn, /events: rankByQuiz\(v2ranked\)\.slice\(0, limit\)/);
  assert.match(fn, /events: rankByQuiz\(ranked\)\.slice\(0, limit\)/);
  assert.equal(fn.match(/quizMisfit: quizMisfitById,\n/g)?.length, 2);

  assert.match(read("src/app/discover/page.tsx"), /quizMisfit=\{personalized\?\.quizMisfit\}/);
  // The first key of every Discover sort mode.
  assert.match(
    read("src/components/event-explorer.tsx"),
    /\.sort\(\(left, right\) => \{\s*\/\/[^\n]*\n[^\n]*\n\s*const misfitDelta = \(quizMisfit\?\.\[left\.id\] \?\? 0\) - \(quizMisfit\?\.\[right\.id\] \?\? 0\);\s*if \(misfitDelta !== 0\) return misfitDelta;\s*if \(sortMode === "popular"\)/,
  );
  assert.match(
    read("src/app/dashboard/page.tsx"),
    /const radarPool = personalizedPool\.filter\(\(event\) => misfitOf\(event\.id\) === bestFit\);/,
  );
  assert.match(read("src/app/people/page.tsx"), /misfitOf\(a\.id\) - misfitOf\(b\.id\) \|\|/);
});
