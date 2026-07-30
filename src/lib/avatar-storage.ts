/**
 * Avatar storage — Cloudflare R2 with a Supabase Storage fallback.
 *
 * Production prefers the configured public R2 bucket. Existing environments
 * can continue using the Supabase `avatars` bucket through the service-role
 * admin client, so already-stored URLs and incremental rollout keep working.
 *
 * Two entrypoints (mirroring the old R2 surface so callers didn't change much):
 *  - `uploadAvatarFromUrl(profileId, sourceUrl)` — one-shot rehost of a Google
 *    profile photo. Best-effort: returns null on any failure so a flaky Google
 *    CDN never blocks login.
 *  - `uploadAvatarFromBuffer(profileId, buffer)` — user upload path from
 *    `POST /api/upload/avatar`. Throws on failure so the route returns 500.
 *
 * Both paths normalise to a 512×512 JPG with `sharp` before upload so the
 * stored object size and rendering are predictable across the app.
 *
 * Bucket setup (one-time, in the Supabase dashboard):
 *   Storage → New bucket → name `avatars`, Public bucket = ON.
 */

import sharp from "sharp";

import { getSupabaseAdmin, StorageNotConfiguredError } from "@/utils/supabase/admin";
import {
  isR2PublicMediaConfigured,
  uploadPublicMediaObject,
} from "@/lib/public-media-storage";

const AVATAR_SIZE = 512;
const AVATAR_QUALITY = 85;
const AVATAR_BUCKET = "avatars";
// Cap on the bytes we'll pull from a remote URL (Google's hi-res can be huge).
const MAX_REHOST_BYTES = 8 * 1024 * 1024;

function readPublicBase(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  return url || null;
}

export function isAvatarStorageConfigured(): boolean {
  if (isR2PublicMediaConfigured()) return true;
  // We need both the public URL (for the resulting <img src>) and the service-
  // role key (for the upload itself). getSupabaseAdmin reads the latter.
  if (!readPublicBase()) return false;
  try {
    getSupabaseAdmin();
    return true;
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return false;
    throw error;
  }
}

async function normaliseToJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate() // honour EXIF orientation
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "centre" })
    .jpeg({ quality: AVATAR_QUALITY, mozjpeg: true })
    .toBuffer();
}

function buildPublicUrl(key: string): string {
  const base = readPublicBase();
  if (!base) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  }
  // Cache-bust on every write so a replaced avatar shows up immediately even
  // though the object key (`<profileId>.jpg`) stays the same.
  return `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${key}?v=${Date.now()}`;
}

async function putAvatar(profileId: string, body: Buffer): Promise<string> {
  const key = `${profileId}.jpg`;

  if (isR2PublicMediaConfigured()) {
    const url = await uploadPublicMediaObject({
      key,
      body,
      contentType: "image/jpeg",
      cacheControl: "public, max-age=31536000",
    });
    return `${url}?v=${Date.now()}`;
  }

  const supabase = getSupabaseAdmin();

  // Uint8Array, not the raw Node Buffer: storage-js on Node 18+/24 passes a
  // Buffer body straight to undici's fetch, which fails with an opaque
  // "fetch failed". A Uint8Array view of the same bytes uploads correctly.
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(key, new Uint8Array(body), {
    contentType: "image/jpeg",
    // Same key on every write (one avatar per profile) → upsert so the second
    // upload doesn't 409 on "resource already exists".
    upsert: true,
    // 1 year — we cache-bust with `?v=<ts>` in the URL so this is safe.
    cacheControl: "31536000",
  });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  return buildPublicUrl(key);
}

/**
 * Fetches a remote image (typically the Google `picture` URL handed to us by
 * NextAuth), resizes to 512×512 JPG, and writes it to the public `avatars`
 * bucket at `<profileId>.jpg`. Returns the public URL, or `null` if anything
 * along the way failed — callers should treat null as "couldn't backfill,
 * leave photo_url null and try again later".
 */
export async function uploadAvatarFromUrl(
  profileId: string,
  sourceUrl: string,
): Promise<string | null> {
  if (!isAvatarStorageConfigured()) return null;

  try {
    const res = await fetch(sourceUrl, {
      // Google avatars sometimes 403 without a UA — give them a generic one.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ClickAvatarRehost/1.0)" },
      // Don't let a slow CDN hang an auth roundtrip.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const contentLength = Number.parseInt(res.headers.get("content-length") ?? "", 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_REHOST_BYTES) {
      return null;
    }

    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength > MAX_REHOST_BYTES) return null;

    const jpeg = await normaliseToJpeg(Buffer.from(arrayBuf));
    return await putAvatar(profileId, jpeg);
  } catch (error) {
    // Never let a rehost failure throw out of the auth path.
    console.warn("uploadAvatarFromUrl failed", { profileId, error });
    return null;
  }
}

/**
 * User-initiated upload from /api/upload/avatar. Takes the already-validated
 * buffer (size/MIME), pipes through sharp, and writes to Supabase Storage.
 * Throws on failure — the route handler converts that to a 500.
 */
export async function uploadAvatarFromBuffer(
  profileId: string,
  source: Buffer,
): Promise<string> {
  const jpeg = await normaliseToJpeg(source);
  return putAvatar(profileId, jpeg);
}
