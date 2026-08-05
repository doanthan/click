"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { EndowedProgress, FormField, Icon, ckBtn, type IconName } from "@/components/ds";
import { useFormDraft } from "@/lib/use-form-draft";
import { submitPersonalityQuizAction } from "./actions";
import { PERSONALITY_DRAFT, readPersonalityAnswers, type PersonalityDraft } from "./draft";

// Styling ports the DS quiz (`click-app-v2/quiz.jsx`): a Lucide line glyph on a
// lavender disc (never a spark - that's rationed to the three mechanic peaks),
// one neutral option whose selected state is a flat Deep-Purple fill with NO
// tick, and an ENDOWED progress bar that starts pre-filled.
//
// The old per-pick confetti burst is gone on purpose: the DS bans gamification
// trinkets (no confetti / badges / streaks) - dopamine comes from a real moment,
// and a quiz answer isn't one.

type Option = { value: string; label: string; body: string };
type Question = { name: string; legend: string; sub: string; icon: IconName; options: Option[] };

const QUESTIONS: Question[] = [
  {
    name: "social_energy",
    legend: "Social energy",
    sub: "No right answers - just what's true for you.",
    icon: "users",
    options: [
      { value: "introvert", label: "Introvert", body: "I refuel alone after socialising." },
      { value: "ambivert", label: "Ambivert", body: "Depends on the day and the room." },
      { value: "extrovert", label: "Extrovert", body: "I refuel by being around people." },
    ],
  },
  {
    name: "pace",
    legend: "Preferred pace",
    sub: "The rooms you enjoy most.",
    icon: "clock",
    options: [
      { value: "relaxed", label: "Relaxed", body: "Long table, slow chat, no hurry." },
      { value: "balanced", label: "Balanced", body: "Light structure, some flow." },
      { value: "fast_moving", label: "Fast moving", body: "Stations, rotations, lots of motion." },
    ],
  },
  {
    name: "openness",
    legend: "Openness",
    sub: "How you like to arrive somewhere new.",
    icon: "compass",
    options: [
      { value: "cautious", label: "Cautious", body: "I want to feel the room before I dive in." },
      { value: "curious", label: "Curious", body: "I'll try most things once." },
      { value: "ready", label: "Ready", body: "All in. New everything." },
    ],
  },
  {
    name: "frequency",
    legend: "How often you want to show up",
    sub: "So we lean toward what actually fits your week.",
    icon: "calendar",
    options: [
      { value: "occasional", label: "Occasional", body: "One thing a month is plenty." },
      { value: "active", label: "Active", body: "About once a week." },
      { value: "enthusiastic", label: "Enthusiastic", body: "A few things a week." },
    ],
  },
];

const INTENTS = ["friendship", "dating", "networking", "exploring"] as const;
type Intent = (typeof INTENTS)[number];

const TOTAL_STEPS = QUESTIONS.length + 1; // +1 for intent mix
// Endowed progress: pre-filled on step 1, fast early / slower late. Never 0.
const PCT = [22, 44, 62, 80, 96];

const PICK_MESSAGE = "Pick an option to continue.";

export function PersonalityQuizWizard({ initialError }: { initialError?: boolean }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [intentMix, setIntentMix] = useState<Record<Intent, number>>({
    friendship: 25,
    dating: 25,
    networking: 25,
    exploring: 25,
  });
  // A string, not a boolean: the intent step needs to say something different
  // from "pick an option", and two error slots would be two designs.
  const [error, setError] = useState<string | null>(initialError ? PICK_MESSAGE : null);
  const [pending, startTransition] = useTransition();
  const advanceTimer = useRef<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Only a step change the user caused should move focus. Without this, the
  // heading would grab focus on first paint, which nobody asked for.
  const focusHeadingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    };
  }, []);

  // Auto-advance unmounts the keyed fieldset the user is standing on, so their
  // focus lands on <body> and the next Tab restarts from the top of the page.
  // Parking focus on the new heading keeps the caret where the content is and
  // gets the new question read out; the live region below carries the counter.
  useEffect(() => {
    if (!focusHeadingRef.current) return;
    focusHeadingRef.current = false;
    headingRef.current?.focus();
  }, [step]);

  const draftValues = useMemo<PersonalityDraft>(() => ({ answers }), [answers]);

  // Picks up the four answers the homepage teaser collected before sending the
  // visitor to log in, and doubles as reload insurance for this wizard. Landing
  // on the first UNANSWERED question is what makes the handoff feel earned: a
  // complete set drops straight onto the intent step with the bar at 96%.
  const { clear: clearDraft } = useFormDraft<PersonalityDraft>({
    key: PERSONALITY_DRAFT.key,
    version: PERSONALITY_DRAFT.version,
    storage: PERSONALITY_DRAFT.storage,
    values: draftValues,
    apply: (saved) => {
      const restored = readPersonalityAnswers(saved);
      if (Object.keys(restored).length === 0) return;
      setAnswers(restored);
      const firstUnanswered = QUESTIONS.findIndex((q) => !restored[q.name]);
      setStep(firstUnanswered === -1 ? QUESTIONS.length : firstUnanswered);
    },
  });

  const currentQuestion = step < QUESTIONS.length ? QUESTIONS[step] : null;
  const isIntentStep = step === QUESTIONS.length;
  const intentTotal = useMemo(
    () => INTENTS.reduce((sum, k) => sum + (intentMix[k] || 0), 0),
    [intentMix],
  );
  const heading = currentQuestion ? currentQuestion.legend : "Your intent mix";

  function pickOption(name: string, value: string) {
    setAnswers((prev) => ({ ...prev, [name]: value }));
    setError(null);
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => {
      focusHeadingRef.current = true;
      setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
    }, 420);
  }

  function goBack() {
    if (pending) return;
    // A pick within the last 420ms still has an advance queued, and letting it
    // land would bounce the user forward again a moment after they asked to go
    // back. Their newer intent wins.
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    // Back swaps the same content out from under focus, so it needs the same
    // handling as the auto-advance.
    focusHeadingRef.current = true;
    setStep((s) => Math.max(s - 1, 0));
  }

  function submit() {
    // The nav buttons carry aria-disabled rather than disabled, so refusing the
    // repeat press is this function's job - two presses would be two personas.
    if (pending) return;

    // Guard: every question must be answered before we hand off to the server.
    const missing = QUESTIONS.find((q) => !answers[q.name]);
    if (missing) {
      const idx = QUESTIONS.findIndex((q) => q.name === missing.name);
      focusHeadingRef.current = true;
      setStep(idx);
      setError(PICK_MESSAGE);
      return;
    }

    // The mix used to render in --danger whenever it was not 100 while submit
    // ignored it entirely and the server stored the numbers as given - a red
    // signal that blocked nothing. Now the red means what it looks like. The
    // button stays enabled and focusable so pressing it is what explains why.
    if (intentTotal !== 100) {
      setError(`Your mix adds up to ${intentTotal}. Adjust it to 100 to save.`);
      return;
    }

    const fd = new FormData();
    for (const q of QUESTIONS) fd.append(q.name, answers[q.name]);
    for (const k of INTENTS) fd.append(`intent_${k}`, String(intentMix[k] ?? 0));

    setError(null);
    startTransition(async () => {
      try {
        await submitPersonalityQuizAction(fd);
        // Success only: the action redirects to /quiz on a good save, so getting
        // past the await means the write went through. Never before it - a
        // failed save has to leave the answers where the user can retry them.
        clearDraft();
      } catch {
        // Otherwise the button sits on its pending label forever and a save
        // that never happened is indistinguishable from one that did.
        setError("We couldn't save that just now. Your answers are still here - press Save persona to try again.");
      }
    });
  }

  return (
    <div className="mt-5">
      {/* Step counter + endowed progress bar. Shared markup now; the PCT curve
          stays this quiz's own so the pacing does not shift. */}
      <EndowedProgress step={step} total={TOTAL_STEPS} pct={PCT[step]} />

      {/* This wizard lives on ONE URL, so unlike the life quiz it gets no route
          announcement when the step changes. This region is that announcement.
          Polite, and only the counter - the heading it pairs with is announced
          by the focus move, and saying both twice is noise. */}
      <p className="sr-only" aria-live="polite">
        Step {step + 1} of {TOTAL_STEPS}
      </p>

      {/* Section head - plain line glyph on a lavender disc, NEVER a spark.
          Keyed on the step so rise-soft replays as each one arrives; the
          resting state is fully visible, the motion is only additive. */}
      <div key={`head-${step}`} className="rise-soft mt-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-[color:var(--lavender-100)] text-[color:var(--purple)]">
          <Icon name={currentQuestion ? currentQuestion.icon : "radar"} size={19} stroke={1.8} />
        </span>
        {/* tabIndex={-1}: not in the tab order, but focusable from script, which
            is what lets the step change carry focus without adding a stop. */}
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-display mt-3.5 text-[length:var(--text-h3)] font-semibold leading-[1.2] tracking-[-0.02em] text-[color:var(--ink)]"
        >
          {heading}
        </h1>
        <p className="mt-1.5 text-[14px] leading-[1.5] text-[color:var(--slate)]">
          {currentQuestion
            ? currentQuestion.sub
            : "Split 100 across these - it shapes what we suggest, and nothing else."}
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--danger)_7%,var(--paper))] px-3.5 py-3 text-[13.5px] font-medium text-[color:var(--danger)]"
        >
          {error}
        </p>
      ) : null}

      {/* Question - one neutral option; selected = flat Deep-Purple fill, no tick */}
      {currentQuestion ? (
        <fieldset key={currentQuestion.name} className="rise-soft rise-d1 mt-6">
          <legend className="sr-only">{currentQuestion.legend}</legend>
          <div className="grid gap-2.5">
            {currentQuestion.options.map((opt) => {
              const selected = answers[currentQuestion.name] === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  aria-pressed={selected}
                  onClick={() => pickOption(currentQuestion.name, opt.value)}
                  className={`min-h-11 rounded-xl border-[1.5px] px-4 py-3 text-left transition-colors ${
                    selected
                      ? "border-[color:var(--purple)] bg-[color:var(--purple)]"
                      : "border-[color:var(--mist-strong)] bg-[color:var(--paper)] hover:bg-[color:var(--lavender-100)]"
                  }`}
                >
                  <span
                    className={`block text-[15px] font-semibold ${
                      selected ? "text-[color:var(--champagne)]" : "text-[color:var(--ink)]"
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span
                    className={`mt-0.5 block text-[12.5px] leading-[1.45] ${
                      selected
                        ? "text-[color:var(--lavender-200)]"
                        : "text-[color:var(--slate)]"
                    }`}
                  >
                    {opt.body}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {/* Intent mix step */}
      {isIntentStep ? (
        <fieldset className="rise-soft rise-d1 mt-6">
          <legend className="sr-only">Intent mix</legend>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {INTENTS.map((intent) => (
              // FormField carries the shared .ck-input treatment, so these four
              // stop being the only hand-styled controls in the quiz family.
              <FormField
                key={intent}
                label={intent.charAt(0).toUpperCase() + intent.slice(1)}
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                value={intentMix[intent]}
                onChange={(e) =>
                  setIntentMix((prev) => ({
                    ...prev,
                    [intent]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                  }))
                }
              />
            ))}
          </div>
          {/* The --danger reading is now backed by submit(), which refuses a
              mix that is not 100. One signal, and it means what it looks
              like - it used to be red and block nothing. */}
          <p
            className={`mt-3.5 text-[13px] font-medium tabular-nums ${
              intentTotal === 100
                ? "text-[color:var(--slate)]"
                : "text-[color:var(--danger)]"
            }`}
          >
            Total: {intentTotal} / 100
          </p>
        </fieldset>
      ) : null}

      {/* Nav. aria-disabled, never the disabled attribute: a control that goes
          disabled under the pointer is blurred by the browser, which drops a
          keyboard user back to the top of the document mid-save. The handlers
          below are what actually refuse the second press. */}
      <div className="mt-7 flex items-center gap-3 border-t border-[color:var(--mist)] pt-5">
        {step > 0 ? (
          <button
            type="button"
            onClick={goBack}
            aria-disabled={pending || undefined}
            className={ckBtn("secondary", "md")}
          >
            <span className="ck-btn__label">Back</span>
          </button>
        ) : null}
        <div className="flex-1" />
        {isIntentStep ? (
          <button
            type="button"
            onClick={submit}
            aria-disabled={pending || undefined}
            aria-busy={pending || undefined}
            className={ckBtn("primary", "md", { className: pending ? "ck-btn--loading" : "" })}
          >
            <span className="ck-btn__label">
              Save persona
              <Icon name="arrowR" size={16} />
            </span>
            {pending ? <span className="ck-btn__spinner" aria-hidden /> : null}
          </button>
        ) : (
          <p className="text-[13px] text-[color:var(--slate)]">Pick one to continue</p>
        )}
      </div>
    </div>
  );
}
