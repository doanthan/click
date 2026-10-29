/**
 * Profile gallery uploads (up to 5 extra photos per profile).
 *
 * POST multipart `file` (JPG/PNG/WEBP ≤ 5 MB) → normalises to a 4:5 portrait
 * JPG, uploads to the public `avatars` bucket under `gallery/<profileId>/`,
 * and appends the URL to `profiles.gallery_photos` (capped at 5, enforced in
 * the UPDATE's WHERE so concurrent uploads can't overshoot).
 *
 * DELETE json `{ url }` → removes the URL from `gallery_photos` and
 * best-effort deletes the storage object (only if the key sits under the
 * caller's own gallery prefix).
 *
 * Both return 200 `{ urls: string[], mainPhoto? }` - the full gallery after
 * the change, so the uploader can re-render without refetching, and the photo
 * check's result when the change also moved the main photo.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAvatarStorageConfigured } from "@/lib/avatar-storage";
import {
  deleteGalleryObject,
  ownGalleryKeyFromUrl,
  uploadGalleryPhotoFromBuffer,
} from "@/lib/gallery-storage";
import { getPostgresPool } from "@/lib/postgres";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordProfilePhotoCheck } from "@/lib/event-repository";
import { photoFailureMessage, sameObjectUrls, verifyPhotoUrl, type PhotoStatus } from "@/lib/photo-verify";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_GALLERY_PHOTOS = 5;

export const runtime = "nodejs";

type MainPhoto = { status: PhotoStatus; error?: string };

/**
 * When a gallery change moves the main photo, the new one is checked like any
 * upload (01 §2) before it can show in the click pool, and the result goes
 * back to the uploader: the gallery change already succeeded, but a main photo
 * that failed must be said, never left as a silent silhouette. 'pending' means
 * the check itself could not run; "Set as main" on the photo runs it again.
 */
async function checkMainPhoto(profileId: string): Promise<MainPhoto> {
  try {
    const current = await getPostgresPool()!.query<{ photo_url: string | null; photo_status: PhotoStatus }>(
      `select photo_url, photo_status from profiles where id = $1::uuid`,
      [profileId],
    );
    const row = current.rows[0];
    if (!row?.photo_url || row.photo_status !== "pending") return { status: row?.photo_status ?? "none" };
    const check = await verifyPhotoUrl(row.photo_url, profileId, { retries: 2, backoffMs: 400 });
    await recordProfilePhotoCheck(profileId, row.photo_url, check);
    if (check.status === "ok") return { status: "ok" };
    return { status: check.status === "none" ? "none" : "failed", error: photoFailureMessage(check) };
  } catch (error) {
    console.warn("gallery main-photo check failed", { profileId, error });
    return { status: "pending" };
  }
}

async function resolveProfileId(email: string): Promise<string | null> {
  const pool = getPostgresPool();
  if (!pool) return null;
  const result = await pool.query<{ id: string }>(
    `select id::text from profiles where email = $1 limit 1`,
    [email],
  );
  return result.rows[0]?.id ?? null;
}

async function requireProfileId(): Promise<
  { profileId: string } | { response: NextResponse }
> {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!session?.user || !email) {
    return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  }
  if (!getPostgresPool()) {
    return { response: NextResponse.json({ error: "Database unavailable." }, { status: 503 }) };
  }
  const profileId = await resolveProfileId(email);
  if (!profileId) {
    return {
      response: NextResponse.json(
        { error: "Finish onboarding before uploading photos." },
        { status: 400 },
      ),
    };
  }
  return { profileId };
}

export async function POST(request: Request) {
  const who = await requireProfileId();
  if ("response" in who) return who.response;
  const limit = await checkRateLimit({
    scope: "gallery-upload",
    identity: who.profileId,
    limit: 20,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  if (!isAvatarStorageConfigured()) {
    return NextResponse.json({ error: "Upload temporarily unavailable." }, { status: 503 });
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
    return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadGalleryPhotoFromBuffer(who.profileId, buffer);

    // Append + cap in one statement: the cardinality guard means two parallel
    // uploads racing past a client-side count can't push the array beyond 5.
    const pool = getPostgresPool()!;
    const updated = await pool.query<{ gallery_photos: string[] }>(
      `
        update profiles
        set gallery_photos = array_append(gallery_photos, $2), updated_at = now()
        where id = $1::uuid and cardinality(gallery_photos) < $3
        returning gallery_photos
      `,
      [who.profileId, url, MAX_GALLERY_PHOTOS],
    );

    const row = updated.rows[0];
    if (!row) {
      // Gallery already full - clean up the orphaned object we just wrote.
      const key = ownGalleryKeyFromUrl(who.profileId, url);
      if (key) void deleteGalleryObject(key);
      return NextResponse.json(
        { error: `You can add up to ${MAX_GALLERY_PHOTOS} photos.` },
        { status: 400 },
      );
    }

    // If the user has no primary avatar yet, seed it from this gallery photo.
    // Otherwise a user who only ever fills the gallery has no face on their
    // profile card / in the "click with someone" pool, and the dashboard keeps
    // nagging "add a profile photo" even though they added photos (bug board
    // #182). A real square avatar uploaded later via /api/upload/avatar still
    // overwrites this. Best-effort - never fail the gallery upload over it.
    const seeded = await pool
      .query(
        `update profiles set photo_url = $2, photo_status = 'pending', updated_at = now()
         where id = $1::uuid and (photo_url is null or photo_url = '')`,
        [who.profileId, url],
      )
      .catch(() => null);
    // `mainPhoto` only when this upload became the main photo.
    const mainPhoto = seeded?.rowCount ? await checkMainPhoto(who.profileId) : undefined;

    return NextResponse.json({ urls: row.gallery_photos, mainPhoto });
  } catch (error) {
    console.error("gallery upload failed", error);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const who = await requireProfileId();
  if ("response" in who) return who.response;

  let url: string;
  try {
    const body = (await request.json()) as { url?: unknown };
    if (typeof body.url !== "string" || !body.url) throw new Error("missing url");
    url = body.url;
  } catch {
    return NextResponse.json({ error: "Expected json body { url }." }, { status: 400 });
  }

  try {
    const pool = getPostgresPool()!;
    // Every stored form of the photo (Supabase or R2 - the copy kept the key),
    // because the object goes from both backends below whichever form came in.
    const forms = sameObjectUrls(url);
    const updated = await pool.query<{ gallery_photos: string[] }>(
      `
        update profiles
        set gallery_photos = array(
              select photo from unnest(gallery_photos) with ordinality as g(photo, n)
               where photo is null or photo <> all($2::text[])
               order by n
            ),
            updated_at = now()
        where id = $1::uuid
        returning gallery_photos
      `,
      [who.profileId, forms],
    );

    // If the removed photo was also serving as the avatar (seeded from the
    // gallery on first upload), repoint the avatar to the next remaining gallery
    // photo, or clear it if none are left - so we never leave a broken avatar
    // pointing at a deleted object (bug board #182).
    // Not best-effort: if this fails, the photo stays the main one, so its
    // object must not be deleted below (the catch answers 500 first) - or the
    // profile would keep an 'ok' photo that no longer exists.
    const moved = await pool.query(
      `update profiles
       set photo_url = gallery_photos[1],
           photo_status = case when gallery_photos[1] is null then 'none' else 'pending' end,
           updated_at = now()
       where id = $1::uuid and photo_url = any($2::text[])`,
      [who.profileId, forms],
    );
    const mainPhoto = moved.rowCount ? await checkMainPhoto(who.profileId) : undefined;

    // Only delete the object when the URL provably sits under the caller's own
    // gallery prefix - a crafted URL can't reach other users' objects.
    const key = ownGalleryKeyFromUrl(who.profileId, url);
    if (key) void deleteGalleryObject(key);

    return NextResponse.json({ urls: updated.rows[0]?.gallery_photos ?? [], mainPhoto });
  } catch (error) {
    console.error("gallery delete failed", error);
    return NextResponse.json({ error: "Could not remove photo." }, { status: 500 });
  }
}
