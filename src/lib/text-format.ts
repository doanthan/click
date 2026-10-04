// Small, framework-agnostic text helpers shared by client components and the
// server repository. Keep this file dependency-free so it can be imported from
// both the browser bundle (event-create wizard) and Node (event-repository).

// Bug board #334. The Event Card clamps its title at two lines and reserves
// both (DS README, Event Card: "assume a ~60-char title cap so titles never
// exceed ~2 lines"), but nothing enforced the cap, so a long title lost its
// tail to the ellipsis on every card. The wizard, the edit form and both
// repository writers read this one number.
export const EVENT_TITLE_MAX_LENGTH = 60;

// Words that stay lowercase in title case unless they're the first or last word
// of the title. Deliberately short - the goal is "Restaurant Meetup: Table for
// Eight", not a copy-editor's full style guide.
const MINOR_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on",
  "or", "per", "so", "the", "to", "up", "via", "vs", "yet",
]);

function upperFirst(token: string): string {
  // Uppercase the first character only; leave the rest as the user typed it so
  // intentional acronyms (BBQ, DJ, NYE) survive instead of becoming "Bbq".
  if (!token) return token;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

/**
 * Title-case a string for event titles. Capitalises the first letter of each
 * significant word, keeps short connector words ("for", "and", "the", …)
 * lowercase in the middle, and always capitalises the first and last word.
 *
 * Designed to run on every keystroke: it only changes case (never length), so
 * the caret position is preserved in a controlled input. Idempotent, so running
 * it again server-side on submit is safe.
 */
export function toTitleCase(input: string): string {
  // Split on whitespace but KEEP the separators so we can rejoin without
  // collapsing the spaces the user is typing between words.
  const tokens = input.split(/(\s+)/);
  const wordCount = tokens.filter((t) => /\S/.test(t)).length;
  let wordIndex = -1;
  return tokens
    .map((token) => {
      if (!/\S/.test(token)) return token; // whitespace separator
      wordIndex += 1;
      const isFirst = wordIndex === 0;
      const isLast = wordIndex === wordCount - 1;
      if (!isFirst && !isLast && MINOR_WORDS.has(token.toLowerCase())) {
        return token.toLowerCase();
      }
      return upperFirst(token);
    })
    .join("");
}
