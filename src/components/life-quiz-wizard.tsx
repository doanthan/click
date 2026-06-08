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

// Life quiz — multi-step wizard mirroring the /merchant/signup pattern. Each
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
// renders <LifeQuizStep step={n} /> which surfaces the progress pills and
// Back / Next / Save nav. Unlike the merchant wizard there's no per-step
// validation — the quiz is opt-in ("tap what fits, skip what doesn't"), so
// every step is skippable and Save commits whatever's selected.

// ---------- data ----------

export type Section = {
  slug: string;
  title: string;
  output: string;
  options: { slug: string; label: string }[];
};

export const SECTIONS: Section[] = [
  {
    slug: "life-stage",
    title: "Life stage",
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
      { slug: "rebuilding", label: "Rebuilding after a chapter" },
    ],
  },
  {
    slug: "availability",
    title: "Availability",
    output: "When you’re likely to actually show up.",
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
    output: "Rooms that match your energy.",
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
    output: "Where you’re at right now.",
    options: [
      { slug: "curious", label: "Curious" },
      { slug: "cautious", label: "Cautious" },
      { slug: "ready", label: "Ready" },
      { slug: "rebuilding-confidence", label: "Rebuilding confidence" },
    ],
  },
];

export const STEP_COUNT = SECTIONS.length;
// Step paths line up index-for-index with SECTIONS.
export const STEP_PATHS = SECTIONS.map((s) => `/quiz/life/${s.slug}`);

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
    <div className="mt-10">
      {/* Progress pills */}
      <ol className="flex items-center gap-2" aria-label="Progress">
        {SECTIONS.map((s, i) => {
          const done = i < step;
          const here = i === step;
          return (
            <li key={s.slug} className="flex-1">
              <button
                type="button"
                onClick={() => router.push(STEP_PATHS[i])}
                aria-label={`Go to ${s.title}`}
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
        Step {step + 1} of {STEP_COUNT} · {section.title}
      </p>

      {/* Section card */}
      <fieldset className="mt-6 rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
        <legend className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          {section.title} · {section.output}
        </legend>
        <div className="mt-4 flex flex-wrap gap-2">
          {section.options.map((opt) => {
            const selected = state.selected.includes(opt.slug);
            return (
              <button
                key={opt.slug}
                type="button"
                aria-pressed={selected}
                onClick={() => dispatch({ type: "toggle", slug: opt.slug })}
                className={[
                  "cursor-pointer rounded-full border-2 border-[color:var(--line)] px-4 py-2 text-sm font-bold hard-shadow-sm transition-colors",
                  selected
                    ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                    : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach-soft)]",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Nav buttons */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || pending}
          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[color:var(--cream)]"
        >
          ← Back
        </button>

        <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
          {state.selected.length} selected
        </span>

        {isLast ? (
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm disabled:cursor-not-allowed disabled:opacity-60 hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
          >
            {pending ? "Saving…" : "Save Life Quiz tags"}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
