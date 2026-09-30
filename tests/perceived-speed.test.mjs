import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

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

test("these loading screens are their page's own frame, so nothing moves when it lands", () => {
  // They used bars sized to the copy, and on a phone the copy wraps differently
  // at every width: content landed 50-260px below where the loading screen had
  // drawn it. With the frame shared, the copy is the same text in both states.
  for (const [dir, frame] of [
    ["login", "LoginFrame"],
    ["register", "RegisterFrame"],
    ["how-it-works", "HowItWorksIntro"],
  ]) {
    for (const file of ["page.tsx", "loading.tsx"]) {
      assert.match(read(`src/app/${dir}/${file}`), new RegExp(`<${frame}\\b`), `src/app/${dir}/${file}`);
    }
  }
});

test("a rounded-* passed to Skeleton replaces its default corner", () => {
  // Tailwind emits .rounded-full and .rounded-lg ahead of .rounded-md, so with
  // the default also on the element it won, and every placeholder disc drew as
  // a rounded square.
  const source = ts.transpileModule(read("src/components/skeleton.tsx"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", source)(createRequire(import.meta.url), loaded, loaded.exports);
  const classes = (className) =>
    renderToStaticMarkup(createElement(loaded.exports.Skeleton, { className })).match(/class="([^"]*)"/)[1].split(" ");

  assert.ok(classes("size-12").includes("rounded-md"), "no corner passed: the default");
  for (const corner of ["rounded-full", "rounded-lg", "rounded-t-md", "rounded-none", "rounded-[12px]"]) {
    const list = classes(`size-12 ${corner}`);
    assert.ok(list.includes(corner) && !list.includes("rounded-md"), `${corner} should replace the default`);
  }
  // A breakpoint variant only takes over from its breakpoint up.
  assert.ok(classes("h-8 sm:rounded-lg").includes("rounded-md"));
});
