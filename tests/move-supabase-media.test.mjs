// scripts/move-supabase-media-to-r2.mjs - the URL mapping runs here for real;
// its SQL (compare-and-swap rewrite, arrays, 076's photo_status trigger) was run
// on PGlite with every migration applied.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { TARGETS, r2CopyOf } from "../scripts/move-supabase-media-to-r2.mjs";

const SUPABASE = "https://old.supabase.co";
const R2 = "https://media.letsclick.app";
const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const bucket = `${SUPABASE}/storage/v1/object/public/avatars`;

test("a Supabase avatars URL maps to R2 under the same key, keeping its cache-buster", () => {
  assert.deepEqual(r2CopyOf(`${bucket}/${ID}.jpg?v=1785920397776`, SUPABASE, R2), {
    key: `${ID}.jpg`,
    url: `${R2}/${ID}.jpg?v=1785920397776`,
  });
  assert.deepEqual(r2CopyOf(`${bucket}/events/${ID}/b.jpg`, SUPABASE, `${R2}/`), {
    key: `events/${ID}/b.jpg`,
    url: `${R2}/events/${ID}/b.jpg`,
  });
  assert.equal(r2CopyOf(`${bucket}/gallery/${ID}/c.jpg`, SUPABASE, R2).key, `gallery/${ID}/c.jpg`);
});

test("anything else is left alone: other hosts, other buckets, signed URLs, escaping keys", () => {
  for (const url of [
    `https://evil.example/storage/v1/object/public/avatars/${ID}.jpg`,
    `${SUPABASE}/storage/v1/object/public/merchant-documents/${ID}/licence.pdf`,
    `${SUPABASE}/storage/v1/object/sign/avatars/${ID}.jpg?token=x`,
    `${bucket}/`,
    `${bucket}/events/%2E%2E/%2E%2E/x.jpg`,
    `${bucket}/%2F${ID}.jpg`,
    `${bucket}/%E0%A4%A.jpg`,
    "/home/avatars/av-1.jpg",
    "not a url",
  ]) {
    assert.equal(r2CopyOf(url, SUPABASE, R2), null, url);
  }
});

test("it rewrites only the photo and event-image columns, and never deletes or overwrites", () => {
  assert.deepEqual(
    TARGETS.map((t) => `${t.table}.${t.column}`),
    ["profiles.photo_url", "profiles.gallery_photos", "events.image_url", "events.image_urls"],
  );
  const src = readFileSync("scripts/move-supabase-media-to-r2.mjs", "utf8");
  assert.doesNotMatch(src, /DeleteObject|\.remove\(|delete from/i);
  // Rows change only while they still hold the old URL.
  assert.match(src, /`\$\{param\} = any\("\$\{t\.column\}"\)` : `"\$\{t\.column\}" = \$\{param\}`/);
  // An R2 object with other bytes under the key is reported, not replaced, and
  // the write is create-only, so an upload landing after the HEAD survives.
  assert.match(src, /if \(etag !== null && etag !== md5\(source\.bytes\)\)/);
  assert.match(src, /IfNoneMatch: "\*",/);
  assert.match(src, /if \(error\?\.\$metadata\?\.httpStatusCode === 412\) return false;/);
  assert.match(src, /if \(etag === null && !\(await r2CreateOnly\(copy\.key, source\.bytes, source\.type\)\)\) \{\s*if \(\(await r2Etag\(copy\.key\)\) !== md5\(source\.bytes\)\)/);
  assert.doesNotMatch(src, /uploadPublicMediaObject/);
  // The rows move only once the R2 copy serves the same bytes.
  assert.match(src, /if \(served\.error \|\| md5\(served\.bytes\) !== md5\(source\.bytes\)\)/);
  assert.match(src, /--apply/);
});

test("a delete sent with either stored form of a photo finds the row that holds the other", async () => {
  const { sameObjectUrls } = await import("../src/lib/photo-verify.ts");
  const bases = [`${R2}/`, `${bucket}/`];
  assert.deepEqual(sameObjectUrls(`${bucket}/gallery/${ID}/g.jpg`, bases), [
    `${bucket}/gallery/${ID}/g.jpg`,
    `${R2}/gallery/${ID}/g.jpg`,
  ]);
  assert.deepEqual(sameObjectUrls(`${R2}/${ID}.jpg?v=1`, bases), [`${R2}/${ID}.jpg?v=1`, `${bucket}/${ID}.jpg?v=1`]);
  assert.deepEqual(sameObjectUrls("https://elsewhere.example/x.jpg", bases), ["https://elsewhere.example/x.jpg"]);

  const gallery = readFileSync("src/app/api/upload/gallery/route.ts", "utf8");
  const removal = gallery.slice(gallery.indexOf("export async function DELETE"));
  assert.match(removal, /const forms = sameObjectUrls\(url\);/);
  assert.match(removal, /where photo is null or photo <> all\(\$2::text\[\]\)\s+order by n/);
  assert.match(removal, /where id = \$1::uuid and photo_url = any\(\$2::text\[\]\)`,\s*\[who\.profileId, forms\]/);
  assert.doesNotMatch(removal, /array_remove\(gallery_photos, \$2\)/);

  const eventImage = readFileSync("src/app/api/upload/event-image/route.ts", "utf8");
  assert.match(eventImage, /const forms = sameObjectUrls\(url\);/);
  assert.match(eventImage, /select 1 from events where image_url = any\(\$1::text\[\]\) or image_urls && \$1::text\[\] limit 1`,\s*\[forms\]/);
});
