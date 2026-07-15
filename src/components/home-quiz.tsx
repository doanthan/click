"use client";

import { useEffect, useState } from "react";
import { submitPersonalityQuizAction } from "@/app/quiz/personality/actions";
import { fireBrandConfetti } from "./brand-confetti";
import { openLoginModal } from "./login-modal-host";

type Question = {
  name: "social_energy" | "pace" | "openness" | "frequency";
  legend: string;
  hint: string;
  options: { value: string; label: string }[];
};

// Compact 4-question subset of /quiz/personality, suitable for the top of /.
// Submit goes to the same server action (`submitPersonalityQuizAction`), which
// writes a row to click_personas and redirects to /quiz?from=personality.
const QUESTIONS: Question[] = [
  {
    name: "social_energy",
    legend: "Social energy",
    hint: "Where do you refuel?",
    options: [
      { value: "introvert", label: "Introvert" },
      { value: "ambivert", label: "Ambivert" },
      { value: "extrovert", label: "Extrovert" },
    ],
  },
  {
    name: "pace",
    legend: "Pace",
    hint: "What kind of room?",
    options: [
      { value: "relaxed", label: "Relaxed" },
      { value: "balanced", label: "Balanced" },
      { value: "fast_moving", label: "Fast" },
    ],
  },
  {
    name: "openness",
    legend: "Openness",
    hint: "How do you arrive?",
    options: [
      { value: "cautious", label: "Cautious" },
      { value: "curious", label: "Curious" },
      { value: "ready", label: "Ready" },
    ],
  },
  {
    name: "frequency",
    legend: "Frequency",
    hint: "How often do you show up?",
    options: [
      { value: "occasional", label: "Occasional" },
      { value: "active", label: "Active" },
      { value: "enthusiastic", label: "Enthusiastic" },
    ],
  },
];

type HomeQuizProps = {
  isLoggedIn: boolean;
  persona?: {
    personaName: string;
    socialEnergy: string;
    pace: string;
    openness: string;
    engagementFrequency: string;
  } | null;
};

export function HomeQuiz({ isLoggedIn, persona = null }: HomeQuizProps) {
  const [retaking, setRetaking] = useState(false);

  // Logged-out visitor — don't drop a full, unsavable form into the page. Show
  // a compact "about you" tag that opens the quiz in a modal; submitting there
  // prompts login (the deeper /quiz/personality flow is one click past that).
  if (!isLoggedIn) {
    return <LoggedOutQuizCta />;
  }

  // Logged-in user with a saved persona — show summary with a retake toggle.
  if (isLoggedIn && persona && !retaking) {
    return (
      <QuizFrame
        eyebrow="Your Click persona"
        title={
          <>
            You read as{" "}
            <span className="font-display font-semibold text-[color:var(--purple)]">
              {persona.personaName}
            </span>
            .
          </>
        }
        subtitle={`${persona.socialEnergy} · ${persona.pace} pace · ${persona.openness} · ${persona.engagementFrequency}`}
      >
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setRetaking(true)}
            className="ck-btn ck-btn--md ck-btn--primary"
          >
            Retake the quiz
          </button>
          <a
            href="/quiz/life"
            className="ck-btn ck-btn--md ck-btn--secondary"
          >
            Add life tags →
          </a>
        </div>
      </QuizFrame>
    );
  }

  return (
    <QuizFrame
      eyebrow="Pick your vibe"
      title={
        <>
          A <span className="text-[color:var(--purple)]">tiny</span> quiz so Click can suggest{" "}
          <span className="peach-highlight">rooms that fit you</span>.
        </>
      }
      subtitle="Four taps. We write you a Click persona and lean your suggestions toward events that feel like you."
    >
      <QuizForm isLoggedIn={isLoggedIn} />
    </QuizFrame>
  );
}

// Logged-out homepage treatment: a slim "about you" tag + one-line pitch with a
// button that opens the four-question quiz in a modal. Keeps the value prop
// visible without dropping a tall, unsavable form into the page flow.
function LoggedOutQuizCta() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="bg-[color:var(--lav-bg)] px-5 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-5 rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] sm:p-7">
            <div className="min-w-0 max-w-2xl">
              <span className="text-xs font-bold tracking-[0.08em] uppercase text-[color:var(--purple-500)]">
                Pick your vibe
              </span>
              <h2 className="font-display mt-4 text-2xl font-semibold leading-[1.05] tracking-[-0.02em] text-[color:var(--ink)] sm:text-3xl">
                A <span className="text-[color:var(--purple)]">tiny</span> quiz so Click can suggest{" "}
                <span className="peach-highlight">rooms that fit you</span>.
              </h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                Four taps · 30 seconds. We write you a Click persona and lean
                your suggestions toward events that feel like you.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="ck-btn ck-btn--md ck-btn--primary shrink-0"
            >
              Take the quiz →
            </button>
          </div>
        </div>
      </section>

      {open ? <QuizModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function QuizModal({ onClose }: { onClose: () => void }) {
  // Mirror the LoginModal chrome: lock scroll + close on Escape while open.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-quiz-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8"
    >
      <button
        type="button"
        aria-label="Close quiz"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[rgba(28,24,48,0.5)]"
      />

      <div className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[var(--radius-xl)] bg-[color:var(--paper)] shadow-[0_12px_32px_rgba(28,24,48,0.14)]">
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line-soft)] px-5 py-3.5">
          <span className="text-xs font-bold tracking-[0.08em] uppercase text-[color:var(--purple-500)]">
            Pick your vibe
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-full bg-[color:var(--lavender-100)] text-sm text-[color:var(--slate)] hover:text-[color:var(--ink)]"
          >
            ✕
          </button>
        </div>

        <div className="p-6 sm:p-8">
          <h2
            id="home-quiz-modal-title"
            className="font-display text-3xl font-bold leading-[1.02] tracking-[-0.025em] text-[color:var(--ink)] sm:text-4xl"
          >
            A <span className="text-[color:var(--purple)]">tiny</span> quiz so Click can suggest{" "}
            <span className="peach-highlight">rooms that fit you</span>.
          </h2>
          <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            Four taps. We write you a Click persona and lean your suggestions
            toward events that feel like you.
          </p>
          <QuizForm isLoggedIn={false} onLoggedOutSubmit={onClose} />
        </div>
      </div>
    </div>
  );
}

function QuizForm({
  isLoggedIn,
  onLoggedOutSubmit,
}: {
  isLoggedIn: boolean;
  onLoggedOutSubmit?: () => void;
}) {
  // Logged-out submit: intercept and open the login modal so the user can
  // sign in / sign up. We don't preserve selections through login — they
  // can re-tap once back, and the deeper /quiz/personality form is one
  // click away from the post-login flow.
  function handleLoggedOutSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (isLoggedIn) {
      // Real success path: the persona is about to be saved by the server
      // action (required fields guarantee a valid submit). Celebrate the save
      // with a brand confetti beat, fired from where the submit button sits.
      // It is reduced-motion guarded inside fireBrandConfetti.
      const button = event.currentTarget.querySelector('button[type="submit"]');
      const rect = button?.getBoundingClientRect();
      const origin = rect
        ? {
            x: (rect.left + rect.width / 2) / window.innerWidth,
            y: (rect.top + rect.height / 2) / window.innerHeight,
          }
        : undefined;
      void fireBrandConfetti(origin);
      return;
    }
    event.preventDefault();
    // Close the quiz modal first so it isn't stacked behind the login modal.
    onLoggedOutSubmit?.();
    openLoginModal({ callbackUrl: "/quiz/personality" });
  }

  return (
    <form
      // When logged in, this calls the server action directly. When logged
      // out, the onSubmit handler short-circuits before the action fires.
      action={isLoggedIn ? submitPersonalityQuizAction : undefined}
      onSubmit={handleLoggedOutSubmit}
      className="mt-6 grid gap-4"
    >
      {/* Default intent split — the /quiz/personality page lets users tune
          this; on the home block we use neutral defaults so the saved
          persona is still meaningful. */}
      <input type="hidden" name="intent_friendship" value="25" />
      <input type="hidden" name="intent_dating" value="25" />
      <input type="hidden" name="intent_networking" value="25" />
      <input type="hidden" name="intent_exploring" value="25" />

      <div className="grid gap-3 md:grid-cols-2">
        {QUESTIONS.map((q) => (
          <fieldset
            key={q.name}
            className="rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-4"
          >
            <legend className="px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--purple-700)]">
              {q.legend}
            </legend>
            <p className="mt-1 text-xs text-[color:var(--slate)]">
              {q.hint}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {q.options.map((opt) => (
                <label
                  key={opt.value}
                  className="cursor-pointer rounded-xl border-[1.5px] border-[color:var(--mist-strong)] bg-[color:var(--paper)] px-3.5 py-2 text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:border-[color:var(--slate)] has-[input:checked]:border-transparent has-[input:checked]:bg-[color:var(--purple)] has-[input:checked]:text-[color:var(--champagne)]"
                >
                  <input
                    type="radio"
                    name={q.name}
                    value={opt.value}
                    required={isLoggedIn}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-[12px] text-[color:var(--slate)]">
          {isLoggedIn ? (
            <>Takes 30 seconds · saved to your profile</>
          ) : (
            <>Log in to save your answers · 30 seconds total</>
          )}
        </p>
        <button
          type="submit"
          className="ck-btn ck-btn--md ck-btn--primary"
        >
          {isLoggedIn ? "Save my persona →" : "Log in to save →"}
        </button>
      </div>
    </form>
  );
}

function QuizFrame({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[color:var(--lav-bg)] px-5 py-12 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
          <div className="max-w-2xl">
            <span className="text-xs font-bold tracking-[0.08em] uppercase text-[color:var(--purple-500)]">
              {eyebrow}
            </span>
            <h2 className="font-display mt-4 text-3xl font-bold leading-[1.02] tracking-[-0.025em] text-[color:var(--ink)] sm:text-4xl">
              {title}
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
              {subtitle}
            </p>
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}
