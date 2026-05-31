"use client";

/**
 * Profile-edit form (client island).
 *
 * Wraps the `saveProfileEditAction` server action and adds the interactivity
 * the plain server form couldn't do:
 *  - multi-select intents + interest/music tag chips (selections submit as
 *    repeated `intent` / `interest_tag` / `music_tag` fields the action reads
 *    with `getAll`),
 *  - a "type a postcode → pick your suburb" flow backed by
 *    `GET /api/geo/postcode` (the chosen suburb submits as `suburb`),
 *  - the existing avatar uploader.
 *
 * Tag chips submit a fixed slug per option (matching the curated `tags` rows),
 * so the server never has to slugify free text.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AvatarUploader } from "@/components/avatar-uploader";
import { interestTagCategories, musicTags } from "@/lib/click-data";
import type { OwnProfile } from "@/lib/event-repository";

// Local copy so this client bundle never imports src/lib/postcode.ts (which
// pulls in the ~300 KB postcode table — that stays server-side).
const isValidPostcode = (code: string) => /^\d{4}$/.test(code.trim());
import { saveProfileEditAction } from "@/app/profile/edit/actions";

const INTENT_OPTIONS: { value: string; label: string; body: string }[] = [
  { value: "friendship",  label: "Friendship",  body: "Low-pressure plans to make new friends." },
  { value: "dating",      label: "Dating",      body: "Slow dating tables and relationship-minded events." },
  { value: "networking",  label: "Networking",  body: "Career switchers, founders, peer support." },
  { value: "hobbies",     label: "Hobbies",     body: "Find people who share your craft — creative, sport, gaming, books." },
  { value: "wellness",    label: "Wellness",    body: "Slow mornings, mindful movement, sober-friendly nights." },
  { value: "community",   label: "Community",   body: "Local meetups, volunteering, neighbourhood vibes." },
  { value: "new_in_town", label: "New in town", body: "Just relocated — looking to plug into Sydney fast." },
  { value: "exploring",   label: "Exploring",   body: "Just curious — show me a bit of everything." },
];

// Mirrors the slug the DB matcher derives from a label
// (see database/026_curate_interest_tags.sql).
function interestSlug(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function ProfileEditForm({ profile }: { profile: OwnProfile }) {
  const [intents, setIntents] = useState<Set<string>>(new Set(profile.intents));
  const [interests, setInterests] = useState<Set<string>>(new Set(profile.interestSlugs));
  const [music, setMusic] = useState<Set<string>>(new Set(profile.musicSlugs));

  // Suburb is stored as a name; legacy rows (and onboarding) store a 4-digit
  // postcode in the same column. Detect that so the field round-trips sensibly.
  const initialSuburb = profile.suburb ?? "";
  const suburbIsPostcode = isValidPostcode(initialSuburb);
  const [postcode, setPostcode] = useState(suburbIsPostcode ? initialSuburb : "");
  const [suburb, setSuburb] = useState(suburbIsPostcode ? "" : initialSuburb);
  const [suburbOptions, setSuburbOptions] = useState<string[]>(
    suburbIsPostcode || !initialSuburb ? [] : [initialSuburb],
  );
  const [pcStatus, setPcStatus] = useState<"idle" | "loading" | "error">("idle");
  const [pcMessage, setPcMessage] = useState<string | null>(null);

  // Postcode → suburbs lookup. `requested` guards against a stale response
  // overwriting a newer one; `timer` debounces typing.
  const requested = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function resolvePostcode(code: string) {
    try {
      const res = await fetch(`/api/geo/postcode?code=${code}`);
      if (requested.current !== code) return; // superseded
      if (!res.ok) {
        setPcStatus("error");
        setPcMessage(
          res.status === 404
            ? "We don't recognise that postcode — pick the closest suburb below."
            : "Couldn't look that up. Try again.",
        );
        return;
      }
      const data = (await res.json()) as { state: string; suburbs: string[] };
      if (requested.current !== code) return;
      setSuburbOptions(data.suburbs);
      setPcStatus("idle");
      setPcMessage(`${data.suburbs.length > 1 ? "Pick your suburb" : "Suburb"} · ${data.state}`);
      // Default to the first suburb unless the current pick is still valid.
      setSuburb((prev) => (prev && data.suburbs.includes(prev) ? prev : data.suburbs[0] ?? ""));
    } catch {
      if (requested.current !== code) return;
      setPcStatus("error");
      setPcMessage("Couldn't look that up. Check your connection.");
    }
  }

  // Legacy rows store a postcode in the suburb column — resolve it once on
  // mount so the suburb dropdown is populated without the user re-typing. The
  // setState happens inside resolvePostcode (an async fn), not in the effect
  // body, so it doesn't trip the cascading-render lint rule.
  const initRan = useRef(false);
  useEffect(() => {
    if (initRan.current || !suburbIsPostcode) return;
    initRan.current = true;
    requested.current = initialSuburb;
    void resolvePostcode(initialSuburb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePostcodeChange(raw: string) {
    const code = raw.replace(/\D/g, "").slice(0, 4);
    setPostcode(code);
    if (timer.current) clearTimeout(timer.current);

    if (!isValidPostcode(code)) {
      requested.current = "";
      setPcStatus("idle");
      setPcMessage(null);
      return;
    }

    requested.current = code;
    setPcStatus("loading");
    setPcMessage(null);
    timer.current = setTimeout(() => void resolvePostcode(code), 350);
  }

  return (
    <form
      action={saveProfileEditAction}
      className="mt-5 grid gap-6 rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow-sm"
    >
      <AvatarUploader initialUrl={profile.photoUrl} displayName={profile.displayName} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Display name" name="display_name" defaultValue={profile.displayName} required />
        <Field
          label="Age (optional)"
          name="age"
          type="number"
          min={18}
          defaultValue={profile.age?.toString() ?? ""}
        />
      </div>

      {/* ----- Postcode → suburb ----- */}
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-[color:var(--ink)]">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Postcode
          </span>
          <input
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={postcode}
            onChange={(e) => handlePostcodeChange(e.target.value)}
            placeholder="2204"
            className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] placeholder:text-[color:var(--mauve)]/55 outline-none focus:bg-[color:var(--cream)]"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-[color:var(--ink)]">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Suburb
          </span>
          <select
            name="suburb"
            required
            value={suburb}
            onChange={(e) => setSuburb(e.target.value)}
            className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] outline-none focus:bg-[color:var(--cream)]"
          >
            {suburbOptions.length === 0 ? (
              <option value="" disabled>
                Enter a postcode first
              </option>
            ) : null}
            {/* Keep whatever was saved selectable even if it's off the list. */}
            {suburb && !suburbOptions.includes(suburb) ? (
              <option value={suburb}>{suburb}</option>
            ) : null}
            {suburbOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      {pcMessage ? (
        <p
          className={`-mt-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] ${
            pcStatus === "error" ? "text-[color:var(--rose)]" : "text-[color:var(--mauve)]"
          }`}
        >
          {pcStatus === "loading" ? "Looking up…" : pcMessage}
        </p>
      ) : null}

      {/* ----- Bio ----- */}
      <label className="grid gap-2 text-sm font-bold text-[color:var(--ink)]">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          Bio
        </span>
        <textarea
          name="bio"
          rows={4}
          defaultValue={profile.bio ?? ""}
          className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] outline-none focus:bg-[color:var(--cream)]"
          placeholder="A short, friendly intro — what you’re into, what you’re here for."
        />
      </label>

      {/* ----- Intents ----- */}
      <Fieldset legend="Intents (pick any)">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {INTENT_OPTIONS.map((opt) => {
            const checked = intents.has(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setIntents((s) => toggle(s, opt.value))}
                aria-pressed={checked}
                className={`rounded-2xl border-2 p-4 text-left transition hard-shadow-sm active:scale-[0.98] ${
                  checked
                    ? "border-[color:var(--rose)] bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                    : "border-[color:var(--line)] bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                }`}
              >
                <span className="block text-sm font-bold uppercase tracking-wide">{opt.label}</span>
                <span className="mt-1 block text-xs font-semibold leading-5 opacity-80">{opt.body}</span>
              </button>
            );
          })}
        </div>
        {[...intents].map((value) => (
          <input key={value} type="hidden" name="intent" value={value} />
        ))}
      </Fieldset>

      {/* ----- Interest tags ----- */}
      <Fieldset
        legend="Interest tags"
        hint="Shape your recommendations — pick the activities you're into."
      >
        <div className="grid gap-4">
          {interestTagCategories.map(([category, ...tagList]) => (
            <div key={category} className="grid gap-2">
              <span className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                {category}
              </span>
              <div className="flex flex-wrap gap-2">
                {tagList.map((label) => {
                  const slug = interestSlug(label);
                  return (
                    <Chip
                      key={slug}
                      label={label}
                      selected={interests.has(slug)}
                      onClick={() => setInterests((s) => toggle(s, slug))}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {[...interests].map((slug) => (
          <input key={slug} type="hidden" name="interest_tag" value={slug} />
        ))}
      </Fieldset>

      {/* ----- Music tags ----- */}
      <Fieldset legend="Music tags" hint="Music taste is used as a subtle matching signal.">
        <div className="flex flex-wrap gap-2">
          {musicTags.map((tag) => (
            <Chip
              key={tag.slug}
              label={tag.label}
              selected={music.has(tag.slug)}
              onClick={() => setMusic((s) => toggle(s, tag.slug))}
            />
          ))}
        </div>
        {[...music].map((slug) => (
          <input key={slug} type="hidden" name="music_tag" value={slug} />
        ))}
      </Fieldset>

      {/* ----- Click quiz ----- */}
      <Fieldset legend="Click quiz">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--champagne)] p-5">
          <p className="max-w-md text-sm font-semibold leading-6 text-[color:var(--mauve)]">
            The Life Quiz tunes your matches — life stage, social energy, availability, and mood.
            Takes about two minutes.
          </p>
          <Link
            href="/quiz/life"
            className="shrink-0 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
          >
            Take the Life Quiz
          </Link>
        </div>
      </Fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Link
          href="/profile"
          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
        >
          Save profile
        </button>
      </div>
    </form>
  );
}

function Fieldset({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {legend}
      </legend>
      {hint ? (
        <p className="-mt-1 text-xs font-semibold text-[color:var(--mauve)]">{hint}</p>
      ) : null}
      {children}
    </fieldset>
  );
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full border-2 px-4 py-2 text-sm font-bold transition active:scale-[0.97] ${
        selected
          ? "border-[color:var(--rose)] bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
          : "border-[color:var(--line)] bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
      }`}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  min,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  min?: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[color:var(--ink)]">
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={min}
        className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] placeholder:text-[color:var(--mauve)]/55 outline-none focus:bg-[color:var(--cream)]"
      />
    </label>
  );
}
