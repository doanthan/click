/**
 * Getting a phone photo under Vercel's request-body ceiling before it uploads.
 *
 * Vercel refuses a function request body over 4.5 MB with a 413 before any of
 * our code runs, so that - not a route's own MAX_UPLOAD_BYTES - is the real cap
 * on every photo upload. Phone photos pass it all the time, and the 413 is not
 * JSON, so the uploaders said only "Upload failed" (bug board #321/#335). Every
 * server pipeline downsizes anyway (event covers 1600px, gallery 880x1100,
 * avatars 512px), so re-encoding a big photo in the browser first loses nothing
 * anyone ever sees.
 *
 * Browser-only: call it from an event handler, never during render.
 */

/** Under 4.5 MB, leaving room for the multipart wrapper around the file. */
export const UPLOAD_BODY_LIMIT_BYTES = 4 * 1024 * 1024;

export const PHOTO_TOO_BIG_MESSAGE = "That photo is too big to upload - try a smaller one.";

const SHRINK_LONG_EDGE = 2048;
const SHRINK_QUALITY = 0.85;

/**
 * The file untouched when it already fits, otherwise a JPEG re-encode with the
 * long edge capped. Hands back the original whenever the browser can't decode
 * or shrink it, so the caller's size check refuses it with a clear message
 * instead of the upload dying on a 413.
 */
export async function shrinkPhotoForUpload(file: File): Promise<File> {
  if (file.size <= UPLOAD_BODY_LIMIT_BYTES || typeof createImageBitmap !== "function") {
    return file;
  }
  try {
    // "from-image" keeps a phone photo upright (EXIF orientation). An engine
    // that predates that option value rejects it, so retry with the defaults.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() =>
      createImageBitmap(file),
    );
    const scale = Math.min(1, SHRINK_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    // JPEG has no alpha, so a transparent PNG gets a white ground, not black.
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", SHRINK_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;
    const name = `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`;
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}
