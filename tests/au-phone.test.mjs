import assert from "node:assert/strict";
import test from "node:test";

// The real shipping helpers, not a copy - src/lib/au-phone.ts is what the
// merchant signup wizard AND registerMerchantWizardSubmit both import. Node
// strips the type annotations on import (Node >= 22.18 / >= 23.6); the repo
// runs Node 24.
import {
  formatAuPhone,
  isValidAuPhone,
  normalizeAuPhone,
  validateAuPhone,
} from "../src/lib/au-phone.ts";

// Why this file exists: the wizard and the server used to hold their own rules.
// The wizard accepted four shapes, the server accepted one - `/^(?:\+?61|0)\d{9}$/`
// against a string with whitespace stripped but punctuation left in. So a host
// whose business line is 1300 123 456 (the example the field's own hint offers)
// passed every step, reached Documents, pressed Submit and was told "Enter a
// valid Australian phone number." two routes away from the field, with nothing
// marked. Same for 1800 and 13-xx-xx lines, bare 8-digit landlines, and any
// number typed with brackets. One module now governs both sides; these are the
// shapes it has to keep accepting.

test("every shape the wizard offers as an example is accepted", () => {
  for (const number of [
    "0412 345 678", // mobile
    "412 345 678", // mobile typed without the trunk 0
    "+61 412 345 678", // mobile with the country code
    "02 9646 8888", // landline with area code
    "(02) 9646 8888", // ... as people actually type it
    "+61 2 9646 8888",
    "0061 2 9646 8888",
    "9646 8888", // bare local landline, no area code
    "1300 123 456",
    "1800 123 456",
    "13 12 34", // 13xxxx short business line
  ]) {
    assert.equal(isValidAuPhone(number), true, `${number} must be accepted`);
    assert.equal(validateAuPhone(number), null, `${number} must produce no error`);
  }
});

test("punctuation never decides the verdict", () => {
  // The server's old regex ran against a whitespace-stripped string, so every
  // bracket and dash was a rejection on its own.
  const digits = normalizeAuPhone("(02) 9646-8888");
  assert.equal(digits, "0296468888");
  assert.equal(isValidAuPhone("(02) 9646-8888"), true);
  assert.equal(isValidAuPhone("02-9646-8888"), true);
});

test("what the wizard sends is what the server re-checks", () => {
  // The wizard POSTs normalizeAuPhone(value) and the server normalises again
  // before validating, so normalisation has to be idempotent or a number could
  // pass on the way out and fail on the way in.
  for (const number of ["+61 412 345 678", "412 345 678", "0061 2 9646 8888", "1300 123 456"]) {
    const once = normalizeAuPhone(number);
    assert.equal(normalizeAuPhone(once), once, `${number} must survive a second pass`);
    assert.equal(isValidAuPhone(once), true);
  }
});

test("a number that is genuinely wrong still fails, with a reason", () => {
  assert.equal(isValidAuPhone("02 9646 888"), false); // 9 digits
  assert.match(validateAuPhone("02 9646 888"), /Landlines need 10 digits/);
  assert.match(validateAuPhone("0412 345 67"), /Mobiles need 10 digits/);
  assert.match(validateAuPhone("1300 123 45"), /1300\/1800 numbers need 10 digits/);
  // An empty field gets its own line - the hint has nothing to pinpoint.
  assert.match(validateAuPhone("   "), /Add a phone number/);
});

test("the blur formatter only ever regroups a number it recognises", () => {
  assert.equal(formatAuPhone("0412345678"), "0412 345 678");
  assert.equal(formatAuPhone("0296468888"), "02 9646 8888");
  assert.equal(formatAuPhone("1300123456"), "1300 123 456");
  assert.equal(formatAuPhone("131234"), "13 12 34");
  assert.equal(formatAuPhone("96468888"), "9646 8888");
  // Unknown shape: hand the typing back rather than mangle it.
  assert.equal(formatAuPhone("  not a number  "), "not a number");
});
