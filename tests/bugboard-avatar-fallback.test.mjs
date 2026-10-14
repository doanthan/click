import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const photo = read("src/components/avatar-photo.tsx");
const ds = read("src/components/ds.tsx");
const uploader = read("src/components/avatar-uploader.tsx");
const home = read("src/app/page.tsx");

const fnBody = (source, start) => {
  const at = source.indexOf(start);
  assert.ok(at > -1, `${start} not found`);
  const end = source.indexOf("\nexport ", at + 1);
  return source.slice(at, end === -1 ? undefined : end);
};

test("a photo that fails to load hides itself, even if it failed before hydration", () => {
  // Bug board #338/#343: alt="" still left Firefox painting a broken image's
  // square frame inside the round avatar.
  assert.match(photo, /^"use client";/);
  assert.match(photo, /onError=\{\(event\) => \{\s*event\.currentTarget\.hidden = true;/);
  assert.match(photo, /img\?\.complete && img\.naturalWidth === 0\) img\.hidden = true/);
  // Still lazy: an eager plain <img> holds route transitions (RouteTransition).
  assert.match(photo, /loading="lazy"/);
  assert.match(photo, /key=\{src\}/);
});

test("the DS Avatar and the profile uploader draw their fallback under the photo", () => {
  // ds.tsx is rendered by Server Components, so the handler lives in AvatarPhoto.
  assert.doesNotMatch(ds, /^"use client"/m);
  const avatar = fnBody(ds, "export function Avatar(");
  assert.match(avatar, /\{silhouette\}\s*\{\/\*[\s\S]*?\*\/\}\s*<AvatarPhoto src=\{avatarSrc\} size=\{size\} \/>/);
  assert.doesNotMatch(avatar, /<img\b/);

  // The initial always renders; the photo covers it only while it loads fine.
  assert.match(uploader, /\{initial\}\s*<\/span>\s*\{url \? <AvatarPhoto src=\{url\} size=\{80\} \/> : null\}/);
  assert.doesNotMatch(uploader, /<img\b/);
});

test("the homepage hero has no free-text box", () => {
  // Bug board #337/#341: when, then Discover - no "What do you feel like doing?".
  // Sliced to the function alone: the motion toggle below it is an <input>.
  const at = home.indexOf("function ExploreForm(");
  assert.ok(at > -1, "ExploreForm not found");
  const form = home.slice(at, home.indexOf("\n}\n", at));
  assert.doesNotMatch(form, /<input\b/);
  assert.doesNotMatch(form, /feel like doing/);
  assert.match(form, /<select\s+name="date"/);
  assert.match(form, /action="\/discover"/);
});
