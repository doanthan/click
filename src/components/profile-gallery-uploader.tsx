"use client";

/**
 * Profile photo gallery picker used on /profile/edit.
 *
 * Up to 5 extra photos alongside the avatar. Like the AvatarUploader, each
 * add/remove persists immediately via /api/upload/gallery (the API is the
 * source of truth and returns the full list after every change), so the
 * surrounding form save isn't involved — photos stick even if the user walks
 * away without hitting "Save profile".
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 5;

export function ProfileGalleryUploader({ initialUrls }: { initialUrls: string[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    const body = new FormData();
    body.set("file", file);

    setPending(true);
    try {
      const response = await fetch("/api/upload/gallery", { method: "POST", body });
      const payload = (await response.json().catch(() => null)) as
        | { urls?: string[]; error?: string }
        | null;
      if (!response.ok || !payload?.urls) {
        setError(
          response.status === 503
            ? "Photo uploads aren’t available right now — your other changes will still save."
            : payload?.error ?? "Upload failed. Try again.",
        );
        return;
      }
      setUrls(payload.urls);
      router.refresh();
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setPending(false);
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
        | { urls?: string[]; error?: string }
        | null;
      if (!response.ok || !payload?.urls) {
        setError(payload?.error ?? "Could not remove that photo. Try again.");
        return;
      }
      setUrls(payload.urls);
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
      <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        More photos · {urls.length}/{MAX_PHOTOS}
      </span>
      <p className="-mt-1 text-xs font-semibold text-[color:var(--mauve)]">
        Add up to {MAX_PHOTOS} photos of you doing things you love — they show on your
        profile alongside your prompts.
      </p>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {urls.map((url) => (
          <div
            key={url}
            className="group relative aspect-[4/5] overflow-hidden rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => void handleRemove(url)}
              disabled={removing === url}
              aria-label="Remove photo"
              className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] text-xs font-bold text-[color:var(--ink)] hard-shadow-sm transition hover:bg-[color:var(--rose)] hover:text-[color:var(--surface-deep)] disabled:opacity-50"
            >
              {removing === url ? "…" : "✕"}
            </button>
          </div>
        ))}

        {slotsLeft > 0 ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="grid aspect-[4/5] place-items-center rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--champagne)] text-[color:var(--mauve)] transition hover:bg-[color:var(--peach)] hover:text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="grid justify-items-center gap-1">
              <span className="text-2xl leading-none">{pending ? "⏳" : "+"}</span>
              <span className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em]">
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

      {error ? (
        <p
          role="alert"
          className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-3 py-2 text-xs font-bold text-[color:var(--surface-deep)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
