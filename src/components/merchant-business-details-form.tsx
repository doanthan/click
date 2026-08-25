"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ds";

// Merchant self-service for the details a host can safely change after they are
// approved: how we and their guests reach them, and the street they are on.
//
// The Settings tab used to be entirely read-only and told every host to email
// support to change ANYTHING - including a phone number that had simply
// changed. That put a same-day support obligation on the most routine edit in
// the product.
//
// Business name, trading name, ABN and the venue's state/postcode are NOT here,
// and that is the point: they are what an admin verified at approval, and the
// state/postcode decide whether the venue is inside the launch pilot. Those
// still go through support, and the note under the form says so plainly rather
// than implying the whole profile is locked.

type Socials = Partial<Record<"instagram" | "tiktok" | "facebook" | "youtube" | "x", string>>;

const SOCIAL_FIELDS: Array<{ key: keyof Socials; label: string; placeholder: string }> = [
  { key: "instagram", label: "Instagram", placeholder: "@yourvenue" },
  { key: "tiktok", label: "TikTok", placeholder: "@yourvenue" },
  { key: "facebook", label: "Facebook", placeholder: "facebook.com/yourvenue" },
];

export function MerchantBusinessDetailsForm({
  initialContactEmail,
  initialPhone,
  initialWebsiteUrl,
  initialAddressStreet,
  initialSocials,
  suburbLine,
}: {
  initialContactEmail: string;
  initialPhone: string;
  initialWebsiteUrl: string;
  initialAddressStreet: string;
  initialSocials: Socials;
  /** "Newtown NSW 2042" - shown read-only beside the editable street. */
  suburbLine: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [contactEmail, setContactEmail] = useState(initialContactEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl);
  const [addressStreet, setAddressStreet] = useState(initialAddressStreet);
  const [socials, setSocials] = useState<Socials>(initialSocials);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null,
  );

  const signature = useMemo(
    () => JSON.stringify({ contactEmail, phone, websiteUrl, addressStreet, socials }),
    [contactEmail, phone, websiteUrl, addressStreet, socials],
  );
  const initialSignature = useMemo(
    () =>
      JSON.stringify({
        contactEmail: initialContactEmail,
        phone: initialPhone,
        websiteUrl: initialWebsiteUrl,
        addressStreet: initialAddressStreet,
        socials: initialSocials,
      }),
    [
      initialContactEmail,
      initialPhone,
      initialWebsiteUrl,
      initialAddressStreet,
      initialSocials,
    ],
  );
  const dirty = signature !== initialSignature;

  async function save() {
    if (saving) return;
    if (!dirty) {
      setMessage({ kind: "ok", text: "Nothing has changed yet." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/merchant/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactEmail,
          phone,
          websiteUrl,
          addressStreet,
          socials,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok || !payload) {
        // The server returns the SAME messages the signup wizard shows, so a
        // rejected phone number reads identically in both places.
        setMessage({ kind: "error", text: payload?.error ?? "Could not save your details." });
        return;
      }
      setMessage({ kind: "ok", text: "Saved." });
      router.refresh();
    } catch {
      // A rejected fetch (offline, DNS, an aborted navigation) skipped every
      // branch above and left the button stuck on "Saving...".
      setMessage({
        kind: "error",
        text: "Could not reach the server, so nothing was saved. Check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
        <div>
          <p className="text-sm font-semibold text-[color:var(--ink)]">Contact + venue</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[color:var(--slate)]">
            Where we email you, the number on your listings, and your street.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="merchant-business-details-panel"
          className="ck-btn ck-btn--secondary ck-btn--sm"
        >
          {open ? "Close" : "Edit"}
        </button>
      </div>

      {open ? (
        <div
          id="merchant-business-details-panel"
          className="rise-soft space-y-4 border-t border-[color:var(--mist)] px-4 py-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Contact email"
              type="email"
              autoComplete="email"
              value={contactEmail}
              hint="Where booking and payout notices go."
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setMessage(null);
                setContactEmail(e.target.value);
              }}
            />
            <FormField
              label="Phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              // Same wording the signup wizard uses, so the rule a host
              // learned at signup is the rule they read here.
              hint="Mobile, landline or business line - e.g. 0412 345 678, 02 9646 8888 or 1300 123 456. Spaces, brackets and +61 are fine."
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setMessage(null);
                setPhone(e.target.value);
              }}
            />
          </div>

          <FormField
            label="Website"
            type="url"
            inputMode="url"
            value={websiteUrl}
            placeholder="yourvenue.com.au"
            hint="Optional. Leave it empty to remove the one we have."
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setMessage(null);
              setWebsiteUrl(e.target.value);
            }}
          />

          <FormField
            label="Street address"
            value={addressStreet}
            placeholder="29 Bridge Rd"
            hint={
              <>
                {suburbLine
                  ? `Your suburb and postcode stay as ${suburbLine}. `
                  : ""}
                Moving to a different suburb or state changes which pilot region
                you are in, so that one goes through support.
              </>
            }
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setMessage(null);
              setAddressStreet(e.target.value);
            }}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            {SOCIAL_FIELDS.map((field) => (
              <FormField
                key={field.key}
                label={field.label}
                value={socials[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setMessage(null);
                  setSocials((prev) => ({ ...prev, [field.key]: e.target.value }));
                }}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              // Genuinely must not double-fire, and the label carries the state.
              disabled={saving}
              className="ck-btn ck-btn--primary ck-btn--sm"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {message ? (
              <p
                role={message.kind === "error" ? "alert" : "status"}
                className={`text-xs font-bold ${
                  message.kind === "error"
                    ? "text-[color:var(--danger)]"
                    : "text-[color:var(--purple-700)]"
                }`}
              >
                {message.text}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
