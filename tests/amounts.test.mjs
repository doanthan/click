import assert from "node:assert/strict";
import test from "node:test";

// The real shipping helpers, not a copy - src/lib/amounts.ts is what the
// create-event wizard imports for both the price/capacity keystroke handler and
// validateStep. Node strips the type annotations on import (Node >= 22.18 /
// >= 23.6); the repo runs Node 24.
import {
  sanitizeAmount,
  PRICE_PATTERN,
  CAPACITY_PATTERN,
} from "../src/lib/amounts.ts";

// Why this file exists: the price input used to strip every non-digit, so a
// merchant typing "12.50" ended up with "1250", parsePriceCents did
// Math.round(1250 * 100) and the event published at $1250 on LIVE Stripe. The
// fix - sanitizeAmount plus the two patterns below - shipped with no coverage
// at all, which is the wrong state for the only money path in the wizard.

test("cents survive the keystroke handler", () => {
  // The regression itself. "12.50" must come back out as "12.50", not "1250".
  assert.equal(sanitizeAmount("12.50", 2), "12.50");
  assert.equal(sanitizeAmount("12.5", 2), "12.5");
  assert.equal(sanitizeAmount("0", 2), "0");
});

test("a second decimal point can never appear", () => {
  // Fat-fingering the point twice, or pasting "12.5.7", must not produce a
  // string that Number() reads as NaN and the server then coerces to 0.
  const out = sanitizeAmount("12.5.7", 2);
  assert.equal(out.split(".").length - 1, 1, "at most one decimal point");
  assert.equal(out, "12.57");
  assert.equal(sanitizeAmount("1..2", 2), "1.2");
});

test("extra decimal places are truncated, never rounded up", () => {
  // Rounding here would charge a cent the merchant never typed. On a live card
  // that is a real charge, so truncation is the only safe direction.
  assert.equal(sanitizeAmount("12.509", 2), "12.50");
  assert.equal(sanitizeAmount("12.999", 2), "12.99");
  assert.equal(sanitizeAmount("0.005", 2), "0.00");
});

test("letters and symbols are stripped", () => {
  assert.equal(sanitizeAmount("$12.50", 2), "12.50");
  assert.equal(sanitizeAmount("12,50", 2), "1250");
  assert.equal(sanitizeAmount("AUD 12.50 each", 2), "12.50");
});

test("an empty field stays empty", () => {
  // Empty is how a merchant clears the price back to "free"; turning it into
  // "0" under their hands would be the same class of bug as the original.
  assert.equal(sanitizeAmount("", 2), "");
  assert.equal(sanitizeAmount("abc", 2), "");
});

test("the price pattern accepts real dollar amounts and rejects the rest", () => {
  for (const good of ["0", "12", "12.5", "12.50", "1200.00"]) {
    assert.ok(PRICE_PATTERN.test(good), `${good} should be a valid price`);
  }
  // "12." is what sanitizeAmount leaves behind mid-typing, and "12.501" is a
  // third decimal place that no card can charge - both belong to the validator,
  // which is exactly why sanitizeAmount does not silently repair them.
  for (const bad of ["12.", "12.501", "", ".5", "-1", "1e3"]) {
    assert.ok(!PRICE_PATTERN.test(bad), `${bad} should be rejected`);
  }
});

test("capacity refuses a decimal instead of silently multiplying it", () => {
  // "1.5" used to have its point stripped and became 15 - a guest list ten
  // times the one the merchant typed.
  assert.ok(!CAPACITY_PATTERN.test("1.5"));
  assert.ok(!CAPACITY_PATTERN.test("12.0"));
  assert.ok(CAPACITY_PATTERN.test("12"));
  assert.ok(CAPACITY_PATTERN.test("1"));
});

test("the patterns are not global, so repeated tests stay honest", () => {
  // A /g regex carries lastIndex between calls: the second .test() of the same
  // valid string would return false and reject a price the first call accepted.
  assert.equal(PRICE_PATTERN.global, false);
  assert.equal(CAPACITY_PATTERN.global, false);
  assert.ok(PRICE_PATTERN.test("12.50"));
  assert.ok(PRICE_PATTERN.test("12.50"));
});
