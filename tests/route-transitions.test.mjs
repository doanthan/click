import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");

// Route transitions (2026-09-30): pages fade between each other through React's
// <ViewTransition> in the app templates, and each route's loading shell
// dissolves into its page. These pin the parts that fail silently.

test("the route transition only ever animates a real route change", () => {
  const source = read("src/components/route-transition.tsx");
  // Without default="none", every refresh, server action and search-param
  // change inside a page would crossfade the whole page.
  assert.match(source, /<ViewTransition enter="ck-page" exit="ck-page" default="none">/);
  assert.match(source, /<ViewTransition exit="ck-skeleton" default="none">/);
  // A template remounts on a route change, which is what gives the transition
  // an enter and an exit. A layout would only ever see in-place updates.
  for (const template of [
    "src/app/template.tsx",
    "src/app/dashboard/template.tsx",
    "src/app/events/template.tsx",
    "src/app/profile/template.tsx",
    "src/app/categories/template.tsx",
  ]) {
    assert.match(read(template), /export default RouteTransition;/, `${template} should render RouteTransition`);
  }
});

test("every route's loading shell dissolves into its page", () => {
  const shells = readdirSync(path.join(root, "src/app"), { recursive: true })
    .filter((file) => path.basename(file) === "loading.tsx")
    .map((file) => path.join("src/app", file));
  assert.ok(shells.length > 20, `found only ${shells.length} loading shells`);
  for (const shell of shells) {
    const source = read(shell);
    assert.match(source, /from "@\/components\/route-transition";/, `${shell} should import RouteSkeleton`);
    assert.match(source, /<RouteSkeleton>[\s\S]*<\/RouteSkeleton>/, `${shell} should wrap its shell in RouteSkeleton`);
  }
});

test("the chrome holds still while a page changes", () => {
  const css = read("src/app/globals.css");
  // A named group paints above the live page, so anything left unnamed blinks
  // out under the fading page. Each selector must match exactly one element, or
  // the browser skips the transition altogether.
  for (const [selector, name] of [
    [".site-header", "ck-header"],
    [".ck-bottom-nav", "ck-bottom-nav"],
    [".ck-curtain", "ck-curtain"],
    ['[data-support-widget] > button[aria-label="Report a bug"]', "ck-support-fab"],
  ]) {
    assert.ok(css.includes(`${selector} { view-transition-name: ${name}; }`), `${selector} should be pinned as ${name}`);
    assert.match(css, new RegExp(`::view-transition-group\\(${name}\\)`), `${name} needs its own non-animating group`);
  }
  // The desktop nav shares aria-label="Primary" and two buttons share .ck-fab.
  assert.doesNotMatch(css, /nav\[aria-label="Primary"\] \{ view-transition-name/);
  assert.doesNotMatch(css, /^\.ck-fab \{ view-transition-name/m);
  assert.match(read("src/components/site-chrome.tsx"), /"site-header sticky top-0/);
  assert.match(read("src/components/mobile-bottom-nav.tsx"), /"ck-bottom-nav fixed/);
});

test("route transitions stay calm and honour reduced motion", () => {
  const css = read("src/app/globals.css");
  // DS motion: short fades, 4-8px rises, ~120-240ms.
  const rise = css.match(/@keyframes ck-page-in \{ from \{ opacity: 0; transform: translateY\((\d+)px\); \} \}/);
  assert.ok(rise, "ck-page-in should be a fade and a small rise");
  assert.ok(Number(rise[1]) <= 8, `the page rises ${rise[1]}px`);
  for (const [, ms] of css.matchAll(/animation: ck-page-(?:in|out) (\d+)ms/g)) {
    assert.ok(Number(ms) <= 240, `a route transition runs ${ms}ms`);
  }
  // The global reduced-motion block matches `*`, which never reaches the
  // view-transition pseudo-elements, so they need their own rule.
  const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduced, /::view-transition-group\(\*\),\s*::view-transition-old\(\*\),\s*::view-transition-new\(\*\) \{\s*animation-duration: 0s !important;/);
});

test("avatars never hold up a route change", () => {
  // Inside a <ViewTransition>, React holds a commit (up to ~800ms) for any eager
  // plain img without an onLoad. Avatars appear by the dozen on the people list.
  const avatar = read("src/components/ds.tsx").split("export function Avatar(")[1].split("export function AvatarStack(")[0];
  assert.match(avatar, /<img src=\{avatarSrc\}[^>]*loading="lazy"/);
});
