/**
 * Profile gallery storage — sibling of `avatar-storage.ts`, using R2 when
 * configured and the legacy Supabase bucket as a fallback.
 *
 * Up to 5 extra profile photos per attendee (Hinge-style), stored in the same
 * public `avatars` bucket under a `gallery/<profileId>/<uuid>.jpg` prefix per
 * the "reuse the bucket with a key prefix" convention. Keys are unique per
 * upload (uuid), so no cache-busting query string is needed — a "replaced"
 * photo is a new object and the old one is deleted.
 *
 * Photos normalise to a 4:5 portrait crop (880×1100 JPG) via sharp so the
 * profile grid renders uniformly without client-side cropping.
 *
 * Reuse `isAvatarStorageConfigured()` from avatar-storage for the env check —
 * both helpers need exactly the same configuration.
 */

import { randomUUID } from "node:crypto";

import sharp from "sharp";

import { getSupabaseAdmin } from "@/utils/supabase/admin";
import {
  deletePublicMediaObject,
  isR2PublicMediaConfigured,
  r2PublicMediaKeyFromUrl,
  uploadPublicMediaObject,
} from "@/lib/public-media-storage";

const GALLERY_BUCKET = "avatars";
const GALLERY_PREFIX = "gallery";
const GALLERY_WIDTH = 880;
const GALLERY_HEIGHT = 1100; // 4:5 portrait, like dating-app galleries
const GALLERY_QUALITY = 82;

function publicBase(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  return url;
}

/**
 * Resizes to a 4:5 portrait JPG and uploads to
 * `avatars/gallery/<profileId>/<uuid>.jpg`. Returns the public URL.
 * Throws on failure — the route handler converts that to a 500.
 */
export async function uploadGalleryPhotoFromBuffer(
  profileId: string,
  source: Buffer,
): Promise<string> {
  const jpeg = await sharp(source)
    .rotate() // honour EXIF orientation
    .resize(GALLERY_WIDTH, GALLERY_HEIGHT, { fit: "cover", position: "centre" })
    .jpeg({ quality: GALLERY_QUALITY, mozjpeg: true })
    .toBuffer();

  const key = `${GALLERY_PREFIX}/${profileId}/${randomUUID()}.jpg`;

  if (isR2PublicMediaConfigured()) {
    return uploadPublicMediaObject({
      key,
      body: jpeg,
      contentType: "image/jpeg",
    });
  }

  const supabase = getSupabaseAdmin();

  // Uint8Array, not the raw Node Buffer — see avatar-storage.ts (undici fetch
  // fails opaquely on Buffer bodies).
  const { error } = await supabase.storage
    .from(GALLERY_BUCKET)
    .upload(key, new Uint8Array(jpeg), {
      contentType: "image/jpeg",
      cacheControl: "31536000", // immutable: unique key per upload
    });

  if (error) {
    throw new Error(`Supabase Storage gallery upload failed: ${error.message}`);
  }

  return `${publicBase()}/storage/v1/object/public/${GALLERY_BUCKET}/${key}`;
}

/**
 * Maps a public gallery URL back to its object key, but only when it belongs
 * to this profile's own `gallery/<profileId>/` prefix — callers use this to
 * make sure a delete request can't reach into another user's objects.
 */
export function ownGalleryKeyFromUrl(profileId: string, url: string): string | null {
  const r2Key = r2PublicMediaKeyFromUrl(url);
  if (r2Key?.startsWith(`${GALLERY_PREFIX}/${profileId}/`)) return r2Key;

  const marker = `/storage/v1/object/public/${GALLERY_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const key = url.slice(at + marker.length).split("?")[0];
  return key.startsWith(`${GALLERY_PREFIX}/${profileId}/`) ? key : null;
}

/** Best-effort object delete — the DB row is the source of truth. */
export async function deleteGalleryObject(key: string): Promise<void> {
  if (isR2PublicMediaConfigured()) {
    await deletePublicMediaObject(key).catch((error) => {
      console.warn("R2 gallery object delete failed", { key, error });
    });
  }
  try {
    const supabase = getSupabaseAdmin();
    await supabase.storage.from(GALLERY_BUCKET).remove([key]);
  } catch (error) {
    console.warn("gallery object delete failed", { key, error });
  }
}
