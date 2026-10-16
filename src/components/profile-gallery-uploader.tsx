"use client";

/**
 * Profile photo gallery picker used on /profile/edit.
 *
 * Up to 5 extra photos alongside the avatar. Like the AvatarUploader, each
 * add/remove persists immediately via /api/upload/gallery (the API is the
 * source of truth and returns the full list after every change), so the
 * surrounding form save isn't involved - photos stick even if the user walks
 * away without hitting "Save profile".
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorNote } from "@/components/avatar-uploader";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Icon } from "@/components/ds";
import {
  PHOTO_TOO_BIG_MESSAGE,
  UPLOAD_BODY_LIMIT_BYTES,
  shrinkPhotoForUpload,
} from "@/lib/photo-upload";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 5;
// The photo check's result for a main photo a gallery change moved (api/upload/gallery).
type MainPhoto = { status: "none" | "pending" | "ok" | "failed"; error?: string };

export function ProfileGalleryUploader({ initialUrls }: { initialUrls: string[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  // The remove icon used to delete on its first tap: no confirm, no undo, and
  // the DELETE takes the object out of storage the moment the API answers, so
  // a thumb landing on the corner of the wrong tile cost a photo for good.
  // Holds the url awaiting confirmation.
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Photos persist on upload, but with the only "Save profile" button at the
  // bottom of a long form, users thought they had to scroll down to save them
  // (bug board #219). Flash an explicit "Saved ✓" so it's clear it's done.
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashSaved() {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSaved(true);
    savedTimer.current = setTimeout(() => setSaved(false), 3000);
  }

  async function handleFile(file: File) {
    setError(null);

    if (!ACCEPT.split(",").includes(file.type)) {
      setError("Use a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be 5 MB or smaller.");
      return;
    }

    setPending(true);
    // Over Vercel's 4.5 MB body limit the request never reaches our route
    // (bug board #335), so a big phone photo is re-encoded first.
    const upload = await shrinkPhotoForUpload(file);
    if (upload.size > UPLOAD_BODY_LIMIT_BYTES) {
      setError(PHOTO_TOO_BIG_MESSAGE);
      setPending(false);
      return;
    }
    const body = new FormData();
    body.set("file", upload);

    // Guard against a silent hang: a stalled upload used to leave the spinner
    // spinning forever with no feedback (bug board: "pending icon and nothing
    // happened"). Abort after 30s so the user gets a retry-able error instead.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch("/api/upload/gallery", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as
        | { urls?: string[]; error?: string; mainPhoto?: MainPhoto }
        | null;
      if (!response.ok || !Array.isArray(payload?.urls)) {
        setError(
          response.status === 503
            ? "Photo uploads aren’t available right now - your other changes will still save."
            : response.status === 413
              ? PHOTO_TOO_BIG_MESSAGE
              : payload?.error ?? "Upload failed. Try again.",
        );
        return;
      }
      setUrls(payload.urls);
      if (!sayMainPhoto(payload.mainPhoto)) flashSaved();
      router.refresh();
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      clearTimeout(timeout);
      setPending(false);
    }
  }

  // The change also moved the main photo (this was the first photo, or the main
  // one was removed): say what its photo check found (01 §2) - never a silent
  // silhouette. router.refresh() then brings the avatar above the new photo
  // and its verdict; never a reload, which the form's unsaved-changes guard can
  // cancel. Returns whether there was something to say.
  function sayMainPhoto(mainPhoto: MainPhoto | undefined): boolean {
    if (mainPhoto?.status === "failed") {
      setError(mainPhoto.error ?? "Your new main photo didn't work. Try another one.");
    } else if (mainPhoto?.status === "pending") {
      setError("Saved - but we couldn't check your main photo just now. Tap Set as main on it in a moment to try again.");
    } else {
      return false;
    }
    return true;
  }

  // Promote a gallery photo to the main avatar (bug board #220 - there was no
  // way to choose your main photo, only "replace" on the avatar itself).
  const [settingMain, setSettingMain] = useState<string | null>(null);
  async function handleSetMain(url: string) {
    setError(null);
    setSettingMain(url);
    try {
      const response = await fetch("/api/upload/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!response.ok || !payload?.url) {
        setError(payload?.error ?? "Couldn't set that as your main photo. Try again.");
        // 422: it IS the main photo now, failed (01 §2) - the avatar shows that too.
        if (response.status === 422) router.refresh();
        return;
      }
      // The avatar above takes the new photo from the refreshed server props
      // (AvatarUploader), and so does the header. Not a reload: the form's
      // unsaved-changes guard can cancel one.
      router.refresh();
    } catch {
      setError("Couldn't set that as your main photo. Check your connection.");
    } finally {
      setSettingMain(null);
    }
  }

  async function handleRemove(url: string) {
    setError(null);
    setRemoving(url);
    try {
      const response = await fetch("/api/upload/gallery", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { urls?: string[]; error?: string; mainPhoto?: MainPhoto }
        | null;
      if (!response.ok || !Array.isArray(payload?.urls)) {
        setError(payload?.error ?? "Could not remove that photo. Try again.");
        return;
      }
      setUrls(payload.urls);
      sayMainPhoto(payload.mainPhoto);
      router.refresh();
    } catch {
      setError("Could not remove that photo. Check your connection and try again.");
    } finally {
      setRemoving(null);
    }
  }

  const slotsLeft = MAX_PHOTOS - urls.length;

  return (
    <div className="grid gap-3">
      <span className="flex items-center gap-2.5">
        <span className="eyebrow">
          More photos · {urls.length}/{MAX_PHOTOS}
        </span>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[color:var(--sage)]">
            <Icon name="check" size={13} stroke={2.6} />
            Saved
          </span>
        ) : null}
      </span>
      <p className="-mt-1 text-[13px] leading-[1.5] text-[color:var(--slate)]">
        Add up to {MAX_PHOTOS} photos of you doing things you love - they show on your profile
        alongside your prompts. Photos save as soon as they upload.
      </p>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {urls.map((url) => (
          <div
            key={url}
            className="group relative aspect-[4/5] overflow-hidden rounded-[12px] bg-[color:var(--champagne-deep)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="size-full object-cover" />
            {/* The tap target is the full 44px box; the 28px disc inside it is
                the visual, unchanged. A destructive control sitting on top of a
                photo is the last one that should need an accurate thumb. */}
            <button
              type="button"
              onClick={() => setConfirmRemove(url)}
              disabled={removing === url}
              aria-label="Remove photo"
              className="group/remove absolute right-0 top-0 grid size-11 place-items-center disabled:opacity-50"
            >
              <span className="grid size-7 place-items-center rounded-full bg-[color:var(--paper)] text-[color:var(--ink)] shadow-[var(--shadow-xs)] transition group-hover/remove:bg-[color:var(--lavender-100)]">
                {removing === url ? "…" : <Icon name="x" size={13} stroke={2.4} />}
              </span>
            </button>
            {/* Choose this as the main avatar (bug board #220). */}
            <button
              type="button"
              onClick={() => void handleSetMain(url)}
              disabled={settingMain === url}
              aria-label="Set as main photo"
              className="absolute inset-x-0 bottom-0 truncate bg-[color-mix(in_srgb,var(--ink)_62%,transparent)] px-1 py-1.5 text-center text-[11px] font-semibold text-[color:var(--champagne)] transition hover:bg-[color:var(--purple)] disabled:opacity-60"
            >
              {settingMain === url ? "Setting…" : "Set as main"}
            </button>
          </div>
        ))}

        {slotsLeft > 0 ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="grid aspect-[4/5] place-items-center rounded-[12px] border border-dashed border-[color:var(--mist-strong)] bg-[color:var(--champagne)] text-[color:var(--purple)] transition hover:bg-[color:var(--lavender-100)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="grid justify-items-center gap-1.5">
              <Icon name="plus" size={20} />
              <span className="text-[12px] font-semibold">
                {pending ? "Uploading…" : "Add photo"}
              </span>
            </span>
          </button>
        ) : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          // Reset so picking the same file twice still fires onChange.
          event.target.value = "";
        }}
      />

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {/* Portals onto document.body, so its buttons sit outside the profile form
          this uploader renders inside and can never submit it. */}
      <ConfirmDialog
        open={confirmRemove !== null}
        tone="rose"
        badge="Remove"
        title="Remove this photo?"
        description="It comes off your profile straight away - you can upload it again whenever you like."
        confirmLabel="Remove photo"
        cancelLabel="Keep it"
        onConfirm={() => {
          const url = confirmRemove;
          setConfirmRemove(null);
          if (url) void handleRemove(url);
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
