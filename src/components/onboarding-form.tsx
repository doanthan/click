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

// The 6 stops in the order the spec called out: low-friction first, free-text last.
const STEPS = [
  { id: "name",       label: "Name"       },
  { id: "age",        label: "Birth date" },
  { id: "intent",     label: "Intent"     },
  { id: "visibility", label: "Visibility" },
  { id: "tags",       label: "Interests"  },
  { id: "bio",        label: "Optional"   },
] as const;
const TOTAL_STEPS = STEPS.length;
type StepIndex = 1 | 2 | 3 | 4 | 5 | 6;

const STORAGE_KEY = "click:onboarding-draft";
const DRAFT_VERSION = 1;

type Draft = {
  v: number;
  step: number;
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

function clampStep(n: number): StepIndex {
  if (!Number.isFinite(n)) return 1;
  const i = Math.round(n);
  if (i < 1) return 1;
  if (i > TOTAL_STEPS) return TOTAL_STEPS as StepIndex;
  return i as StepIndex;
}

export function OnboardingForm({ initialName }: OnboardingFormProps) {
  const router = useRouter();
  const maxBirthDate = useMemo(() => getMaxBirthDate(), []);

  const [step, setStep] = useState<StepIndex>(1);
  const [direction, setDirection] = useState<"fwd" | "back">("fwd");

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
  const [stepError, setStepError] = useState("");

  const hydratedRef = useRef(false);
  const firstFieldRef = useRef<
    HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement | null
  >(null);

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
          if (typeof draft.step === "number") setStep(clampStep(draft.step));
        }
      }
    } catch {
      // ignore
    }

    // ?step=N in the URL overrides any saved step.
    const params = new URLSearchParams(window.location.search);
    const urlStep = params.get("step");
    if (urlStep) setStep(clampStep(Number.parseInt(urlStep, 10)));

    hydratedRef.current = true;
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist draft on every change (after hydration so we don't clobber it on mount).
  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    try {
      const draft: Draft = {
        v: DRAFT_VERSION,
        step,
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
  }, [step, displayName, suburb, birthDate, intents, datingVisible, flexibleDiscovery, tags, bio]);

  // Keep ?step=N in sync without triggering a Next.js navigation.
  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("step", String(step));
    window.history.replaceState(null, "", url.toString());
  }, [step]);

  // Auto-focus the first field whenever the step changes.
  // (stepError is cleared by the navigation helpers below, not here, so this
  // effect stays a pure side-effect — no setState in body.)
  useEffect(() => {
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 240);
    return () => window.clearTimeout(t);
  }, [step]);

  // Single funnel for every step transition: clears errors, sets direction,
  // moves step. Keeps the focus effect clean and the validation in one place.
  function transitionTo(target: StepIndex, dir: "fwd" | "back") {
    setStepError("");
    setDirection(dir);
    setStep(target);
  }

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

  // Per-step gate. Returns "" if OK, else an inline message.
  function validateStep(target: StepIndex): string {
    switch (target) {
      case 1:
        if (!displayName.trim()) return "Add a name people will see.";
        if (!suburb.trim()) return "Tell us your suburb.";
        return "";
      case 2: {
        if (!birthDate) return "Pick your birth date so we can confirm you're 18+.";
        const age = ageFromBirthDate(birthDate);
        if (age === null) return "That birth date doesn't look right.";
        if (age < 18) return "You need to be 18 or older to use Click.";
        return "";
      }
      default:
        return "";
    }
  }

  function goNext() {
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      return;
    }
    if (step >= TOTAL_STEPS) {
      void handleSubmit();
      return;
    }
    transitionTo(clampStep(step + 1), "fwd");
  }

  function goBack() {
    if (step <= 1) return;
    transitionTo(clampStep(step - 1), "back");
  }

  function jumpTo(target: StepIndex) {
    // Allow jumping back to any earlier step via the progress dots, but only
    // forward as far as the previous validated steps allow.
    if (target === step) return;
    if (target < step) {
      transitionTo(target, "back");
      return;
    }
    for (let s = step; s < target; s++) {
      const err = validateStep(s as StepIndex);
      if (err) {
        setStepError(err);
        return;
      }
    }
    transitionTo(target, "fwd");
  }

  async function handleSubmit() {
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

  // Steps 5 and 6 are skippable. Step 4 (visibility) has sane defaults but
  // we still surface a "Looks good" CTA rather than a "Skip" — visibility
  // is a real choice the user should at least see.
  const canSkip = step === 5 || step === 6;
  const isFinal = step === TOTAL_STEPS;
  const primaryLabel =
    state === "submitting"
      ? "Saving…"
      : isFinal
        ? "Finish"
        : "Continue";

  return (
    <section
      className="flex min-h-[100dvh] flex-col lg:min-h-0 lg:rounded-2xl lg:border-2 lg:border-[color:var(--line)] lg:bg-[color:var(--cream)] lg:hard-shadow-sm lg:my-12 lg:overflow-hidden"
      aria-label="Profile setup"
    >
      {/* ---------- Sticky header: progress + back ---------- */}
      <header
        className="sticky top-0 z-20 border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)]/90 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur lg:rounded-t-2xl lg:px-6 lg:pt-4"
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 1}
            aria-label="Previous step"
            className="-ml-2 grid size-10 place-items-center rounded-full text-[color:var(--ink)] disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[color:var(--mauve)]">
            Step {step} of {TOTAL_STEPS} · {STEPS[step - 1].label}
          </p>
          <span aria-hidden="true" className="size-10" />
        </div>

        {/* Six dots — tappable to jump back. On larger screens they become a strip. */}
        <ol className="mt-3 flex items-center gap-1.5">
          {STEPS.map((s, i) => {
            const n = (i + 1) as StepIndex;
            const isDone = n < step;
            const isCurrent = n === step;
            return (
              <li key={s.id} className="flex-1">
                <button
                  type="button"
                  onClick={() => jumpTo(n)}
                  aria-label={`Go to step ${n}: ${s.label}`}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`block h-1.5 w-full rounded-full transition ${
                    isCurrent
                      ? "bg-[color:var(--rose)]"
                      : isDone
                        ? "bg-[color:var(--ink)]"
                        : "bg-[color:var(--line-soft)]"
                  }`}
                />
              </li>
            );
          })}
        </ol>
      </header>

      {/* ---------- Step body ---------- */}
      <div
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8"
        // Reserve room above the sticky footer so the last field is never hidden under it.
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 7.5rem)" }}
      >
        {/* key={step} re-mounts the panel, which re-triggers the slide animation. */}
        <div
          key={step}
          className={direction === "fwd" ? "step-enter-fwd" : "step-enter-back"}
        >
          {step === 1 && (
            <StepShell
              eyebrow="About you"
              title="What should we call you?"
              subtitle="Lowest friction first — just a name and a suburb so we can stop calling you 'new user'."
            >
              <label className="grid gap-2 text-sm font-bold">
                Display name
                <input
                  ref={firstFieldRef as React.Ref<HTMLInputElement>}
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
            </StepShell>
          )}

          {step === 2 && (
            <StepShell
              eyebrow="Quick check"
              title="When were you born?"
              subtitle="Click is 18+. We compute your age from this and never show your full DOB."
            >
              <div className="grid gap-2 text-sm font-bold">
                <span id="birth-date-label">Birth date</span>
                <BirthDatePicker
                  labelledBy="birth-date-label"
                  ref={firstFieldRef as React.Ref<HTMLButtonElement>}
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
            </StepShell>
          )}

          {step === 3 && (
            <StepShell
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
            </StepShell>
          )}

          {step === 4 && (
            <StepShell
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
            </StepShell>
          )}

          {step === 5 && (
            <StepShell
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
            </StepShell>
          )}

          {step === 6 && (
            <StepShell
              eyebrow="Optional"
              title="Anything we should know?"
              subtitle="One line is fine. Helps us hand-pick early events for you. Totally skippable."
            >
              <label className="grid gap-2 text-sm font-bold">
                Tell us what you want
                <textarea
                  ref={firstFieldRef as React.Ref<HTMLTextAreaElement>}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="min-h-32 rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 text-base font-semibold outline-none focus:border-[color:var(--rose)]"
                  placeholder="I want low-pressure ways to make friends after work."
                />
              </label>
            </StepShell>
          )}
        </div>

        {(stepError || message) && (
          <p
            role="alert"
            className="mt-4 rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-3 text-sm font-bold text-[color:var(--surface-deep)]"
          >
            {stepError || message}
          </p>
        )}
      </div>

      {/* ---------- Sticky footer: primary CTA + skip ---------- */}
      <footer
        className="sticky bottom-0 z-20 border-t-2 border-[color:var(--line)] bg-[color:var(--champagne)]/95 px-4 pt-3 backdrop-blur lg:rounded-b-2xl lg:px-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="flex items-center justify-between gap-3">
          {canSkip ? (
            <button
              type="button"
              onClick={() => {
                if (isFinal) {
                  void handleSubmit();
                } else {
                  transitionTo(clampStep(step + 1), "fwd");
                }
              }}
              disabled={state === "submitting"}
              className="text-sm font-bold uppercase tracking-wide text-[color:var(--mauve)] underline-offset-4 hover:underline disabled:opacity-50"
            >
              Skip for now
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={goNext}
            disabled={state === "submitting"}
            className="ml-auto rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {primaryLabel}
          </button>
        </div>
      </footer>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function StepShell({
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
    <div className="mx-auto grid w-full max-w-xl gap-5">
      <div>
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--rose)]">
          {eyebrow}
        </p>
        <h2 className="font-display mt-2 text-3xl font-light leading-[1.05] sm:text-4xl">
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
