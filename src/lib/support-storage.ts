/**
 * Bug-report screenshot storage — Supabase Storage backend.
 *
 * Per CLAUDE.md, new public-media features reuse the public `avatars` bucket
 * with a key prefix rather than creating a new bucket. Screenshots land at
 * `support/<ticketRef>.jpg` and are served by Supabase's public object endpoint
 * (so they render in the admin/Sheet without signed URLs).
 *
 * Normalised to JPEG via sharp so stored size is predictable. Returns null when
 * storage isn't configured — the ticket still saves to Postgres without an image.
 */

import sharp from "sharp";

import { getSupabaseAdmin, StorageNotConfiguredError } from "@/utils/supabase/admin";

const BUCKET = "avatars";
const PREFIX = "support";
const MAX_WIDTH = 1600; // cap huge retina screenshots
const QUALITY = 80;

function readPublicBase(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  return url || null;
}

export function isSupportStorageConfigured(): boolean {
  if (!readPublicBase()) return false;
  try {
    getSupabaseAdmin();
    return true;
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return false;
    throw error;
  }
}

/**
 * Uploads a screenshot for a ticket. Best-effort: returns null on any failure
 * (missing config, sharp/encode error, upload error) so a flaky screenshot
 * never blocks the bug report itself.
 */
export async function uploadScreenshot(
  ticketRef: string,
  source: Buffer,
): Promise<string | null> {
  if (!isSupportStorageConfigured()) return null;

  try {
    const jpeg = await sharp(source)
      .rotate()
      .resize(MAX_WIDTH, undefined, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toBuffer();

    const supabase = getSupabaseAdmin();
    const key = `${PREFIX}/${ticketRef}.jpg`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(key, new Uint8Array(jpeg), {
        contentType: "image/jpeg",
        upsert: true,
        cacheControl: "31536000",
      });

    if (error) {
      console.warn("[support-storage] upload failed:", error.message);
      return null;
    }

    const base = readPublicBase();
    return `${base}/storage/v1/object/public/${BUCKET}/${key}`;
  } catch (error) {
    console.warn("[support-storage] uploadScreenshot failed", { ticketRef, error });
    return null;
  }
}
