"use client";

import {
  createContext,
  useContext,
  useReducer,
  useState,
  useTransition,
  type Dispatch,
} from "react";
import { useRouter } from "next/navigation";
import { submitLifeQuizAction } from "@/app/quiz/life/actions";
import { EndowedProgress, Icon, ckBtn, type IconName } from "@/components/ds";
import { useFormDraft } from "@/lib/use-form-draft";

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
type Action = { type: "toggle"; slug: string } | { type: "restore"; selected: string[] };

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
    // Only ever dispatched once, by the draft rehydrate below. It replaces the
    // whole array rather than merging so a saved draft means exactly what the
    // user last had on screen.
    case "restore":
      return { selected: action.selected };
  }
}

// Bump the version if the shape of State changes - older drafts are dropped
// rather than half-applied.
const DRAFT_KEY = "click:quiz-life:v1";
const DRAFT_VERSION = 1;

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

  // The layout keeps this provider mounted across step navigation, which covers
  // Life stage → Availability → … but NOT a reload or a bookmarked deep link to
  // /quiz/life/energy - and this file's header sells those URLs as the reason
  // for per-step routes. sessionStorage closes that hole: same tab, same
  // sitting. The read happens inside useFormDraft's effect, never in the
  // useReducer initialiser, or the server and first client render disagree.
  //
  // Deliberately never cleared. Saving is additive (saveLifeQuizTags only ever
  // inserts), so restoring the last answer set on a retake is closer to the
  // truth than showing an empty board to someone who already has quiz tags.
  useFormDraft<State>({
    key: DRAFT_KEY,
    version: DRAFT_VERSION,
    storage: "session",
    values: state,
    apply: (saved) =>
      dispatch({
        type: "restore",
        selected: Array.isArray(saved?.selected)
          ? saved.selected.filter((s): s is string => typeof s === "string")
          : [],
      }),
  });

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
  const [saveError, setSaveError] = useState(false);

  const section = SECTIONS[step];
  const isLast = step === STEP_COUNT - 1;
  // Scoped to THIS section, both for the nav label and for the caption below the
  // options. The caption used to render the global total, so arriving at step 2
  // with three life stages picked made an untouched screen read "3 selected".
  const selectedHere = section.options.filter((o) => state.selected.includes(o.slug)).length;
  const answeredHere = selectedHere > 0;
  const nothingSelected = state.selected.length === 0;

  function goNext() {
    router.push(STEP_PATHS[step + 1]);
  }

  function goBack() {
    if (pending) return;
    if (step > 0) router.push(STEP_PATHS[step - 1]);
  }

  function save() {
    // Back and Finish carry aria-disabled rather than disabled, so refusing the
    // repeat press is this function's job - a disabled control under the pointer
    // gets blurred by the browser, which dumps keyboard users to document start
    // exactly when they are waiting on the save.
    if (pending) return;
    const fd = new FormData();
    for (const slug of state.selected) fd.append("tag", slug);
    setSaveError(false);
    startTransition(async () => {
      try {
        await submitLifeQuizAction(fd);
      } catch {
        // A successful save redirects, so reaching here means the write did not
        // land. Without this the button sat on its pending label forever and the
        // quiz looked broken rather than retryable. The draft is untouched, so
        // every pick is still on screen to try again with.
        setSaveError(true);
      }
    });
  }

  return (
    <div className="mt-5">
      {/* Step counter + endowed progress bar. The markup is shared now, but the
          PCT curve stays this quiz's own so the pacing does not shift. */}
      <EndowedProgress step={step} total={STEP_COUNT} pct={PCT[step]} />

      {/* Section head - plain line glyph on a lavender disc, NEVER a spark.
          rise-soft replays on every step because each step is its own route, so
          the shell remounts. Motion is additive: the resting state is visible. */}
      <div className="rise-soft mt-8 text-center">
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
      <fieldset className="rise-soft rise-d1 mt-6">
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
        {selectedHere === 0
          ? "Tap what fits. Skip what doesn't."
          : `${selectedHere} selected here`}
      </p>

      {saveError ? (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--danger)_7%,var(--paper))] px-3.5 py-3 text-[13.5px] font-medium text-[color:var(--danger)]"
        >
          We couldn&apos;t save that just now. Your picks are still here - press Finish to try again.
        </p>
      ) : null}

      {/* Nav */}
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
        {/* No separate text "Skip": the primary button already self-labels
            Next vs "Skip section" from answeredHere, so the two controls did
            exactly the same thing side by side. One primary per screen. */}
        {isLast ? (
          <button
            type="button"
            onClick={save}
            aria-disabled={pending || undefined}
            aria-busy={pending || undefined}
            className={ckBtn("primary", "md", { className: pending ? "ck-btn--loading" : "" })}
          >
            <span className="ck-btn__label">
              {/* Says what pressing it costs. Nothing selected means nothing to
                  save, and the landing on /quiz says so too - an empty finish
                  must not look identical to a real one. */}
              {nothingSelected ? "Finish without saving" : "Finish"}
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
