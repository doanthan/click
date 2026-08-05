"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { interestTagCategories } from "@/lib/click-data";
import { regionFromPostcode } from "@/lib/geo";
import { AvatarUploader } from "@/components/avatar-uploader";
import { BirthDatePicker } from "@/components/birth-date-picker";
import { AuthError, AuthNote, Field } from "@/components/auth-ui";
import {
  CatGlyph,
  Icon,
  Logo,
  categoryGlyphKey,
  ckBtn,
  type IconName,
} from "@/components/ds";

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
};

const INTENT_OPTIONS: IntentOption[] = [
  { value: "friendship",  cat: "social",      label: "Friendship",  body: "Good people, low stakes, no agenda." },
  { value: "dating",      cat: "dating",      label: "Dating",      body: "If you click with someone, see where it goes." },
  { value: "networking",  cat: "networking",  label: "Networking",  body: "A few more good faces in your week." },
  { value: "hobbies",     cat: "arts",        label: "Hobbies",     body: "Find the people who share your craft." },
  { value: "wellness",    cat: "wellness",    label: "Wellness",    body: "Slow mornings, mindful movement, sober-friendly nights." },
  { value: "community",   cat: "community",   label: "Community",   body: "Local meetups, volunteering, your neighbourhood." },
  { value: "new_in_town", cat: "travel",      label: "New in town", body: "Find your feet, and your people nearby." },
  { value: "exploring",   icon: "compass",    label: "Exploring",   body: "Curious - show me a bit of everything." },
];

const STORAGE_KEY = "click:onboarding-draft";
const DRAFT_VERSION = 3;

// Australian postcodes are exactly 4 digits.
const POSTCODE_RE = /^\d{4}$/;

type Draft = {
  v: number;
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

export function OnboardingForm({
  initialName,
  initialPostcode = "",
  initialPhotoUrl = null,
  next,
}: OnboardingFormProps) {
  const router = useRouter();
  const maxBirthDate = useMemo(() => getMaxBirthDate(), []);

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

  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  // Pilot is greater Sydney for now. When the postcode lands outside it, show a
  // non-blocking heads-up that we're not live there yet but they'll be on the
  // launch waitlist (mirrors the merchant event-create location gate). Only
  // fires on a complete 4-digit postcode so it never flashes mid-typing.
  const outsidePilotArea = useMemo(() => {
    const trimmed = postcode.trim();
    return POSTCODE_RE.test(trimmed) && regionFromPostcode(trimmed) !== "Sydney";
  }, [postcode]);

  const hydratedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Hydrate the saved draft from localStorage once. This is the "synchronize
  // React with an external store on mount" pattern - we can't lazy-init from
  // browser storage without an SSR/CSR hydration mismatch, so the one-render
  // cost from effect-driven setState is the lesser evil. Rule disabled for the
  // whole block intentionally.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
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
        }
      }
    } catch {
      // ignore
    }

    hydratedRef.current = true;
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist draft on every change (after hydration so we don't clobber it on mount).
  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    try {
      const draft: Draft = {
        v: DRAFT_VERSION,
        displayName,
        postcode,
        birthDate,
        intents: Array.from(intents),
        datingVisible,
        flexibleDiscovery,
        tags: Array.from(tags),
        bio,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // localStorage can fail (quota, private mode) - ignore.
    }
  }, [displayName, postcode, birthDate, intents, datingVisible, flexibleDiscovery, tags, bio]);

  function toggleIntent(intent: Intent) {
    setIntents((current) => {
      const next = new Set(current);
      if (next.has(intent)) next.delete(intent);
      else next.add(intent);
      // Always keep at least one intent so downstream filters aren't empty.
      if (next.size === 0) next.add("friendship");
      return next;
    });
  }

  function toggleTag(tag: string) {
    setTags((current) => {
      const next = new Set(current);
      const key = tag.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
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

  async function handleSubmit() {
    const err = validateAll();
    if (err) {
      setState("error");
      setMessage(err);
      // Bring the error (and the top fields it usually refers to) into view.
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
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
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}

    router.push(next ?? "/dashboard");
    router.refresh();
  }

  const picked = tags.size;

  return (
    <section className="flex min-h-[100dvh] flex-col" aria-label="Profile setup">
      {/* ---------- Header ---------- */}
      <header className="flex-none px-5 pt-[max(env(safe-area-inset-top),1rem)] sm:px-8">
        <div className="mx-auto w-full max-w-xl">
          <Logo size={26} />
        </div>
      </header>

      {/* ---------- Body: every section stacked on one scrollable page ---------- */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-8 sm:px-8"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 7.5rem)" }}
      >
        <div className="mx-auto grid w-full max-w-xl gap-11">
          <div>
            <p className="eyebrow">Set up your profile</p>
            <h1 className="font-display mt-3 text-[length:var(--text-h1)] font-semibold leading-[1.12] tracking-[-0.02em] text-[color:var(--ink)]">
              A few quick taps
            </h1>
            <p className="mt-2 text-base leading-[1.6] text-[color:var(--slate)]">
              Fill what matters, skip what doesn&apos;t, then hit Finish. You can polish it all
              later from your dashboard.
            </p>
          </div>

          {/* ----- About you ----- */}
          <Section
            glyph={<Icon name="pin" size={19} />}
            eyebrow="About you"
            title="The basics"
            subtitle="Just enough to find you good things nearby."
          >
            <Field
              label="First name"
              icon="user"
              required
              autoComplete="given-name"
              inputMode="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jordan"
            />
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
              hint="Click is piloting in inner Sydney first. Pop in your postcode - we'll show you what's near."
            />
            {outsidePilotArea ? (
              <AuthNote icon="pin">
                You&apos;re outside our first suburbs - you&apos;re still in, and we&apos;ll tell
                you the moment Click reaches your area.
              </AuthNote>
            ) : null}
          </Section>

          {/* ----- Photo (optional, but it's what unlocks the click pool) ----- */}
          <Section
            glyph={<Icon name="camera" size={19} />}
            eyebrow="Your face"
            title="Add a photo"
            subtitle="Optional - but you only show up in Click with someone once you have one, so it's worth the ten seconds."
          >
            <AvatarUploader initialUrl={initialPhotoUrl} displayName={displayName} />
          </Section>

          {/* ----- Birth date ----- */}
          <Section
            glyph={<Icon name="calendar" size={19} />}
            eyebrow="Quick check"
            title="When were you born?"
            subtitle="Click is 18+. We work out your age from this and never show your full birth date."
          >
            <div className="grid gap-1.5">
              <span id="birth-date-label" className="text-[13.5px] font-semibold text-[color:var(--ink)]">
                Birth date
              </span>
              <BirthDatePicker
                labelledBy="birth-date-label"
                value={birthDate}
                onChange={setBirthDate}
                max={maxBirthDate}
                describedBy="birth-date-hint"
              />
              <span id="birth-date-hint" className="text-[12.5px] leading-[1.5] text-[color:var(--slate)]">
                Used once for the age gate, then hidden.
              </span>
            </div>
          </Section>

          {/* ----- Intent ----- */}
          <Section
            glyph={<Icon name="users" size={19} />}
            eyebrow="What you're after"
            title="What brings you to Click?"
            subtitle="Pick any that fit - it tunes what we show you. You can change it later."
          >
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
          </Section>

          {/* ----- Visibility ----- */}
          <Section
            glyph={<Icon name="eye" size={19} />}
            eyebrow="Visibility"
            title="Who can see you?"
            subtitle="Set what you're comfortable with - you can change these anytime in settings."
          >
            {/* Dating visibility is only meaningful to people who picked Dating -
                hide it entirely otherwise so non-dating users aren't asked about
                a dating-only setting. */}
            {intents.has("dating") ? (
              <Toggle
                label="Show I'm open to dating"
                description="Only people also open to dating ever see this."
                checked={datingVisible}
                onChange={setDatingVisible}
              />
            ) : null}
            <Toggle
              label="Flexible discovery"
              description="Show me events across intents, not only the one I lead with."
              checked={flexibleDiscovery}
              onChange={setFlexibleDiscovery}
            />
          </Section>

          {/* ----- Interests (optional) ----- */}
          <Section
            glyph={<CatGlyph name="arts" size={19} />}
            eyebrow="Interests"
            title="What do you like doing?"
            subtitle="Pick a few - three or more is the sweet spot. You can always add more later."
          >
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
                          className={`ck-tag ck-tag--select h-8 px-3.5 text-[13.5px] ${
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
            <p className="text-[13.5px] font-medium text-[color:var(--slate)]">
              {picked === 0
                ? "Pick a few to get started."
                : picked >= 3
                  ? `Nice - ${picked} picked.`
                  : `${picked} picked · pick ${3 - picked} more for better suggestions.`}
            </p>
          </Section>

          {/* ----- Bio (optional) ----- */}
          <Section
            glyph={<Icon name="user" size={19} />}
            eyebrow="Optional"
            title="Anything you'd like us to know?"
            subtitle="One line is plenty. It helps us hand-pick your first few events."
          >
            <label className="grid gap-1.5">
              <span className="text-[13.5px] font-semibold text-[color:var(--ink)]">
                Tell us what you want
              </span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="min-h-28 rounded-xl border-[1.5px] border-[color:var(--mist-strong)] bg-[color:var(--paper)] px-3.5 py-3 text-base leading-[1.55] text-[color:var(--ink)] placeholder:text-[color:var(--ink-faint)]"
                placeholder="I'd like low-pressure ways to meet people after work."
              />
            </label>
          </Section>

          {message ? <AuthError>{message}</AuthError> : null}
        </div>
      </div>

      {/* ---------- Sticky footer: single Finish CTA ---------- */}
      <footer
        className="sticky bottom-0 z-20 flex-none border-t border-[color:var(--mist)] bg-[color:var(--champagne)] px-5 pt-3 sm:px-8"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto flex max-w-xl items-center justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={state === "submitting"}
            aria-busy={state === "submitting" || undefined}
            className={ckBtn("primary", "lg", {
              className: state === "submitting" ? "ck-btn--loading" : "",
            })}
          >
            <span className="ck-btn__label">
              Finish
              <Icon name="arrowR" size={17} />
            </span>
            {state === "submitting" ? <span className="ck-btn__spinner" aria-hidden /> : null}
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

function Section({
  glyph,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  glyph: ReactNode;
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid w-full gap-5">
      <div className="flex items-start gap-3.5">
        <Disc>{glyph}</Disc>
        <div className="min-w-0">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="font-display mt-1.5 text-[length:var(--text-h3)] font-semibold leading-[1.2] tracking-[-0.02em] text-[color:var(--ink)]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1.5 text-[14.5px] leading-[1.55] text-[color:var(--slate)]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4">{children}</div>
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
      className="flex items-start justify-between gap-4 rounded-2xl border-[1.5px] border-[color:var(--mist-strong)] bg-[color:var(--paper)] px-4 py-3.5 text-left transition-colors hover:bg-[color:var(--lavender-100)]"
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
