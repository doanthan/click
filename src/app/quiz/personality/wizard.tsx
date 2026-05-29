"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { submitPersonalityQuizAction } from "./actions";
import { fireConfetti } from "./confetti";

type Option = { value: string; label: string; body: string };
type Question = { name: string; legend: string; options: Option[] };

const QUESTIONS: Question[] = [
  {
    name: "social_energy",
    legend: "Social energy",
    options: [
      { value: "introvert", label: "Introvert", body: "I refuel alone after socialising." },
      { value: "ambivert", label: "Ambivert", body: "Depends on the day and the room." },
      { value: "extrovert", label: "Extrovert", body: "I refuel by being around people." },
    ],
  },
  {
    name: "pace",
    legend: "Preferred pace",
    options: [
      { value: "relaxed", label: "Relaxed", body: "Long table, slow chat, no hurry." },
      { value: "balanced", label: "Balanced", body: "Light structure, some flow." },
      { value: "fast_moving", label: "Fast moving", body: "Stations, rotations, lots of motion." },
    ],
  },
  {
    name: "openness",
    legend: "Openness",
    options: [
      { value: "cautious", label: "Cautious", body: "Want to feel the room before I dive in." },
      { value: "curious", label: "Curious", body: "I’ll try most things once." },
      { value: "ready", label: "Ready", body: "All-in. New everything." },
    ],
  },
  {
    name: "frequency",
    legend: "How often you want to show up",
    options: [
      { value: "occasional", label: "Occasional", body: "One thing a month is plenty." },
      { value: "active", label: "Active", body: "About once a week." },
      { value: "enthusiastic", label: "Enthusiastic", body: "Multiple things a week." },
    ],
  },
];

const INTENTS = ["friendship", "dating", "networking", "exploring"] as const;
type Intent = (typeof INTENTS)[number];

const TOTAL_STEPS = QUESTIONS.length + 1; // +1 for intent mix

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

  function pickOption(name: string, value: string, evt: React.MouseEvent<HTMLButtonElement>) {
    const rect = evt.currentTarget.getBoundingClientRect();
    fireConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
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
    <div className="mt-10">
      {/* Progress pills */}
      <ol className="flex items-center gap-2" aria-label="Progress">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
          const done = i < step;
          const here = i === step;
          return (
            <li key={i} className="flex-1">
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1}`}
                aria-current={here ? "step" : undefined}
                className={[
                  "h-2 w-full rounded-full border-2 border-[color:var(--line)] transition-colors",
                  done
                    ? "bg-[color:var(--peach)]"
                    : here
                      ? "bg-[color:var(--rose)]"
                      : "bg-[color:var(--cream)]",
                ].join(" ")}
              />
            </li>
          );
        })}
      </ol>
      <p className="mt-3 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        Step {step + 1} of {TOTAL_STEPS}
      </p>

      {error ? (
        <p className="mt-6 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-3 text-sm font-bold text-[color:var(--surface-deep)]">
          Pick an option to continue.
        </p>
      ) : null}

      {/* Question card */}
      {currentQuestion ? (
        <fieldset
          key={currentQuestion.name}
          className="mt-6 rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm"
        >
          <legend className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
            {currentQuestion.legend}
          </legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {currentQuestion.options.map((opt) => {
              const selected = answers[currentQuestion.name] === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={(e) => pickOption(currentQuestion.name, opt.value, e)}
                  className={[
                    "cursor-pointer rounded-2xl border-2 border-[color:var(--line)] p-4 text-left hard-shadow-sm transition-colors",
                    selected
                      ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                      : "bg-[color:var(--champagne)] hover:bg-[color:var(--peach-soft)]",
                  ].join(" ")}
                >
                  <span className="block text-sm font-bold uppercase tracking-wide">
                    {opt.label}
                  </span>
                  <span className="mt-1 block text-xs font-semibold leading-5 opacity-80">
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
        <fieldset className="mt-6 rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
          <legend className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
            Intent mix · split 100 across these
          </legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {INTENTS.map((intent) => (
              <label
                key={intent}
                className="grid gap-2 text-sm font-bold text-[color:var(--ink)]"
              >
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
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
                  className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] outline-none focus:bg-[color:var(--cream)]"
                />
              </label>
            ))}
          </div>
          <p
            className={[
              "mt-3 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em]",
              intentTotal === 100 ? "text-[color:var(--mauve)]" : "text-[color:var(--rose)]",
            ].join(" ")}
          >
            Total: {intentTotal} / 100
          </p>
        </fieldset>
      ) : null}

      {/* Nav buttons */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || pending}
          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm disabled:opacity-40"
        >
          ← Back
        </button>

        {isIntentStep ? (
          <button
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              fireConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, 120);
              submit();
            }}
            disabled={pending}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)] disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save Persona"}
          </button>
        ) : (
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Pick one to continue →
          </p>
        )}
      </div>
    </div>
  );
}
