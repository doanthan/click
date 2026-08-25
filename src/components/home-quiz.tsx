"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { submitPersonalityQuizAction } from "@/app/quiz/personality/actions";
import {
  PERSONALITY_DRAFT,
  readPersonalityAnswers,
  type PersonalityDraft,
} from "@/app/quiz/personality/draft";
import { ckBtn, Icon } from "@/components/ds";
import { ModalShell } from "@/components/modal-shell";
import { useFormDraft } from "@/lib/use-form-draft";
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

  // Logged-out visitor - don't drop a full, unsavable form into the page. Show
  // a compact "about you" tag that opens the quiz in a modal; submitting there
  // prompts login (the deeper /quiz/personality flow is one click past that).
  if (!isLoggedIn) {
    return <LoggedOutQuizCta />;
  }

  // Logged-in user with a saved persona - show summary with a retake toggle.
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
          {/* ckBtn() and an <Icon>, not a raw class string and a literal arrow:
              a text arrow inherits neither icon sizing nor stroke, and screen
              readers read it out as part of the label. */}
          <button type="button" onClick={() => setRetaking(true)} className={ckBtn("primary", "md")}>
            <span className="ck-btn__label">Retake the quiz</span>
          </button>
          <Link href="/quiz/life" className={ckBtn("secondary", "md")}>
            <span className="ck-btn__label">
              Add life tags
              <Icon name="arrowR" size={16} />
            </span>
          </Link>
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
      <section className="px-5 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-5 rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] sm:p-7">
            <div className="min-w-0 max-w-2xl">
              <span className="text-xs font-bold tracking-[0.08em] uppercase text-[color:var(--purple-500)]">
                Pick your vibe
              </span>
              <h2 className="font-display mt-4 text-2xl font-semibold leading-[1.05] tracking-[-0.02em] text-balance text-[color:var(--ink)] sm:text-3xl">
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
              className={ckBtn("primary", "md", { className: "shrink-0" })}
            >
              <span className="ck-btn__label">
                Take the quiz
                <Icon name="arrowR" size={16} />
              </span>
            </button>
          </div>
        </div>
      </section>

      {open ? <QuizModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function QuizModal({ onClose }: { onClose: () => void }) {
  // ModalShell owns Escape, the Tab trap, the scroll lock and focus restore.
  // The hand-rolled version locked body scroll without trapping focus, so Tab
  // walked out onto a page the reader could no longer scroll.
  return (
    <ModalShell
      onClose={onClose}
      labelledBy="home-quiz-modal-title"
      zIndex={100}
      className="px-4 py-8"
      scrimClassName="bg-[rgba(28,24,48,0.5)]"
    >
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
    </ModalShell>
  );
}

function QuizForm({
  isLoggedIn,
  onLoggedOutSubmit,
}: {
  isLoggedIn: boolean;
  onLoggedOutSubmit?: () => void;
}) {
  // The radios are controlled now for one reason: we cannot persist answers we
  // cannot read. The name/value/required attributes stay on them, so the
  // logged-in path still posts natively and still gets browser validation.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Question names the browser rejected as empty on the last submit attempt.
  const [invalid, setInvalid] = useState<string[]>([]);

  const draftValues = useMemo<PersonalityDraft>(() => ({ answers }), [answers]);

  // The four taps now survive the login round trip. They used to be thrown
  // away at the wall - the one moment the product asks for effort before asking
  // for a signup was the one moment it discarded that effort. The same key
  // seeds the full wizard at /quiz/personality, so signing in lands on the
  // intent step with the bar already near the end instead of on a blank form.
  //
  // Nothing clears it from here. A form with `action=` hands off to the server
  // the moment this handler returns, so any clear() on this path would run
  // BEFORE the write, and a rejected save would have taken the answers with it.
  // The wizard clears the key on its own confirmed success; until then, keeping
  // a stale draft only ever means a retake starts from your last answers.
  useFormDraft<PersonalityDraft>({
    key: PERSONALITY_DRAFT.key,
    version: PERSONALITY_DRAFT.version,
    storage: PERSONALITY_DRAFT.storage,
    values: draftValues,
    apply: (saved) => {
      const restored = readPersonalityAnswers(saved);
      if (Object.keys(restored).length > 0) setAnswers(restored);
    },
  });

  function pick(name: string, value: string) {
    setAnswers((prev) => ({ ...prev, [name]: value }));
    // Answering clears that question's error and nothing else - a group the
    // user has not reached yet should not lose its marker.
    setInvalid((prev) => prev.filter((n) => n !== name));
  }

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
    // Logged out the radios are deliberately not `required` - the browser must
    // not block a submit this handler owns - which left nothing at all between
    // an untouched form and the login modal. So the button read "Log in to
    // save", walked the visitor to signup, and saved them nothing: there was
    // never anything in the draft to carry across. Mark the blanks with the
    // same per-question markers the logged-in path already uses and stop here.
    const missing = QUESTIONS.filter((q) => !answers[q.name]).map((q) => q.name);
    if (missing.length > 0) {
      setInvalid(missing);
      return;
    }
    // Close the quiz modal first so it isn't stacked behind the login modal.
    // The answers are already in storage, so /quiz/personality picks them up.
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
      {/* Default intent split - the /quiz/personality page lets users tune
          this; on the home block we use neutral defaults so the saved
          persona is still meaningful. */}
      <input type="hidden" name="intent_friendship" value="25" />
      <input type="hidden" name="intent_dating" value="25" />
      <input type="hidden" name="intent_networking" value="25" />
      <input type="hidden" name="intent_exploring" value="25" />

      <div className="grid gap-3 md:grid-cols-2">
        {QUESTIONS.map((q) => {
          const missing = invalid.includes(q.name);
          return (
            <fieldset
              key={q.name}
              className={`rounded-[var(--radius-lg)] border bg-[color:var(--paper)] p-4 ${
                missing
                  ? "border-[color:var(--danger)]"
                  : "border-[color:var(--line-soft)]"
              }`}
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
                      checked={answers[q.name] === opt.value}
                      onChange={() => pick(q.name, opt.value)}
                      // The radio is sr-only, so the browser's own validation
                      // bubble anchors to a clipped 1px box - it points at
                      // nothing. Catching invalid lets the error land on the
                      // question instead, where it can be read.
                      onInvalid={() =>
                        setInvalid((prev) => (prev.includes(q.name) ? prev : [...prev, q.name]))
                      }
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              {missing ? (
                <p role="alert" className="mt-2.5 text-xs font-medium text-[color:var(--danger)]">
                  Pick one to continue.
                </p>
              ) : null}
            </fieldset>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-[12px] text-[color:var(--slate)]">
          {isLoggedIn ? (
            <>Takes 30 seconds · saved to your profile</>
          ) : (
            <>Log in to save your answers · 30 seconds total</>
          )}
        </p>
        <button type="submit" className={ckBtn("primary", "md")}>
          <span className="ck-btn__label">
            {isLoggedIn ? "Save my persona" : "Log in to save"}
            <Icon name="arrowR" size={16} />
          </span>
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
    <section className="px-5 py-12 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
          <div className="max-w-2xl">
            <span className="text-xs font-bold tracking-[0.08em] uppercase text-[color:var(--purple-500)]">
              {eyebrow}
            </span>
            <h2 className="font-display mt-4 text-3xl font-bold leading-[1.02] tracking-[-0.025em] text-balance text-[color:var(--ink)] sm:text-4xl">
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
