/**
 * POST /api/upload/event-image
 *
 * Multipart upload from the event-create wizard's Media step. Used by the
 * drop / paste / file-picker UI for additional event photos.
 *
 * Body: `file` — JPG/PNG/WEBP ≤ 10 MB. Server-side: sharp normalises into a
 * max-1600 JPG and writes to the configured public-media backend (R2 first,
 * Supabase fallback) under `events/<uuid>.jpg`. Each call writes a fresh key
 * so client-side removal just orphans the object.
 *
 * Gated to approved merchants — anyone else gets 403.
 *
 * Returns:
 *   200 { url: string }                — success
 *   400 { error: string }              — bad MIME, missing file, oversize
 *   401 { error: "Sign in required." } — no session
 *   403 { error: string }              — not a merchant / not approved
 *   503 { error: "Upload temporarily unavailable." } — Supabase env not configured
 *   500 { error: "Upload failed." }    — anything else (already logged)
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  isEventImageStorageConfigured,
  uploadEventImageFromBuffer,
} from "@/lib/event-image-storage";
import { getProfileStatus } from "@/lib/event-repository";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB — event photos are bigger than avatars.

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const limit = await checkRateLimit({
    scope: "event-image-upload",
    identity: session.user.email ?? "authenticated-user",
    limit: 30,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  // Same gate as /merchant/events/create's layout: only approved merchants
  // get to write event photos.
  const status = await getProfileStatus(session);
  if (!status.merchantProfile) {
    return NextResponse.json(
      { error: "Complete merchant signup before uploading event photos." },
      { status: 403 },
    );
  }
  if (status.merchantProfile.verification_status !== "approved") {
    return NextResponse.json(
      { error: "Admin approval is required before uploading event photos." },
      { status: 403 },
    );
  }

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
    const url = await uploadEventImageFromBuffer(buffer);
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
