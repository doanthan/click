/**
 * Bug-report screenshot storage - Supabase Storage backend.
 *
 * Screenshots can contain personal or diagnostic information, so they reuse
 * the private `merchant-documents` bucket under `support/<ticketRef>.jpg` and
 * are only opened through a short-lived signed URL from the admin route.
 *
 * Normalised to JPEG via sharp so stored size is predictable. Returns null when
 * storage isn't configured - the ticket still saves to Postgres without an image.
 */

import { getSupabaseAdmin, StorageNotConfiguredError } from "@/utils/supabase/admin";

const BUCKET = "merchant-documents";
const PREFIX = "support";
const MAX_WIDTH = 1600; // cap huge retina screenshots
const QUALITY = 80;

export function isSupportStorageConfigured(): boolean {
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
    // sharp is a native module - load it here, never at module scope. A failed
    // load at module scope takes the whole route down before the handler runs
    // (Next answers an HTML 500), which is what broke the bug reporter.
    const sharp = (await import("sharp")).default;
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

    return key;
  } catch (error) {
    console.warn("[support-storage] uploadScreenshot failed", { ticketRef, error });
    return null;
  }
}

export async function createSignedScreenshotUrl(key: string): Promise<string | null> {
  if (!key.startsWith(`${PREFIX}/`) || key.includes("..")) return null;
  if (!isSupportStorageConfigured()) return null;
  const { data, error } = await getSupabaseAdmin().storage
    .from(BUCKET)
    .createSignedUrl(key, 60);
  if (error) {
    console.warn("[support-storage] signed URL failed:", error.message);
    return null;
  }
  return data.signedUrl;
}
