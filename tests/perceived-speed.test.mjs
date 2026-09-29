import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");

// A tester called the site "laggy and clunky" (2026-09-29). Past the region fix
// in vercel.json, these are the parts of that feel that live in code.

test("forwarding-only URLs redirect in next.config.ts, not in a page", () => {
  // A page-level redirect() runs after the root loading.tsx has started
  // streaming, so production answered 200 + a 1-second meta refresh and the
  // visitor waited for the JS before moving on.
  const config = read("next.config.ts");
  for (const [source, destination] of [
    ["/events", "/discover"],
    ["/signup", "/register"],
    ["/saved-events", "/bookmarks"],
    ["/quiz/life", "/quiz/life/life-stage"],
  ]) {
    assert.match(
      config,
      new RegExp(`\\{ source: "${source}", destination: "${destination}", permanent: false \\}`),
      `${source} should redirect to ${destination} in next.config.ts`,
    );
    // Config redirects run before the filesystem, so a page here never renders.
    assert.equal(
      existsSync(path.join(root, "src/app", source, "page.tsx")),
      false,
      `src/app${source}/page.tsx would be dead code behind the redirect`,
    );
  }
});

test("a bookmark tap shows the new state before the request goes out", () => {
  const button = read("src/components/event-bookmark-button.tsx");
  const toggle = button.slice(
    button.indexOf("async function toggle()"),
    button.indexOf('if (variant === "star")'),
  );
  const flip = toggle.indexOf("setSaved(next)");
  assert.ok(flip > -1 && flip < toggle.indexOf("await fetch("), "the icon must change before the request");
  // Every failure puts it back: the network error, the 401 and a non-OK answer.
  assert.equal(toggle.match(/setSaved\(previous\)/g)?.length, 3);
  // Disabled-while-saving is what dimmed the icon through the whole round trip.
  assert.doesNotMatch(button, /disabled=\{state === "submitting"\}/);
  assert.doesNotMatch(button, /Saving\.\.\./);
});

test("the load-in stagger stays short", () => {
  // The .rise-d* ladder used to reach 580ms, so the last block on the home page
  // and dashboard settled ~0.8s after the page had already arrived.
  const css = read("src/app/globals.css");
  const delays = [...css.matchAll(/\.rise-d\d \{ animation-delay: (\d+)ms; \}/g)].map((m) => Number(m[1]));
  assert.equal(delays.length, 6);
  assert.ok(Math.max(...delays) <= 240, `the longest stagger is ${Math.max(...delays)}ms`);
});

test("the busiest routes that fell back to the root loading card have their own", () => {
  // Without one, a tap flashed the full-page "Loading Click…" card first.
  for (const file of [
    "src/app/login/loading.tsx",
    "src/app/register/loading.tsx",
    "src/app/onboarding/loading.tsx",
    "src/app/how-it-works/loading.tsx",
    "src/app/quiz/(index)/loading.tsx",
  ]) {
    assert.ok(existsSync(path.join(root, file)), `${file} is missing`);
  }
  // Beside quiz/page.tsx it would also wrap /quiz/personality and /quiz/life,
  // flashing the list shape before both takeovers.
  assert.equal(existsSync(path.join(root, "src/app/quiz/loading.tsx")), false);
});
