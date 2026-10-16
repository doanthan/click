// Build prompt 1, item 1 - the photo gate (01 §2, 09 §3/§4, 13 §6, 21 S9).
// The check itself runs here for real (src/lib/photo-verify.ts, sharp included);
// the gates are pinned in the source, and their behaviour on real rows was run
// on PGlite through the real repository (see the build report).

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  STOCK_FACE_DHASHES,
  checkPhotoBytes,
  classifyPhotoUrl,
  dHashHex,
  hammingHex,
  ownStoredPhotoKey,
  photoFailureMessage,
  photoStorageBases,
  verifyPhotoUrl,
} from "../src/lib/photo-verify.ts";

// A member, and this deployment's storage (R2 + the legacy Supabase bucket).
const OWNER = "aaaaaaaa-0000-4000-8000-000000000001";
const OTHER = "aaaaaaaa-0000-4000-8000-000000000002";
const BASES = ["https://media.letsclick.app/", "https://old.supabase.co/storage/v1/object/public/avatars/"];
const own = (key = `${OWNER}.jpg`) => `https://media.letsclick.app/${key}`;

const read = (file) => readFileSync(path.join(process.cwd(), file), "utf8");
const code = (src) =>
  src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/^[ \t]*\/\/.*$/gm, "").replace(/--[^\n]*/g, "");
const repo = read("src/lib/event-repository.ts");

const svg = (body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">${body}</svg>`);
const jpeg = (input) => sharp(input).resize(512, 512).jpeg({ quality: 85 }).toBuffer();
async function photoLike() {
  // Noise stands in for a photo's texture: high entropy, nothing like a stock face.
  const raw = Buffer.alloc(256 * 256 * 3);
  for (let i = 0; i < raw.length; i += 1) raw[i] = (i * 7919 + (i >> 3) * 104729) % 256;
  return jpeg(await sharp(raw, { raw: { width: 256, height: 256, channels: 3 } }).png().toBuffer());
}

test("URLs that can never be a member's photo fail without a fetch", () => {
  assert.deepEqual(classifyPhotoUrl(null), { status: "none", reason: "no photo" });
  assert.deepEqual(classifyPhotoUrl("  "), { status: "none", reason: "no photo" });
  for (const url of [
    "/home/avatars/av-3.jpg",
    "https://www.letsclick.app/home/avatars/av-16.jpg",
    "https://images.unsplash.com/photo-123",
    "https://i.pravatar.cc/300",
    "https://randomuser.me/api/portraits/women/2.jpg",
  ]) {
    assert.equal(classifyPhotoUrl(url)?.status, "failed", url);
    assert.match(classifyPhotoUrl(url).reason, /stock/, url);
  }
  for (const url of [
    "https://ui-avatars.com/api/?name=D+T",
    "https://placehold.co/400",
    "https://lh3.googleusercontent.com/a/default-user=s96-c",
    "https://www.gravatar.com/avatar/abc?d=mp",
    "https://cdn.example.com/img/placeholder.png",
  ]) {
    assert.equal(classifyPhotoUrl(url)?.status, "failed", url);
  }
  assert.equal(classifyPhotoUrl("not a url")?.status, "failed");
  assert.equal(classifyPhotoUrl("ftp://media.letsclick.app/x.jpg")?.status, "failed");
  // A stored upload has to be fetched to know.
  assert.equal(classifyPhotoUrl("https://media.letsclick.app/abc.jpg?v=1"), null);
});

test("a flat letter avatar, a silhouette and a tiny image are placeholders; a photo passes", async () => {
  const letter = await jpeg(svg(`<rect width="512" height="512" fill="#e91e63"/><text x="256" y="330" font-size="260" text-anchor="middle" fill="#fff" font-family="Arial">C</text>`));
  const silhouette = await jpeg(svg(`<rect width="512" height="512" fill="#e0e0e0"/><circle cx="256" cy="200" r="100" fill="#bdbdbd"/><ellipse cx="256" cy="470" rx="190" ry="160" fill="#bdbdbd"/>`));
  assert.equal((await checkPhotoBytes(letter)).status, "failed");
  assert.match((await checkPhotoBytes(letter)).reason, /placeholder or default avatar/);
  assert.equal((await checkPhotoBytes(silhouette)).status, "failed");
  const tiny = await sharp(await photoLike()).resize(32, 32).jpeg().toBuffer();
  assert.match((await checkPhotoBytes(tiny)).reason, /placeholder \(only 32x32\)/);
  assert.equal((await checkPhotoBytes(Buffer.from("not an image"))).status, "failed");
  assert.equal((await checkPhotoBytes(Buffer.alloc(0))).reason, "empty file");
  assert.deepEqual(await checkPhotoBytes(await photoLike()), {
    status: "ok",
    reason: "loads publicly as a real photo",
  });
});

test("the site's generated faces are stock even after the upload pipeline re-encodes them", async () => {
  const dir = path.join(process.cwd(), "public/home/avatars");
  const faces = readdirSync(dir).filter((file) => /^av-\d+\.jpg$/.test(file));
  assert.equal(faces.length, Object.keys(STOCK_FACE_DHASHES).length, "every face is listed");
  for (const face of faces) {
    const original = readFileSync(path.join(dir, face));
    // The pinned hash still matches the file - swapping a face fails here.
    assert.equal(await dHashHex(original), STOCK_FACE_DHASHES[face], face);
    // ...and a re-upload through avatar-storage.ts's 512 cover crop is still caught.
    const reuploaded = await sharp(original)
      .rotate()
      .resize(512, 512, { fit: "cover", position: "centre" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    const result = await checkPhotoBytes(reuploaded);
    assert.equal(result.status, "failed", face);
    assert.match(result.reason, /stock image/, face);
  }
  assert.equal(hammingHex("ff00", "ff01"), 1);
});

test("the stored object has to load publicly: a 402, a 404 or a dead host fails, retried first", async () => {
  let calls = 0;
  const answering = (status, body = "", type = "image/jpeg") => async () => {
    calls += 1;
    return new Response(body, { status, headers: { "content-type": type } });
  };
  calls = 0;
  let result = await verifyPhotoUrl(`https://old.supabase.co/storage/v1/object/public/avatars/${OWNER}.jpg?v=1`, OWNER, {
    storageBases: BASES,
    fetchImpl: answering(402),
    retries: 3,
    backoffMs: 1,
  });
  assert.deepEqual(result, { status: "failed", reason: "unreachable (HTTP 402)" });
  assert.equal(calls, 4, "3 retries after the first try");
  result = await verifyPhotoUrl(own(), OWNER, {
    storageBases: BASES,
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
    retries: 1,
    backoffMs: 1,
  });
  assert.equal(result.status, "failed");
  assert.match(result.reason, /^unreachable/);
  result = await verifyPhotoUrl(own(), OWNER, {
    storageBases: BASES,
    fetchImpl: answering(200, "<html>", "text/html"),
    retries: 0,
  });
  assert.deepEqual(result, { status: "failed", reason: "not an image (text/html)" });
  const photo = await photoLike();
  let init;
  result = await verifyPhotoUrl(own(`gallery/${OWNER}/a1b2.jpg`), OWNER, {
    storageBases: BASES,
    fetchImpl: async (_url, options) => {
      init = options;
      return new Response(photo, { status: 200, headers: { "content-type": "image/jpeg" } });
    },
    retries: 0,
  });
  assert.equal(result.status, "ok");
  assert.equal(init.redirect, "error", "a redirect is never followed");
  // A failure always comes with words for the member - never a silent silhouette.
  assert.match(photoFailureMessage({ status: "failed", reason: "unreachable (HTTP 402)" }), /couldn't load it back/);
  assert.match(photoFailureMessage({ status: "failed", reason: "stock image (matches av-1.jpg)" }), /stock photo/);
});

test("only the member's own stored photo is ever fetched - nothing else a profile holds", async () => {
  let calls = 0;
  const counting = async () => {
    calls += 1;
    return new Response("", { status: 200, headers: { "content-type": "image/jpeg" } });
  };
  for (const url of [
    own(`${OTHER}.jpg`), // someone else's photo
    own(`gallery/${OTHER}/x.jpg`),
    own(`gallery/${OWNER}/../${OTHER}.jpg`), // the URL parser resolves the ..
    own(`gallery/${OWNER}%2F..%2F..%2F${OTHER}.jpg`),
    "http://127.0.0.1:3001/api/tables",
    // The bucket path in a #fragment: the old gallery check searched the whole string.
    `http://127.0.0.1:3001/api/tables#/storage/v1/object/public/avatars/gallery/${OWNER}/x.jpg`,
    "http://169.254.169.254/latest/meta-data/",
    "https://evil.example/x.jpg",
    `https://media.letsclick.app.evil.example/${OWNER}.jpg`,
    `/uploads/${OWNER}.jpg`,
  ]) {
    const result = await verifyPhotoUrl(url, OWNER, { storageBases: BASES, fetchImpl: counting, retries: 0 });
    assert.equal(result.status, "failed", url);
    assert.match(result.reason, /not a photo this member uploaded/, url);
  }
  assert.equal(calls, 0, "never fetched");
  assert.equal(ownStoredPhotoKey(own(), OWNER, BASES), `${OWNER}.jpg`);
  assert.equal(ownStoredPhotoKey(`https://old.supabase.co/storage/v1/object/public/avatars/gallery/${OWNER}/k.jpg`, OWNER, BASES), `gallery/${OWNER}/k.jpg`);
  assert.equal(ownStoredPhotoKey(`https://old.supabase.co/storage/v1/object/public/other-bucket/${OWNER}.jpg`, OWNER, BASES), null);
  // With no storage configured nothing is anyone's stored photo.
  assert.equal(ownStoredPhotoKey(own(), OWNER, []), null);
  assert.deepEqual(
    photoStorageBases({ R2_PUBLIC_URL: "https://media.letsclick.app/", NEXT_PUBLIC_SUPABASE_URL: "https://old.supabase.co" }),
    BASES,
  );
  // "Set as main" fetches the URL it is given, so its gallery check is this same
  // origin-and-path check, never a search of the string.
  const gallery = code(read("src/lib/gallery-storage.ts"));
  const galleryCheck = gallery.slice(gallery.indexOf("export function ownGalleryKeyFromUrl("));
  assert.match(galleryCheck.slice(0, 300), /const key = ownStoredPhotoKey\(url, profileId\);/);
  assert.doesNotMatch(gallery, /indexOf\(marker\)/);
  // The edit form no longer sends a photo URL at all.
  assert.doesNotMatch(code(read("src/app/profile/edit/actions.ts")), /photoUrl|photo_url/);
  assert.doesNotMatch(read("src/components/avatar-uploader.tsx"), /name="photo_url"/);
});

test("photo_status exists, starts 'none', and the database keeps it honest from 076 on", () => {
  const columns = read("database/076_member_photo_test_flags.sql");
  assert.match(columns, /add column if not exists photo_status text not null default 'none'/);
  assert.match(columns, /check \(photo_status in \('none', 'pending', 'ok', 'failed'\)\)/);
  // In 076, not 077: a photo changed by the code still running between the
  // backfill and the deploy is 'pending' too, never a stale 'ok'. A changed URL
  // is unchecked until the check says otherwise; no URL is 'none'; and nothing
  // is 'ok' without a photo.
  assert.match(columns, /elsif new\.photo_url is distinct from old\.photo_url\s*and new\.photo_status is not distinct from old\.photo_status then\s*new\.photo_status := 'pending';/);
  assert.match(columns, /if nullif\(btrim\(coalesce\(new\.photo_url, ''\)\), ''\) is null then\s*new\.photo_status := 'none';/);
  assert.match(columns, /check \(photo_status <> 'ok' or nullif\(btrim\(photo_url\), ''\) is not null\)/);
  assert.doesNotMatch(read("database/077_member_photo_test_enforcement.sql"), /profiles_photo_status_follows_url/);
  // The photos changed in that window get checked once the code is live.
  const backfill = read("scripts/backfill-build-prompt-1.mjs");
  assert.match(backfill, /select id::text from profiles where photo_status = 'pending'/);
});

test("upload: stored as 'pending', then checked to 'ok' or 'failed' with a visible error and a retry", () => {
  const route = read("src/app/api/upload/avatar/route.ts");
  assert.match(route, /await updateOwnProfile\(session, \{ photoUrl: publicUrl \}\);\s*\n\s*return await checkStoredPhoto\(profileId, publicUrl\);/);
  assert.match(route, /const check = await verifyPhotoUrl\(publicUrl, profileId, \{ retries: 2, backoffMs: 400 \}\);\s*await recordProfilePhotoCheck\(profileId, publicUrl, check\);/);
  assert.match(route, /\{ error: photoFailureMessage\(check\), url: publicUrl, photoStatus: "failed" \},\s*\{ status: 422 \}/);
  // A new URL is pending; the same URL again keeps its status.
  const update = repo.slice(repo.indexOf("export async function updateOwnProfile("));
  assert.match(update, /when \$\$\{photoParam\}::text is null then 'none'\s*when \$\$\{photoParam\}::text is distinct from photo_url then 'pending'\s*else photo_status/);
  // Recorded only while the profile still holds the photo that was checked.
  assert.match(repo, /update profiles set photo_status = \$3, updated_at = now\(\)\s*where id = \$1::uuid and photo_url = \$2/);
  // The uploader shows the reason and keeps the retry; profile edit, onboarding,
  // the dashboard and the Click page all say a failed photo failed.
  const uploader = read("src/components/avatar-uploader.tsx");
  assert.match(uploader, /if \(response\.status === 422 && payload\?\.url\) \{[\s\S]*?setError\(payload\.error/);
  assert.match(uploader, /useState<string \| null>\(photoFailed \? PHOTO_FAILED_MESSAGE : null\)/);
  assert.match(read("src/app/profile/edit/page.tsx"), /photoFailed=\{profileStatus\.photoStatus === "failed"\}/);
  assert.match(read("src/app/onboarding/page.tsx"), /initialPhotoFailed=\{status\.photoStatus === "failed"\}/);
  // Every other writer of photo_url moves the status with it.
  const gallery = read("src/app/api/upload/gallery/route.ts");
  assert.match(gallery, /set photo_url = \$2, photo_status = 'pending'/);
  assert.match(gallery, /photo_status = case when gallery_photos\[1\] is null then 'none' else 'pending' end/);
  // A gallery change that moves the main photo answers with its check, and the
  // gallery shows it: a reload brings the avatar's failure and retry, and a
  // check that could not run is said there and then.
  assert.equal((gallery.match(/const mainPhoto = (seeded\?|moved)\.rowCount \? await checkMainPhoto\(who\.profileId\) : undefined;/g) ?? []).length, 2);
  assert.match(gallery, /return \{ status: check\.status === "none" \? "none" : "failed", error: photoFailureMessage\(check\) \};/);
  // Moving the main photo off a removed one is not best-effort: if it fails, the
  // object is not deleted (the profile would keep an 'ok' photo that is gone).
  const removal = gallery.slice(gallery.indexOf("export async function DELETE("));
  assert.match(removal, /const moved = await pool\.query\(/);
  assert.ok(removal.indexOf("const moved = await pool.query(") < removal.indexOf("deleteGalleryObject(key)"));
  const galleryUi = read("src/components/profile-gallery-uploader.tsx");
  assert.match(galleryUi, /if \(!sayMainPhoto\(payload\.mainPhoto\)\) flashSaved\(\);\s*router\.refresh\(\);/);
  assert.match(galleryUi, /sayMainPhoto\(payload\.mainPhoto\);\s*router\.refresh\(\);/);
  assert.match(galleryUi, /if \(mainPhoto\?\.status === "failed"\) \{\s*setError\(mainPhoto\.error/);
  // Never a reload: Edit profile's unsaved-changes guard can cancel one, and
  // then the failure would never show.
  assert.doesNotMatch(code(galleryUi), /location\.reload\(\)/);
  // "Set as main" on a photo that fails: it is the main photo now, so the avatar refreshes too.
  assert.match(galleryUi, /if \(response\.status === 422\) router\.refresh\(\);/);
  // ...because the avatar takes the refreshed photo and verdict from its props.
  assert.match(uploader, /if \(shown\.initialUrl !== initialUrl \|\| shown\.photoFailed !== photoFailed\) \{\s*setShown\(\{ initialUrl, photoFailed \}\);\s*setUrl\(initialUrl\);\s*setError\(\(current\) => \(photoFailed \? current \?\? PHOTO_FAILED_MESSAGE : null\)\);/);
  // Onboarding's own failed flag clears on a good upload, or the sync above
  // would show a failure for the new photo.
  assert.match(read("src/components/onboarding-form.tsx"), /onUploaded=\{\(url\) => \{\s*setPhotoUrl\(url\);\s*setPhotoFailed\(false\);/);
  assert.match(repo, /set photo_url = \$2, photo_status = 'pending', updated_at = now\(\)\s*where id = \$1::uuid and photo_url is null/);
  assert.match(repo, /photo_url = null,\s*photo_status = 'none',/);
});

test("every surface gates on photo_status = 'ok': pool, picks read, who-was-there, both sides of the send", () => {
  const slice = (start, end) => code(repo.slice(repo.indexOf(start), repo.indexOf(end, repo.indexOf(start) + 1)));
  const pool = slice("export async function getSuggestedPeople(", "\nfunction strongestPickSignal(");
  const daily = slice("export async function getDailyPicks(", "\nexport async function generateDailyPicksForAll(");
  const prompts = slice("export async function getPostEventClickPrompts(", "export async function getPostEventClickPromptForEvent(");
  const forEvent = slice("export async function getPostEventClickPromptForEvent(", "export async function answerPostEventWindowForSession(");
  const send = slice("async function sendClickInner(", "export async function createUserClickForSession(");
  assert.match(pool, /and p\.photo_status = 'ok'/);
  assert.match(daily, /and p\.photo_status = 'ok'/);
  assert.match(prompts, /and other\.photo_status = 'ok'/);
  assert.match(forEvent, /and other\.photo_status = 'ok'/);
  assert.match(send, /if \(clickedProfile\.photo_status !== "ok"\) \{\s*throw notEligibleError/);
  assert.match(send, /if \(sender\?\.photo_status !== "ok"\) \{\s*throw validationError/);
  // Scripts that insert clicks directly cannot reach a real member without it (077).
  const enforce = read("database/077_member_photo_test_enforcement.sql");
  assert.match(enforce, /a\.photo_status = 'ok' and b\.photo_status = 'ok'/);
  assert.match(enforce, /before insert on clicks/);
  assert.match(enforce, /before insert on mutual_clicks/);
});
