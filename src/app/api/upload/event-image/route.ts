/**
 * POST /api/upload/event-image - multipart upload from the event-create
 * wizard's Media step and the merchant event editor. Used by the drop / paste /
 * file-picker UI for additional event photos.
 *
 * Body: `file` - JPG/PNG/WEBP ≤ 10 MB. Server-side: sharp normalises into a
 * max-1600 JPG and writes to the configured public-media backend (R2 first,
 * Supabase fallback) under `events/<merchantProfileId>/<uuid>.jpg`. Each call
 * writes a fresh key, so a photo is never overwritten in place.
 *
 * DELETE /api/upload/event-image - json `{ url }`. Reclaims a photo the
 * merchant uploaded and then removed BEFORE it was saved onto an event, which
 * otherwise leaks an object nothing will ever reference. Two independent gates
 * make this safe, and both must pass:
 *   1. the URL has to resolve to a key under the caller's OWN
 *      `events/<merchantProfileId>/` prefix - an arbitrary key from the browser
 *      is refused, so this can never reach another merchant's (or another
 *      feature's) objects;
 *   2. no event may reference the URL. That check is what makes the caller's
 *      "this is new in my editing session" claim verifiable server-side: if any
 *      event points at the object, the delete is refused even for its owner.
 * The client treats the outcome as advisory - see merchant-event-edit-form.
 *
 * Gated to approved merchants - anyone else gets 403.
 *
 * Returns (POST):
 *   200 { url: string }                - success
 *   400 { error: string }              - bad MIME, missing file, oversize
 *   401 { error: "Sign in required." } - no session
 *   403 { error: string }              - not a merchant / not approved
 *   503 { error: "Upload temporarily unavailable." } - Supabase env not configured
 *   500 { error: "Upload failed." }    - anything else (already logged)
 * Returns (DELETE):
 *   200 { deleted: boolean }           - deleted, or a safe no-op (still in use)
 *   400 / 401 / 403 / 503              - as above
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  deleteEventImageObject,
  isEventImageStorageConfigured,
  ownEventImageKeyFromUrl,
  uploadEventImageFromBuffer,
} from "@/lib/event-image-storage";
import { getProfileStatus, type MerchantProfileRow } from "@/lib/event-repository";
import { getPostgresPool } from "@/lib/postgres";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB - event photos are bigger than avatars.

export const runtime = "nodejs";

/**
 * Same gate as /merchant/events/create's layout: only approved merchants get to
 * write - or reclaim - event photos. Returns the merchant row so callers can
 * scope object keys to its id.
 */
async function requireApprovedMerchant(): Promise<
  { merchant: MerchantProfileRow } | { response: NextResponse }
> {
  const session = await auth();
  if (!session?.user) {
    return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  }
  const status = await getProfileStatus(session);
  if (!status.merchantProfile) {
    return {
      response: NextResponse.json(
        { error: "Complete merchant signup before uploading event photos." },
        { status: 403 },
      ),
    };
  }
  if (status.merchantProfile.verification_status !== "approved") {
    return {
      response: NextResponse.json(
        { error: "Admin approval is required before uploading event photos." },
        { status: 403 },
      ),
    };
  }
  return { merchant: status.merchantProfile };
}

export async function POST(request: Request) {
  const who = await requireApprovedMerchant();
  if ("response" in who) return who.response;

  // Identity is the merchant profile id rather than the session email: it is
  // the same key the object prefix uses, so the limit follows the account that
  // owns the photos.
  const limit = await checkRateLimit({
    scope: "event-image-upload",
    identity: who.merchant.id,
    limit: 30,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  if (!isEventImageStorageConfigured()) {
    return NextResponse.json(
      { error: "Upload temporarily unavailable." },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing `file` field." }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only JPG, PNG, or WEBP images are allowed." },
      { status: 400 },
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Image must be 10 MB or smaller." },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadEventImageFromBuffer(buffer, who.merchant.id);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("event image upload failed", error);
    // Surface the underlying reason outside production so a local "Upload
    // failed." toast actually says what broke (Supabase Storage error, sharp,
    // etc.) instead of a generic message. Production stays opaque.
    const detail =
      process.env.NODE_ENV === "production"
        ? "Upload failed."
        : error instanceof Error
          ? error.message
          : "Upload failed.";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const who = await requireApprovedMerchant();
  if ("response" in who) return who.response;

  const limit = await checkRateLimit({
    scope: "event-image-delete",
    identity: who.merchant.id,
    limit: 60,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  let url: string;
  try {
    const body = (await request.json()) as { url?: unknown };
    if (typeof body.url !== "string" || !body.url) throw new Error("missing url");
    url = body.url;
  } catch {
    return NextResponse.json({ error: "Expected json body { url }." }, { status: 400 });
  }

  // Gate 1 - the key must sit under this merchant's own prefix. Anything else
  // (another merchant's photo, an avatar, a crafted path) resolves to null and
  // is refused outright, so the browser never gets to name an arbitrary object.
  const key = ownEventImageKeyFromUrl(who.merchant.id, url);
  if (!key) {
    return NextResponse.json({ error: "That photo isn't yours to remove." }, { status: 403 });
  }

  // Gate 2 - nothing may still reference it. This is the check that makes the
  // "new in this editing session" claim verifiable: an object already saved on
  // an event (this merchant's or anyone's) stays put, because the merchant may
  // yet abandon the edit and the live event would be left pointing at a hole.
  // Reclaiming those older objects is a separate garbage-collection concern.
  const pool = getPostgresPool();
  if (!pool) {
    // Fail closed: without the database we cannot prove the object is unused.
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
  try {
    const inUse = await pool.query(
      `select 1 from events where image_url = $1 or $1 = any(image_urls) limit 1`,
      [url],
    );
    if (inUse.rowCount) {
      // Not an error: the merchant removed a photo the event still carries, and
      // the save is what will drop it from the gallery.
      return NextResponse.json({ deleted: false });
    }
  } catch (error) {
    console.error("event image delete reference check failed", error);
    return NextResponse.json({ error: "Could not remove photo." }, { status: 500 });
  }

  // Best-effort by design - deleteEventImageObject swallows backend failures.
  // A failed reclaim leaves one orphaned object, which is exactly the situation
  // we are improving on; it must never be able to break the merchant's edit.
  await deleteEventImageObject(key);
  return NextResponse.json({ deleted: true });
}
