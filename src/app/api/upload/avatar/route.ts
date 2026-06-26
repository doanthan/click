/**
 * POST /api/upload/avatar
 *
 * Multipart upload from the profile-edit page (and onboarding, eventually).
 * Body: `file` — a JPG/PNG/WEBP ≤ 5 MB. Server-side: sharp normalises to a
 * 512×512 JPG, pushes to the public Supabase Storage `avatars` bucket at
 * `<profileId>.jpg`, persists the resulting public URL on `profiles.photo_url`,
 * and returns it.
 *
 * Returns:
 *   200 { url: string }                — success
 *   400 { error: string }              — bad MIME, missing file, oversize
 *   401 { error: "Sign in required." } — no session
 *   503 { error: "Upload temporarily unavailable." } — Supabase env not configured
 *   500 { error: "Upload failed." }    — anything else (already logged)
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  isAvatarStorageConfigured,
  uploadAvatarFromBuffer,
  uploadAvatarFromUrl,
} from "@/lib/avatar-storage";
import { ownGalleryKeyFromUrl } from "@/lib/gallery-storage";
import { updateOwnProfile } from "@/lib/event-repository";
import { getPostgresPool } from "@/lib/postgres";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  if (!isAvatarStorageConfigured()) {
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
      { error: "Image must be 5 MB or smaller." },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }

  // Resolve the caller's profile id via the same path every other repo
  // function uses (so the photo lands on the correct row even on first login).
  const pool = getPostgresPool();
  if (!pool) {
    return NextResponse.json(
      { error: "Database unavailable." },
      { status: 503 },
    );
  }
  const email = session.user.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const profileRow = await pool.query<{ id: string }>(
      `select id::text from profiles where email = $1 limit 1`,
      [email],
    );
    const profileId = profileRow.rows[0]?.id;
    if (!profileId) {
      // Fall through to onboarding — they need to complete it before uploading.
      return NextResponse.json(
        { error: "Finish onboarding before uploading a photo." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await uploadAvatarFromBuffer(profileId, buffer);

    // Persist via the same writer the profile-edit form uses so we don't
    // bypass any future validation that lands there.
    await updateOwnProfile(session, { photoUrl: publicUrl });

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("avatar upload failed", error);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

/**
 * PATCH /api/upload/avatar
 *
 * Promote one of the caller's existing gallery photos to their main avatar
 * (bug board #220 — "I can't choose my main"). Body: `{ url }` where url is one
 * of the profile's own gallery photos. We re-host it through the same 512×512
 * JPG pipeline as a fresh upload (so the avatar key/shape stays consistent) and
 * persist it on `profiles.photo_url`.
 *
 * Returns:
 *   200 { url: string }                — success (new avatar URL)
 *   400 { error }                      — bad body / not one of your gallery photos
 *   401 { error: "Sign in required." } — no session
 *   502 { error }                      — re-host failed
 *   503 { error }                      — storage/db not configured
 */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!isAvatarStorageConfigured()) {
    return NextResponse.json(
      { error: "Upload temporarily unavailable." },
      { status: 503 },
    );
  }
  const email = session.user.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: { url?: unknown };
  try {
    body = (await request.json()) as { url?: unknown };
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const sourceUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!sourceUrl) {
    return NextResponse.json({ error: "Missing `url`." }, { status: 400 });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  try {
    const profileRow = await pool.query<{ id: string }>(
      `select id::text from profiles where email = $1 limit 1`,
      [email],
    );
    const profileId = profileRow.rows[0]?.id;
    if (!profileId) {
      return NextResponse.json(
        { error: "Finish onboarding before setting a photo." },
        { status: 400 },
      );
    }

    // Only one of the caller's OWN gallery photos can become their avatar —
    // never an arbitrary URL.
    if (!ownGalleryKeyFromUrl(profileId, sourceUrl)) {
      return NextResponse.json(
        { error: "That photo isn't in your gallery." },
        { status: 400 },
      );
    }

    const publicUrl = await uploadAvatarFromUrl(profileId, sourceUrl);
    if (!publicUrl) {
      return NextResponse.json(
        { error: "Couldn't set that photo as your main. Try again." },
        { status: 502 },
      );
    }

    await updateOwnProfile(session, { photoUrl: publicUrl });
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("avatar set-as-main failed", error);
    return NextResponse.json({ error: "Couldn't update your main photo." }, { status: 500 });
  }
}
