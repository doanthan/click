"use client";

/**
 * Avatar picker used on /profile/edit (and reusable for onboarding).
 *
 * - Renders a round preview that doubles as the file input trigger.
 * - On selection, POSTs the file to /api/upload/avatar; the route normalises
 *   to 512×512 JPG in R2 and persists `profiles.photo_url`.
 * - The hidden `photo_url` field keeps the existing server action contract
 *   (`saveProfileEditAction` reads `photo_url`) — uploading just rewrites
 *   that field with the new R2 URL.
 *
 * The route already persists the URL, so the surrounding form save is the
 * "commit other profile edits" step rather than the source of truth for the
 * avatar. If the user uploads and then walks away without saving the form,
 * their new photo still sticks.
 */

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

type AvatarUploaderProps = {
  initialUrl: string | null;
  displayName: string;
};

export function AvatarUploader({ initialUrl, displayName }: AvatarUploaderProps) {
  const inputId = useId();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial = (displayName.trim()[0] ?? "✷").toUpperCase();

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
      const response = await fetch("/api/upload/avatar", {
        method: "POST",
        body,
      });
      const payload = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!response.ok || !payload?.url) {
        // 503 = storage env not configured on this deploy. It's not the user's
        // fault and retrying won't help until ops sets the Supabase keys, so say
        // so plainly rather than the bare "temporarily unavailable".
        setError(
          response.status === 503
            ? "Photo uploads aren’t available right now — your other changes will still save."
            : payload?.error ?? "Upload failed. Try again.",
        );
        return;
      }
      setUrl(payload.url);
      router.refresh();
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3">
      <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        Profile photo
      </span>

      <div className="flex items-center gap-4">
        <label
          htmlFor={inputId}
          className={`relative grid size-20 cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm transition ${
            pending ? "opacity-60" : "hover:bg-[color:var(--peach)]"
          }`}
          aria-label="Choose a profile photo"
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              width={80}
              height={80}
              className="size-full object-cover"
            />
          ) : (
            <span className="font-display text-3xl font-light text-[color:var(--ink)]">
              {initial}
            </span>
          )}
          {pending ? (
            <span className="absolute inset-0 grid place-items-center bg-[color:var(--cream)]/70 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--ink)]">
              Uploading…
            </span>
          ) : null}
        </label>

        <div className="grid gap-1.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {url ? "Replace photo" : "Upload photo"}
          </button>
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-[color:var(--mauve)]">
            JPG, PNG, or WEBP · up to 5 MB
          </span>
        </div>
      </div>

      <input
        ref={fileRef}
        id={inputId}
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

      {/* The existing server action reads this hidden field; we keep parity
          with the previous URL-text input so no action changes are needed. */}
      <input type="hidden" name="photo_url" value={url ?? ""} />

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
