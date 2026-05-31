// Small, framework-agnostic text helpers shared by client components and the
// server repository. Keep this file dependency-free so it can be imported from
// both the browser bundle (event-create wizard) and Node (event-repository).

// Words that stay lowercase in title case unless they're the first or last word
// of the title. Deliberately short — the goal is "Restaurant Meetup: Table for
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
