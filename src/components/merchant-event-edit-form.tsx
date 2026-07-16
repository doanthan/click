"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Tag = { slug: string; label: string };

const FIELD_LABEL_CLASS =
  "text-[12.5px] font-semibold text-[color:var(--slate)]";
const INPUT_CLASS =
  "mt-1.5 w-full rounded-xl border border-[color:var(--mist)] bg-white px-3 py-2 text-base text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]";

// Merchant self-service editor for an event's SAFE fields (title, description,
// street address, interest tags). Price / time / capacity are intentionally NOT
// editable here — changing them after people have booked needs a review, so the
// form shows a note directing merchants to request one. The street address is
// safe to edit (it doesn't change what someone paid for) so it lives here.
export function MerchantEventEditForm({
  eventSlug,
  initialTitle,
  initialDescription,
  initialAddress,
  pendingAddress,
  addressNeedsReview,
  initialImages,
  initialTags,
  tagOptions,
}: {
  eventSlug: string;
  initialTitle: string;
  initialDescription: string;
  initialAddress: string;
  // A proposed address already awaiting admin review, if any.
  pendingAddress: string | null;
  // Whether an address change will be queued for admin review rather than going
  // live immediately — true once the event is published or anyone has booked
  // (bug board #209). We tell the merchant up front.
  addressNeedsReview: boolean;
  initialImages: string[];
  initialTags: Tag[];
  tagOptions: Tag[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [address, setAddress] = useState(initialAddress);
  const [images, setImages] = useState<string[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>(initialTags);

  const MAX_PHOTOS = 5;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    const room = MAX_PHOTOS - images.length;
    if (room <= 0) {
      setUploadError(`You can have at most ${MAX_PHOTOS} photos.`);
      return;
    }
    const toUpload = Array.from(files).slice(0, room);
    setUploading(true);
    try {
      for (const file of toUpload) {
        const form = new FormData();
        form.set("file", file);
        const res = await fetch("/api/upload/event-image", { method: "POST", body: form });
        const payload = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !payload.url) {
          setUploadError(payload.error ?? "Upload failed.");
          break;
        }
        setImages((prev) => (prev.length < MAX_PHOTOS ? [...prev, payload.url!] : prev));
      }
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
  }
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const selectedSlugs = useMemo(() => new Set(tags.map((t) => t.slug)), [tags]);
  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tagOptions
      .filter((o) => !selectedSlugs.has(o.slug))
      .filter((o) => !q || o.label.toLowerCase().includes(q))
      .slice(0, 24);
  }, [tagOptions, selectedSlugs, query]);

  function addTag(tag: Tag) {
    setTags((prev) => (prev.some((t) => t.slug === tag.slug) ? prev : [...prev, tag]));
    setQuery("");
  }
  function removeTag(slug: string) {
    setTags((prev) => prev.filter((t) => t.slug !== slug));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/merchant/events/${encodeURIComponent(eventSlug)}/details`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            address,
            images,
            tagSlugs: tags.map((t) => t.slug),
          }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        event?: { pendingAddress?: string | null; address?: string | null };
      };
      if (!response.ok) {
        setMessage({ kind: "error", text: payload.error ?? "Could not save changes." });
        return;
      }
      // If the address edit got parked for review, the saved event still shows
      // the OLD address with the new one pending — tell the merchant so they
      // don't think the change silently failed.
      const queuedForReview =
        payload.event?.pendingAddress != null &&
        payload.event.pendingAddress === address.trim() &&
        address.trim() !== initialAddress.trim();
      setMessage({
        kind: "ok",
        text: queuedForReview
          ? "Saved. Your address change was sent to admins for review (it affects people who've booked)."
          : "Saved.",
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Edit event</p>
          <p className="mt-1 text-sm font-medium text-[color:var(--slate)]">
            Update the title, description, street address, photos and interest tags.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ck-btn ck-btn--secondary ck-btn--sm"
        >
          {open ? "Close" : "Edit details"}
        </button>
      </div>

      {open ? (
        <div className="mt-5 space-y-5">
          <label className="block">
            <span className={FIELD_LABEL_CLASS}>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>

          <label className="block">
            <span className={FIELD_LABEL_CLASS}>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className={`${INPUT_CLASS} leading-6`}
            />
          </label>

          <label className="block">
            <span className={FIELD_LABEL_CLASS}>Street address</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Unit 6/29 Bridge Rd, Stanmore NSW 2048"
              className={INPUT_CLASS}
            />
            <span className="mt-1 block text-xs text-[color:var(--slate)]">
              Shown to confirmed attendees on the event page.
              {addressNeedsReview
                ? " This event is already live, so changing the address needs admin review before it goes live."
                : ""}
            </span>
            {pendingAddress ? (
              <span className="mt-2 block rounded-xl bg-[color:var(--lavender-100)] px-3 py-2 text-xs font-medium text-[color:var(--purple-700)]">
                Pending admin review: <span className="italic">{pendingAddress}</span>. The
                current address stays live until it&apos;s approved.
              </span>
            ) : null}
          </label>

          <div>
            <span className={FIELD_LABEL_CLASS}>
              Photos ({images.length}/{MAX_PHOTOS})
            </span>
            <p className="mt-1 text-xs text-[color:var(--slate)]">
              First photo is the cover. JPG / PNG / WEBP, up to {MAX_PHOTOS}.
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {images.map((url, idx) => (
                <li key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Event photo ${idx + 1}`}
                    className="size-20 rounded-xl border border-[color:var(--line)] object-cover"
                  />
                  {idx === 0 ? (
                    <span className="absolute left-1 top-1 rounded-md bg-[color:var(--lavender-100)] px-1.5 py-0.5 text-[0.6rem] font-semibold text-[color:var(--purple-700)]">
                      Cover
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    aria-label={`Remove photo ${idx + 1}`}
                    className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-lg border border-[color:var(--mist)] bg-white text-xs font-semibold text-[color:var(--slate)] shadow-[var(--shadow-xs)] hover:text-[color:var(--danger)]"
                  >
                    ×
                  </button>
                </li>
              ))}
              {images.length < MAX_PHOTOS ? (
                <li>
                  <label
                    className={`grid size-20 cursor-pointer place-items-center rounded-xl border border-dashed border-[color:var(--mist-strong)] bg-white text-center text-xs font-semibold text-[color:var(--slate)] hover:bg-[color:var(--lavender-100)] ${
                      uploading ? "pointer-events-none opacity-60" : ""
                    }`}
                  >
                    {uploading ? "Uploading…" : "+ Add"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        handleFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </li>
              ) : null}
            </ul>
            {uploadError ? (
              <p className="mt-2 text-xs font-semibold text-[color:var(--danger)]">{uploadError}</p>
            ) : null}
          </div>

          <div>
            <span className={FIELD_LABEL_CLASS}>Interest tags</span>
            <ul className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {tags.length === 0 ? (
                <li className="text-xs font-medium text-[color:var(--slate)]">None yet.</li>
              ) : (
                tags.map((tag) => (
                  <li key={tag.slug}>
                    <span className="ck-tag ck-tag--selected">
                      {tag.label}
                      <button
                        type="button"
                        onClick={() => removeTag(tag.slug)}
                        aria-label={`Remove ${tag.label}`}
                        className="leading-none opacity-80 hover:opacity-100"
                      >
                        ×
                      </button>
                    </span>
                  </li>
                ))
              )}
            </ul>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tags to add…"
              className={INPUT_CLASS}
            />
            {query.trim() ? (
              <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {available.length === 0 ? (
                  <span className="text-xs font-medium text-[color:var(--slate)]">
                    No matching tags.
                  </span>
                ) : (
                  available.map((tag) => (
                    <button
                      key={tag.slug}
                      type="button"
                      onClick={() => addTag(tag)}
                      className="ck-tag ck-tag--select"
                    >
                      + {tag.label}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <p className="rounded-xl border border-dashed border-[color:var(--mist-strong)] bg-[color:var(--champagne)] p-3 text-xs leading-5 text-[color:var(--slate)]">
            Changing the price, date/time or capacity affects people who may have
            already booked - those need a review. Email support@click.local to
            request a change.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || uploading || !title.trim()}
              className="ck-btn ck-btn--primary ck-btn--md"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {message ? (
              <span
                className={`text-sm font-medium ${
                  message.kind === "ok"
                    ? "text-[color:var(--ink)]"
                    : "text-[color:var(--danger)]"
                }`}
              >
                {message.text}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
