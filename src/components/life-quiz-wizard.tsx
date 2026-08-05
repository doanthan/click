"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  useTransition,
  type Dispatch,
} from "react";
import { useRouter } from "next/navigation";
import { submitLifeQuizAction } from "@/app/quiz/life/actions";
import { EndowedProgress, Icon, ckBtn } from "@/components/ds";
import { useFormDraft } from "@/lib/use-form-draft";
import { SECTIONS, KNOWN_OPTION_SLUGS, type Section } from "@/lib/life-quiz-sections";

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
// A RETAKE IS AN EDIT, NOT AN APPEND. The layout hands this provider the answers
// the profile already carries (getLifeQuizSelections) and seeds state with them,
// so a returning user opens on their own answers rather than a blank board -
// and saveLifeQuizTags is authoritative within the sections that were actually
// on screen, so a pill they turn off comes off the profile. Those two halves
// only work together: an authoritative save on a blank board would read every
// untouched section as "the user wants this empty". The sections a sitting
// showed are tracked in state.visited and travel with the submit, which is also
// what makes "I cleared this section" different from "I never opened it".
//
// Styling ports the DS quiz (`click-app-v2/quiz.jsx`): a Lucide line glyph on a
// lavender disc (never a spark - that's rationed to the three mechanic peaks),
// one neutral option pill whose selected state is a flat Deep-Purple fill with
// NO tick, and an ENDOWED progress bar that starts pre-filled.

// ---------- data ----------

// The taxonomy itself lives in src/lib/life-quiz-sections.ts, NOT here. The
// server's saveLifeQuizTags needs the same option lists to bound its retake
// DELETE, and a server module cannot import an array out of a "use client" file
// - it gets a client-reference proxy. Keeping the data in a shared, JSX-free lib
// module means the wizard and the delete scope can never disagree.
// Imported (not just re-exported) because STEP_COUNT and STEP_PATHS below are
// derived from SECTIONS and need the binding in local scope; re-exported so
// existing importers of SECTIONS from this module keep working.
export { SECTIONS, KNOWN_OPTION_SLUGS, type Section };

export const STEP_COUNT = SECTIONS.length;
// Step paths line up index-for-index with SECTIONS.
export const STEP_PATHS = SECTIONS.map((s) => `/quiz/life/${s.slug}`);
// Endowed progress: the bar is already moving on step 1, and it's fast early /
// slower late. It never starts at 0.
const PCT = [26, 48, 72, 92];

// ---------- state ----------

type State = {
  selected: string[];
  /** Section slugs this sitting has actually put on screen - see `visit`. */
  visited: string[];
};
type Action =
  | { type: "toggle"; slug: string }
  | { type: "visit"; slug: string }
  | { type: "restore"; selected: string[]; visited: string[] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "toggle": {
      const has = state.selected.includes(action.slug);
      return {
        ...state,
        selected: has
          ? state.selected.filter((s) => s !== action.slug)
          : [...state.selected, action.slug],
      };
    }
    // Records that a section was rendered, which is the only evidence the save
    // accepts before it is allowed to clear that section's tags. Dispatched from
    // a mount effect, so returning the SAME state object when the slug is
    // already recorded is load-bearing - a fresh object every time would
    // re-render forever.
    case "visit":
      return state.visited.includes(action.slug)
        ? state
        : { ...state, visited: [...state.visited, action.slug] };
    // Only ever dispatched once, by the draft rehydrate below.
    case "restore":
      return {
        // Replaced, not merged: a saved draft means exactly what the user last
        // had on screen, deselections included.
        selected: action.selected,
        // Unioned, and that asymmetry is deliberate. This action lands in a rAF
        // AFTER the mounted step has already recorded its own visit, so a
        // replace would drop the section the user is standing on and quietly
        // make it unclearable. Nothing extra becomes deletable either: every
        // slug in the draft was on screen in this same tab.
        visited: Array.from(new Set([...state.visited, ...action.visited])),
      };
  }
}

// Bump the version if the shape of State changes - older drafts are dropped
// rather than half-applied. v2 added `visited`; a v1 draft carries no record of
// which sections were shown, and applying it would let an authoritative save
// run with a blank shown-list.
const DRAFT_KEY = "click:quiz-life:v1";
const DRAFT_VERSION = 2;

// ---------- context ----------

type LifeQuizContextValue = {
  state: State;
  dispatch: Dispatch<Action>;
  /** The answers this sitting OPENED with, filtered to renderable options. */
  initial: string[];
  /** Removes the saved draft. Success branch only. */
  clearDraft: () => void;
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

export function LifeQuizProvider({
  children,
  initialSelected = [],
}: {
  children: React.ReactNode;
  /**
   * The quiz answers this profile already carries, read server-side in the
   * layout. Optional so the provider still renders if it is ever mounted
   * somewhere without a session.
   */
  initialSelected?: string[];
}) {
  // Mount-scoped on purpose. The layout re-renders on a soft navigation between
  // steps, so a prop read every render could swap this out mid-sitting for a
  // fresher server value and contradict edits already on screen. Reading a PROP
  // in an initialiser is fine - it is the same value on the server render and
  // the first client render, which is exactly what browser storage is not.
  const [initial] = useState(() => initialSelected.filter((s) => KNOWN_OPTION_SLUGS.has(s)));
  const [state, dispatch] = useReducer(reducer, { selected: initial, visited: [] });

  // The layout keeps this provider mounted across step navigation, which covers
  // Life stage → Availability → … but NOT a reload or a bookmarked deep link to
  // /quiz/life/energy - and this file's header sells those URLs as the reason
  // for per-step routes. sessionStorage closes that hole: same tab, same
  // sitting. The read happens inside useFormDraft's effect, never in the
  // useReducer initialiser, or the server and first client render disagree.
  //
  // The draft now means one thing only: an UNFINISHED sitting in this tab. It
  // is cleared on a successful save (see LifeQuizStep), because the server copy
  // it pre-populates from is authoritative from that moment - a kept draft in a
  // long-lived tab would silently re-assert answers the user has since changed
  // somewhere else. Restoring it wins over the server values while it exists,
  // which is right: it is the newer, in-progress edit.
  const { clear: clearDraft } = useFormDraft<State>({
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
        visited: Array.isArray(saved?.visited)
          ? saved.visited.filter((s): s is string => typeof s === "string")
          : [],
      }),
  });

  return (
    <LifeQuizContext.Provider value={{ state, dispatch, initial, clearDraft }}>
      {children}
    </LifeQuizContext.Provider>
  );
}

// ---------- step shell ----------

export function LifeQuizStep({ step }: { step: number }) {
  const { state, dispatch, initial, clearDraft } = useLifeQuiz();
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
  // Did this section arrive with answers on it? That is what separates "I turned
  // everything off here" from "I never answered this" - the same distinction the
  // save makes with state.visited, said out loud so the empty screen does not
  // read as untouched.
  const hadAnswersHere = section.options.some((o) => initial.includes(o.slug));
  const clearedHere = selectedHere === 0 && hadAnswersHere;

  // Seeing a section is what earns the right to clear it. The save sends
  // state.visited and the server deletes only inside those sections, so someone
  // deep-linking to /quiz/life/energy and pressing Finish can never wipe the
  // three sections they were never shown. Mount-scoped by section slug; the
  // reducer no-ops on a repeat, so the re-render this could cause never happens.
  const sectionSlug = section.slug;
  useEffect(() => {
    dispatch({ type: "visit", slug: sectionSlug });
  }, [dispatch, sectionSlug]);

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
    // The sections this sitting put on screen. Everything the authoritative
    // delete is allowed to touch is derived from this list server-side, so an
    // empty tag list for a visited section is how a deselect actually lands.
    for (const slug of state.visited) fd.append("section", slug);
    // Whether the sitting OPENED with answers. Only the client knows that, and
    // the hub needs it to tell "you cleared your answers" apart from "you
    // skipped every section and nothing was written" - two very different
    // endings that would otherwise both arrive as saved=0.
    if (initial.length > 0) fd.append("had", "1");
    setSaveError(false);
    startTransition(async () => {
      try {
        await submitLifeQuizAction(fd);
        // Success only: the action redirects on a good save, so getting past the
        // await means the write landed and the server copy is now the truth this
        // quiz pre-populates from. Never before it - a failed save has to leave
        // every pick on screen to retry with.
        clearDraft();
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
        {selectedHere > 0
          ? `${selectedHere} selected here`
          : clearedHere
            ? "Nothing selected here - finishing saves this section empty."
            : "Tap what fits. Skip what doesn't."}
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
              {/* Says what pressing it does. Three endings, three labels: a save,
                  a deliberate clear (they arrived with answers and turned them
                  all off - the retake is authoritative, so that is a real write),
                  and a finish that writes nothing at all. The landing on /quiz
                  says the same three things back. */}
              {nothingSelected
                ? initial.length > 0
                  ? "Finish and clear my answers"
                  : "Finish without saving"
                : "Finish"}
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
