/**
 * Event image storage — Cloudflare R2 with a Supabase Storage fallback.
 *
 * Reuses the public `avatars` bucket per the project convention in CLAUDE.md
 * ("when adding new public-media features, reuse this bucket with a key
 * prefix"). Objects land at `events/<uuid>.jpg`. Sibling helper to
 * `avatar-storage.ts`.
 *
 * Entry point:
 *   `uploadEventImageFromBuffer(buffer)` — server-side path used by
 *   `POST /api/upload/event-image`. Resizes to a max 1600×1600 envelope
 *   (preserving aspect ratio so portrait/landscape both fit) and writes
 *   a JPG via the service-role admin client. Throws on failure so the route
 *   returns 500.
 *
 * Returns the public URL of the stored object. R2 is preferred whenever all
 * R2 variables are present; Supabase keeps older environments compatible.
 */
import { randomUUID } from "node:crypto";

import sharp from "sharp";

import { getSupabaseAdmin, StorageNotConfiguredError } from "@/utils/supabase/admin";
import {
  isR2PublicMediaConfigured,
  uploadPublicMediaObject,
} from "@/lib/public-media-storage";

const EVENT_IMAGE_MAX_DIMENSION = 1600;
const EVENT_IMAGE_QUALITY = 82;
// Public bucket — `avatars` is reused with a key prefix per the convention in
// CLAUDE.md ("Reuse this bucket with a key prefix; not a new bucket.").
const PUBLIC_BUCKET = "avatars";
const KEY_PREFIX = "events/";

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
      // `inside` preserves aspect ratio and never enlarges — small photos stay
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
 * `avatars` bucket under `events/<uuid>.jpg`. Each call generates a fresh
 * key — uploads are immutable, so removing an image client-side just
 * orphans the object (acceptable for now; a sweeper can clean abandoned
 * wizard uploads later).
 */
export async function uploadEventImageFromBuffer(source: Buffer): Promise<string> {
  const jpeg = await normaliseToJpeg(source);
  const key = `${KEY_PREFIX}${randomUUID()}.jpg`;

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
      // 1 year — keys are unique per upload so we never overwrite.
      cacheControl: "31536000",
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  return buildPublicUrl(key);
}
