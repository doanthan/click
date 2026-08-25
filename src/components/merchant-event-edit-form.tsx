"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/ds";
import { SUPPORT_EMAIL_DEFAULT } from "@/lib/email-templates/tokens";
import { useFormDraft } from "@/lib/use-form-draft";
import { DURATION_OPTIONS, nearestDurationValue } from "@/lib/event-duration";
import { CAPACITY_PATTERN, PRICE_PATTERN, sanitizeAmount } from "@/lib/amounts";
import { MERCHANT_EVENT_EDIT_SECTION_ID } from "@/lib/merchant-event-edit";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";

type Tag = { slug: string; label: string };

// Heading for the two COMPOSITE controls (photos, tags). A single control gets
// its label from FormField instead - this file used to carry its own inputClass
// and label constant, which is exactly how fifteen focus-ring variants happen.
const GROUP_LABEL_CLASS = "text-[13.5px] font-semibold text-[color:var(--ink)]";

/** Everything the form can change, in the shape the draft is stored in. */
type Draft = {
  title: string;
  description: string;
  address: string;
  images: string[];
  tagSlugs: string[];
  // Terms. Present in every draft, but only ever editable - and only ever
  // sent - while `termsEditable` is true. A draft written before this shape
  // existed is dropped by the version bump rather than half-applied.
  category: string;
  startsAt: string;
  durationMinutes: string;
  capacity: string;
  price: string;
};

// Bump when the Draft shape changes; older drafts are then dropped rather than
// half-applied into fields that have since moved.
const DRAFT_VERSION = 2;

type Message = { kind: "ok" | "error" | "note"; text: string; id: number };

// Merchant self-service editor for an event's SAFE fields (title, description,
// street address, interest tags). Price / time / capacity are intentionally NOT
// editable here - changing them after people have booked needs a review, so the
// form shows a note directing merchants to request one. The street address is
// safe to edit (it doesn't change what someone paid for) so it lives here.
//
// Deliberately a single panel and NOT a wizard: the dominant journey here is
// fixing one typo, and routing that through four navigations taxes every common
// visit to flatter the rare one. The create flow is stepped because it is a
// different, much larger set of fields.
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
  termsEditable,
  eventCancelled = false,
  categoryOptions,
  initialCategory,
  initialStartsAt,
  initialDurationMinutes,
  initialCapacity,
  initialPriceCents,
}: {
  eventSlug: string;
  initialTitle: string;
  initialDescription: string;
  initialAddress: string;
  // A proposed address already awaiting admin review, if any.
  pendingAddress: string | null;
  // Whether an address change will be queued for admin review rather than going
  // live immediately - true once the event is published or anyone has booked
  // (bug board #209). We tell the merchant up front.
  addressNeedsReview: boolean;
  initialImages: string[];
  initialTags: Tag[];
  tagOptions: Tag[];
  // Whether this event's TERMS - what it is, when it runs, how many seats, what
  // a seat costs - can still be changed. True only while the event is neither
  // publicly listed nor holding a seat, which is exactly the rejected / pending
  // case. The server enforces the same rule; this only decides what to render.
  termsEditable: boolean;
  // A cancelled event has its terms locked for a different reason from a live
  // one, and the difference matters: a live event's terms are locked BECAUSE
  // people booked against them, so support can move them. A cancelled event has
  // nobody to protect and nothing to move - it has no un-cancel path at all, and
  // the way to run the night again is Duplicate. One note per reason.
  eventCancelled?: boolean;
  categoryOptions: string[];
  initialCategory: string;
  // "YYYY-MM-DDTHH:mm" in Sydney wall time, the datetime-local shape.
  initialStartsAt: string;
  initialDurationMinutes: number;
  initialCapacity: number;
  initialPriceCents: number;
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
  const [category, setCategory] = useState(initialCategory);
  const [startsAt, setStartsAt] = useState(initialStartsAt);
  // Snapped: an event created through the API can carry any duration, and a
  // <select> handed an unmatched value renders blank.
  const [durationMinutes, setDurationMinutes] = useState(
    nearestDurationValue(initialDurationMinutes),
  );
  const [capacity, setCapacity] = useState(String(initialCapacity));
  const [price, setPrice] = useState(
    initialPriceCents > 0 ? (initialPriceCents / 100).toFixed(2).replace(/\.00$/, "") : "0",
  );
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [restoredDraft, setRestoredDraft] = useState(false);
  // Set once a save lands, so "changed since the last save" stays honest in the
  // window before router.refresh() brings the new server props back down.
  const [savedSignature, setSavedSignature] = useState<string | null>(null);

  const MAX_PHOTOS = 5;

  // Every message carries an id so the same text saved twice still re-enters -
  // a "Saved." that never moves cannot be told apart from a stale one.
  const messageId = useRef(0);
  function announce(kind: Message["kind"], text: string) {
    messageId.current += 1;
    setMessage({ kind, text, id: messageId.current });
  }

  const values = useMemo<Draft>(
    () => ({
      title,
      description,
      address,
      images,
      tagSlugs: tags.map((t) => t.slug),
      category,
      startsAt,
      durationMinutes,
      capacity,
      price,
    }),
    [
      title,
      description,
      address,
      images,
      tags,
      category,
      startsAt,
      durationMinutes,
      capacity,
      price,
    ],
  );
  const initialValues = useMemo<Draft>(
    () => ({
      title: initialTitle,
      description: initialDescription,
      address: initialAddress,
      images: initialImages,
      tagSlugs: initialTags.map((t) => t.slug),
      category: initialCategory,
      startsAt: initialStartsAt,
      durationMinutes: nearestDurationValue(initialDurationMinutes),
      capacity: String(initialCapacity),
      price:
        initialPriceCents > 0
          ? (initialPriceCents / 100).toFixed(2).replace(/\.00$/, "")
          : "0",
    }),
    [
      initialTitle,
      initialDescription,
      initialAddress,
      initialImages,
      initialTags,
      initialCategory,
      initialStartsAt,
      initialDurationMinutes,
      initialCapacity,
      initialPriceCents,
    ],
  );
  const signature = useMemo(() => JSON.stringify(values), [values]);
  const initialSignature = useMemo(() => JSON.stringify(initialValues), [initialValues]);
  const dirty = signature !== (savedSignature ?? initialSignature);

  // A draft only stores tag SLUGS, so labels are rehydrated from the options the
  // server sent. initialTags is folded in too: a tag can be on this event
  // without being in the pickable list.
  const tagBySlug = useMemo(() => {
    const map = new Map<string, Tag>();
    for (const tag of tagOptions) map.set(tag.slug, tag);
    for (const tag of initialTags) map.set(tag.slug, tag);
    return map;
  }, [tagOptions, initialTags]);

  // Rewriting a long description and then losing it to a stray tap is the most
  // expensive thing that can happen on this surface. The hook does the read in
  // an effect (never a useState initializer) so the first client render still
  // matches the server's.
  const { clear: clearDraft } = useFormDraft<Draft>({
    key: `click:merchant-event-edit:${eventSlug}`,
    version: DRAFT_VERSION,
    values,
    apply: (saved) => {
      setTitle(saved.title);
      setDescription(saved.description);
      setAddress(saved.address);
      setImages(saved.images);
      setTags(saved.tagSlugs.flatMap((slug) => tagBySlug.get(slug) ?? []));
      // Only restore the terms into fields that are actually on screen. A draft
      // taken while the event was still editable must not silently reappear in
      // state after it went live.
      if (termsEditable) {
        setCategory(saved.category);
        setStartsAt(saved.startsAt);
        setDurationMinutes(saved.durationMinutes);
        setCapacity(saved.capacity);
        setPrice(saved.price);
      }
      // Only surface the restore when the draft actually differs from what the
      // server just sent. A draft written from untouched fields is not work
      // anyone needs told about, and opening the panel over it would be noise.
      if (JSON.stringify(saved) !== initialSignature) {
        setOpen(true);
        setRestoredDraft(true);
      }
    },
  });

  const { pendingHref, confirm: leavePage, cancel: keepEditing } = useUnsavedGuard(dirty);

  useEffect(() => {
    function openFromHash() {
      if (window.location.hash === `#${MERCHANT_EVENT_EDIT_SECTION_ID}`) setOpen(true);
    }
    // Read in an effect, not during render: window.location does not exist on
    // the server and the two renders have to agree.
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setMessage(null);
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
        const uploadedUrl = payload.url;
        if (!res.ok || !uploadedUrl) {
          setUploadError(payload.error ?? "Upload failed.");
          break;
        }
        setImages((prev) => (prev.length < MAX_PHOTOS ? [...prev, uploadedUrl] : prev));
      }
    } catch {
      // Same hole the save path had: a rejected fetch skipped every message and
      // landed in finally, so the tray just stopped saying "Uploading...".
      setUploadError("Could not upload that photo. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    setMessage(null);
    setImages((prev) => prev.filter((u) => u !== url));

    // Photos upload the instant they are picked, so a photo added and then
    // removed before saving used to leave an object nothing would ever
    // reference again. Reclaim exactly those: a URL that was NOT in the images
    // the server handed us on mount is new to this editing session, so no event
    // points at it. A photo that arrived with the event only leaves the array -
    // the merchant may still abandon the edit, and the live event would then be
    // pointing at a deleted object. (The route re-checks both facts itself; the
    // save that follows is what actually drops the photo from the event.)
    if (initialImages.includes(url)) return;
    // Fire-and-forget on purpose: a failed cleanup leaves one orphaned object,
    // which is the situation we already lived with, whereas surfacing it here
    // would put a scary message on a plain, reversible "remove this photo".
    void fetch("/api/upload/event-image", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => {});
  }

  const selectedSlugs = useMemo(() => new Set(tags.map((t) => t.slug)), [tags]);
  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tagOptions
      .filter((o) => !selectedSlugs.has(o.slug))
      .filter((o) => !q || o.label.toLowerCase().includes(q))
      .slice(0, 24);
  }, [tagOptions, selectedSlugs, query]);

  function addTag(tag: Tag) {
    setMessage(null);
    setTags((prev) => (prev.some((t) => t.slug === tag.slug) ? prev : [...prev, tag]));
    setQuery("");
  }
  function removeTag(slug: string) {
    setMessage(null);
    setTags((prev) => prev.filter((t) => t.slug !== slug));
  }

  const titleError = title.trim() === "" ? "Give the event a title." : undefined;

  /* The terms fields need the same guard the create wizard puts on them, and for
     the same reason - they are the only two values here that go through
     Number.parse* with a `|| 0` fallback, so a cleared or half-typed field
     becomes a number nobody typed.

     Capacity is the one that reported a lie: an empty box parsed to 0, and
     updateMerchantEventDetails only applies a capacity when `input.capacity > 0`
     (event-repository.ts), so the write was a no-op, the response was ok, and
     the panel said "Saved." while the seat count sat unchanged. Price has the
     opposite failure - `priceCents >= 0` means a malformed value really does
     land - so it gets the create wizard's rule verbatim, empty still meaning
     free the way the hint under the field says it does.

     Only while termsEditable: these fields are neither rendered nor sent
     otherwise, so validating them would block a title fix on a live event. */
  const capacityError =
    termsEditable &&
    (!CAPACITY_PATTERN.test(capacity.trim()) || Number.parseInt(capacity, 10) < 1)
      ? "Capacity must be a whole number of seats, e.g. 12."
      : undefined;
  const priceError =
    termsEditable && price.trim() && !PRICE_PATTERN.test(price.trim())
      ? "Price must be a dollar amount, e.g. 12.50. Enter 0 for a free event."
      : undefined;
  const termsError = capacityError ?? priceError;

  // aria-disabled, not `disabled`: the reasons live in save() below, and a real
  // disabled attribute both hides them and blurs a focused button.
  const blocked =
    saving || uploading || Boolean(titleError) || Boolean(termsError) || !dirty;

  async function save() {
    // The double-submit guard the missing `disabled` would have given us.
    if (saving) return;
    if (titleError) {
      announce("error", titleError);
      return;
    }
    if (termsError) {
      announce("error", termsError);
      return;
    }
    if (uploading) {
      announce("note", "A photo is still uploading - save once it lands.");
      return;
    }
    if (!dirty) {
      announce("note", "Nothing has changed yet.");
      return;
    }

    const sentSignature = signature;
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
            // Sent only when the fields were on screen. Omitting them leaves
            // every term as-is server-side, so a published or booked event
            // cannot be repriced or moved by a stale tab.
            ...(termsEditable
              ? {
                  category,
                  startsAt,
                  durationMinutes: Number.parseInt(durationMinutes, 10) || 120,
                  capacity: Number.parseInt(capacity, 10) || 0,
                  priceCents: Math.round((Number.parseFloat(price) || 0) * 100),
                }
              : {}),
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        event?: { pendingAddress?: string | null; address?: string | null };
      } | null;
      if (!response.ok || !payload) {
        announce("error", payload?.error ?? "Could not save changes.");
        return;
      }
      // If the address edit got parked for review, the saved event still shows
      // the OLD address with the new one pending - tell the merchant so they
      // don't think the change silently failed.
      const queuedForReview =
        payload.event?.pendingAddress != null &&
        payload.event.pendingAddress === address.trim() &&
        address.trim() !== initialAddress.trim();
      // Only on the success branch: clearing earlier would throw the draft away
      // while the write could still fail.
      setSavedSignature(sentSignature);
      setRestoredDraft(false);
      clearDraft();
      announce(
        "ok",
        queuedForReview
          ? "Saved. Your address change was sent to admins for review (it affects people who've booked)."
          : "Saved.",
      );
      router.refresh();
    } catch {
      // try/finally with no catch used to send a failed save straight past every
      // message to the finally, so the button simply re-enabled and the merchant
      // could not tell a dropped connection from a successful write.
      announce(
        "error",
        "Could not reach the server, so nothing was saved. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      id={MERCHANT_EVENT_EDIT_SECTION_ID}
      className="mt-10 scroll-mt-8 rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Edit event</p>
          <p className="mt-1 text-sm font-medium text-[color:var(--slate)]">
            {termsEditable
              ? "Update the title, description, date, seats, price, street address, photos and interest tags."
              : "Update the title, description, street address, photos and interest tags."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`${MERCHANT_EVENT_EDIT_SECTION_ID}-panel`}
          className="ck-btn ck-btn--secondary ck-btn--sm"
        >
          {open ? "Close" : "Edit details"}
        </button>
      </div>

      {open ? (
        <div
          id={`${MERCHANT_EVENT_EDIT_SECTION_ID}-panel`}
          className="rise-soft mt-5 space-y-5"
        >
          {restoredDraft ? (
            <p
              role="status"
              className="rounded-xl bg-[color:var(--lav-bg)] px-3 py-2 text-xs font-semibold text-[color:var(--purple-700)]"
            >
              Picked up where you left off. These edits are not saved yet.
            </p>
          ) : null}

          <div className="rise-soft rise-d1">
            <FormField
              label="Title"
              required
              value={title}
              error={titleError}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setMessage(null);
                setTitle(e.target.value);
              }}
            />
          </div>

          <div className="rise-soft rise-d2">
            <FormField
              as="textarea"
              label="Description"
              rows={5}
              value={description}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                setMessage(null);
                setDescription(e.target.value);
              }}
            />
          </div>

          {termsEditable ? (
            /* The terms of the event. Only rendered while nobody can be hurt by
               a change - the event is not publicly listed and holds no seats -
               which is exactly the state a REJECTED event is in.
               Before this, a host rejected for the wrong category, a price that
               did not match the listing, or a capacity the venue cannot hold
               could edit the title, the description, the tags, the address and
               the photos, and none of those are usually why an event is
               rejected. The fix loop ended at an email to support. */
            <div className="rise-soft rise-d3 space-y-4 rounded-2xl bg-[color:var(--lav-bg)] p-4">
              <div>
                <p className="text-[13px] font-semibold text-[color:var(--ink)]">
                  Date, seats and price
                </p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-[color:var(--slate)]">
                  Editable while this event is not on Discover and nobody holds a
                  seat. Once it is live or someone has booked, these lock - they
                  are the terms people booked against.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  as="select"
                  label="Category"
                  value={category}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    setMessage(null);
                    setCategory(e.target.value);
                  }}
                >
                  {categoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </FormField>
                <FormField
                  label="Starts"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setMessage(null);
                    setStartsAt(e.target.value);
                  }}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <FormField
                  as="select"
                  label="Runs for"
                  value={durationMinutes}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    setMessage(null);
                    setDurationMinutes(e.target.value);
                  }}
                >
                  {DURATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FormField>
                <FormField
                  label="Capacity"
                  type="text"
                  inputMode="numeric"
                  value={capacity}
                  hint="Total seats."
                  error={capacityError}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setMessage(null);
                    setCapacity(sanitizeAmount(e.target.value, 2));
                  }}
                />
                <FormField
                  label="Price per person"
                  type="text"
                  inputMode="decimal"
                  value={price}
                  hint="What ONE guest pays. 0 for free."
                  error={priceError}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setMessage(null);
                    setPrice(sanitizeAmount(e.target.value, 6));
                  }}
                />
              </div>
            </div>
          ) : (
            /* This note used to render UNCONDITIONALLY, a few hundred pixels
               below the price, date and capacity fields it was telling the host
               they could not change - so on a rejected event it contradicted the
               three inputs sitting right there and sent a host emailing support
               for an edit they could have made themselves. It is the explanation
               for those fields being ABSENT, so it belongs here - the one branch
               where they are not on screen. */
            <p className="rise-soft rise-d3 rounded-xl border border-dashed border-[color:var(--mist-strong)] bg-[color:var(--champagne)] p-3 text-xs leading-5 text-[color:var(--slate)]">
              {eventCancelled ? (
                <>
                  This event is cancelled, so its date, seats and price are fixed
                  - a cancelled event stays cancelled. To run the night again,
                  tap &ldquo;Duplicate event&rdquo; at the top of this page: it
                  opens the create wizard with every detail already filled in, so
                  you only pick a new date and submit.
                </>
              ) : (
                <>
                  The price, date/time and capacity are the terms people booked
                  against, so they are fixed once this event is live or somebody
                  holds a seat. Email {SUPPORT_EMAIL_DEFAULT} to request a change.
                </>
              )}
            </p>
          )}

          <div className="rise-soft rise-d3">
            <FormField
              label="Street address"
              value={address}
              placeholder="Unit 6/29 Bridge Rd, Stanmore NSW 2048"
              hint={
                <>
                  Shown to confirmed attendees on the event page.
                  {addressNeedsReview
                    ? " This event is already live, so an address change goes to admin review before it appears."
                    : ""}
                </>
              }
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setMessage(null);
                setAddress(e.target.value);
              }}
            />
            {pendingAddress ? (
              /* The banner used to stop at "pending review", which reads as a
                 dead end - the host has no withdraw control, so it looked like
                 the change was stuck until an admin happened to look. It is not:
                 updateMerchantEventDetails writes pending_address = the newly
                 submitted value, so editing again REPLACES what is queued. Say
                 that, and name support for the one case the host genuinely
                 cannot do alone (calling the change off entirely). */
              <p className="mt-2 rounded-xl bg-[color:var(--lavender-100)] px-3 py-2 text-xs font-medium text-[color:var(--purple-700)]">
                Pending admin review: <span className="italic">{pendingAddress}</span>. The
                current address stays live until it&apos;s approved. Editing this
                field again replaces what&apos;s queued - to call the change off
                entirely, email {SUPPORT_EMAIL_DEFAULT}.
              </p>
            ) : null}
          </div>

          <div>
            <span className={GROUP_LABEL_CLASS}>
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
                  {/* size-8 (32px) box around a size-6 painted face: the chip
                      looks the same, the tappable area grows. A 24px
                      DESTRUCTIVE target overlapping the next thumbnail is a
                      deleted photo one mis-tap away, and unlike the create
                      wizard's tiles this one removes an image from an event
                      that may already be published. */}
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    aria-label={`Remove photo ${idx + 1}`}
                    className="absolute -right-2.5 -top-2.5 grid size-8 place-items-center rounded-lg text-xs font-semibold text-[color:var(--slate)] hover:text-[color:var(--danger)]"
                  >
                    <span
                      aria-hidden
                      className="grid size-6 place-items-center rounded-lg border border-[color:var(--mist)] bg-[color:var(--paper)] shadow-[var(--shadow-xs)]"
                    >
                      ×
                    </span>
                  </button>
                </li>
              ))}
              {images.length < MAX_PHOTOS ? (
                <li>
                  <label
                    aria-busy={uploading || undefined}
                    className={`grid size-20 cursor-pointer place-items-center rounded-xl border border-dashed border-[color:var(--mist-strong)] bg-[color:var(--paper)] text-center text-xs font-semibold text-[color:var(--slate)] hover:bg-[color:var(--lavender-100)] ${
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
              <p role="alert" className="mt-2 text-xs font-semibold text-[color:var(--danger)]">
                {uploadError}
              </p>
            ) : null}
          </div>

          <div>
            <span className={GROUP_LABEL_CLASS}>Interest tags</span>
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
              aria-label="Search interest tags to add"
              placeholder="Search tags to add…"
              className="ck-input mt-1.5 w-full"
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

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              aria-busy={saving || undefined}
              aria-disabled={blocked || undefined}
              className={`ck-btn ck-btn--primary ck-btn--md ${blocked ? "opacity-60" : ""}`}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {message ? (
              <span
                // Keyed on the message id so a second save visibly re-enters
                // rather than leaving the previous line sitting there.
                key={message.id}
                role={message.kind === "error" ? "alert" : "status"}
                className={`rise-soft text-sm font-medium ${
                  message.kind === "error"
                    ? "text-[color:var(--danger)]"
                    : message.kind === "note"
                      ? "text-[color:var(--slate)]"
                      : "text-[color:var(--ink)]"
                }`}
              >
                {message.text}
              </span>
            ) : dirty ? (
              <span className="text-sm font-medium text-[color:var(--slate)]">
                Unsaved changes.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingHref)}
        tone="rose"
        title="Leave without saving?"
        description="Your edits to this event are still only on this page."
        confirmLabel="Leave without saving"
        cancelLabel="Keep editing"
        onConfirm={leavePage}
        onCancel={keepEditing}
      />
    </section>
  );
}
