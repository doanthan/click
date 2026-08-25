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
 * This is the longest form in the app (nine sections, ~80 controls), so it also
 * carries the three safety nets a form that size needs: a localStorage draft, a
 * leave-without-saving guard on both exits, and a sticky bar that says out loud
 * whether anything is unsaved. It stays ONE page on purpose - it is reached from
 * an existing profile, so the dominant journey is "change one thing", and gating
 * that behind steps would tax every common visit to flatter the rare full pass.
 *
 * Layout follows the DS "Settings / Edit profile" spec: sections separated by
 * whitespace + one hairline, sitting directly on the cream page ground - no
 * outer card, so nothing here is a card inside a card. Interests + music are
 * the neutral→purple-fill `Tag` pill (never the 16 category circles).
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AvatarUploader } from "@/components/avatar-uploader";
import { ProfileGalleryUploader } from "@/components/profile-gallery-uploader";
import { SettingRow, Switch } from "@/components/account-setting-toggle";
import { VerifiedTick } from "@/components/verified-tick";
import { Badge, FormField, Icon } from "@/components/ds";
import { SubmitButton } from "@/components/ds-client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Reveal } from "@/components/reveal";
import { useFormDraft } from "@/lib/use-form-draft";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import type { OwnProfile, ProfileCompletion, ProfileTagOptions } from "@/lib/event-repository";
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

type PromptDraft = { id: string; answer: string };

/** Everything the draft carries and everything "is anything unsaved" compares. */
type DraftValues = {
  displayName: string;
  age: string;
  postcode: string;
  suburb: string;
  bio: string;
  intents: string[];
  interests: string[];
  music: string[];
  prompts: PromptDraft[];
  datingVisible: boolean;
  flexibleDiscovery: boolean;
};

/* Suburb is stored as a name; legacy rows (and onboarding, which writes the raw
   postcode into profiles.suburb) put a 4-digit code in the same column. Split it
   so the two controls round-trip either shape. */
function splitSuburb(stored: string | null): { postcode: string; suburb: string } {
  const raw = (stored ?? "").trim();
  return isValidPostcode(raw) ? { postcode: raw, suburb: "" } : { postcode: "", suburb: raw };
}

/* Order-independent so re-picking the same tags in a different order is not an
   edit. `postcode` is deliberately absent: it has no `name`, so it never reaches
   the server and typing one is not by itself an unsaved change. */
function fingerprint(v: DraftValues): string {
  return JSON.stringify([
    v.displayName.trim(),
    v.age.trim(),
    v.suburb.trim(),
    v.bio.trim(),
    [...v.intents].sort(),
    [...v.interests].sort(),
    [...v.music].sort(),
    v.prompts,
    v.datingVisible,
    v.flexibleDiscovery,
  ]);
}

/* djb2. A stable 32-bit stamp of the SERVER values this draft branched from -
   see the useFormDraft call below for why the stamp is the draft's version. */
function stampOf(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return h;
}

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function ProfileEditForm({
  profile,
  tagOptions,
  completion,
}: {
  profile: OwnProfile;
  tagOptions: ProfileTagOptions;
  /** Server-computed checklist from getProfileCompletion - the item set, labels
   *  and weighting stay the repository's; only the four items this form owns get
   *  re-evaluated against live state below. */
  completion: ProfileCompletion;
}) {
  const base = useMemo<DraftValues>(() => {
    const { postcode, suburb } = splitSuburb(profile.suburb);
    return {
      displayName: profile.displayName,
      age: profile.age?.toString() ?? "",
      postcode,
      suburb,
      bio: profile.bio ?? "",
      intents: [...profile.intents],
      interests: [...profile.interestSlugs],
      music: [...profile.musicSlugs],
      prompts: profile.prompts.map((p) => ({ id: p.id, answer: p.answer })),
      datingVisible: profile.datingVisible,
      flexibleDiscovery: profile.flexibleDiscovery,
    };
  }, [profile]);

  const [displayName, setDisplayName] = useState(base.displayName);
  const [age, setAge] = useState(base.age);
  const [bio, setBio] = useState(base.bio);
  const [intents, setIntents] = useState<Set<string>>(new Set(base.intents));
  const [interests, setInterests] = useState<Set<string>>(new Set(base.interests));
  const [music, setMusic] = useState<Set<string>>(new Set(base.music));
  const [datingVisible, setDatingVisible] = useState(base.datingVisible);
  const [flexibleDiscovery, setFlexibleDiscovery] = useState(base.flexibleDiscovery);
  const [prompts, setPrompts] = useState<PromptDraft[]>(base.prompts);

  const datingSelected = intents.has("dating");

  const [postcode, setPostcode] = useState(base.postcode);
  const [suburb, setSuburb] = useState(base.suburb);
  const [suburbOptions, setSuburbOptions] = useState<string[]>(base.suburb ? [base.suburb] : []);
  const [pcStatus, setPcStatus] = useState<"idle" | "loading" | "error">("idle");
  const [pcMessage, setPcMessage] = useState<string | null>(null);

  // The legacy lookup below swaps a stored postcode for a real suburb name. That
  // is the page tidying up after itself, not the user editing, so the baseline
  // moves with it - otherwise someone who has typed nothing would be told they
  // have unsaved changes the moment the page settles.
  const [baselineSuburb, setBaselineSuburb] = useState(base.suburb);

  // Postcode → suburbs lookup. `requested` guards against a stale response
  // overwriting a newer one; `timer` debounces typing.
  const requested = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function resolvePostcode(code: string, rebaseline = false) {
    try {
      const res = await fetch(`/api/geo/postcode?code=${code}`);
      if (requested.current !== code) return; // superseded
      if (!res.ok) {
        // Whatever is still in `suburbOptions` belongs to the PREVIOUS postcode,
        // so a failed lookup used to leave the select showing someone else's
        // suburbs - or nothing at all - under a message telling the person to
        // "pick the closest suburb below". Drop the stale list and say the one
        // thing they can actually act on.
        setSuburbOptions([]);
        setPcStatus("error");
        setPcMessage(
          res.status === 404
            ? "We don't recognise that postcode - check it, or try a nearby one."
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
      // Legacy resolve only: the suburb we just derived IS the saved value in a
      // readable shape, so it becomes the baseline rather than an edit.
      if (rebaseline) setBaselineSuburb(data.suburbs[0] ?? "");
    } catch {
      if (requested.current !== code) return;
      // Same staleness as the !res.ok branch above: the options on screen are
      // the last postcode's, not this one's.
      setSuburbOptions([]);
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
    if (initRan.current || !base.postcode) return;
    initRan.current = true;
    requested.current = base.postcode;
    void resolvePostcode(base.postcode, true);
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

  /* ---- draft, dirtiness and the leave guard ---- */

  const values = useMemo<DraftValues>(
    () => ({
      displayName,
      age,
      postcode,
      suburb,
      bio,
      intents: [...intents],
      interests: [...interests],
      music: [...music],
      prompts,
      datingVisible,
      flexibleDiscovery,
    }),
    [displayName, age, postcode, suburb, bio, intents, interests, music, prompts, datingVisible, flexibleDiscovery],
  );

  const dirty = fingerprint(values) !== fingerprint({ ...base, suburb: baselineSuburb });

  /* The draft's version is a stamp of the server values it branched from, which
     is how it gets cleared without a success callback: saveProfileEditAction
     redirects, so this component never sees "saved". Come back after a save and
     the page renders NEW server values, the stamp changes, and useFormDraft drops
     the stale draft for us. Come back after a crash or a stray Cancel and the
     server values are untouched, the stamp still matches, and the work returns.
     Nothing is ever discarded on a path that might not have saved. */
  const { restored } = useFormDraft<DraftValues>({
    key: `click:profile-edit:${profile.id}`,
    version: stampOf(fingerprint(base)),
    storage: "local",
    values,
    apply: (saved) => {
      setDisplayName(saved.displayName);
      setAge(saved.age);
      setBio(saved.bio);
      setPostcode(saved.postcode);
      setSuburb(saved.suburb);
      setIntents(new Set(saved.intents));
      setInterests(new Set(saved.interests));
      setMusic(new Set(saved.music));
      setPrompts(saved.prompts);
      setDatingVisible(saved.datingVisible);
      setFlexibleDiscovery(saved.flexibleDiscovery);
    },
  });

  const guard = useUnsavedGuard(dirty);

  /* ---- live completion ---- */

  // The repository owns WHAT counts (the five items, their labels, their equal
  // weighting); this only re-answers the four it can see change as you type, so
  // the meter moves in the place where completion actually happens. `quiz` keeps
  // the server's answer - nothing on this page changes it.
  // Undefined in the value type on purpose: `quiz` is absent from this map, and
  // the `?? item.done` below is what hands that item back to the server's answer.
  const liveDone: Record<string, boolean | undefined> = {
    photo: !!profile.photoUrl || profile.galleryPhotos.length > 0,
    suburb: suburb.trim().length > 0,
    bio: bio.trim().length > 0,
    tags: interests.size >= 3,
  };
  const items = completion.items.map((item) => ({ ...item, done: liveDone[item.key] ?? item.done }));
  const doneCount = items.filter((item) => item.done).length;
  // A checklist meter, not endowed wizard progress: 0 of 5 really is nothing done
  // and 5 of 5 really is finished, so both ends tell the truth here.
  const percent = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
  const allDone = doneCount === items.length && items.length > 0;

  /* There is deliberately no submit-time block on a blank suburb any more. The
     suburb <select> can only be filled from the postcode field above it, so one
     postcode the lookup can't place - or a lookup that hadn't landed yet - used
     to preventDefault the whole form, and preventDefault stops the server action
     outright (React only runs a form `action` when the submit event wasn't
     default-prevented). Bio, prompts, intents, interests and music all became
     unsavable, with no way out of the page but abandoning the edits.
     saveProfileEditAction reads a blank suburb as "leave the stored one alone"
     rather than writing NULL, so nothing is lost by letting the save through -
     the hint on the Suburb field below says so where it is relevant. */

  return (
    <form action={saveProfileEditAction} className="mt-2">
      {/* Only worth saying when the restored draft actually differs from what is
          stored - otherwise it announces a rescue that rescued nothing. */}
      {restored && dirty ? (
        <p className="rise-soft mt-4 rounded-[12px] bg-[color:var(--lavender-100)] px-3.5 py-2.5 text-[13px] font-medium leading-5 text-[color:var(--ink)]">
          Picked up where you left off - these are your unsaved edits from last time.
        </p>
      ) : null}

      {/* ----- Photos ----- */}
      {/* Unwrapped: it is above the fold, so it must never wait on an observer. */}
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
      {/* Also unwrapped, for a second reason: it holds the only natively-required
          control on the page, and the browser cannot focus a constraint-violating
          field that a not-yet-revealed section is still holding at opacity 0. */}
      <Group>
        <SectionHead>About you</SectionHead>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Display name"
            name="display_name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          {/* "Optional" was a lie: the action deliberately collapses a blank or
              under-18 value to undefined, because writing NULL would trip the
              click gate and lock the user out of clicking with everyone. */}
          <FormField
            label="Age"
            hint="Shown next to your name. Once it is set it can't be cleared here - tell us if it's wrong."
            name="age"
            type="number"
            min={18}
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField
            label="Postcode"
            error={pcStatus === "error" ? pcMessage ?? undefined : undefined}
            hint={pcStatus === "loading" ? "Looking up…" : pcStatus === "idle" ? pcMessage : null}
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={postcode}
            onChange={(e) => handlePostcodeChange(e.target.value)}
            placeholder="2204"
          />

          <FormField
            label="Suburb"
            as="select"
            name="suburb"
            /* A warning, not an error: the save goes through either way, so
               painting this --danger red would claim a problem that isn't one. */
            hint={
              suburb.trim()
                ? null
                : "Your suburb is set from your postcode above - everything else here still saves."
            }
            value={suburb}
            onChange={(e) => setSuburb(e.target.value)}
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
          </FormField>
        </div>

        {/* No-JS honesty. The suburb options are fetched by handlePostcodeChange,
            so with scripting off this select is stuck on whatever the server
            rendered. Say that out loud rather than leaving a control that looks
            broken.

            Deliberately NOT a native `required` on the select: server-side its
            only options are the already-saved suburb (if any), so `required`
            adds nothing when a suburb exists and makes the whole form
            permanently unsubmittable when one doesn't - a no-JS visitor could
            no longer edit their bio or tags either. The real guard is in
            saveProfileEditAction, which now treats a blank suburb as "leave
            unchanged" instead of writing NULL. */}
        <noscript>
          <p className="mt-2 max-w-[520px] text-[13px] leading-[1.55] text-[color:var(--slate)]">
            Looking your suburb up from your postcode needs JavaScript. Everything else on this
            page still saves without it, and your suburb is left exactly as it is.
          </p>
        </noscript>
      </Group>

      {/* ----- Bio ----- */}
      {/* From here down every section is a <Reveal>: nine stacked groups is a long
          scroll, which is the one shape Reveal is for. Plain and undelayed - they
          arrive one at a time as you scroll, so a stagger would only add waiting. */}
      <Reveal>
        <Group>
          <SectionHead sub="A line or two in your own words - e.g. potter by hobby, gig-goer by habit.">
            Bio
          </SectionHead>
          <textarea
            name="bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What you're into, and what you're here for."
            className="ck-input ck-input--area w-full"
          />
        </Group>
      </Reveal>

      {/* ----- Prompts ----- */}
      <Reveal>
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
                      aria-label="Prompt"
                      className="ck-input min-w-0 flex-1 font-semibold"
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
                    aria-label="Your answer"
                    className="ck-input ck-input--area w-full"
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
      </Reveal>

      {/* ----- Here for (intents) ----- */}
      <Reveal>
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
          {/* Deselecting everything renders zero inputs, so `intent` arrives as an
              empty list - which the repository now writes rather than skips. */}
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
      </Reveal>

      {/* ----- Discovery ----- */}
      <Reveal>
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
      </Reveal>

      {/* ----- Interest tags ----- */}
      <Reveal>
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
      </Reveal>

      {/* ----- Music tags ----- */}
      <Reveal>
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
      </Reveal>

      {/* ----- Click quiz ----- */}
      <Reveal>
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
      </Reveal>

      {/* Sticky save bar so "Save changes" is always reachable without scrolling
          to the very bottom of this long form (bug board #219). It also carries
          the two things this page used to leave unsaid: how far the profile has
          come, and whether anything is currently unsaved. */}
      <div className="sticky bottom-[calc(56px+env(safe-area-inset-bottom))] z-10 flex flex-wrap lg:bottom-0 items-center justify-between gap-x-5 gap-y-3 border-t border-[color:var(--mist)] bg-[color:var(--champagne)] py-4">
        <div className="min-w-[180px] flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {allDone ? (
              <span className="pop-in inline-block">
                <Badge tone="sage">Profile complete</Badge>
              </span>
            ) : (
              <span className="font-display text-[12.5px] font-semibold text-[color:var(--slate)]">
                Profile {doneCount} of {items.length}
              </span>
            )}
            {dirty ? (
              <span className="text-[12px] text-[color:var(--slate)]">Unsaved changes</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[color:var(--sage)]">
                <Icon name="check" size={12} stroke={2.6} />
                All changes saved
              </span>
            )}
          </div>
          <div
            className="mt-2 h-1.5 max-w-[260px] overflow-hidden rounded-full bg-[color:var(--lav-bg)]"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-label={`Profile ${doneCount} of ${items.length} complete`}
          >
            <div
              className="h-full rounded-full bg-[color:var(--purple)] transition-[width] duration-500 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="font-display px-2 text-[14px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)]"
          >
            Cancel
          </Link>
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </div>
      </div>

      {/* Renders through a portal onto document.body, so its buttons are outside
          this form and can never submit it. */}
      <ConfirmDialog
        open={!!guard.pendingHref}
        tone="rose"
        badge="Unsaved"
        title="Leave without saving?"
        description="Your photos are already saved. The rest of this page is not yet."
        confirmLabel="Leave without saving"
        cancelLabel="Keep editing"
        onConfirm={guard.confirm}
        onCancel={guard.cancel}
      />
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
