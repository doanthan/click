/**
 * Event image storage - Cloudflare R2 with a Supabase Storage fallback.
 *
 * Reuses the public `avatars` bucket per the project convention in CLAUDE.md
 * ("when adding new public-media features, reuse this bucket with a key
 * prefix"). Objects land at `events/<merchantProfileId>/<uuid>.jpg` - the owner
 * segment is what lets the delete path prove a merchant is only ever reclaiming
 * an object they uploaded themselves (same shape as `gallery-storage.ts`).
 * Sibling helper to `avatar-storage.ts`.
 *
 * Entry points:
 *   `uploadEventImageFromBuffer(buffer, ownerId)` - server-side path used by
 *   `POST /api/upload/event-image`. Resizes to a max 1600×1600 envelope
 *   (preserving aspect ratio so portrait/landscape both fit) and writes
 *   a JPG via the service-role admin client. Throws on failure so the route
 *   returns 500.
 *   `ownEventImageKeyFromUrl` / `deleteEventImageObject` - the cleanup pair the
 *   DELETE half of that route uses to reclaim a photo the merchant uploaded and
 *   then removed before saving.
 *
 * Returns the public URL of the stored object. R2 is preferred whenever all
 * R2 variables are present; Supabase keeps older environments compatible.
 */
import { randomUUID } from "node:crypto";

import sharp from "sharp";

import { getSupabaseAdmin, StorageNotConfiguredError } from "@/utils/supabase/admin";
import {
  deletePublicMediaObject,
  isR2PublicMediaConfigured,
  r2PublicMediaKeyFromUrl,
  uploadPublicMediaObject,
} from "@/lib/public-media-storage";

const EVENT_IMAGE_MAX_DIMENSION = 1600;
const EVENT_IMAGE_QUALITY = 82;
// Public bucket - `avatars` is reused with a key prefix per the convention in
// CLAUDE.md ("Reuse this bucket with a key prefix; not a new bucket.").
const PUBLIC_BUCKET = "avatars";
const KEY_PREFIX = "events";

function readPublicBase(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  return url || null;
}

export function isEventImageStorageConfigured(): boolean {
  if (isR2PublicMediaConfigured()) return true;
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
    .resize(EVENT_IMAGE_MAX_DIMENSION, EVENT_IMAGE_MAX_DIMENSION, {
      // `inside` preserves aspect ratio and never enlarges - small photos stay
      // small, big photos get capped to the envelope.
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: EVENT_IMAGE_QUALITY, mozjpeg: true })
    .toBuffer();
}

function buildPublicUrl(key: string): string {
  const base = readPublicBase();
  if (!base) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  }
  return `${base}/storage/v1/object/public/${PUBLIC_BUCKET}/${key}`;
}

/**
 * Take a raw image buffer, normalise to JPG, and write it to the public
 * `avatars` bucket under `events/<ownerId>/<uuid>.jpg`, where `ownerId` is the
 * uploading merchant profile. Each call generates a fresh key - uploads are
 * immutable, so a photo swapped out client-side is a new object, and the old
 * one is reclaimed through the delete path (never overwritten).
 */
export async function uploadEventImageFromBuffer(
  source: Buffer,
  ownerId: string,
): Promise<string> {
  const jpeg = await normaliseToJpeg(source);
  const key = `${KEY_PREFIX}/${ownerId}/${randomUUID()}.jpg`;

  if (isR2PublicMediaConfigured()) {
    return uploadPublicMediaObject({
      key,
      body: jpeg,
      contentType: "image/jpeg",
    });
  }

  const supabase = getSupabaseAdmin();

  // Pass a Uint8Array, not the raw Node Buffer: under Node 18+/24 the
  // storage-js client (2.20) hands a Buffer body straight to undici's fetch,
  // which rejects it with an opaque "fetch failed". A Uint8Array (or Blob)
  // serialises correctly. `jpeg` from sharp is a Buffer, so re-wrap its bytes.
  const { error } = await supabase.storage
    .from(PUBLIC_BUCKET)
    .upload(key, new Uint8Array(jpeg), {
      contentType: "image/jpeg",
      upsert: false,
      // 1 year - keys are unique per upload so we never overwrite.
      cacheControl: "31536000",
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  return buildPublicUrl(key);
}

/**
 * Map a public event-photo URL back to its object key, but ONLY when the key
 * sits under this merchant's own `events/<ownerId>/` prefix. Returns null for
 * anything else, so a crafted URL from the browser can never name an object the
 * caller did not upload - the route hands whatever the client sent straight to
 * this function and refuses on null.
 *
 * Objects written before the owner segment existed (`events/<uuid>.jpg`) never
 * match, so they are simply not deletable through this path. That is the safe
 * direction to fail: those are all photos that were saved onto an event.
 */
export function ownEventImageKeyFromUrl(ownerId: string, url: string): string | null {
  const ownPrefix = `${KEY_PREFIX}/${ownerId}/`;
  if (!ownerId) return null;

  const r2Key = r2PublicMediaKeyFromUrl(url);
  if (r2Key?.startsWith(ownPrefix)) return r2Key;

  const marker = `/storage/v1/object/public/${PUBLIC_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  // Drop any cache-busting query string before comparing - the key is the path.
  const key = url.slice(at + marker.length).split("?")[0];
  if (!key.startsWith(ownPrefix)) return null;
  // A prefix match alone is not enough: `events/<ownerId>/../../other.jpg`
  // starts with the right characters and then climbs straight back out of it.
  // The R2 helper rejects `..` on its own; Supabase's remove() would not.
  return key.includes("..") ? null : key;
}

/**
 * Best-effort object delete. Never throws: the caller is reclaiming an object
 * nothing references, so a failure leaves exactly the orphan we already had,
 * whereas a thrown error would bubble into a merchant's edit.
 *
 * Both backends are asked because an environment can gain R2 after some objects
 * already landed in Supabase Storage; whichever one does not hold the key
 * no-ops.
 */
export async function deleteEventImageObject(key: string): Promise<void> {
  if (isR2PublicMediaConfigured()) {
    await deletePublicMediaObject(key).catch((error) => {
      console.warn("R2 event image delete failed", { key, error });
    });
  }
  try {
    const supabase = getSupabaseAdmin();
    await supabase.storage.from(PUBLIC_BUCKET).remove([key]);
  } catch (error) {
    console.warn("event image delete failed", { key, error });
  }
}
