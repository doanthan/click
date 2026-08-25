"use client";

/**
 * Avatar picker used on /profile/edit (and reusable for onboarding).
 *
 * - Renders a round preview that doubles as the file input trigger.
 * - On selection, POSTs the file to /api/upload/avatar; the route normalises
 *   to 512×512 JPG in R2 and persists `profiles.photo_url`.
 * - The hidden `photo_url` field keeps the existing server action contract
 *   (`saveProfileEditAction` reads `photo_url`) - uploading just rewrites
 *   that field with the new R2 URL.
 *
 * The route already persists the URL, so the surrounding form save is the
 * "commit other profile edits" step rather than the source of truth for the
 * avatar. If the user uploads and then walks away without saving the form,
 * their new photo still sticks.
 */

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Icon } from "@/components/ds";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

type AvatarUploaderProps = {
  initialUrl: string | null;
  displayName: string;
  /** Fired after a successful upload. Onboarding uses it to know whether to
   *  nudge for a photo on the completion screen. */
  onUploaded?: (url: string) => void;
  optional?: boolean;
};

export function AvatarUploader({
  initialUrl,
  displayName,
  onUploaded,
  optional = false,
}: AvatarUploaderProps) {
  const inputId = useId();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The avatar persists on upload, but the only "Save profile" button sits at
  // the bottom of a long form - so users thought they had to scroll down to
  // save the photo (bug board #219). Flash a "Saved ✓" to make it clear.
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashSaved() {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSaved(true);
    savedTimer.current = setTimeout(() => setSaved(false), 3000);
  }

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
    // Same guard the gallery uploader two rows down already has: without it a
    // stalled upload sat on "Uploading…" with the button disabled forever, so
    // the member could not retry and could not tell whether the photo saved.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch("/api/upload/avatar", {
        method: "POST",
        body,
        signal: controller.signal,
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
            ? "Photo uploads aren’t available right now - your other changes will still save."
            : payload?.error ?? "Upload failed. Try again.",
        );
        return;
      }
      setUrl(payload.url);
      onUploaded?.(payload.url);
      flashSaved();
      router.refresh();
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      clearTimeout(timeout);
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3">
      <span className="flex items-center gap-2.5">
        <span className="eyebrow">Profile photo</span>
        {optional ? (
          <span className="text-[12px] font-medium text-[color:var(--slate)]">Optional</span>
        ) : null}
        {saved ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[color:var(--sage)]">
            <Icon name="check" size={13} stroke={2.6} />
            Saved
          </span>
        ) : null}
      </span>

      <div className="flex items-center gap-4">
        <label
          htmlFor={inputId}
          className={`relative grid size-20 cursor-pointer place-items-center overflow-hidden rounded-full bg-[color:var(--lavender-100)] shadow-[0_0_0_3px_var(--paper),0_0_0_4px_var(--lavender)] transition ${
            pending ? "opacity-60" : "hover:bg-[color:var(--lavender-200)]"
          }`}
          aria-label="Choose a profile photo"
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" width={80} height={80} className="size-full object-cover" />
          ) : (
            <span className="font-display text-3xl font-semibold text-[color:var(--purple)]">
              {initial}
            </span>
          )}
          {pending ? (
            <span className="absolute inset-0 grid place-items-center bg-[color:var(--paper)]/75 text-[11px] font-semibold text-[color:var(--ink)]">
              Uploading…
            </span>
          ) : null}
        </label>

        <div className="grid gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
          >
            {url ? "Replace photo" : "Upload photo"}
          </Button>
          <span className="text-[12px] text-[color:var(--slate)]">
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

      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </div>
  );
}

/** Errors are Ink-on-tint, never a full red fill - calm, still unmissable. */
export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-[12px] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper))] px-3.5 py-2.5 text-[13px] font-medium leading-5 text-[color:var(--danger)]"
    >
      {children}
    </p>
  );
}
