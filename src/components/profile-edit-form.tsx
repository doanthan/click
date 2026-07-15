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
 *
 * Layout follows the DS "Settings / Edit profile" spec: sections separated by
 * whitespace + one hairline, sitting directly on the cream page ground - no
 * outer card, so nothing here is a card inside a card. Interests + music are
 * the neutral→purple-fill `Tag` pill (never the 16 category circles).
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AvatarUploader } from "@/components/avatar-uploader";
import { ProfileGalleryUploader } from "@/components/profile-gallery-uploader";
import { SettingRow, Switch } from "@/components/account-setting-toggle";
import { VerifiedTick } from "@/components/verified-tick";
import { Button, Icon } from "@/components/ds";
import type { OwnProfile, ProfileTagOptions } from "@/lib/event-repository";
import {
  MAX_PROFILE_PROMPTS,
  MAX_PROMPT_ANSWER_LENGTH,
  PROFILE_PROMPTS,
} from "@/lib/profile-prompts";

// Local copy so this client bundle never imports src/lib/postcode.ts (which
// pulls in the ~300 KB postcode table - that stays server-side).
const isValidPostcode = (code: string) => /^\d{4}$/.test(code.trim());
import { saveProfileEditAction } from "@/app/profile/edit/actions";

const INTENT_OPTIONS: { value: string; label: string; body: string }[] = [
  { value: "friendship",  label: "Friendship",  body: "Low-pressure plans to make new friends." },
  { value: "dating",      label: "Dating",      body: "Slow dating tables and relationship-minded events." },
  { value: "networking",  label: "Networking",  body: "Career switchers, founders, peer support." },
  { value: "hobbies",     label: "Hobbies",     body: "People who share your craft - creative, sport, gaming, books." },
  { value: "wellness",    label: "Wellness",    body: "Slow mornings, mindful movement, sober-friendly nights." },
  { value: "community",   label: "Community",   body: "Local meetups, volunteering, neighbourhood things." },
  { value: "new_in_town", label: "New in town", body: "Just landed - keen to plug into Sydney fast." },
  { value: "exploring",   label: "Exploring",   body: "Curious - show me a bit of everything." },
];

const FIELD =
  "w-full rounded-[12px] border border-[color:var(--mist-strong)] bg-[color:var(--paper)] px-3.5 text-[15.5px] text-[color:var(--ink)] outline-none placeholder:text-[color:var(--ink-faint)] focus-visible:border-[color:var(--purple)]";
const INPUT = `${FIELD} h-12`;

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function ProfileEditForm({
  profile,
  tagOptions,
}: {
  profile: OwnProfile;
  tagOptions: ProfileTagOptions;
}) {
  const [intents, setIntents] = useState<Set<string>>(new Set(profile.intents));
  const [interests, setInterests] = useState<Set<string>>(new Set(profile.interestSlugs));
  const [music, setMusic] = useState<Set<string>>(new Set(profile.musicSlugs));
  const [datingVisible, setDatingVisible] = useState(profile.datingVisible);
  const [flexibleDiscovery, setFlexibleDiscovery] = useState(profile.flexibleDiscovery);
  const [prompts, setPrompts] = useState<{ id: string; answer: string }[]>(
    profile.prompts.map((p) => ({ id: p.id, answer: p.answer })),
  );

  const datingSelected = intents.has("dating");

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
            ? "We don't recognise that postcode - pick the closest suburb below."
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

  // Legacy rows store a postcode in the suburb column - resolve it once on
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
    <form action={saveProfileEditAction} className="mt-2">
      {/* ----- Photos ----- */}
      <Group>
        <AvatarUploader initialUrl={profile.photoUrl} displayName={profile.displayName} />
        <p className="mt-4 max-w-[520px] text-[13px] leading-[1.55] text-[color:var(--slate)]">
          A real, clear photo of your face works best - it helps the people you meet recognise you
          when you get there.
        </p>

        {profile.verified ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-[12px] bg-[color:var(--lavender-100)] px-3.5 py-2.5 text-[13px] font-medium leading-5 text-[color:var(--ink)]">
            <VerifiedTick /> Your profile is verified - the tick shows next to your name across
            Click.
          </p>
        ) : (
          <p className="mt-3 max-w-[520px] text-[13px] leading-[1.55] text-[color:var(--slate)]">
            Photo verification is coming soon - once Click confirms the photo is really you, a
            verified tick shows next to your name.
          </p>
        )}

        <div className="mt-7">
          <ProfileGalleryUploader initialUrls={profile.galleryPhotos} />
        </div>
      </Group>

      {/* ----- About you ----- */}
      <Group>
        <SectionHead>About you</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Display name">
            <input
              name="display_name"
              defaultValue={profile.displayName}
              required
              className={INPUT}
            />
          </FieldRow>
          <FieldRow label="Age" note="Optional - shown next to your name.">
            <input
              name="age"
              type="number"
              min={18}
              defaultValue={profile.age?.toString() ?? ""}
              className={INPUT}
            />
          </FieldRow>
        </div>

        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <FieldRow
            label="Postcode"
            note={
              pcMessage ? (
                <span className={pcStatus === "error" ? "text-[color:var(--danger)]" : undefined}>
                  {pcStatus === "loading" ? "Looking up…" : pcMessage}
                </span>
              ) : null
            }
          >
            <input
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={postcode}
              onChange={(e) => handlePostcodeChange(e.target.value)}
              placeholder="2204"
              className={INPUT}
            />
          </FieldRow>

          <FieldRow label="Suburb">
            <select
              name="suburb"
              required
              value={suburb}
              onChange={(e) => setSuburb(e.target.value)}
              className={INPUT}
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
          </FieldRow>
        </div>
      </Group>

      {/* ----- Bio ----- */}
      <Group>
        <SectionHead sub="A line or two in your own words - e.g. potter by hobby, gig-goer by habit.">
          Bio
        </SectionHead>
        <textarea
          name="bio"
          rows={4}
          defaultValue={profile.bio ?? ""}
          placeholder="What you're into, and what you're here for."
          className={`${FIELD} resize-y py-3 leading-[1.55]`}
        />
      </Group>

      {/* ----- Prompts ----- */}
      <Group>
        <SectionHead sub="Show some personality - answer one or three. They show on your profile.">
          Prompts · optional, up to {MAX_PROFILE_PROMPTS}
        </SectionHead>
        <div className="grid gap-3">
          {prompts.map((entry, index) => {
            const usedElsewhere = new Set(
              prompts.filter((_, i) => i !== index).map((p) => p.id),
            );
            return (
              <div key={entry.id} className="grid gap-2">
                <div className="flex items-center gap-2">
                  <select
                    value={entry.id}
                    onChange={(e) =>
                      setPrompts((list) =>
                        list.map((p, i) => (i === index ? { ...p, id: e.target.value } : p)),
                      )
                    }
                    className={`min-w-0 flex-1 ${FIELD} h-11 text-[14px] font-semibold`}
                  >
                    {PROFILE_PROMPTS.filter((p) => !usedElsewhere.has(p.id)).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}…
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setPrompts((list) => list.filter((_, i) => i !== index))}
                    aria-label="Remove prompt"
                    className="grid size-9 shrink-0 place-items-center rounded-[10px] text-[color:var(--slate)] transition-colors hover:bg-[color:var(--lavender-100)] hover:text-[color:var(--ink)]"
                  >
                    <Icon name="x" size={16} stroke={2.2} />
                  </button>
                </div>
                <textarea
                  value={entry.answer}
                  onChange={(e) =>
                    setPrompts((list) =>
                      list.map((p, i) => (i === index ? { ...p, answer: e.target.value } : p)),
                    )
                  }
                  rows={2}
                  maxLength={MAX_PROMPT_ANSWER_LENGTH}
                  placeholder="Your answer…"
                  className={`${FIELD} resize-y py-2.5 text-[14.5px] leading-[1.5]`}
                />
                <span className="text-right text-[11.5px] text-[color:var(--ink-faint)]">
                  {entry.answer.length}/{MAX_PROMPT_ANSWER_LENGTH}
                </span>
              </div>
            );
          })}

          {prompts.length < MAX_PROFILE_PROMPTS ? (
            <button
              type="button"
              onClick={() => {
                const used = new Set(prompts.map((p) => p.id));
                const next = PROFILE_PROMPTS.find((p) => !used.has(p.id));
                if (next) setPrompts((list) => [...list, { id: next.id, answer: "" }]);
              }}
              className="font-display inline-flex w-fit items-center gap-1.5 rounded-[12px] px-1 py-1 text-[13.5px] font-semibold text-[color:var(--purple)] hover:underline"
            >
              <Icon name="plus" size={15} stroke={2.2} />
              Add a prompt
            </button>
          ) : null}
        </div>
        {/* Unanswered prompts are dropped server-side, so a blank slot never saves. */}
        <input type="hidden" name="prompts_json" value={JSON.stringify(prompts)} />
      </Group>

      {/* ----- Here for (intents) ----- */}
      <Group>
        <SectionHead sub="Pick any that fit - it just tunes what we show you.">Here for</SectionHead>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {INTENT_OPTIONS.map((opt) => (
            <IntentCard
              key={opt.value}
              label={opt.label}
              body={opt.body}
              on={intents.has(opt.value)}
              onClick={() => setIntents((s) => toggle(s, opt.value))}
            />
          ))}
        </div>
        {[...intents].map((value) => (
          <input key={value} type="hidden" name="intent" value={value} />
        ))}

        {/* Dating mode sits inline with the intent that reveals it. */}
        {datingSelected ? (
          <div className="mt-3.5 rounded-[16px] border border-[color:var(--lavender-200)] bg-[color:var(--lavender-100)] px-4 py-3.5">
            <button
              type="button"
              role="switch"
              aria-checked={datingVisible}
              onClick={() => setDatingVisible((v) => !v)}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <span className="min-w-0">
                <span className="block text-[14.5px] font-semibold text-[color:var(--ink)]">
                  Dating mode {datingVisible ? "· On" : "· Paused"}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-[1.5] text-[color:var(--slate)]">
                  Only people also open to dating ever see this.
                </span>
              </span>
              <Switch on={datingVisible} />
            </button>
          </div>
        ) : null}
        {/* Always submit current state so it round-trips even while the dating
            toggle is hidden (no dating intent selected). */}
        <input type="hidden" name="dating_visible" value={datingVisible ? "true" : "false"} />
      </Group>

      {/* ----- Discovery ----- */}
      <Group>
        <SectionHead sub="How broad your event suggestions are.">Discovery</SectionHead>
        <SettingRow
          label="Flexible discovery"
          description="Show me events across intents - e.g. friendship-tagged events even when dating is my main intent."
          on={flexibleDiscovery}
          onToggle={() => setFlexibleDiscovery((v) => !v)}
        />
        <input
          type="hidden"
          name="flexible_discovery"
          value={flexibleDiscovery ? "true" : "false"}
        />
      </Group>

      {/* ----- Interest tags ----- */}
      <Group>
        <SectionHead sub="The specific things you're into - not just the broad categories.">
          Interests
        </SectionHead>
        <div className="grid gap-[18px]">
          {tagOptions.interestCategories.map(({ category, tags }) => (
            <div key={category}>
              <p className="mb-2.5 text-[12px] font-semibold tracking-[0.03em] text-[color:var(--slate)]">
                {category}
              </p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <TagButton
                    key={tag.slug}
                    label={tag.label}
                    selected={interests.has(tag.slug)}
                    onClick={() => setInterests((s) => toggle(s, tag.slug))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p
          className={`mt-4 text-[13.5px] font-semibold ${
            interests.size >= 3 ? "text-[color:var(--sage)]" : "text-[color:var(--slate)]"
          }`}
        >
          {interests.size === 0
            ? "Pick a few you're into"
            : `${interests.size} picked${interests.size >= 3 ? " - nice" : ""}`}
        </p>
        {[...interests].map((slug) => (
          <input key={slug} type="hidden" name="interest_tag" value={slug} />
        ))}
      </Group>

      {/* ----- Music tags ----- */}
      <Group>
        <SectionHead sub="A few genres, if you like - optional.">Music you&apos;re into</SectionHead>
        <div className="flex flex-wrap gap-2">
          {tagOptions.musicTags.map((tag) => (
            <TagButton
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
      </Group>

      {/* ----- Click quiz ----- */}
      <Group last>
        <Link
          href="/quiz/life"
          className="flex w-full items-center gap-3.5 rounded-[16px] bg-[color:var(--paper)] px-4 py-4 shadow-[var(--shadow-sm)] transition-colors hover:bg-[color:var(--lavender-100)]"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[color:var(--lavender-100)] text-[color:var(--purple)]">
            <Icon name="compass" size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-[color:var(--ink)]">
              {profile.lifeQuizCompleted ? "Update your Click quiz" : "Take the Click quiz"}
            </span>
            <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-[color:var(--slate)]">
              {profile.lifeQuizCompleted
                ? "Life stage, energy, availability - it keeps your suggestions sharp."
                : "It makes your suggestions a lot more relevant. About two minutes."}
            </span>
          </span>
          <Icon name="chevR" size={18} className="text-[color:var(--ink-faint)]" />
        </Link>
      </Group>

      {/* Sticky save bar so "Save changes" is always reachable without scrolling
          to the very bottom of this long form (bug board #219). */}
      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-[color:var(--mist)] bg-[color:var(--champagne)] py-4">
        <Link
          href="/profile"
          className="font-display px-2 text-[14px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)]"
        >
          Cancel
        </Link>
        <Button type="submit">Save changes</Button>
      </div>
    </form>
  );
}

/* Sections are separated by whitespace + ONE hairline - never boxed into cards. */
function Group({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`py-7 ${last ? "" : "border-b border-[color:var(--mist)]"}`}>{children}</div>
  );
}

function SectionHead({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-3.5">
      <h2 className="eyebrow">{children}</h2>
      {sub ? (
        <p className="mt-1.5 text-[13px] leading-[1.5] text-[color:var(--slate)]">{sub}</p>
      ) : null}
    </div>
  );
}

function FieldRow({
  label,
  note,
  children,
}: {
  label: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-[7px] block text-[13.5px] font-semibold text-[color:var(--ink)]">
        {label}
      </span>
      {children}
      {note ? (
        <span className="mt-1.5 block text-[12px] text-[color:var(--slate)]">{note}</span>
      ) : null}
    </label>
  );
}

/* Selected = lavender wash + a purple check disc. Selection is always purple,
   never a status colour. Radius 12, never a pill (pills are the tags). */
function IntentCard({
  label,
  body,
  on,
  onClick,
}: {
  label: string;
  body: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-start justify-between gap-2.5 rounded-[12px] border px-4 py-3.5 text-left transition-colors ${
        on
          ? "border-[color:var(--purple-500)] bg-[color:var(--lavender-100)]"
          : "border-[color:var(--mist-strong)] bg-[color:var(--paper)] hover:border-[color:var(--slate)]"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold text-[color:var(--ink)]">{label}</span>
        <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-[color:var(--slate)]">
          {body}
        </span>
      </span>
      <span
        aria-hidden
        className={`mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full bg-[color:var(--purple)] text-[color:var(--champagne)] transition ${
          on ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      >
        <Icon name="check" size={13} stroke={3} />
      </span>
    </button>
  );
}

/* The DS `Tag` pill, made pressable. `.ck-tag--select` carries the hover/focus
   states; `.ck-tag--selected` is the Deep-Purple fill (the fill IS the signal -
   no tick). Status colour never lands on a tag. */
function TagButton({
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
      className={`ck-tag ck-tag--select ${selected ? "ck-tag--selected" : ""}`}
    >
      {label}
    </button>
  );
}
