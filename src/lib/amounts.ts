/**
 * Pure amount helpers for money and seat-count inputs.
 *
 * These lived inside event-create-wizard.tsx, which is a client component and
 * therefore unreachable from `node --test tests/*.test.mjs`. They guard a LIVE
 * Stripe path - the wizard's price field used to strip every non-digit, so
 * "12.50" became "1250" and parsePriceCents (Math.round(n * 100)) published a
 * $1250 event - so they need a test that exercises the real shipping code
 * rather than a copy of it. Hence their own module: the wizard imports from
 * here and so does tests/amounts.test.mjs.
 *
 * Keep this file free of React and of anything Next-only. It is imported by
 * Node directly.
 */

/**
 * Keep the digits and at most one decimal point, capped at `decimals` places.
 *
 * Deliberately NOT a "make it a valid number" transform: a controlled input
 * that rewrites what you typed is exactly how "12.50" became "1250". Anything
 * this leaves malformed ("12.", "") is the validator's problem, not the
 * keystroke's - the merchant keeps seeing their own value next to the reason it
 * was refused.
 *
 * Extra decimals are TRUNCATED, never rounded: rounding "12.509" up to "12.51"
 * would charge a cent nobody typed, and on a live card that is a real charge.
 */
export function sanitizeAmount(raw: string, decimals: number): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  const whole = cleaned.slice(0, dot);
  const fraction = cleaned.slice(dot + 1).replace(/\./g, "").slice(0, decimals);
  return `${whole}.${fraction}`;
}

/**
 * A dollar amount with at most two decimal places: "0", "12", "12.5", "12.50".
 * Rejects the shapes sanitizeAmount deliberately lets through mid-typing -
 * a trailing "12." and a third decimal place.
 *
 * No /g flag on purpose: a global regex carries lastIndex between .test()
 * calls, so alternating calls would report false on valid input.
 */
export const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Whole seats only. The capacity input used to strip every non-digit, so "1.5"
 * silently became 15 - a 10x guest list nobody typed.
 */
export const CAPACITY_PATTERN = /^\d+$/;
