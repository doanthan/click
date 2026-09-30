"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { loadQuizSuggestionsAction, saveClickQuizAction } from "@/app/quiz/life/actions";
import { EndowedProgress, Icon, Spark, ckBtn, type IconName } from "@/components/ds";
import { EventCard } from "@/components/event-card";
import { Skeleton } from "@/components/skeleton";
import {
  CLICK_QUIZ_STEPS,
  toggleAnswer,
  type ClickQuizAnswers,
  type ClickQuizState,
  type QuizQuestion,
} from "@/lib/click-quiz";

/**
 * The Click quiz - intro, five steps, finish - as click-tech
 * Click_Design_Prompt_Quiz.md (rev 5 Jul 2026) lays it out. One component, two
 * homes: the modal over whatever page it was opened from (LifeQuizModalLink),
 * and /quiz/life for a new tab or the welcome email's link.
 *
 * - Every question is optional. The footer is Back (from step 2) · a quiet
 *   Skip · ONE primary that always moves forward - Next, then Finish. The
 *   primary never offers to skip the section: the prominent action must not
 *   push people past the most useful answers (Cindy, 1 Jul).
 * - Every forward move autosaves the whole board and the step, so closing
 *   loses nothing and reopening lands where the member left off.
 * - The finish screen acknowledges, and never reads the answers back.
 */

const TOTAL = CLICK_QUIZ_STEPS.length;
const FINISHED = TOTAL + 1;
// Endowed progress: already moving on step 1, fast early and slower late. The
// finish screen draws its own full bar, because EndowedProgress never shows 100.
const PCT = [15, 36, 56, 74, 90];

const EYEBROW = "mt-3.5 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--purple)]";
const TITLE =
  "font-display mt-1.5 text-[length:var(--text-h3)] font-semibold leading-[1.2] tracking-[-0.02em] text-[color:var(--ink)] outline-none";
const QUIET =
  "font-display inline-flex min-h-11 items-center justify-center rounded-[12px] px-3 text-[14px] font-semibold text-[color:var(--slate)] transition-colors hover:text-[color:var(--ink)]";
const CLOSE =
  "grid size-11 shrink-0 place-items-center rounded-[12px] text-[color:var(--slate)] transition-colors hover:bg-[color:var(--lavender-100)] hover:text-[color:var(--ink)]";

type Suggestions = Awaited<ReturnType<typeof loadQuizSuggestionsAction>>;

export function ClickQuiz({
  initial,
  mode,
  onClose,
  onSaved,
}: {
  initial: ClickQuizState;
  mode: "modal" | "page";
  /** Modal: close back onto the page underneath. Without it, leaving is a link to /dashboard. */
  onClose?: () => void;
  /** Called after every save that landed. */
  onSaved?: () => void;
}) {
  // 0 = intro, 1..TOTAL = a step, FINISHED = the finish screen.
  const [step, setStep] = useState(() => Math.min(Math.max(Math.trunc(initial.step) || 0, 0), TOTAL));
  const [answers, setAnswers] = useState<ClickQuizAnswers>(initial.answers);
  const [finishing, startFinish] = useTransition();
  const [saveError, setSaveError] = useState(false);
  // undefined while loading; null when there is nothing to show.
  const [suggestions, setSuggestions] = useState<Suggestions | undefined>(undefined);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Only a move the member made takes focus - first paint leaves it where the
  // dialog put it.
  const moved = useRef(false);
  // Saves go out one at a time, in order. Each carries the whole board, so an
  // earlier autosave landing after Finish would otherwise put older answers back.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    // Announces the new screen, and scrolls a tall step's top back into view.
    headingRef.current?.focus();
  }, [step]);

  function go(next: number) {
    moved.current = true;
    setStep(next);
  }

  function save(nextStep: number, finish: boolean) {
    const board = answers;
    const run = queue.current.then(() => saveClickQuizAction({ answers: board, step: nextStep, finish }));
    queue.current = run.catch(() => undefined);
    return run.then((result) => {
      onSaved?.();
      return result;
    });
  }

  function pick(question: QuizQuestion, value: string) {
    setAnswers((current) => {
      const next = { ...current };
      const picked = toggleAnswer(question, current[question.id], value);
      if (picked === undefined) delete next[question.id];
      else next[question.id] = picked;
      return next;
    });
  }

  function finish() {
    if (finishing) return;
    setSaveError(false);
    startFinish(async () => {
      try {
        await save(TOTAL, true);
      } catch {
        // Nothing moved: every answer is still on screen to try again with.
        setSaveError(true);
        return;
      }
      go(FINISHED);
      loadQuizSuggestionsAction().then(setSuggestions, () => setSuggestions(null));
    });
  }

  function advance() {
    if (finishing) return;
    if (step >= TOTAL) return finish();
    // Best-effort: the next save carries the same board again, and Finish
    // says so out loud if it cannot land.
    save(step + 1, false).catch(() => {});
    go(step + 1);
  }

  function back() {
    if (finishing || step <= 1) return;
    go(step - 1);
  }

  const inStep = step >= 1 && step <= TOTAL;
  const section = inStep ? CLICK_QUIZ_STEPS[step - 1] : null;

  const closeControl = onClose ? (
    <button type="button" onClick={onClose} aria-label="Close the quiz" className={CLOSE}>
      <Icon name="x" size={18} stroke={2.2} />
    </button>
  ) : (
    <Link href="/dashboard" aria-label="Close the quiz" className={CLOSE}>
      <Icon name="x" size={18} stroke={2.2} />
    </Link>
  );

  return (
    <div className={mode === "modal" ? "flex max-h-[calc(100dvh-2rem)] flex-col" : "flex flex-col"}>
      {/* Top bar: progress · close. No wordmark (spec rev 1 Jul). */}
      <div className="flex flex-none items-start gap-4 px-5 pt-3 sm:px-7 sm:pt-4">
        <div className="min-w-0 flex-1 pt-2">
          {inStep ? (
            <EndowedProgress step={step - 1} total={TOTAL} pct={PCT[step - 1]} />
          ) : step === FINISHED ? (
            <div>
              <p className="font-display text-[12.5px] font-semibold text-[color:var(--slate)]">All done</p>
              <div className="mt-2 h-1.5 rounded-full bg-[color:var(--purple)]" />
            </div>
          ) : null}
        </div>
        {closeControl}
      </div>
      {/* The step counter for screen readers; focus moving to the heading reads
          the step's title. */}
      <p className="sr-only" aria-live="polite">
        {inStep ? `Step ${step} of ${TOTAL}` : ""}
      </p>

      <div className={`px-5 pt-2 pb-6 sm:px-7 ${mode === "modal" ? "min-h-0 flex-1 overflow-y-auto" : ""}`}>
        {step === 0 ? (
          <div className="rise-soft mx-auto max-w-[410px] text-center">
            <Glyph icon="compass" />
            <p className={EYEBROW}>The Click quiz</p>
            <h1 ref={headingRef} tabIndex={-1} className={TITLE}>
              Find your kind of night
            </h1>
            <p className="mt-2.5 text-[15px] leading-[1.55] text-[color:var(--ink-soft)]">
              A handful of quick questions, so we surface fewer, better things - the events and rooms that
              feel like you. About two minutes. Skip anything, change it all later.
            </p>
            <PrivateNote className="mx-auto mt-4 max-w-[360px]">
              Private to you - these tune your suggestions and never show on your profile.
            </PrivateNote>
            <div className="mt-5">
              <button type="button" onClick={() => go(1)} className={ckBtn("primary", "lg")}>
                <span className="ck-btn__label">
                  Start the quiz
                  <Icon name="arrowR" size={16} />
                </span>
              </button>
            </div>
            <div className="mt-1.5">
              {onClose ? (
                <button type="button" onClick={onClose} className={QUIET}>
                  Maybe later
                </button>
              ) : (
                <Link href="/dashboard" className={QUIET}>
                  Maybe later
                </Link>
              )}
            </div>
          </div>
        ) : section ? (
          <div key={step} className="rise-soft mx-auto max-w-[460px]">
            <div className="text-center">
              <Glyph icon={section.icon} />
              <p className={EYEBROW}>{section.eyebrow}</p>
              <h1 ref={headingRef} tabIndex={-1} className={TITLE}>
                {section.title}
              </h1>
              <p className="mt-1.5 text-[14px] leading-[1.5] text-[color:var(--slate)]">{section.sub}</p>
            </div>
            <div className="mt-6 grid gap-6">
              {section.questions.map((question) => (
                <QuestionBlock
                  key={question.id}
                  question={question}
                  value={answers[question.id]}
                  onPick={(value) => pick(question, value)}
                />
              ))}
            </div>
            {saveError ? (
              <p
                role="alert"
                className="mt-6 rounded-xl border border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--danger)_7%,var(--paper))] px-3.5 py-3 text-[13.5px] font-medium text-[color:var(--danger)]"
              >
                We couldn&apos;t save that just now. Your answers are still here - press Finish to try again.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="rise-soft">
            <div className="mx-auto max-w-[410px] text-center">
              <Glyph icon="check" />
              {/* The one sanctioned spark on a quiz surface (spec rev 1 Jul:
                  "Finish keeps the one sanctioned spark"). */}
              <h1 ref={headingRef} tabIndex={-1} className={`${TITLE} mt-3.5`}>
                You&apos;re all set{" "}
                <Spark size={22} tone="var(--purple)" className="inline-block align-[-2px]" />
              </h1>
              <p className="mt-2.5 text-[15px] leading-[1.6] text-[color:var(--ink-soft)]">
                Thanks - that helps a lot. We&apos;ll start leaning toward your kind of thing.
              </p>
            </div>
            <SuggestionStrip suggestions={suggestions} />
            <div className="mt-6 text-center">
              <Link href="/discover" className={ckBtn("primary", "lg")}>
                <span className="ck-btn__label">
                  See what&apos;s on
                  <Icon name="arrowR" size={16} />
                </span>
              </Link>
              <p className="mt-3 text-[13px] text-[color:var(--slate)]">Change your answers anytime in Settings.</p>
            </div>
          </div>
        )}
      </div>

      {inStep ? (
        <div className="flex flex-none items-center gap-2 border-t border-[color:var(--mist)] px-5 py-3 sm:px-7">
          {step > 1 ? (
            <button
              type="button"
              onClick={back}
              aria-disabled={finishing || undefined}
              className={ckBtn("ghost", "md")}
            >
              <span className="ck-btn__label">Back</span>
            </button>
          ) : null}
          <div className="flex-1" />
          <button type="button" onClick={advance} aria-disabled={finishing || undefined} className={QUIET}>
            Skip
          </button>
          <button
            type="button"
            onClick={advance}
            aria-disabled={finishing || undefined}
            aria-busy={finishing || undefined}
            className={ckBtn("primary", "md", { className: finishing ? "ck-btn--loading" : "" })}
          >
            <span className="ck-btn__label">
              {step === TOTAL ? "Finish" : "Next"}
              <Icon name="arrowR" size={16} />
            </span>
            {finishing ? <span className="ck-btn__spinner" aria-hidden /> : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** A plain line glyph on a lavender disc. Never the spark. */
function Glyph({ icon }: { icon: IconName }) {
  return (
    <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-[color:var(--lavender-100)] text-[color:var(--purple)]">
      <Icon name={icon} size={19} stroke={1.8} />
    </span>
  );
}

/** The lock line on a lavender-wash card (spec template section 6a). */
function PrivateNote({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <p
      className={`flex items-start gap-2 rounded-[16px] border border-[color:var(--lavender)] bg-[color:var(--lav-bg)] px-3.5 py-2.5 text-left text-[13px] leading-[1.5] text-[color:var(--purple-800)] ${className}`}
    >
      <Icon name="lock" size={14} stroke={1.9} className="mt-0.5 shrink-0 text-[color:var(--purple)]" />
      <span>{children}</span>
    </p>
  );
}

function QuestionBlock({
  question,
  value,
  onPick,
}: {
  question: QuizQuestion;
  value: string | string[] | undefined;
  onPick: (value: string) => void;
}) {
  const promptId = useId();
  const isOn = (option: string) => (Array.isArray(value) ? value.includes(option) : value === option);
  return (
    <div role="group" aria-labelledby={promptId}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span id={promptId} className="font-display text-[15.5px] leading-[1.3] font-semibold text-[color:var(--ink)]">
          {question.prompt}
        </span>
        {question.multi ? (
          <span className="text-[12.5px] font-medium text-[color:var(--slate)]">pick any</span>
        ) : null}
        {question.sensitive ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[color:var(--slate)]">
            <Icon name="lock" size={12} stroke={2} />
            optional
          </span>
        ) : null}
      </div>
      {/* One neutral pill; selected = flat Deep-Purple fill, cream label, NO
          tick. Colours are background-color longhands (bg-[color:...]), never
          a transitioned background shorthand, which left selected pills
          unpainted in the DS mock. */}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {question.options.map((option) => {
          const on = isOn(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(option.value)}
              className={`inline-flex min-h-11 items-center rounded-[12px] border-[1.5px] px-4 py-2.5 text-left text-[14.5px] leading-[1.3] transition-colors ${
                on
                  ? "border-[color:var(--purple)] bg-[color:var(--purple)] font-semibold text-[color:var(--champagne)]"
                  : "border-[color:var(--mist-strong)] bg-[color:var(--paper)] font-medium text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {question.note ? <PrivateNote className="mt-3">{question.note}</PrivateNote> : null}
    </div>
  );
}

/** "What's on near you this week", on the one Event Card the whole site uses. */
function SuggestionStrip({ suggestions }: { suggestions: Suggestions | undefined }) {
  const headingId = useId();
  if (suggestions === undefined) {
    return (
      <div className="mt-6 flex gap-3 overflow-hidden" aria-hidden>
        <Skeleton className="h-[300px] w-[248px] shrink-0 rounded-[16px]" />
        <Skeleton className="h-[300px] w-[248px] shrink-0 rounded-[16px]" />
      </div>
    );
  }
  // Low data or a failed read: the finish screen stands on its own.
  if (!suggestions || suggestions.events.length === 0) return null;
  const bookmarked = new Set(suggestions.bookmarkedIds);
  return (
    <section aria-labelledby={headingId} className="mt-6">
      <h2 id={headingId} className="font-display text-[15.5px] font-semibold text-[color:var(--ink)]">
        {suggestions.popular ? "Popular near you this week" : "What's on near you this week"}
      </h2>
      <div className="ckRail -mx-5 mt-3 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 sm:-mx-7 sm:scroll-px-7 sm:px-7">
        {suggestions.events.map((event) => (
          <div key={event.id} className="w-[248px] shrink-0 snap-start">
            <EventCard event={event} bookmarked={bookmarked.has(event.id)} />
          </div>
        ))}
      </div>
    </section>
  );
}
