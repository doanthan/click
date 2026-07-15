"use client";

import {
  createContext,
  useContext,
  useReducer,
  useTransition,
  type Dispatch,
} from "react";
import { useRouter } from "next/navigation";
import { submitLifeQuizAction } from "@/app/quiz/life/actions";
import { Icon, ckBtn, type IconName } from "@/components/ds";

// Life quiz - multi-step wizard mirroring the /merchant/signup pattern. Each
// section gets its own URL so users can bookmark, link to, and browser-back
// through them:
//   /quiz/life              · entry → redirects to the first step
//   /quiz/life/life-stage   · step 1/4
//   /quiz/life/availability · step 2/4
//   /quiz/life/event-style  · step 3/4
//   /quiz/life/energy       · step 4/4 → Save
//
// Selected tags live in a React context provided by <LifeQuizProvider> mounted
// in the route's layout, so they persist across client-side navigation between
// sibling step pages (App Router keeps shared layouts mounted). Each step page
// renders <LifeQuizStep step={n} /> which surfaces the progress bar and
// Back / Skip / Next / Save nav. Unlike the merchant wizard there's no per-step
// validation - the quiz is opt-in ("tap what fits, skip what doesn't"), so
// every step is skippable and Save commits whatever's selected.
//
// Styling ports the DS quiz (`click-app-v2/quiz.jsx`): a Lucide line glyph on a
// lavender disc (never a spark - that's rationed to the three mechanic peaks),
// one neutral option pill whose selected state is a flat Deep-Purple fill with
// NO tick, and an ENDOWED progress bar that starts pre-filled.

// ---------- data ----------

export type Section = {
  slug: string;
  title: string;
  /** Plain line glyph on a lavender disc. Never a spark on a quiz surface. */
  icon: IconName;
  output: string;
  options: { slug: string; label: string }[];
};

export const SECTIONS: Section[] = [
  {
    slug: "life-stage",
    title: "Life stage",
    icon: "user",
    output: "Pulls events tagged for similar moments.",
    options: [
      { slug: "student", label: "Student" },
      { slug: "new-to-town", label: "New to town" },
      { slug: "single-social", label: "Single & social" },
      { slug: "in-a-relationship", label: "In a relationship" },
      { slug: "pet-owner", label: "Pet owner" },
      { slug: "new-parent", label: "New parent" },
      { slug: "empty-nester", label: "Empty nester" },
      { slug: "traveller", label: "Traveller / nomad" },
      { slug: "career-pivot", label: "Career pivot" },
      { slug: "recently-single", label: "Recently single" },
      { slug: "retiree", label: "Retiree" },
    ],
  },
  {
    slug: "availability",
    title: "Availability",
    icon: "calendar",
    output: "When you're likely to actually show up.",
    options: [
      { slug: "weeknights", label: "Weeknights" },
      { slug: "weekends", label: "Weekends" },
      { slug: "mornings", label: "Mornings" },
      { slug: "flexible-schedule", label: "Flexible schedule" },
    ],
  },
  {
    slug: "event-style",
    title: "Event style",
    icon: "compass",
    output: "Rooms that fit your energy.",
    options: [
      { slug: "small-table", label: "Small table" },
      { slug: "active", label: "Active / outdoors" },
      { slug: "creative", label: "Creative / hands-on" },
      { slug: "high-energy", label: "High energy" },
      { slug: "quiet-setting", label: "Quiet setting" },
    ],
  },
  {
    slug: "energy",
    title: "Energy and mood",
    icon: "radar",
    output: "Where you're at right now.",
    options: [
      { slug: "curious", label: "Curious" },
      { slug: "cautious", label: "Cautious" },
      { slug: "ready", label: "Ready" },
    ],
  },
];

export const STEP_COUNT = SECTIONS.length;
// Step paths line up index-for-index with SECTIONS.
export const STEP_PATHS = SECTIONS.map((s) => `/quiz/life/${s.slug}`);
// Endowed progress: the bar is already moving on step 1, and it's fast early /
// slower late. It never starts at 0.
const PCT = [26, 48, 72, 92];

// ---------- state ----------

type State = { selected: string[] };
type Action = { type: "toggle"; slug: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "toggle": {
      const has = state.selected.includes(action.slug);
      return {
        selected: has
          ? state.selected.filter((s) => s !== action.slug)
          : [...state.selected, action.slug],
      };
    }
  }
}

// ---------- context ----------

type LifeQuizContextValue = {
  state: State;
  dispatch: Dispatch<Action>;
};

const LifeQuizContext = createContext<LifeQuizContextValue | null>(null);

function useLifeQuiz(): LifeQuizContextValue {
  const value = useContext(LifeQuizContext);
  if (!value) {
    throw new Error(
      "useLifeQuiz must be used inside <LifeQuizProvider> (mounted in src/app/quiz/life/layout.tsx)",
    );
  }
  return value;
}

export function LifeQuizProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { selected: [] });
  return (
    <LifeQuizContext.Provider value={{ state, dispatch }}>
      {children}
    </LifeQuizContext.Provider>
  );
}

// ---------- step shell ----------

export function LifeQuizStep({ step }: { step: number }) {
  const { state, dispatch } = useLifeQuiz();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const section = SECTIONS[step];
  const isLast = step === STEP_COUNT - 1;
  const answeredHere = section.options.some((o) => state.selected.includes(o.slug));

  function goNext() {
    router.push(STEP_PATHS[step + 1]);
  }

  function goBack() {
    if (step > 0) router.push(STEP_PATHS[step - 1]);
  }

  function save() {
    const fd = new FormData();
    for (const slug of state.selected) fd.append("tag", slug);
    startTransition(async () => {
      await submitLifeQuizAction(fd);
    });
  }

  return (
    <div className="mt-5">
      {/* Step counter + endowed progress bar */}
      <p className="font-display text-[12.5px] font-semibold text-[color:var(--slate)]">
        Step {step + 1} of {STEP_COUNT}
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--lav-bg)]"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={STEP_COUNT}
        aria-label={`Step ${step + 1} of ${STEP_COUNT}`}
      >
        <div
          className="h-full rounded-full bg-[color:var(--purple)] transition-[width] duration-500 ease-out"
          style={{ width: `${PCT[step]}%` }}
        />
      </div>

      {/* Section head - plain line glyph on a lavender disc, NEVER a spark */}
      <div className="mt-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-[color:var(--lavender-100)] text-[color:var(--purple)]">
          <Icon name={section.icon} size={19} stroke={1.8} />
        </span>
        <h1 className="font-display mt-3.5 text-[length:var(--text-h3)] font-semibold leading-[1.2] tracking-[-0.02em] text-[color:var(--ink)]">
          {section.title}
        </h1>
        <p className="mt-1.5 text-[14px] leading-[1.5] text-[color:var(--slate)]">
          {section.output}
        </p>
      </div>

      {/* Options - one neutral pill; selected = flat Deep-Purple fill, no tick */}
      <fieldset className="mt-6">
        <legend className="sr-only">{section.title}</legend>
        <div className="flex flex-wrap justify-center gap-2">
          {section.options.map((opt) => {
            const selected = state.selected.includes(opt.slug);
            return (
              <button
                key={opt.slug}
                type="button"
                aria-pressed={selected}
                onClick={() => dispatch({ type: "toggle", slug: opt.slug })}
                className={`inline-flex min-h-11 items-center justify-center rounded-xl border-[1.5px] px-4 py-2.5 text-[14.5px] transition-colors ${
                  selected
                    ? "border-[color:var(--purple)] bg-[color:var(--purple)] font-semibold text-[color:var(--champagne)]"
                    : "border-[color:var(--mist-strong)] bg-[color:var(--paper)] font-medium text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="mt-4 text-center text-[13px] text-[color:var(--slate)]">
        {state.selected.length === 0
          ? "Tap what fits. Skip what doesn't."
          : `${state.selected.length} selected`}
      </p>

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
        {!isLast ? (
          <button
            type="button"
            onClick={goNext}
            className="font-display px-1 text-sm font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)]"
          >
            Skip
          </button>
        ) : null}
        {isLast ? (
          <button
            type="button"
            onClick={save}
            disabled={pending}
            aria-busy={pending || undefined}
            className={ckBtn("primary", "md", { className: pending ? "ck-btn--loading" : "" })}
          >
            <span className="ck-btn__label">
              Finish
              <Icon name="arrowR" size={16} />
            </span>
            {pending ? <span className="ck-btn__spinner" aria-hidden /> : null}
          </button>
        ) : (
          <button type="button" onClick={goNext} className={ckBtn("primary", "md")}>
            <span className="ck-btn__label">
              {answeredHere ? "Next" : "Skip section"}
              <Icon name="arrowR" size={16} />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
