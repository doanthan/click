// Bug board #321/#335: photos over Vercel's 4.5 MB request-body limit died with a
// bare 413 ("Upload failed") before reaching our upload routes. The shrink itself
// needs a browser (createImageBitmap + canvas) and was checked in Chromium,
// Firefox and WebKit; here the real helper's pass-through paths run in Node, and
// each uploader is pinned to shrinking before it builds the request.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  PHOTO_TOO_BIG_MESSAGE,
  UPLOAD_BODY_LIMIT_BYTES,
  shrinkPhotoForUpload,
} from "../src/lib/photo-upload.ts";

const read = (file) => readFileSync(path.join(process.cwd(), file), "utf8");

test("the upload ceiling sits under Vercel's 4.5 MB body limit", () => {
  assert.ok(UPLOAD_BODY_LIMIT_BYTES < 4.5 * 1024 * 1024);
  assert.doesNotMatch(PHOTO_TOO_BIG_MESSAGE, /—/);
});

test("a photo that already fits goes up untouched", async () => {
  const small = new File([new Uint8Array(1024)], "a.jpg", { type: "image/jpeg" });
  assert.equal(await shrinkPhotoForUpload(small), small);
});

test("with no way to decode, the original comes back for the caller's size check", async () => {
  // Node has no createImageBitmap - the same as a browser that can't decode it.
  const big = new File([new Uint8Array(UPLOAD_BODY_LIMIT_BYTES + 1)], "b.jpg", { type: "image/jpeg" });
  assert.equal(await shrinkPhotoForUpload(big), big);
});

test("a 1-4 MB photo is shrunk too, not only one that would 413", async () => {
  // A stand-in decoder that records what it was asked to decode, then fails, so
  // the helper takes its hand-back-the-original path.
  const decoded = [];
  globalThis.createImageBitmap = async (file) => {
    decoded.push(file.name);
    throw new Error("no decoder in Node");
  };
  try {
    const twoMb = new File([new Uint8Array(2 * 1024 * 1024)], "two-mb.jpg", { type: "image/jpeg" });
    const halfMb = new File([new Uint8Array(512 * 1024)], "half-mb.jpg", { type: "image/jpeg" });
    assert.equal(await shrinkPhotoForUpload(twoMb), twoMb);
    assert.equal(await shrinkPhotoForUpload(halfMb), halfMb);
    assert.ok(decoded.includes("two-mb.jpg"), "a 2 MB photo must be re-encoded before it posts");
    assert.ok(!decoded.includes("half-mb.jpg"), "a small photo goes up as it is");
  } finally {
    delete globalThis.createImageBitmap;
  }
});

test("every photo uploader shrinks before it posts, and names a 413", () => {
  for (const file of [
    "src/components/avatar-uploader.tsx",
    "src/components/profile-gallery-uploader.tsx",
    "src/components/event-create-wizard.tsx",
    "src/components/merchant-event-edit-form.tsx",
  ]) {
    const source = read(file);
    const shrink = source.indexOf("await shrinkPhotoForUpload(file)");
    assert.ok(shrink > -1, `${file} must shrink before uploading`);
    assert.ok(source.indexOf('set("file", upload)', shrink) > shrink, `${file} must post the shrunk file`);
    assert.match(source, /upload\.size > UPLOAD_BODY_LIMIT_BYTES/, `${file} must refuse what still doesn't fit`);
    assert.match(source, /status === 413/, `${file} must explain a 413`);
  }
});
