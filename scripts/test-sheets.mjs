/**
 * Throwaway connectivity test for the Google Sheets triage board.
 *
 *   node scripts/test-sheets.mjs
 *
 * Loads .env.local, then drives the real src/lib/support-sheets.ts code to:
 *   1. create the tab + header + checkboxes + colour rules (if missing),
 *   2. append three rows exercising every column, and flip them to the three
 *      states so you can eyeball red / amber / green in the sheet.
 * Delete the TEST- rows afterwards.
 */

import { readFileSync } from "node:fs";
import { google } from "googleapis";

// --- load .env.local into process.env (only keys not already set) ----------
function loadEnv(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let [, key, val] = m;
    // strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnv(new URL("../.env.local", import.meta.url).pathname);

const required = [
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("✖ Missing env keys:", missing.join(", "));
  process.exit(1);
}

const { appendBugRow, markBugRowUserFixed, isSheetsConfigured } = await import(
  "../src/lib/support-sheets.ts"
);

if (!isSheetsConfigured()) {
  console.error("✖ isSheetsConfigured() is false even though keys are set - check values.");
  process.exit(1);
}

console.log("→ Service account:", process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
console.log("→ Spreadsheet:", process.env.GOOGLE_SHEETS_SPREADSHEET_ID);
console.log("→ Tab:", process.env.GOOGLE_SHEETS_TAB || "Bugs");
console.log("");

const stamp = process.argv[2] || "manual";

// 1) RED - a plain open bug, all columns populated, with a screenshot link.
const redRow = await appendBugRow({
  ticketRef: `TEST-RED-${stamp}`,
  url: "/discover?test=1",
  fullUrl: "https://letsclick.app/discover?test=1",
  role: "attendee",
  dateAdded: "2026-06-02 14:30",
  whatIsWrong: "The Discover filter chips overflow on mobile.",
  expected: "Chips should wrap to a second line under 375px.",
  hasScreenshot: true,
});
console.log(redRow ? `✓ RED row appended at row ${redRow}` : "✗ RED append returned null");

// 2) GREEN - append then mark user-fixed (Status = fixed).
const greenRow = await appendBugRow({
  ticketRef: `TEST-GREEN-${stamp}`,
  url: "/dashboard",
  fullUrl: "https://letsclick.app/dashboard",
  role: "admin",
  dateAdded: "2026-06-02 14:31",
  whatIsWrong: "Calendar count is off by one.",
  expected: "Count should match the number of confirmed events.",
  hasScreenshot: false,
});
if (greenRow) {
  await markBugRowUserFixed(greenRow);
  console.log(`✓ GREEN row appended at row ${greenRow} and marked fixed`);
} else {
  console.log("✗ GREEN append returned null");
}

// 3) AMBER - append, then tick "AI fixed" (col E) directly to prove the amber rule.
const amberRow = await appendBugRow({
  ticketRef: `TEST-AMBER-${stamp}`,
  url: "/events/sample",
  fullUrl: "https://letsclick.app/events/sample",
  role: "merchant",
  dateAdded: "2026-06-02 14:32",
  whatIsWrong: "RSVP button stays disabled after login.",
  expected: "It should enable once the session loads.",
  hasScreenshot: false,
});
if (amberRow) {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  auth.useJWTAccessWithScope = false;
  const sheets = google.sheets({ version: "v4", auth });
  const tab = process.env.GOOGLE_SHEETS_TAB || "Bugs";
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${tab}!F${amberRow}`, // F = "AI fixed"
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[true]] },
  });
  console.log(`✓ AMBER row appended at row ${amberRow} and "AI fixed" ticked`);
} else {
  console.log("✗ AMBER append returned null");
}

console.log("\nDone. Open the sheet - you should see a red, a green, and an amber TEST- row.");
console.log("Delete the TEST- rows when you're satisfied.");
