"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icon, ckBtn, type IconName } from "@/components/ds";
import { submitPersonalityQuizAction } from "./actions";

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

export function PersonalityQuizWizard({ initialError }: { initialError?: boolean }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [intentMix, setIntentMix] = useState<Record<Intent, number>>({
    friendship: 25,
    dating: 25,
    networking: 25,
    exploring: 25,
  });
  const [error, setError] = useState(initialError ?? false);
  const [pending, startTransition] = useTransition();
  const advanceTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    };
  }, []);

  const currentQuestion = step < QUESTIONS.length ? QUESTIONS[step] : null;
  const isIntentStep = step === QUESTIONS.length;
  const intentTotal = useMemo(
    () => INTENTS.reduce((sum, k) => sum + (intentMix[k] || 0), 0),
    [intentMix],
  );

  function pickOption(name: string, value: string) {
    setAnswers((prev) => ({ ...prev, [name]: value }));
    setError(false);
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => {
      setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
    }, 420);
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function submit() {
    // Guard: every question must be answered before we hand off to the server.
    const missing = QUESTIONS.find((q) => !answers[q.name]);
    if (missing) {
      const idx = QUESTIONS.findIndex((q) => q.name === missing.name);
      setStep(idx);
      setError(true);
      return;
    }

    const fd = new FormData();
    for (const q of QUESTIONS) fd.append(q.name, answers[q.name]);
    for (const k of INTENTS) fd.append(`intent_${k}`, String(intentMix[k] ?? 0));

    startTransition(async () => {
      await submitPersonalityQuizAction(fd);
    });
  }

  return (
    <div className="mt-5">
      {/* Step counter + endowed progress bar */}
      <p className="font-display text-[12.5px] font-semibold text-[color:var(--slate)]">
        Step {step + 1} of {TOTAL_STEPS}
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--lav-bg)]"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-label={`Step ${step + 1} of ${TOTAL_STEPS}`}
      >
        <div
          className="h-full rounded-full bg-[color:var(--purple)] transition-[width] duration-500 ease-out"
          style={{ width: `${PCT[step]}%` }}
        />
      </div>

      {/* Section head - plain line glyph on a lavender disc, NEVER a spark */}
      <div className="mt-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-[color:var(--lavender-100)] text-[color:var(--purple)]">
          <Icon name={currentQuestion ? currentQuestion.icon : "radar"} size={19} stroke={1.8} />
        </span>
        <h1 className="font-display mt-3.5 text-[length:var(--text-h3)] font-semibold leading-[1.2] tracking-[-0.02em] text-[color:var(--ink)]">
          {currentQuestion ? currentQuestion.legend : "Your intent mix"}
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
          Pick an option to continue.
        </p>
      ) : null}

      {/* Question - one neutral option; selected = flat Deep-Purple fill, no tick */}
      {currentQuestion ? (
        <fieldset key={currentQuestion.name} className="mt-6">
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
        <fieldset className="mt-6">
          <legend className="sr-only">Intent mix</legend>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {INTENTS.map((intent) => (
              <label key={intent} className="grid gap-1.5">
                <span className="text-[13.5px] font-semibold capitalize text-[color:var(--ink)]">
                  {intent}
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={intentMix[intent]}
                  onChange={(e) =>
                    setIntentMix((prev) => ({
                      ...prev,
                      [intent]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                    }))
                  }
                  className="h-[50px] w-full rounded-xl border-[1.5px] border-[color:var(--mist-strong)] bg-[color:var(--paper)] px-3.5 text-base tabular-nums text-[color:var(--ink)]"
                />
              </label>
            ))}
          </div>
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

      {/* Nav */}
      <div className="mt-7 flex items-center gap-3 border-t border-[color:var(--mist)] pt-5">
        {step > 0 ? (
          <button
            type="button"
            onClick={goBack}
            disabled={pending}
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
            disabled={pending}
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
