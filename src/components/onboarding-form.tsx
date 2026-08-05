"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { interestTagCategories } from "@/lib/click-data";
import { regionFromPostcode } from "@/lib/geo";
import { scopedKey, useAccountScope } from "@/lib/account-scope";
import { AvatarUploader } from "@/components/avatar-uploader";
import { BirthDatePicker } from "@/components/birth-date-picker";
import { AuthError, AuthNote, Field } from "@/components/auth-ui";
import { EventImage } from "@/components/event-image";
import { fireBrandConfetti } from "@/components/brand-confetti";
import {
  CatGlyph,
  Icon,
  Logo,
  categoryGlyphKey,
  ckBtn,
  type IconName,
} from "@/components/ds";

// Onboarding - a paced five-step flow, not one long scroll.
//
// The old surface stacked all seven sections (basics, photo, birth date, intent,
// visibility, interests, bio) down a single page, which read as a wall of
// obligations before the visitor had seen a single reason to fill it in. This
// version follows the spec redesign in `context/01_USER_JOURNEY.md` §2:
//
//   1 basics     · name, birth date, postcode        (required)
//   2 intent     · why you're here, dating toggles inline
//   3 preview    · "here's what Click looks like for you" - REAL upcoming
//                  events, filtered by the intents just picked. Earns step 4.
//   4 interests  · tags by category, soft minimum of three
//   5 photo      · optional photo + optional one-liner, then Finish
//   done         · the payoff: confetti, the no-chat framing, one way onward
//
// State lives here (not per-route) so the localStorage draft, the validation and
// the single POST stay exactly as they were - only the pacing changed. Forward
// moves push a hash entry so browser Back walks the wizard instead of dropping
// the visitor out of it.

type Intent =
  | "dating"
  | "friendship"
  | "networking"
  | "exploring"
  | "hobbies"
  | "wellness"
  | "community"
  | "new_in_town";

type IntentOption = {
  value: Intent;
  label: string;
  body: string;
  /** The ONE icon treatment: a Deep-Purple line glyph on a lavender disc. Never an emoji. */
  cat?: string;
  icon?: IconName;
  /** Category glyph keys this intent wants to see in the step-3 preview. */
  previewCats: string[];
};

const INTENT_OPTIONS: IntentOption[] = [
  { value: "friendship",  cat: "social",      label: "Friendship",  body: "Good people, low stakes, no agenda.",                        previewCats: ["social", "food", "music", "community"] },
  { value: "dating",      cat: "dating",      label: "Dating",      body: "If you click with someone, see where it goes.",              previewCats: ["dating", "social", "food"] },
  { value: "networking",  cat: "networking",  label: "Networking",  body: "A few more good faces in your week.",                        previewCats: ["networking", "learning"] },
  { value: "hobbies",     cat: "arts",        label: "Hobbies",     body: "Find the people who share your craft.",                      previewCats: ["arts", "creative", "learning"] },
  { value: "wellness",    cat: "wellness",    label: "Wellness",    body: "Slow mornings, mindful movement, sober-friendly nights.",    previewCats: ["wellness", "fitness", "outdoors"] },
  { value: "community",   cat: "community",   label: "Community",   body: "Local meetups, volunteering, your neighbourhood.",           previewCats: ["community", "social"] },
  { value: "new_in_town", cat: "travel",      label: "New in town", body: "Find your feet, and your people nearby.",                    previewCats: ["travel", "social", "community"] },
  { value: "exploring",   icon: "compass",    label: "Exploring",   body: "Curious - show me a bit of everything.",                     previewCats: [] },
];

const STORAGE_KEY = "click:onboarding-draft";
// Namespaced per account below: one browser signs in as several people (the QA
// persona switcher, a shared laptop), and a single global key handed the next
// person the previous one's name, postcode and birth date.
// v4 adds `step` so a refresh resumes where the visitor was, not at the top.
const DRAFT_VERSION = 4;

// Australian postcodes are exactly 4 digits.
const POSTCODE_RE = /^\d{4}$/;

/** The trimmed event shape the preview step needs - the page maps EventItem down
 *  to this so the whole catalogue doesn't ride along in the client payload. */
export type OnboardingPreviewEvent = {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string;
  suburb: string;
  price: string;
  image: string;
  imageAlt: string;
};

type StepKey = "basics" | "intent" | "preview" | "interests" | "photo";

type StepDef = {
  key: StepKey;
  eyebrow: string;
  /** Takes the first name so later steps greet the visitor by it. */
  title: (name: string) => string;
  sub: string;
  cat?: string;
  icon?: IconName;
  /** Endowed progress: the bar is already moving on step 1 and never starts at 0. */
  pct: number;
};

const STEPS: StepDef[] = [
  {
    key: "basics",
    eyebrow: "Step one",
    title: () => "First, the basics",
    sub: "Just enough to show you what's on near you.",
    icon: "user",
    pct: 20,
  },
  {
    key: "intent",
    eyebrow: "Step two",
    title: (name) => (name ? `What brings you here, ${name}?` : "What brings you to Click?"),
    sub: "Pick any that fit. It tunes what we show you, and you can change it whenever.",
    icon: "users",
    pct: 42,
  },
  {
    key: "preview",
    eyebrow: "A quick look",
    title: () => "Here's what Click looks like for you",
    sub: "Real events, already on. Tell us what you're into and we'll keep the good ones coming.",
    icon: "compass",
    pct: 60,
  },
  {
    key: "interests",
    eyebrow: "Step three",
    title: () => "What do you like doing?",
    sub: "Tap what sounds like a good night out. Three or more and your suggestions get sharp.",
    cat: "arts",
    pct: 78,
  },
  {
    key: "photo",
    eyebrow: "Last one",
    title: (name) => (name ? `Nice to meet you, ${name}` : "Nice to meet you"),
    sub: "A photo is what unlocks clicking with people - ten seconds now, or add it later from your profile.",
    icon: "camera",
    pct: 93,
  },
];

/** Terminal state: the completion screen, reachable only by a successful save. */
const DONE = STEPS.length;

type Draft = {
  v: number;
  step: number;
  displayName: string;
  postcode: string;
  birthDate: string;
  intents: Intent[];
  datingVisible: boolean;
  flexibleDiscovery: boolean;
  tags: string[];
  bio: string;
};

type SubmitState = "idle" | "submitting" | "error";

type OnboardingFormProps = {
  initialName: string;
  // Existing profile values, so someone sent back through onboarding (e.g. an
  // older account that predates the required birth date) isn't retyping what we
  // already hold. Only a 4-digit postcode is reusable - profiles.suburb used to
  // store a suburb NAME, and that can't seed a postcode field.
  initialPostcode?: string;
  initialPhotoUrl?: string | null;
  // A handful of real upcoming events for the step-3 preview. Empty when the
  // catalogue is empty or the DB is unreachable - the step falls back to copy
  // rather than inventing events.
  previewEvents?: OnboardingPreviewEvent[];
  // Deep link the visitor was headed to before signup interrupted them (already
  // validated by safeNext on the server). Finishing the form resumes that trip
  // instead of dumping them on /dashboard.
  next?: string | null;
};

// 18 years ago today, ISO yyyy-mm-dd - the max value the <input type="date"> accepts.
function getMaxBirthDate() {
  return new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function ageFromBirthDate(iso: string): number | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const hasHadBirthday =
    today.getMonth() > parsed.getMonth() ||
    (today.getMonth() === parsed.getMonth() && today.getDate() >= parsed.getDate());
  if (!hasHadBirthday) age -= 1;
  return age;
}

function firstNameOf(displayName: string) {
  return displayName.trim().split(/\s+/)[0] ?? "";
}

export function OnboardingForm({
  initialName,
  initialPostcode = "",
  initialPhotoUrl = null,
  previewEvents = [],
  next,
}: OnboardingFormProps) {
  const router = useRouter();
  // Per-account draft key - see lib/account-scope. This form keeps its own
  // storage rather than useFormDraft (its restore is field-by-field: interests
  // never come back, and the saved step drives a history.replaceState), but it
  // scopes the key through the same helper.
  const storageKey = scopedKey(useAccountScope(), STORAGE_KEY);
  const maxBirthDate = useMemo(() => getMaxBirthDate(), []);

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");

  const [displayName, setDisplayName] = useState(initialName);
  const [postcode, setPostcode] = useState(initialPostcode);
  const [birthDate, setBirthDate] = useState("");
  const [intents, setIntents] = useState<Set<Intent>>(new Set(["friendship"]));
  // Dating visibility default OFF - opt-in is the safer default on a
  // dating-adjacent product. Flexible discovery stays opt-out (true).
  const [datingVisible, setDatingVisible] = useState(false);
  const [flexibleDiscovery, setFlexibleDiscovery] = useState(true);
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl);

  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  const firstName = firstNameOf(displayName);

  // Pilot is greater Sydney for now. When the postcode lands outside it, show a
  // non-blocking heads-up that we're not live there yet but they'll be on the
  // launch waitlist (mirrors the merchant event-create location gate). Only
  // fires on a complete 4-digit postcode so it never flashes mid-typing.
  const postcodeRegion = useMemo(() => {
    const trimmed = postcode.trim();
    return POSTCODE_RE.test(trimmed) ? regionFromPostcode(trimmed) : null;
  }, [postcode]);

  // Up to three real events, the ones matching the intents just picked first and
  // then the soonest others to top the row up - one lonely card would undersell
  // a screen headed "here's what Click looks like for you". The step falls back
  // to plain copy when there are no events at all; we never fake a card.
  const previewPicks = useMemo(() => {
    if (!previewEvents.length) return [];
    const wanted = new Set(
      INTENT_OPTIONS.filter((o) => intents.has(o.value)).flatMap((o) => o.previewCats),
    );
    const matched = wanted.size
      ? previewEvents.filter((e) => wanted.has(categoryGlyphKey(e.category)))
      : [];
    const rest = previewEvents.filter((e) => !matched.includes(e));
    return [...matched, ...rest].slice(0, 3);
  }, [previewEvents, intents]);

  const hydratedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const submittedRef = useRef(false);

  // Hydrate the saved draft from localStorage once. This is the "synchronize
  // React with an external store on mount" pattern - we can't lazy-init from
  // browser storage without an SSR/CSR hydration mismatch, so the one-render
  // cost from effect-driven setState is the lesser evil. Rule disabled for the
  // whole block intentionally.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<Draft>;
        if (draft.v === DRAFT_VERSION) {
          if (draft.displayName) setDisplayName(draft.displayName);
          if (typeof draft.postcode === "string") setPostcode(draft.postcode);
          if (typeof draft.birthDate === "string") setBirthDate(draft.birthDate);
          if (Array.isArray(draft.intents) && draft.intents.length) {
            setIntents(new Set(draft.intents));
          }
          if (typeof draft.datingVisible === "boolean") setDatingVisible(draft.datingVisible);
          if (typeof draft.flexibleDiscovery === "boolean") setFlexibleDiscovery(draft.flexibleDiscovery);
          // Intentionally NOT restoring `draft.tags`: interests are optional and
          // restoring them silently makes the picker look pre-filled on a fresh
          // visit ("I haven't touched anything"). Interests always start empty.
          if (typeof draft.bio === "string") setBio(draft.bio);
          // Resume where they stopped. Never resume onto `done` - that state is
          // only reachable by an actual successful save.
          if (typeof draft.step === "number" && draft.step > 0 && draft.step < DONE) {
            setStep(draft.step);
            window.history.replaceState(null, "", `#${STEPS[draft.step].key}`);
          }
        }
      }
    } catch {
      // ignore
    }

    hydratedRef.current = true;
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist draft on every change (after hydration so we don't clobber it on
  // mount, and never after a successful save - the step change to `done` would
  // otherwise re-write the draft that handleSubmit just cleared).
  useEffect(() => {
    if (!hydratedRef.current || submittedRef.current || typeof window === "undefined") return;
    try {
      const draft: Draft = {
        v: DRAFT_VERSION,
        step,
        displayName,
        postcode,
        birthDate,
        intents: Array.from(intents),
        datingVisible,
        flexibleDiscovery,
        tags: Array.from(tags),
        bio,
      };
      window.localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      // localStorage can fail (quota, private mode) - ignore.
    }
  }, [storageKey, step, displayName, postcode, birthDate, intents, datingVisible, flexibleDiscovery, tags, bio]);

  // Browser Back walks the wizard instead of leaving it: every forward move
  // pushes a hash entry, so a pop just reads the step back off the hash. The
  // in-page Back button calls history.back() so both routes share one path.
  useEffect(() => {
    function onPop() {
      if (submittedRef.current) {
        // Already saved - there's nothing to come back to.
        router.replace(next ?? "/dashboard");
        return;
      }
      const key = window.location.hash.replace("#", "");
      const index = STEPS.findIndex((s) => s.key === key);
      setDir("back");
      setStep(index === -1 ? 0 : index);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [router, next]);

  // Each step change starts at the top with focus on the new heading, so the
  // flow reads correctly to a screen reader and never lands mid-scroll. Skipped
  // on first paint - stealing focus on page load would scroll past the wordmark.
  const firstPaintRef = useRef(true);
  useEffect(() => {
    if (firstPaintRef.current) {
      firstPaintRef.current = false;
      return;
    }
    scrollRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }, [step]);

  // The one celebration on this surface. Guarded for reduced motion inside
  // fireBrandConfetti itself.
  useEffect(() => {
    if (step === DONE) void fireBrandConfetti({ x: 0.5, y: 0.45 });
  }, [step]);

  function toggleIntent(intent: Intent) {
    setIntents((current) => {
      const nextSet = new Set(current);
      if (nextSet.has(intent)) nextSet.delete(intent);
      else nextSet.add(intent);
      // Always keep at least one intent so downstream filters aren't empty.
      if (nextSet.size === 0) nextSet.add("friendship");
      return nextSet;
    });
  }

  function toggleTag(tag: string) {
    setTags((current) => {
      const nextSet = new Set(current);
      const key = tag.toLowerCase();
      if (nextSet.has(key)) nextSet.delete(key);
      else nextSet.add(key);
      return nextSet;
    });
  }

  // Validates everything required across the whole form in one pass.
  // Returns "" if OK, else an inline message.
  function validateAll(): string {
    if (!displayName.trim()) return "Add a name people will see.";
    if (!postcode.trim()) return "Add your postcode.";
    if (!POSTCODE_RE.test(postcode.trim())) return "Enter a valid 4-digit Australian postcode.";
    if (!birthDate) return "Pick your birth date so we can confirm you're 18+.";
    const age = ageFromBirthDate(birthDate);
    if (age === null) return "That birth date doesn't look right.";
    if (age < 18) return "You need to be 18 or older to use Click.";
    return "";
  }

  // Only step 1 collects required fields; the rest are all optional by design.
  function validateStep(index: number): string {
    return index === 0 ? validateAll() : "";
  }

  function goTo(index: number) {
    setDir("fwd");
    setStep(index);
    window.history.pushState(null, "", `#${STEPS[index].key}`);
  }

  function goBack() {
    // Delegates to the browser so the wizard and the Back button never disagree.
    if (step > 0) window.history.back();
  }

  function handleNext() {
    const err = validateStep(step);
    if (err) {
      setState("error");
      setMessage(err);
      return;
    }
    setState("idle");
    setMessage("");
    if (step < STEPS.length - 1) goTo(step + 1);
    else void handleSubmit();
  }

  async function handleSubmit() {
    // Re-run every rule on submit - a resumed draft can carry a value that was
    // valid when it was typed and isn't now (an 18th birthday edge, say).
    const err = validateAll();
    if (err) {
      setState("error");
      setMessage(err);
      setDir("back");
      setStep(0);
      window.history.pushState(null, "", `#${STEPS[0].key}`);
      return;
    }

    setState("submitting");
    setMessage("");

    let response: Response;
    try {
      response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          // Stored in profiles.suburb - we now collect a 4-digit AU postcode here.
          suburb: postcode.trim(),
          bio,
          intents: Array.from(intents),
          tags: Array.from(tags),
          birthDate: birthDate || undefined,
          // Only persist dating visibility for people who actually picked Dating;
          // the toggle is hidden for everyone else, so its state is meaningless.
          datingVisible: intents.has("dating") ? datingVisible : false,
          flexibleDiscovery,
        }),
      });
    } catch {
      setState("error");
      setMessage("We couldn't reach the server. Check your connection and try again.");
      return;
    }

    if (response.status === 401) {
      window.location.href = "/login?callbackUrl=/onboarding";
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Could not save your profile.");
      return;
    }

    // Wipe the draft on success so a refresh doesn't resurrect it.
    try {
      window.localStorage.removeItem(storageKey);
    } catch {}

    submittedRef.current = true;
    setState("idle");
    setDir("fwd");
    setStep(DONE);
    // Replace, not push: the saved profile is behind us, not a step to go back to.
    window.history.replaceState(null, "", "#done");
    // Warm the destination while they read the completion screen.
    router.refresh();
  }

  if (step === DONE) {
    return (
      <DoneScreen
        firstName={firstName}
        intents={intents}
        tagCount={tags.size}
        hasPhoto={Boolean(photoUrl)}
        onContinue={() => {
          router.push(next ?? "/dashboard");
        }}
      />
    );
  }

  const current = STEPS[step];
  const picked = tags.size;
  const submitting = state === "submitting";
  const isLast = step === STEPS.length - 1;

  return (
    <section className="flex min-h-[100dvh] flex-col" aria-label="Profile setup">
      {/* ---------- Header: wordmark + endowed progress ---------- */}
      <header className="flex-none px-5 pt-[max(env(safe-area-inset-top),1rem)] sm:px-8">
        <div className="mx-auto w-full max-w-xl">
          {/* ChromeGate hides the global header here, so this wordmark is the
              only way back out - it has to be a link. */}
          <Link href="/" aria-label="Click home" className="inline-flex">
            <Logo size={26} />
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--lav-bg)]"
              role="progressbar"
              aria-valuenow={step + 1}
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-label={`Step ${step + 1} of ${STEPS.length}`}
            >
              <div
                className="h-full rounded-full bg-[color:var(--purple)] transition-[width] duration-500 ease-out"
                style={{ width: `${current.pct}%` }}
              />
            </div>
            <span className="font-display flex-none text-[12.5px] font-semibold text-[color:var(--slate)]">
              {step + 1} of {STEPS.length}
            </span>
          </div>
        </div>
      </header>

      {/* ---------- Body: one step at a time ---------- */}
      {/* The Continue button lives in the sticky footer but submits this form via
          `form="onboarding-step"`, so Enter in any field advances the step. */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-8 sm:px-8"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 7.5rem)" }}
      >
        <form
          id="onboarding-step"
          // noValidate: the browser's own bubble would fire on the two `required`
          // inputs before our handler runs, so a missing postcode got a grey
          // native tooltip while a missing birth date (a custom picker, no
          // required input) got our inline note. validateAll covers all three
          // with one voice.
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            handleNext();
          }}
        >
          <div
            key={current.key}
            className={dir === "fwd" ? "step-enter-fwd" : "step-enter-back"}
          >
            <div className="mx-auto grid w-full max-w-xl gap-7">
              {/* ----- Step head: the one spot glyph, on a lavender disc ----- */}
              <div>
                <Disc size={52}>
                  {current.cat ? (
                    <CatGlyph name={current.cat} size={24} />
                  ) : (
                    <Icon name={current.icon ?? "compass"} size={24} stroke={1.8} />
                  )}
                </Disc>
                <p className="eyebrow mt-4">{current.eyebrow}</p>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="font-display mt-2.5 text-[length:var(--text-h2)] font-semibold leading-[1.14] tracking-[-0.02em] text-[color:var(--ink)] outline-none"
                >
                  {current.title(firstName)}
                </h1>
                <p className="mt-2 text-[15px] leading-[1.6] text-[color:var(--slate)]">
                  {/* With no events to show yet, the preview step's usual line
                      ("real events, already on") would be writing a cheque the
                      screen can't cash. */}
                  {current.key === "preview" && !previewPicks.length
                    ? "Three steps, start to finish. Tell us what you're into and we'll line the first ones up."
                    : current.sub}
                </p>
              </div>

              {/* ----- Step body ----- */}
              {current.key === "basics" ? (
                <div className="grid gap-4">
                  <Field
                    label="First name"
                    icon="user"
                    required
                    autoComplete="given-name"
                    inputMode="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Jordan"
                    hint="This is the name people see on Click."
                  />

                  <div className="grid gap-1.5">
                    <span
                      id="birth-date-label"
                      className="text-[13.5px] font-semibold text-[color:var(--ink)]"
                    >
                      Birth date
                    </span>
                    <BirthDatePicker
                      labelledBy="birth-date-label"
                      value={birthDate}
                      onChange={setBirthDate}
                      max={maxBirthDate}
                      describedBy="birth-date-hint"
                    />
                    <span
                      id="birth-date-hint"
                      className="text-[12.5px] leading-[1.5] text-[color:var(--slate)]"
                    >
                      Click is 18+. Used once for the age check, then hidden - we never show your
                      full birth date.
                    </span>
                  </div>

                  <Field
                    label="Postcode"
                    icon="pin"
                    required
                    autoComplete="postal-code"
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="2204"
                    hint="So we can show you what's on within reach."
                  />
                  {postcodeRegion === "Sydney" ? (
                    <AuthNote icon="check">
                      You&apos;re in our first suburbs - there are events near you already.
                    </AuthNote>
                  ) : postcodeRegion ? (
                    <AuthNote icon="pin">
                      You&apos;re outside our first suburbs - you&apos;re still in, and we&apos;ll
                      tell you the moment Click reaches your area.
                    </AuthNote>
                  ) : null}
                </div>
              ) : null}

              {current.key === "intent" ? (
                <div className="grid gap-4">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {INTENT_OPTIONS.map((intent) => {
                      const on = intents.has(intent.value);
                      return (
                        <button
                          key={intent.value}
                          type="button"
                          onClick={() => toggleIntent(intent.value)}
                          aria-pressed={on}
                          className={`flex items-start gap-3 rounded-2xl border-[1.5px] px-4 py-3.5 text-left transition-colors ${
                            on
                              ? "border-[color:var(--purple-500)] bg-[color:var(--lavender-100)]"
                              : "border-[color:var(--mist-strong)] bg-[color:var(--paper)] hover:bg-[color:var(--lavender-100)]"
                          }`}
                        >
                          <Disc>
                            {intent.cat ? (
                              <CatGlyph name={intent.cat} size={19} />
                            ) : (
                              <Icon name={intent.icon ?? "compass"} size={19} />
                            )}
                          </Disc>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-semibold text-[color:var(--ink)]">
                              {intent.label}
                            </span>
                            <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-[color:var(--slate)]">
                              {intent.body}
                            </span>
                          </span>
                          <span
                            aria-hidden
                            className={`mt-0.5 flex size-[22px] flex-none items-center justify-center rounded-full bg-[color:var(--purple)] text-[color:var(--champagne)] transition-opacity ${
                              on ? "opacity-100" : "opacity-0"
                            }`}
                          >
                            <Icon name="check" size={13} stroke={3} />
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Dating visibility is only meaningful to people who picked
                      Dating - it appears inline the moment they do, and stays
                      hidden otherwise. */}
                  {intents.has("dating") ? (
                    <div className="rise-soft">
                      <Toggle
                        label="Show I'm open to dating"
                        description="Only people also open to dating ever see this."
                        checked={datingVisible}
                        onChange={setDatingVisible}
                      />
                    </div>
                  ) : null}
                  <Toggle
                    label="Flexible discovery"
                    description="Show me events across intents, not only the one I lead with."
                    checked={flexibleDiscovery}
                    onChange={setFlexibleDiscovery}
                  />
                </div>
              ) : null}

              {current.key === "preview" ? (
                <div className="grid gap-4">
                  {previewPicks.length ? (
                    <>
                      <div className="grid gap-3">
                        {previewPicks.map((event, index) => (
                          <PreviewCard key={event.id} event={event} index={index} />
                        ))}
                      </div>
                      <AuthNote icon="compass">
                        Pick a few interests next and your dashboard fills with the ones that
                        actually suit you.
                      </AuthNote>
                    </>
                  ) : (
                    <div className="grid gap-2.5">
                      {[
                        {
                          icon: "compass" as IconName,
                          label: "Find something on near you",
                          body: "Small, real plans - a pottery table, a run club, a long lunch.",
                        },
                        {
                          icon: "check" as IconName,
                          label: "Say you're in",
                          body: "One tap. You see who else is going before you get there.",
                        },
                        {
                          icon: "users" as IconName,
                          label: "Meet in person",
                          body: "If you click with someone there, we take it from there.",
                        },
                      ].map((row) => (
                        <div
                          key={row.label}
                          className="flex items-start gap-3 rounded-2xl border-[1.5px] border-[color:var(--mist-strong)] bg-[color:var(--paper)] px-4 py-3.5"
                        >
                          <Disc size={36}>
                            <Icon name={row.icon} size={17} />
                          </Disc>
                          <span className="min-w-0">
                            <span className="block text-[15px] font-semibold text-[color:var(--ink)]">
                              {row.label}
                            </span>
                            <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-[color:var(--slate)]">
                              {row.body}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {current.key === "interests" ? (
                <div className="grid gap-6">
                  {interestTagCategories.map(([category, ...tagList]) => (
                    <div key={category}>
                      <div className="flex items-center gap-2.5">
                        <Disc size={32}>
                          <CatGlyph name={categoryGlyphKey(category)} size={16} />
                        </Disc>
                        <span className="text-[13px] font-semibold text-[color:var(--ink)]">
                          {category}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tagList.map((tag) => {
                          const selected = tags.has(tag.toLowerCase());
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleTag(tag)}
                              aria-pressed={selected}
                              className={`ck-tag ck-tag--select h-9 px-3.5 text-[13.5px] ${
                                selected ? "ck-tag--selected" : ""
                              }`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {current.key === "photo" ? (
                <div className="grid gap-6">
                  <AvatarUploader
                    initialUrl={initialPhotoUrl}
                    displayName={displayName}
                    onUploaded={setPhotoUrl}
                  />
                  <label className="grid gap-1.5">
                    <span className="text-[13.5px] font-semibold text-[color:var(--ink)]">
                      Anything you&apos;d like us to know? <Optional />
                    </span>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="min-h-24 rounded-xl border-[1.5px] border-[color:var(--mist-strong)] bg-[color:var(--paper)] px-3.5 py-3 text-base leading-[1.55] text-[color:var(--ink)] placeholder:text-[color:var(--ink-faint)]"
                      placeholder="I'd like low-pressure ways to meet people after work."
                    />
                    <span className="text-[12.5px] leading-[1.5] text-[color:var(--slate)]">
                      One line is plenty. It helps us hand-pick your first few events.
                    </span>
                  </label>
                </div>
              ) : null}

              {message ? <AuthError>{message}</AuthError> : null}
            </div>
          </div>
        </form>
      </div>

      {/* ---------- Sticky footer: Back / count / Continue ---------- */}
      <footer
        className="sticky bottom-0 z-20 flex-none border-t border-[color:var(--mist)] bg-[color:var(--champagne)] px-5 pt-3 sm:px-8"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={submitting}
              className={ckBtn("secondary", "lg")}
              aria-label="Back a step"
            >
              <span className="ck-btn__label">
                <Icon name="chevL" size={18} />
              </span>
            </button>
          ) : null}

          {/* The interests counter earns its place in the bar: it's the one step
              where progress is a number and the visitor is deciding when to stop. */}
          {current.key === "interests" ? (
            <p aria-live="polite" className="min-w-0 flex-1 text-[13px] font-medium text-[color:var(--slate)]">
              {picked === 0
                ? "Pick a few - or skip."
                : picked >= 3
                  ? `Nice - ${picked} picked.`
                  : `${picked} picked · ${3 - picked} more sharpens it.`}
            </p>
          ) : (
            <div className="flex-1" />
          )}

          <button
            type="submit"
            form="onboarding-step"
            disabled={submitting}
            aria-busy={submitting || undefined}
            className={ckBtn("primary", "lg", {
              className: submitting ? "ck-btn--loading" : "",
            })}
          >
            <span className="ck-btn__label">
              {isLast
                ? "Finish"
                : current.key === "preview"
                  ? "Let's do it"
                  : current.key === "interests" && picked === 0
                    ? "Skip for now"
                    : "Continue"}
              <Icon name="arrowR" size={17} />
            </span>
            {submitting ? <span className="ck-btn__spinner" aria-hidden /> : null}
          </button>
        </div>
      </footer>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

/** The ONE icon treatment: a Deep-Purple line glyph on a soft lavender disc. */
function Disc({ children, size = 40 }: { children: ReactNode; size?: number }) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-full bg-[color:var(--lavender-100)] text-[color:var(--purple)]"
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

function Optional() {
  return (
    <span className="font-normal text-[color:var(--slate)]">· optional</span>
  );
}

/** A real upcoming event, shown flat on the preview step - no RSVP, no link out
 *  of the flow. Staggered entrance so the three land one after another. */
function PreviewCard({ event, index }: { event: OnboardingPreviewEvent; index: number }) {
  return (
    <div
      className={`rise-soft flex items-center gap-3.5 rounded-2xl border-[1.5px] border-[color:var(--mist-strong)] bg-[color:var(--paper)] p-3 ${
        index === 1 ? "rise-d1" : index === 2 ? "rise-d2" : ""
      }`}
    >
      <div className="relative size-[72px] flex-none overflow-hidden rounded-xl bg-[color:var(--lav-bg)]">
        <EventImage
          src={event.image}
          alt={event.imageAlt}
          category={event.category}
          fill
          sizes="72px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold leading-[1.3] text-[color:var(--ink)]">
          {event.title}
        </p>
        <p className="mt-1 truncate text-[12.5px] text-[color:var(--slate)]">
          {event.date} · {event.time}
        </p>
        <p className="mt-0.5 truncate text-[12.5px] text-[color:var(--slate)]">
          {event.suburb} · {event.price}
        </p>
      </div>
    </div>
  );
}

/** The DS switch - Deep Purple when on, never a status colour. */
function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-4 rounded-2xl border-[1.5px] border-[color:var(--mist-strong)] bg-[color:var(--paper)] px-4 py-3.5 text-left transition-colors hover:bg-[color:var(--lavender-100)]"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-[color:var(--ink)]">{label}</span>
        <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-[color:var(--slate)]">
          {description}
        </span>
      </span>
      <span
        aria-hidden
        className={`relative mt-0.5 h-[26px] w-11 flex-none rounded-full transition-colors ${
          checked ? "bg-[color:var(--purple)]" : "bg-[color:var(--mist-strong)]"
        }`}
      >
        <span
          className="absolute top-[3px] size-5 rounded-full bg-[color:var(--paper)] shadow-[var(--shadow-xs)] transition-[left]"
          style={{ left: checked ? 21 : 3 }}
        />
      </span>
    </button>
  );
}

/** The payoff. Profile is already saved by the time this renders, so the only
 *  job left is to set expectations (the no-chat framing the spec requires) and
 *  hand over one way onward. */
function DoneScreen({
  firstName,
  intents,
  tagCount,
  hasPhoto,
  onContinue,
}: {
  firstName: string;
  intents: Set<Intent>;
  tagCount: number;
  hasPhoto: boolean;
  onContinue: () => void;
}) {
  const chosen = INTENT_OPTIONS.filter((o) => intents.has(o.value));

  return (
    <section className="flex min-h-[100dvh] flex-col" aria-label="Profile setup complete">
      <header className="flex-none px-5 pt-[max(env(safe-area-inset-top),1rem)] sm:px-8">
        <div className="mx-auto w-full max-w-xl">
          <Link href="/" aria-label="Click home" className="inline-flex">
            <Logo size={26} />
          </Link>
        </div>
      </header>

      <div className="flex flex-1 items-center px-5 py-10 sm:px-8">
        <div className="mx-auto grid w-full max-w-xl gap-7">
          <div className="rise-soft">
            <Disc size={60}>
              <Icon name="check" size={28} stroke={2.4} />
            </Disc>
            <h1
              tabIndex={-1}
              className="font-display mt-5 text-[length:var(--text-h1)] font-semibold leading-[1.12] tracking-[-0.02em] text-[color:var(--ink)] outline-none"
            >
              {firstName ? `You're in, ${firstName}` : "You're in"}
            </h1>
            <p className="mt-2.5 text-[15px] leading-[1.6] text-[color:var(--slate)]">
              Your profile is saved. Here&apos;s the one thing to know before you go in.
            </p>
          </div>

          {/* The no-chat framing - required on this screen so nobody lands on the
              dashboard hunting for a message button. */}
          <div className="rise-soft rise-d1 rounded-2xl bg-[color:var(--lav-bg)] p-5">
            <p className="font-display text-[15.5px] font-semibold leading-[1.35] text-[color:var(--purple-800)]">
              Click is different. No endless texting.
            </p>
            <p className="mt-2 text-[13.5px] leading-[1.6] text-[color:var(--purple-800)]">
              When you and someone else both click, we suggest a real event to go to together.
              Connection through experience, not inboxes.
            </p>
          </div>

          <div className="rise-soft rise-d2 grid gap-3">
            <p className="eyebrow">What we&apos;ve got so far</p>
            <div className="flex flex-wrap gap-2">
              {chosen.map((o) => (
                <span key={o.value} className="ck-tag h-8 px-3.5 text-[13px]">
                  {o.label}
                </span>
              ))}
              {tagCount ? (
                <span className="ck-tag h-8 px-3.5 text-[13px]">
                  {tagCount} interest{tagCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </div>

          <div className="rise-soft rise-d3 grid gap-3">
            <button type="button" onClick={onContinue} className={ckBtn("primary", "lg", { full: true })}>
              <span className="ck-btn__label">
                Take me in
                <Icon name="arrowR" size={17} />
              </span>
            </button>
            {hasPhoto ? null : (
              <p className="text-center text-[12.5px] leading-[1.5] text-[color:var(--slate)]">
                No photo yet - you can add one anytime from your profile. It&apos;s what unlocks
                clicking with people.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
