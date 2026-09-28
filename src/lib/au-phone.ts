// Australian phone numbers - ONE definition, shared by the merchant signup
// wizard and the server that validates its submit, the way src/lib/abn.ts is
// already shared by both sides.
//
// It lived only in the wizard, and the server had its own narrower regex
// (`/^(?:\+?61|0)\d{9}$/`, written for mobiles and never widened). A host whose
// business line is 1300 123 456 - the exact number the field's own hint offers
// as an example - passed the wizard, reached Documents and was rejected there
// with a message about a field two routes away. Same for 1800/13 lines, bare
// 8-digit landlines, and anything typed with brackets. Both sides now import
// from here, so the two rules cannot drift again.

// Accepts AU mobiles, landlines AND business numbers, in the formats people
// actually type:
//   0412 345 678 · 412 345 678 · 02 9646 8888 · (02) 9646 8888 ·
//   +61 2 9646 8888 · 9646 8888 · 1300 123 456 · 1800 123 456 · 13 12 34
// Strips spaces/brackets/dashes, normalises a +61 / 61 country code and a
// 9-digit mobile (missing leading 0) to a leading 0, then accepts national
// numbers, bare local landlines, and 13/1300/1800 business lines. Kept
// deliberately permissive - a false rejection on a real number is worse than
// letting an oddly-formatted one through (admins see it during verification).
export function normalizeAuPhone(raw: string): string {
  let digits = raw.replace(/[^\d]/g, "");
  // +61 / 0061 country code → national trunk 0. Many people write the standard
  // "+61 (0)4.." / "+61 0412.." print convention and keep their own trunk 0, so
  // strip any leftover leading 0(s) before re-adding ours - otherwise we'd get a
  // double zero ("00412345678") that fails every pattern (bug board #202).
  if (digits.startsWith("0061")) digits = "0" + digits.slice(4).replace(/^0+/, "");
  else if (digits.startsWith("61") && digits.length >= 10) digits = "0" + digits.slice(2).replace(/^0+/, "");
  // A national number typed without its trunk 0 - "412 345 678", or
  // "2 9646 8888" beside the wizard's fixed +61 box, which is how a +61 number
  // is written - gets the 0 back. 2/3/7/8 are the area codes, 4 is mobile.
  if (/^[23478]\d{8}$/.test(digits)) digits = "0" + digits;
  return digits;
}

// Groups `digits` into `sizes`, with anything past the last size kept on the
// last group, so an extra digit stays visible instead of vanishing.
function groupDigits(digits: string, sizes: number[]): string {
  const parts: string[] = [];
  let at = 0;
  sizes.forEach((size, index) => {
    if (at >= digits.length) return;
    parts.push(digits.slice(at, index === sizes.length - 1 ? undefined : at + size));
    at += size;
  });
  return parts.join(" ");
}

// The live formatter behind the signup phone field (bug board #144). Unlike
// formatAuPhone it copes with a half-typed number: it only regroups the digits
// the host has typed, keeps their own leading-0 choice, and never adds or drops
// a digit of the number itself - so the count they see is the count they
// typed. A pasted or autofilled +61 / 0061 loses the country code, because
// the +61 has its own box.
export function formatAuPhoneAsYouType(raw: string): string {
  let digits = raw.replace(/[^\d]/g, "");
  if (raw.trim().startsWith("+")) digits = digits.replace(/^61/, "");
  else if (digits.startsWith("0061")) digits = digits.slice(4);
  if (/^(04|1[38]00)/.test(digits)) return groupDigits(digits, [4, 3, 3]); // 0412 345 678 · 1300 123 456
  if (/^0/.test(digits)) return groupDigits(digits, [2, 4, 4]); // 02 9646 8888
  if (/^4/.test(digits)) return groupDigits(digits, [3, 3, 3]); // 412 345 678
  if (/^13(?!00)/.test(digits)) return groupDigits(digits, [2, 2, 2]); // 13 12 34
  if (/^[2378]\d{8}/.test(digits)) return groupDigits(digits, [1, 4, 4]); // 2 9646 8888
  return groupDigits(digits, [4, 4]); // 9646 8888
}

// What the field says while the host types, before there is anything to call
// an error: which kind of number it reads as, and how far through it they are.
// Only the shapes whose length is certain get a count - a bare "9646..." could
// be a local landline or the start of something longer.
export function auPhoneProgress(raw: string): string {
  const digits = normalizeAuPhone(raw);
  const count = (label: string, target: number) =>
    digits.length > target
      ? `${label} - that's ${digits.length} digits, ${target} is enough.`
      : `${label} - ${digits.length} of ${target} digits.`;
  if (/^04/.test(digits)) return count("Mobile", 10);
  if (/^4/.test(digits)) return count("Mobile", 9);
  if (/^1[38]00/.test(digits)) return count("1300/1800 number", 10);
  if (/^0[2378]/.test(digits)) return count("Landline", 10);
  return "Mobile, landline with area code, or 1300/1800 number - the 0 is optional.";
}

// Display-grouping formatter, mirroring formatAbn/formatAcn's "tidy on blur"
// pattern (bug board #201). Cosmetic only - submit re-normalises via
// normalizeAuPhone, so grouping can't corrupt the stored value. Unknown shapes
// fall back to the trimmed input rather than mangling it.
export function formatAuPhone(raw: string): string {
  const digits = normalizeAuPhone(raw);
  // Mobile: 04XX XXX XXX
  if (/^04\d{8}$/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  // Landline with area code: 0X XXXX XXXX
  if (/^0[2-9]\d{8}$/.test(digits)) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  // 1300 / 1800: 1300 XXX XXX
  if (/^1[38]00\d{6}$/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  // 13 xx xx short business line: 13 XX XX
  if (/^13(?!00)\d{4}$/.test(digits)) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  }
  // Bare 8-digit local landline: XXXX XXXX
  if (/^\d{8}$/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  }
  return raw.trim();
}

// Pinpoints WHY a number fails so the inline error is actionable (bug board
// #144: a tester typed a 9-digit landline and only saw a generic "doesn't look
// like an AU number", which read as a bug rather than a typo).
export function auPhoneHint(raw: string): string {
  const digits = normalizeAuPhone(raw);
  if (/^0[2378]/.test(digits) && digits.length !== 10) {
    return `Landlines need 10 digits including the area code - you've entered ${digits.length}. e.g. 02 9646 8888.`;
  }
  if (/^04/.test(digits) && digits.length !== 10) {
    return `Mobiles need 10 digits - you've entered ${digits.length}. e.g. 0412 345 678.`;
  }
  if (/^1[38]00/.test(digits) && digits.length !== 10) {
    return `1300/1800 numbers need 10 digits - you've entered ${digits.length}. e.g. 1300 123 456.`;
  }
  return "That doesn’t look like an AU number yet - try 0412 345 678, 02 9646 8888 or 1300 123 456.";
}

export function isValidAuPhone(raw: string): boolean {
  const digits = normalizeAuPhone(raw);
  return (
    /^0[2-9]\d{8}$/.test(digits) || // 10-digit mobile or area-code landline
    /^\d{8}$/.test(digits) || // bare 8-digit local landline (no area code)
    /^1[38]00\d{6}$/.test(digits) || // 1300 / 1800 business line
    // 13 xx xx short business line. Never 13 00 xx: those six digits are a
    // 1300 number being typed, and calling them valid flashed "Looks good"
    // four digits early.
    /^13(?!00)\d{4}$/.test(digits)
  );
}

/**
 * Validate a required phone number, mirroring validateRequiredAbn: returns the
 * message to show, or null when the value is good. Both the wizard's per-step
 * validator and the server's submit gate call this, so a host can never be told
 * two different things about the same number.
 */
export function validateAuPhone(raw: string): string | null {
  if (isValidAuPhone(raw)) return null;
  // auPhoneHint pinpoints WHY a typed number failed; it has nothing useful to
  // say about an empty field, so that case gets its own line.
  return raw.trim()
    ? auPhoneHint(raw)
    : "Add a phone number - mobile, landline or business line.";
}
