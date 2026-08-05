import type { IconName } from "@/components/ds";

/**
 * The Life Quiz taxonomy - the single definition of which option slugs each
 * section owns.
 *
 * This lives in `lib` rather than beside the wizard because BOTH sides need it
 * and they sit on opposite sides of the client boundary:
 *
 *   - `src/components/life-quiz-wizard.tsx` ("use client") renders it.
 *   - `saveLifeQuizTags` in `src/lib/event-repository.ts` (server) uses it to
 *     bound a DELETE against `user_tags`.
 *
 * A server module cannot import from a "use client" file and get the array back
 * - it gets a client-reference proxy - which is why the taxonomy previously
 * existed as two hand-synced copies. That is a bad shape for data that decides
 * what a DELETE may touch: adding a wizard option without updating the server
 * copy silently made that answer impossible to deselect, because a slug the
 * server map does not know is never deletable. Fail-safe, but a silent bug.
 *
 * This file has no JSX and no client-only imports (`IconName` is type-only, so
 * it erases at compile time), so both sides - and `node --test` - can import it.
 *
 * Adding a section or option here now updates the wizard, the save's delete
 * scope, and the drift test in one edit.
 */
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

/**
 * Section slug -> the option slugs it owns. Derived, never hand-written, so it
 * cannot drift from SECTIONS above.
 *
 * This is the blast radius of the retake DELETE in `saveLifeQuizTags`: a row is
 * only ever deletable if its slug appears here under a section the submission
 * proves was on screen. Nothing outside this map can be reached.
 */
export const LIFE_QUIZ_SECTION_OPTIONS: Record<string, string[]> = Object.fromEntries(
  SECTIONS.map((section) => [section.slug, section.options.map((option) => option.slug)]),
);

/**
 * Every option slug the wizard can render. Used to filter the pre-populated set
 * the server hands the wizard: a quiz tag no section owns has no pill to sit on,
 * so seeding it would be an invisible selection nobody can turn off, and it
 * would inflate the "3 selected here" counts on a section it is not in.
 * Dropping it costs nothing - the save only deletes within a shown section's own
 * options, so an unknown slug stays on the profile untouched.
 */
export const KNOWN_OPTION_SLUGS = new Set(
  SECTIONS.flatMap((section) => section.options.map((option) => option.slug)),
);
