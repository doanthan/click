"use client";

import { useEffect, useState } from "react";
import { submitPersonalityQuizAction } from "@/app/quiz/personality/actions";
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
            <span className="font-script not-italic text-[color:var(--rose)]">
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
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
          >
            Retake the quiz
          </button>
          <a
            href="/quiz/life"
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)] hover:text-[color:var(--surface-deep)]"
          >
            Add life tags →
          </a>
        </div>
      </QuizFrame>
    );
  }

  return (
    <QuizFrame
      eyebrow={isLoggedIn ? "Two-minute quiz" : "Tell us about you"}
      title={
        <>
          A <span className="italic">tiny</span> quiz so Click can suggest{" "}
          <span className="peach-highlight">rooms that fit you</span>.
        </>
      }
      subtitle="Four taps. We write you a Click persona and use it to surface compatible events."
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
      <section className="border-b-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-5 rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow sm:p-7">
            <div className="min-w-0 max-w-2xl">
              <span className="sticker sticker--peach tilt-l-2 inline-flex">
                <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
                ✷ about you
              </span>
              <h2 className="font-display mt-4 text-2xl font-light leading-[1.05] tracking-tight text-[color:var(--ink)] sm:text-3xl">
                A <span className="italic">tiny</span> quiz so Click can suggest{" "}
                <span className="peach-highlight">rooms that fit you</span>.
              </h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                Four taps · 30 seconds. We write you a Click persona and use it
                to surface compatible events.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="shrink-0 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:-translate-x-[1px] hover:-translate-y-[1px] hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
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
        className="absolute inset-0 cursor-default bg-[color:var(--ink)]/55 backdrop-blur-sm"
      />

      <div className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow">
        <div className="flex items-center justify-between gap-3 border-b-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-3">
          <span className="sticker sticker--peach tilt-l-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
            Tell us about you
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-7 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
          >
            ✕
          </button>
        </div>

        <div className="p-6 sm:p-8">
          <h2
            id="home-quiz-modal-title"
            className="font-display text-3xl font-light leading-[1.02] tracking-tight text-[color:var(--ink)] sm:text-4xl"
          >
            A <span className="italic">tiny</span> quiz so Click can suggest{" "}
            <span className="peach-highlight">rooms that fit you</span>.
          </h2>
          <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            Four taps. We write you a Click persona and use it to surface
            compatible events.
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
    if (isLoggedIn) return;
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
            className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4 hard-shadow-sm"
          >
            <legend className="font-mono px-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              {q.legend}
            </legend>
            <p className="mt-1 text-xs font-semibold text-[color:var(--mauve)]">
              {q.hint}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {q.options.map((opt) => (
                <label
                  key={opt.value}
                  className="cursor-pointer rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm has-[input:checked]:bg-[color:var(--rose)] has-[input:checked]:text-[color:var(--surface-deep)]"
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
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          {isLoggedIn ? (
            <>✷ takes 30 seconds · saved to your profile</>
          ) : (
            <>✷ log in to save your answers · 30 seconds total</>
          )}
        </p>
        <button
          type="submit"
          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:-translate-x-[1px] hover:-translate-y-[1px] hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
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
    <section className="border-b-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-2xl">
              <span className="sticker sticker--peach tilt-l-2 inline-flex">
                <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
                {eyebrow}
              </span>
              <h2 className="font-display mt-4 text-3xl font-light leading-[1.02] tracking-tight text-[color:var(--ink)] sm:text-4xl">
                {title}
              </h2>
              <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                {subtitle}
              </p>
            </div>
            <span className="sticker sticker--rose tilt-r-3 hidden sm:inline-flex">
              ✷ about you
            </span>
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}
