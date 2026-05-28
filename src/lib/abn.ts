// Australian Business Number (ABN) validation.
//
// An ABN is 11 digits. The ATO check-digit algorithm:
//   1. Subtract 1 from the first (leftmost) digit.
//   2. Multiply each digit by its position weight.
//   3. Sum the products.
//   4. The ABN is valid if the sum is divisible by 89.
// See https://abr.business.gov.au/Help/AbnFormat
const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

/** Strip spaces and other separators, leaving only digits. */
export function normalizeAbn(value: string): string {
  return value.replace(/\D/g, "");
}

/** Format 11 digits as "11 222 333 444" (the ATO display grouping). */
export function formatAbn(value: string): string {
  const digits = normalizeAbn(value);
  if (digits.length !== 11) return value.trim();

  return [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 8),
    digits.slice(8, 11),
  ].join(" ");
}

/** Returns true if the value is a valid ABN per the ATO check-digit algorithm. */
export function isValidAbn(value: string): boolean {
  const digits = normalizeAbn(value);
  if (digits.length !== 11) return false;
  // A valid ABN never starts with 0 (the leading digit has 1 subtracted).
  if (digits[0] === "0") return false;

  const sum = ABN_WEIGHTS.reduce((total, weight, index) => {
    const digit = Number(digits[index]) - (index === 0 ? 1 : 0);
    return total + digit * weight;
  }, 0);

  return sum % 89 === 0;
}

/**
 * Validate an optional ABN. Returns an error message when the value is
 * present but invalid; returns null when the value is empty or valid.
 */
export function validateOptionalAbn(value: string): string | null {
  const digits = normalizeAbn(value);
  if (!digits) return null;

  if (digits.length !== 11) {
    return "ABN must be 11 digits.";
  }
  if (!isValidAbn(digits)) {
    return "That ABN is not valid. Please check the digits.";
  }
  return null;
}

/**
 * Validate a required ABN — empty value is an error. Used by the merchant
 * signup wizard per spec §1 (ABN is mandatory for merchants).
 */
export function validateRequiredAbn(value: string): string | null {
  const digits = normalizeAbn(value);
  if (!digits) return "ABN is required.";
  return validateOptionalAbn(value);
}

/** Strip spaces and other separators, leaving only digits. */
export function normalizeAcn(value: string): string {
  return value.replace(/\D/g, "");
}

/** Format 9 digits as "000 000 000" (the ASIC display grouping). */
export function formatAcn(value: string): string {
  const digits = normalizeAcn(value);
  if (digits.length !== 9) return value.trim();
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].join(" ");
}

/**
 * Validate an optional ACN. Spec §1 lists ACN as optional with 9-digit
 * format validation only — no checksum required.
 */
export function validateOptionalAcn(value: string): string | null {
  const digits = normalizeAcn(value);
  if (!digits) return null;
  if (digits.length !== 9) return "ACN must be 9 digits.";
  return null;
}
