"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { interestTagCategories } from "@/lib/click-data";
import { REGISTER_PREFILL_KEY, type RegisterPrefill } from "@/components/register-form";
import { BirthDatePicker } from "@/components/birth-date-picker";

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
  emoji: string;
  body: string;
};

const INTENT_OPTIONS: IntentOption[] = [
  { value: "friendship",  emoji: "🫶", label: "Friendship",  body: "Low-pressure plans to make new friends." },
  { value: "dating",      emoji: "🌹", label: "Dating",      body: "Slow dating tables and relationship-minded events." },
  { value: "networking",  emoji: "💼", label: "Networking",  body: "Career switchers, founders, peer support." },
  { value: "hobbies",     emoji: "🎨", label: "Hobbies",     body: "Find people who share your craft — creative, sport, gaming, books." },
  { value: "wellness",    emoji: "🧘", label: "Wellness",    body: "Slow mornings, mindful movement, sober-friendly nights." },
  { value: "community",   emoji: "🏘️", label: "Community",   body: "Local meetups, volunteering, neighbourhood vibes." },
  { value: "new_in_town", emoji: "🧭", label: "New in town", body: "Just relocated — looking to plug into Sydney fast." },
  { value: "exploring",   emoji: "✨", label: "Exploring",   body: "Just curious — show me a bit of everything." },
];

const STORAGE_KEY = "click:onboarding-draft";
const DRAFT_VERSION = 2;

type Draft = {
  v: number;
  displayName: string;
  suburb: string;
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
};

// 18 years ago today, ISO yyyy-mm-dd — the max value the <input type="date"> accepts.
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

export function OnboardingForm({ initialName }: OnboardingFormProps) {
  const router = useRouter();
  const maxBirthDate = useMemo(() => getMaxBirthDate(), []);

  const [displayName, setDisplayName] = useState(initialName);
  const [suburb, setSuburb] = useState("Sydney");
  const [birthDate, setBirthDate] = useState("");
  const [intents, setIntents] = useState<Set<Intent>>(new Set(["friendship"]));
  // Dating visibility default OFF — opt-in is the safer default on a
  // dating-adjacent product. Flexible discovery stays opt-out (true).
  const [datingVisible, setDatingVisible] = useState(false);
  const [flexibleDiscovery, setFlexibleDiscovery] = useState(true);
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [bio, setBio] = useState("");

  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  const hydratedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Hydrate from sessionStorage (signup prefill) and localStorage (draft) once.
  // This is the "synchronize React with an external store on mount" pattern —
  // we can't lazy-init from browser storage without an SSR/CSR hydration
  // mismatch, so the one-render-cost from effect-driven setState is the lesser
  // evil. Rule disabled for the whole block intentionally.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.sessionStorage.getItem(REGISTER_PREFILL_KEY);
      if (raw) {
        const prefill = JSON.parse(raw) as RegisterPrefill;
        if (prefill.displayName) setDisplayName(prefill.displayName);
        if (prefill.intent) setIntents(new Set([prefill.intent]));
        if (typeof prefill.latitude === "number" && typeof prefill.longitude === "number") {
          setCoords({ latitude: prefill.latitude, longitude: prefill.longitude });
        }
        window.sessionStorage.removeItem(REGISTER_PREFILL_KEY);
      }
    } catch {
      // sessionStorage / parse can fail in private mode — ignore.
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<Draft>;
        if (draft.v === DRAFT_VERSION) {
          if (draft.displayName) setDisplayName(draft.displayName);
          if (draft.suburb) setSuburb(draft.suburb);
          if (typeof draft.birthDate === "string") setBirthDate(draft.birthDate);
          if (Array.isArray(draft.intents) && draft.intents.length) {
            setIntents(new Set(draft.intents));
          }
          if (typeof draft.datingVisible === "boolean") setDatingVisible(draft.datingVisible);
          if (typeof draft.flexibleDiscovery === "boolean") setFlexibleDiscovery(draft.flexibleDiscovery);
          if (Array.isArray(draft.tags)) setTags(new Set(draft.tags));
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
        suburb,
        birthDate,
        intents: Array.from(intents),
        datingVisible,
        flexibleDiscovery,
        tags: Array.from(tags),
        bio,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // localStorage can fail (quota, private mode) — ignore.
    }
  }, [displayName, suburb, birthDate, intents, datingVisible, flexibleDiscovery, tags, bio]);

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
    if (!suburb.trim()) return "Tell us your suburb.";
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
          suburb,
          age: "", // age is derived from birthDate server-side now
          bio,
          intents: Array.from(intents),
          tags: Array.from(tags),
          birthDate: birthDate || undefined,
          datingVisible,
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

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <section
      className="flex min-h-[100dvh] flex-col lg:min-h-0 lg:rounded-2xl lg:border-2 lg:border-[color:var(--line)] lg:bg-[color:var(--cream)] lg:hard-shadow-sm lg:my-12 lg:overflow-hidden"
      aria-label="Profile setup"
    >
      {/* ---------- Header ---------- */}
      <header className="border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-4 lg:rounded-t-2xl lg:px-6 lg:pt-5">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[color:var(--rose)]">
          Set up your profile
        </p>
        <h2 className="font-display mt-2 text-3xl font-light leading-[1.02] sm:text-4xl">
          A few quick taps. No quiz.
        </h2>
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Everything&apos;s on one page — fill what matters, skip what doesn&apos;t, then
          hit Finish. You can polish it all later from your dashboard.
        </p>
      </header>

      {/* ---------- Body: every section stacked on one scrollable page ---------- */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 7.5rem)" }}
      >
        <div className="mx-auto grid w-full max-w-xl gap-12">
          {/* ----- About you ----- */}
          <Section
            eyebrow="About you"
            title="What should we call you?"
            subtitle="Just a name and a suburb so we can stop calling you 'new user'."
          >
            <label className="grid gap-2 text-sm font-bold">
              Display name
              <input
                required
                autoComplete="given-name"
                inputMode="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 text-base font-semibold outline-none focus:border-[color:var(--rose)]"
                placeholder="Jordan Lee"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Suburb in Sydney
              <input
                required
                autoComplete="address-level2"
                value={suburb}
                onChange={(e) => setSuburb(e.target.value)}
                className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 text-base font-semibold outline-none focus:border-[color:var(--rose)]"
                placeholder="Marrickville"
              />
            </label>
            {coords ? (
              <p className="rounded-xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 text-xs font-semibold text-[color:var(--mauve)]">
                <span className="font-mono mr-2 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                  Location ✓
                </span>
                Using {coords.latitude.toFixed(3)}, {coords.longitude.toFixed(3)} to
                sort events near you.
              </p>
            ) : null}
          </Section>

          {/* ----- Birth date ----- */}
          <Section
            eyebrow="Quick check"
            title="When were you born?"
            subtitle="Click is 18+. We compute your age from this and never show your full DOB."
          >
            <div className="grid gap-2 text-sm font-bold">
              <span id="birth-date-label">Birth date</span>
              <BirthDatePicker
                labelledBy="birth-date-label"
                value={birthDate}
                onChange={setBirthDate}
                max={maxBirthDate}
                describedBy="birth-date-hint"
              />
              <span
                id="birth-date-hint"
                className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]"
              >
                18+ only. Used once for the age gate, then hidden.
              </span>
            </div>
          </Section>

          {/* ----- Intent ----- */}
          <Section
            eyebrow="The fun bit"
            title="Why are you here?"
            subtitle="Pick one or more. We use this to keep you out of the wrong rooms."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {INTENT_OPTIONS.map((intent) => {
                const checked = intents.has(intent.value);
                return (
                  <button
                    key={intent.value}
                    type="button"
                    onClick={() => toggleIntent(intent.value)}
                    aria-pressed={checked}
                    className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-4 text-left transition active:scale-[0.98] ${
                      checked
                        ? "border-[color:var(--rose)] bg-[color:var(--peach)] hard-shadow-sm"
                        : "border-[color:var(--line)] bg-[color:var(--cream)] hover:bg-[color:var(--champagne)]"
                    }`}
                  >
                    <span aria-hidden="true" className="text-2xl leading-none">
                      {intent.emoji}
                    </span>
                    <span className="grid gap-1">
                      <span className="block text-base font-bold">{intent.label}</span>
                      <span className="block text-xs font-semibold leading-5 text-[color:var(--mauve)]">
                        {intent.body}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* ----- Visibility ----- */}
          <Section
            eyebrow="Visibility"
            title="Who can see you?"
            subtitle="Off by default for dating. Flip what you're comfortable with — you can change either of these later from settings."
          >
            <Toggle
              label="Dating visibility"
              description="Let people on Click who are dating-minded see you on profiles and Click Radar."
              checked={datingVisible}
              onChange={setDatingVisible}
            />
            <Toggle
              label="Flexible discovery"
              description="Show me cross-intent events (e.g. friendship-tagged events even if my main intent is dating)."
              checked={flexibleDiscovery}
              onChange={setFlexibleDiscovery}
            />
          </Section>

          {/* ----- Interests (optional) ----- */}
          <Section
            eyebrow="Optional"
            title="What are you into?"
            subtitle="Tap whatever fits. Skip what doesn't. These shape your recommendations."
          >
            <div className="grid gap-4">
              {interestTagCategories.map(([category, ...tagList]) => (
                <div
                  key={category}
                  className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4"
                >
                  <p className="text-sm font-bold">{category}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tagList.map((tag) => {
                      const selected = tags.has(tag.toLowerCase());
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          aria-pressed={selected}
                          className={`min-h-9 rounded-full border-2 px-3.5 py-1.5 text-xs font-bold transition active:scale-[0.97] ${
                            selected
                              ? "border-[color:var(--rose)] bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                              : "border-[color:var(--line)] bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
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
          </Section>

          {/* ----- Bio (optional) ----- */}
          <Section
            eyebrow="Optional"
            title="Anything we should know?"
            subtitle="One line is fine. Helps us hand-pick early events for you. Totally skippable."
          >
            <label className="grid gap-2 text-sm font-bold">
              Tell us what you want
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="min-h-32 rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 text-base font-semibold outline-none focus:border-[color:var(--rose)]"
                placeholder="I want low-pressure ways to make friends after work."
              />
            </label>
          </Section>
        </div>

        {message && (
          <p
            role="alert"
            className="mx-auto mt-8 max-w-xl rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-3 text-sm font-bold text-[color:var(--surface-deep)]"
          >
            {message}
          </p>
        )}
      </div>

      {/* ---------- Sticky footer: single Finish CTA ---------- */}
      <footer
        className="sticky bottom-0 z-20 border-t-2 border-[color:var(--line)] bg-[color:var(--champagne)]/95 px-4 pt-3 backdrop-blur lg:rounded-b-2xl lg:px-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto flex max-w-xl items-center justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={state === "submitting"}
            className="ml-auto rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-8 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state === "submitting" ? "Saving…" : "Finish"}
          </button>
        </div>
      </footer>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function Section({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid w-full gap-5">
      <div>
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--rose)]">
          {eyebrow}
        </p>
        <h2 className="font-display mt-2 text-2xl font-light leading-[1.05] sm:text-3xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="grid gap-4">{children}</div>
    </div>
  );
}

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
      className={`flex items-start justify-between gap-3 rounded-2xl border-2 px-4 py-4 text-left transition ${
        checked
          ? "border-[color:var(--rose)] bg-[color:var(--peach)]"
          : "border-[color:var(--line)] bg-[color:var(--cream)]"
      }`}
    >
      <span className="grid gap-1">
        <span className="text-base font-bold">{label}</span>
        <span className="text-xs font-semibold leading-5 text-[color:var(--mauve)]">
          {description}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-[color:var(--line)] p-0.5 transition ${
          checked ? "bg-[color:var(--rose)] justify-end" : "bg-[color:var(--champagne)] justify-start"
        }`}
      >
        <span className="block size-5 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)]" />
      </span>
    </button>
  );
}
