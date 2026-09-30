import type { IconName } from "@/components/ds";

/**
 * The Click quiz - the ONE definition of its steps, questions and answers, and
 * of what each answer turns into. The modal (src/components/click-quiz.tsx),
 * its save (saveClickQuiz in src/lib/event-repository.ts) and node --test all
 * import it, which is why it holds no JSX and only a type-only import.
 *
 * Canon: click-tech UIUX/Cowork/Click_Design_Prompt_Quiz.md (rev 5 Jul 2026)
 * for every string, TECH/08_LIFE_TAGS.md section 2 for what an answer
 * generates. The quiz is intent-neutral on purpose: intent and dating
 * preferences belong to onboarding and Settings, and asking them here too would
 * give the same fact two sources that drift.
 *
 * An answer becomes one of three things:
 *   - a LIFE TAG (lifeTagsFor): life chapter, pet, LGBTQ+, alcohol-free. Written
 *     to user_tags as tag_type 'life', which matching reads (pair overlap, event
 *     targeting, the new-to-town cohort) and no surface renders - see
 *     src/lib/attendee-fomo.ts and the interest-only filters on every people
 *     query.
 *   - the PERSONA (personaFor): recharge, strangers, pace. Written to
 *     click_personas, which both event rankers and the people matcher read.
 *   - nothing yet: room size, vibe, structure, who you click with, social mood,
 *     the other comfort needs, free days and travel range. Kept in
 *     click_quiz_answers until matching has a feature for each.
 */

export type QuizOption = { value: string; label: string };

export type QuizQuestion = {
  id: string;
  prompt: string;
  /** "pick any". */
  multi?: boolean;
  /**
   * A multi-select answer that stands alone ("None of these"): picking it
   * clears the rest, and picking anything else clears it.
   */
  exclusive?: string;
  /** Sensitive: the prompt carries a lock and "optional". */
  sensitive?: boolean;
  /** The soft line under the options, on a lavender-wash card. */
  note?: string;
  options: QuizOption[];
};

export type QuizStep = {
  eyebrow: string;
  title: string;
  sub: string;
  /** A plain line glyph on a lavender disc - never the spark. */
  icon: IconName;
  questions: QuizQuestion[];
};

/** question id -> option value, or option values for a multi-select. */
export type ClickQuizAnswers = Record<string, string | string[]>;

/** What the quiz opens on (getClickQuizForSession). */
export type ClickQuizState = {
  answers: ClickQuizAnswers;
  /** 0 opens on the intro; 1-5 reopens on that step. */
  step: number;
  completed: boolean;
};

// Fun first, sensitive last. Option values are storage keys: renaming one
// orphans every saved answer that used it, so change labels, not values.
export const CLICK_QUIZ_STEPS: QuizStep[] = [
  {
    eyebrow: "Your kind of room",
    title: "Set the scene",
    sub: "The rooms you enjoy most - pick whatever fits.",
    icon: "compass",
    questions: [
      {
        id: "size",
        prompt: "Size that suits you",
        multi: true,
        options: [
          { value: "intimate", label: "Small and intimate" },
          { value: "medium-group", label: "Medium" },
          { value: "large-social", label: "Big and buzzing" },
        ],
      },
      {
        id: "vibe",
        prompt: "The vibe you're after",
        multi: true,
        options: [
          { value: "creative", label: "Hands-on and creative" },
          { value: "active", label: "Active and physical" },
          { value: "social", label: "Social and easygoing" },
          { value: "educational", label: "Learning something new" },
          { value: "calm", label: "Calm and restorative" },
        ],
      },
      {
        id: "structure",
        prompt: "You'd rather it be",
        options: [
          { value: "structured", label: "With a plan" },
          { value: "unstructured", label: "Loose and free-flowing" },
          { value: "flexible", label: "Don't mind either way" },
        ],
      },
    ],
  },
  {
    eyebrow: "How you connect",
    title: "Your social style",
    sub: "No right answers - just what's true for you.",
    icon: "users",
    questions: [
      {
        id: "recharge",
        prompt: "You recharge by",
        // Values ARE the click_personas.social_energy enum - see personaFor.
        options: [
          { value: "introvert", label: "Time on your own" },
          { value: "ambivert", label: "A bit of both" },
          { value: "extrovert", label: "Being around people" },
        ],
      },
      {
        id: "strangers",
        prompt: "Walking into a room of strangers, you",
        options: [
          { value: "observe", label: "Hang back and read the room" },
          { value: "jump-in", label: "Dive in and say hi" },
          { value: "depends", label: "Depends on the day" },
        ],
      },
      {
        id: "clickwith",
        prompt: "You tend to click with people who are",
        multi: true,
        options: [
          { value: "deep", label: "Thoughtful and deep" },
          { value: "playful", label: "Fun and spontaneous" },
          { value: "driven", label: "Driven and ambitious" },
          { value: "warm", label: "Warm and caring" },
        ],
      },
      {
        id: "pace",
        prompt: "Your social pace",
        options: [
          { value: "relaxed", label: "Slow and steady" },
          { value: "balanced", label: "Somewhere in between" },
          { value: "fast", label: "Fast, I love variety" },
        ],
      },
    ],
  },
  {
    eyebrow: "What you're after lately",
    title: "Right about now",
    sub: "This can shift - update it whenever.",
    icon: "clock",
    questions: [
      {
        id: "socially",
        prompt: "Socially, right now you're",
        options: [
          { value: "open", label: "Open and curious" },
          { value: "expanding", label: "Keen to widen your circle" },
          { value: "fun", label: "In a good place, just here for fun" },
        ],
      },
      {
        id: "comfort",
        prompt: "You feel most at ease when",
        multi: true,
        exclusive: "easy",
        options: [
          { value: "activity", label: "There's an activity to focus on" },
          { value: "small-group", label: "It's a small group" },
          { value: "alcohol-free", label: "It's alcohol-free" },
          { value: "easy", label: "No specific needs, I'm easy" },
        ],
      },
    ],
  },
  {
    eyebrow: "Your week & range",
    title: "Timing and distance",
    sub: "So we lean toward what actually fits your life.",
    icon: "calendar",
    questions: [
      {
        id: "free",
        prompt: "When you're usually free",
        multi: true,
        options: [
          { value: "weekday-morning", label: "Weekday mornings" },
          { value: "weekday-evening", label: "Weekday evenings" },
          { value: "saturday", label: "Saturdays" },
          { value: "sunday", label: "Sundays" },
          { value: "flexible", label: "Varies week to week" },
        ],
      },
      {
        id: "distance",
        prompt: "How far you'll travel for a good one",
        options: [
          { value: "suburb", label: "Keep it in my suburb" },
          { value: "twenty-minutes", label: "Up to ~20 minutes" },
          { value: "across-city", label: "Across the city for the right thing" },
          { value: "anywhere", label: "Distance doesn't faze me" },
        ],
      },
    ],
  },
  {
    eyebrow: "A little about you",
    title: "Anything you'd like us to know?",
    sub: "All optional - it just helps us connect you with people in a similar chapter.",
    icon: "user",
    questions: [
      {
        id: "stage",
        prompt: "Any of these fit right now?",
        multi: true,
        exclusive: "none",
        options: [
          { value: "new-in-town", label: "New in town" },
          { value: "new-parent", label: "New parent" },
          { value: "single-parent", label: "Single parent" },
          { value: "student", label: "Student" },
          { value: "recently-retired", label: "Recently retired" },
          { value: "getting-back-out-there", label: "Getting back out there" },
          { value: "changing-careers", label: "Changing careers" },
          { value: "kids-left-home", label: "Kids grown and left home" },
          { value: "none", label: "None of these" },
        ],
      },
      {
        id: "pet",
        prompt: "A pet in your life?",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "lgbtq",
        prompt: "Do you identify as LGBTQ+?",
        sensitive: true,
        // The spec's exact line. No community-signal copy, ever: nothing about
        // this answer is shown to anyone, singly or in aggregate.
        note: "Optional and private to you - it helps us keep events welcoming.",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          { value: "prefer-not", label: "Prefer not to say" },
        ],
      },
    ],
  },
];

export const CLICK_QUIZ_QUESTIONS: QuizQuestion[] = CLICK_QUIZ_STEPS.flatMap((step) => step.questions);

const QUESTION_BY_ID = new Map(CLICK_QUIZ_QUESTIONS.map((question) => [question.id, question]));

/**
 * The only way answers get in - from the modal, from the jsonb column, or from
 * a server action's untrusted payload. Unknown questions and values drop out; a
 * single-select keeps one string; a multi-select keeps its values in option
 * order, de-duplicated, and an exclusive answer sitting beside real ones loses
 * to them.
 */
export function sanitizeAnswers(raw: unknown): ClickQuizAnswers {
  const out: ClickQuizAnswers = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const input = raw as Record<string, unknown>;
  for (const question of CLICK_QUIZ_QUESTIONS) {
    const value = input[question.id];
    const allowed = question.options.map((option) => option.value);
    if (question.multi) {
      if (!Array.isArray(value)) continue;
      let picked = allowed.filter((option) => value.includes(option));
      if (question.exclusive && picked.length > 1) {
        picked = picked.filter((option) => option !== question.exclusive);
      }
      if (picked.length > 0) out[question.id] = picked;
    } else if (typeof value === "string" && allowed.includes(value)) {
      out[question.id] = value;
    }
  }
  return out;
}

/**
 * One tap on a pill. Every question is optional, so tapping the selected
 * single answer clears it rather than doing nothing.
 */
export function toggleAnswer(
  question: QuizQuestion,
  current: string | string[] | undefined,
  value: string,
): string | string[] | undefined {
  if (!question.multi) return current === value ? undefined : value;
  const picked = Array.isArray(current) ? current : [];
  if (picked.includes(value)) {
    const rest = picked.filter((option) => option !== value);
    return rest.length > 0 ? rest : undefined;
  }
  if (value === question.exclusive) return [value];
  return [...picked.filter((option) => option !== question.exclusive), value];
}

export type QuizLifeTag = { slug: string; label: string };

/**
 * Answer -> life tag, per TECH 08 section 2. Slugs are the spec's; a label only
 * names the tag row for admins, because a member's life tags are never shown to
 * anyone. Two comfort answers ("activity", "small-group") are deliberately
 * absent: the spec makes them 30-day mood tags for event targeting only, and
 * this schema has neither an expiry nor a way to keep a tag out of the pair
 * overlap. They stay in click_quiz_answers.
 */
const LIFE_TAG_FOR: Record<string, Record<string, QuizLifeTag>> = {
  stage: {
    "new-in-town": { slug: "new-to-town", label: "New in town" },
    "new-parent": { slug: "new-parent", label: "New parent" },
    "single-parent": { slug: "single-parent", label: "Single parent" },
    student: { slug: "student", label: "Student" },
    "recently-retired": { slug: "retired", label: "Retired" },
    "getting-back-out-there": { slug: "returning-to-social", label: "Getting back out there" },
    "changing-careers": { slug: "career-pivot", label: "Career pivot" },
    "kids-left-home": { slug: "empty-nester", label: "Empty nester" },
  },
  pet: { yes: { slug: "pet-owner", label: "Pet owner" } },
  lgbtq: { yes: { slug: "lgbtq-plus", label: "LGBTQ+" } },
  comfort: { "alcohol-free": { slug: "sober-curious", label: "Alcohol-free" } },
};

/** Every life tag the quiz can write. */
export const CLICK_QUIZ_LIFE_TAGS: QuizLifeTag[] = Object.values(LIFE_TAG_FOR).flatMap((map) => Object.values(map));

function valuesOf(answers: ClickQuizAnswers, questionId: string): string[] {
  const value = answers[questionId];
  if (Array.isArray(value)) return value;
  return typeof value === "string" ? [value] : [];
}

function lookup<T>(map: Record<string, T>, key: string | undefined): T | null {
  return key !== undefined && Object.hasOwn(map, key) ? map[key] : null;
}

export function lifeTagsFor(answers: ClickQuizAnswers): QuizLifeTag[] {
  return Object.entries(LIFE_TAG_FOR).flatMap(([questionId, map]) =>
    valuesOf(answers, questionId).flatMap((value) => lookup(map, value) ?? []),
  );
}

export type QuizPersona = {
  socialEnergy: "introvert" | "ambivert" | "extrovert" | null;
  pace: "relaxed" | "balanced" | "fast_moving" | null;
  openness: "cautious" | "curious" | "ready" | null;
};

const ENERGY_FROM_RECHARGE = { introvert: "introvert", ambivert: "ambivert", extrovert: "extrovert" } as const;
const ENERGY_FROM_STRANGERS = { observe: "introvert", depends: "ambivert", "jump-in": "extrovert" } as const;
const OPENNESS_FROM_STRANGERS = { observe: "cautious", depends: "curious", "jump-in": "ready" } as const;
const PACE_FROM_ANSWER = { relaxed: "relaxed", balanced: "balanced", fast: "fast_moving" } as const;

/**
 * The click_personas columns the rankers read, per TECH 08 section 2. Recharge
 * sets social energy; "a room of strangers" only reinforces it, so it decides
 * when recharge was skipped. The same answer is the quiz's closest question to
 * the old openness scale ("feel the room before I dive in"). A skipped question
 * stays null - never a made-up middle value.
 */
export function personaFor(answers: ClickQuizAnswers): QuizPersona {
  const [recharge] = valuesOf(answers, "recharge");
  const [strangers] = valuesOf(answers, "strangers");
  const [pace] = valuesOf(answers, "pace");
  return {
    socialEnergy: lookup(ENERGY_FROM_RECHARGE, recharge) ?? lookup(ENERGY_FROM_STRANGERS, strangers),
    pace: lookup(PACE_FROM_ANSWER, pace),
    openness: lookup(OPENNESS_FROM_STRANGERS, strangers),
  };
}

// Old Life quiz pills that still have a home in the Click quiz. The rest - the
// energy-and-mood trio's "cautious" and "ready", "Single & social", "In a
// relationship", "Traveller", and "Recently single" (a fragile-state tag the
// spec retired) - answered questions the quiz no longer asks, so nothing
// carries them forward and the first Finish takes them off.
const LEGACY_LIFE_QUIZ_ANSWERS: Record<string, [string, string][]> = {
  retiree: [["stage", "recently-retired"]],
  weeknights: [["free", "weekday-evening"]],
  weekends: [["free", "saturday"], ["free", "sunday"]],
  mornings: [["free", "weekday-morning"]],
  "flexible-schedule": [["free", "flexible"]],
  "small-table": [["size", "intimate"]],
  "high-energy": [["size", "large-social"]],
  "creative-hands-on": [["vibe", "creative"]],
  active: [["vibe", "active"]],
  "quiet-setting": [["vibe", "calm"]],
  curious: [["socially", "open"]],
};

// Every tag the quiz itself writes maps straight back to its answer. Derived, so
// it cannot drift from LIFE_TAG_FOR.
const ANSWER_FOR_TAG: Record<string, [string, string][]> = Object.fromEntries(
  Object.entries(LIFE_TAG_FOR).flatMap(([questionId, map]) =>
    Object.entries(map).map(([value, tag]) => [tag.slug, [[questionId, value]]]),
  ),
);

const RECHARGE_FROM_ENERGY = { introvert: "introvert", ambivert: "ambivert", extrovert: "extrovert" } as const;
const STRANGERS_FROM_OPENNESS = { cautious: "observe", curious: "depends", ready: "jump-in" } as const;
const PACE_FROM_PERSONA = { relaxed: "relaxed", balanced: "balanced", fast_moving: "fast" } as const;

/**
 * The answers a member's existing quiz data already gives - their quiz life tags
 * and latest persona - for someone who has never saved the Click quiz. Opening
 * on them is what keeps the save honest: Finish is authoritative over every
 * quiz life tag, so on a blank board it would clear answers the member never
 * saw.
 */
export function answersFromExisting(
  lifeTagSlugs: string[],
  persona: { socialEnergy: string | null; pace: string | null; openness: string | null } | null,
): ClickQuizAnswers {
  const answers: Record<string, string | string[]> = {};
  const add = ([questionId, value]: [string, string]) => {
    const question = QUESTION_BY_ID.get(questionId);
    if (!question) return;
    const existing = answers[questionId];
    answers[questionId] = question.multi ? [...(Array.isArray(existing) ? existing : []), value] : value;
  };
  for (const slug of lifeTagSlugs) {
    (lookup(ANSWER_FOR_TAG, slug) ?? lookup(LEGACY_LIFE_QUIZ_ANSWERS, slug) ?? []).forEach(add);
  }
  const recharge = lookup(RECHARGE_FROM_ENERGY, persona?.socialEnergy ?? undefined);
  const strangers = lookup(STRANGERS_FROM_OPENNESS, persona?.openness ?? undefined);
  const pace = lookup(PACE_FROM_PERSONA, persona?.pace ?? undefined);
  if (recharge) add(["recharge", recharge]);
  if (strangers) add(["strangers", strangers]);
  if (pace) add(["pace", pace]);
  return sanitizeAnswers(answers);
}
