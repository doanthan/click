/**
 * Google Sheets triage board for support tickets.
 *
 * The sheet is a two-way working board:
 *   • the bug reporter appends new rows (red),
 *   • a Claude Code "AI fixer" pass reads rows, fixes bugs, and ticks "AI fixed"
 *     (amber),
 *   • humans confirm a fix by setting Status = "fixed" (green), or send it back
 *     by un-ticking "AI fixed" (→ red, the AI picks it up again).
 *
 * Row colour is driven by **conditional formatting** set up once on the sheet —
 * NOT by us recolouring imperatively — so colours stay correct no matter who
 * edits the cells (our API, the AI agent, or a person typing in Google Sheets).
 *
 * Columns:  A URL · B What is wrong · C What it should be · D Is issue ·
 *           E AI fixed · F Status · G Screenshot · H Ticket
 *
 * Auth: a Google Cloud **service account** (see below). Postgres (support_tickets)
 * still holds the full record (screenshot, console/network logs, annotations).
 *
 *   GOOGLE_SHEETS_SPREADSHEET_ID
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY   (\n escapes ok)
 *   GOOGLE_SHEETS_TAB                    (optional, default "Bugs")
 *
 * Until those are set, isSheetsConfigured() is false and every export no-ops
 * (the bug still saves to Postgres). Never throws into the request path.
 */

import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";

const HEADER = [
  "URL",
  "Logged in as",
  "What is wrong",
  "What it should be",
  "Is issue",
  "AI fixed",
  "Status",
  "Screenshot",
  "Date added",
  "Ticket",
  // The AI fixer's summary of what it changed (col K). Filled when ai_fixed flips
  // true; mirrors support_tickets.ai_comment. Empty on a fresh report.
  "AI Comment",
];
const COL_COUNT = HEADER.length;
const LAST_COL = String.fromCharCode(64 + COL_COUNT); // e.g. 10 -> "J"
const STATUS_COL = 6; // 0-based index of "Status" (G)
const GRID_ROWS = 2000; // colour rules clamp to grid size; keep coverage generous
const TAB = process.env.GOOGLE_SHEETS_TAB || "Bugs";

// Public origin used for the screenshot links written into the sheet, so they
// resolve from the app (letsclick.app/api/...) rather than exposing raw storage.
const APP_BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://letsclick.app").replace(/\/$/, "");

const GREEN = { red: 0.78, green: 0.93, blue: 0.78 };
const AMBER = { red: 0.99, green: 0.89, blue: 0.6 };
const GRAY = { red: 0.9, green: 0.9, blue: 0.9 };
const RED = { red: 0.97, green: 0.8, blue: 0.78 };

export function isSheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
}

let cachedClient: sheets_v4.Sheets | null = null;
let cachedSheetId: number | null = null;
let cachedRowCount = 1000;

function getClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  // Force a real OAuth2 access token. With scopes set, google-auth-library
  // otherwise sends a *self-signed JWT*, which the Sheets API rejects with
  // "401 — Expected OAuth 2 access token".
  auth.useJWTAccessWithScope = false;
  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

function spreadsheetId(): string {
  return process.env.GOOGLE_SHEETS_SPREADSHEET_ID as string;
}

/** Resolve (and cache) the tab's numeric sheetId; create it + header + formatting if needed. */
async function ensureSheet(sheets: sheets_v4.Sheets): Promise<number> {
  if (cachedSheetId !== null) return cachedSheetId;

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId(),
    fields: "sheets(properties(sheetId,title,gridProperties(rowCount)),conditionalFormats)",
  });
  let sheet = meta.data.sheets?.find((s) => s.properties?.title === TAB);

  if (!sheet) {
    const added = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId(),
      requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] },
    });
    sheet = added.data.replies?.[0]?.addSheet ?? undefined;
  }

  const sheetId = sheet?.properties?.sheetId ?? 0;
  cachedSheetId = sheetId;
  cachedRowCount = sheet?.properties?.gridProperties?.rowCount ?? 1000;

  // Ensure the header row exists — handles a tab that already existed (e.g.
  // created by hand) but is empty, so appends don't land on row 1.
  const firstRow = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${TAB}!A1:A1`,
  });
  if (!firstRow.data.values?.[0]?.[0]) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId(),
      range: `${TAB}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
  }

  // (Re)apply colour rules + checkboxes unless ours are already present and
  // correctly anchored at row 2. This self-heals rules left mis-anchored by an
  // earlier version (ranges shifted down by INSERT_ROWS appends).
  const existing = sheet?.conditionalFormats ?? [];
  const firstRange = existing[0]?.ranges?.[0];
  const looksRight =
    existing.length >= 4 &&
    firstRange?.startRowIndex === 1 &&
    (firstRange?.endRowIndex ?? 0) >= GRID_ROWS &&
    // Self-heal when a column is added (e.g. "AI Comment") so the row colour
    // rules widen to cover it instead of stopping at the old last column.
    (firstRange?.endColumnIndex ?? 0) >= COL_COUNT;
  if (!looksRight) {
    await applyFormatting(sheets, sheetId, existing.length);
  }
  return sheetId;
}

function rule(formula: string, color: { red: number; green: number; blue: number }, sheetId: number, index: number) {
  return {
    addConditionalFormatRule: {
      index,
      rule: {
        // Whole data row (A:H), from row 2 down.
        ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: COL_COUNT }],
        booleanRule: {
          condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: formula }] },
          format: { backgroundColor: color },
        },
      },
    },
  };
}

async function applyFormatting(
  sheets: sheets_v4.Sheets,
  sheetId: number,
  staleRuleCount = 0,
): Promise<void> {
  // Remove any pre-existing rules first (always index 0) so a rebuild can't pile
  // duplicates or leave mis-anchored ranges behind.
  const deletes = Array.from({ length: staleRuleCount }, () => ({
    deleteConditionalFormatRule: { sheetId, index: 0 },
  }));
  // Google clamps an unbounded conditional-format range to the grid's row count
  // at creation time, so size the grid up first (grow-only) — this keeps the
  // colour rules covering rows well beyond any realistic bug count.
  const grow =
    cachedRowCount < GRID_ROWS
      ? [
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { rowCount: GRID_ROWS } },
              fields: "gridProperties.rowCount",
            },
          },
        ]
      : [];
  if (grow.length) cachedRowCount = GRID_ROWS;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId(),
    requestBody: {
      requests: [
        ...deletes,
        ...grow,
        // Bold + frozen header.
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: "userEnteredFormat.textFormat.bold",
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
        // Checkboxes for "Is issue" (E) + "AI fixed" (F).
        {
          setDataValidation: {
            range: { sheetId, startRowIndex: 1, startColumnIndex: 4, endColumnIndex: 6 },
            rule: { condition: { type: "BOOLEAN" }, showCustomUi: true },
          },
        },
        // Colour rules — first match wins for background, so order = priority.
        rule('=$G2="fixed"', GREEN, sheetId, 0), // user-confirmed fixed (Status)
        rule("=$F2=TRUE", AMBER, sheetId, 1), // AI fixed
        rule("=$E2=FALSE", GRAY, sheetId, 2), // triaged: not an issue
        rule('=$A2<>""', RED, sheetId, 3), // open report (catch-all for non-empty rows)
      ],
    },
  });
}

export type SheetRowInput = {
  ticketRef: string;
  url: string; // pathname+search (fallback display)
  fullUrl: string; // absolute URL incl. origin, for a clickable link
  role: string; // reporter's role — "Logged in as"
  dateAdded: string; // when filed, e.g. "2026-06-02 14:30"
  whatIsWrong: string;
  expected: string;
  hasScreenshot: boolean;
};

/** Escape a string for embedding inside an =HYPERLINK("…") formula. */
function sheetStr(value: string): string {
  return value.replace(/"/g, '""');
}

/**
 * Append a new bug as a red row (Status "open", Is issue checked, AI fixed
 * unchecked). Returns the 1-based row number (store in support_tickets.sheet_row),
 * or null if Sheets is unconfigured / failed.
 */
export async function appendBugRow(input: SheetRowInput): Promise<number | null> {
  if (!isSheetsConfigured()) return null;
  try {
    const sheets = getClient();
    await ensureSheet(sheets);

    const screenshotCell = input.hasScreenshot
      ? `=HYPERLINK("${APP_BASE}/api/support/ticket/${encodeURIComponent(input.ticketRef)}/screenshot","screenshot")`
      : "";

    // Full clickable URL (falls back to the pathname if origin is unknown).
    const urlDisplay = input.fullUrl || input.url;
    const urlCell = urlDisplay
      ? `=HYPERLINK("${sheetStr(urlDisplay)}","${sheetStr(urlDisplay)}")`
      : "";

    // Determine the next row explicitly from column A (URL — never a checkbox),
    // rather than spreadsheets.append, whose table-detection gets confused by the
    // checkbox data-validation in columns D/E and scatters rows to the grid end.
    const colA = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId(),
      range: `${TAB}!A:A`,
    });
    const nextRow = (colA.data.values?.length ?? 1) + 1;

    // Grow the grid if we're about to write past its last row (values.update,
    // unlike append, errors instead of auto-extending).
    const cachedSid = cachedSheetId ?? 0;
    if (nextRow > cachedRowCount) {
      const target = nextRow + 200;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId(),
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: { sheetId: cachedSid, gridProperties: { rowCount: target } },
                fields: "gridProperties.rowCount",
              },
            },
          ],
        },
      });
      cachedRowCount = target;
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId(),
      range: `${TAB}!A${nextRow}:${LAST_COL}${nextRow}`,
      // USER_ENTERED so the HYPERLINK formula + TRUE/FALSE booleans are parsed.
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            urlCell, // A URL (clickable)
            input.role, // B Logged in as
            input.whatIsWrong, // C
            input.expected, // D
            true, // E Is issue
            false, // F AI fixed
            "open", // G Status
            screenshotCell, // H
            input.dateAdded, // I Date added
            input.ticketRef, // J
            "", // K AI Comment — filled by the AI fixer pass, empty on report
          ],
        ],
      },
    });

    return nextRow;
  } catch (err) {
    console.warn("[support-sheets] appendBugRow failed:", err);
    return null;
  }
}

/**
 * Mark a row user-confirmed fixed: set its Status cell to "fixed". Conditional
 * formatting turns the row green. No-op if unconfigured.
 */
export async function markBugRowUserFixed(rowNumber: number | null | undefined): Promise<void> {
  if (!isSheetsConfigured() || !rowNumber) return;
  try {
    const sheets = getClient();
    await ensureSheet(sheets);
    const statusA1 = String.fromCharCode(65 + STATUS_COL); // "F"
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId(),
      range: `${TAB}!${statusA1}${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [["fixed"]] },
    });
  } catch (err) {
    console.warn("[support-sheets] markBugRowUserFixed failed:", err);
  }
}

/**
 * Refresh a row after the reporter edits the bug: "What is wrong" (C) and "What
 * it should be" (D). When `state` is supplied (the reporter also changed the
 * status), the triage cells are rewritten too — Is issue (E), AI fixed (F),
 * Status (G) — and conditional formatting recolours the row. No-op if
 * unconfigured.
 */
export async function updateBugRowContent(
  rowNumber: number | null | undefined,
  whatIsWrong: string,
  expected: string,
  state?: { isIssue: boolean; aiFixed: boolean; status: string },
): Promise<void> {
  if (!isSheetsConfigured() || !rowNumber) return;
  try {
    const sheets = getClient();
    await ensureSheet(sheets);
    const data: sheets_v4.Schema$ValueRange[] = [
      { range: `${TAB}!C${rowNumber}:D${rowNumber}`, values: [[whatIsWrong, expected]] },
    ];
    if (state) {
      data.push({
        range: `${TAB}!E${rowNumber}:G${rowNumber}`,
        values: [[state.isIssue, state.aiFixed, state.status]],
      });
    }
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: spreadsheetId(),
      requestBody: { valueInputOption: "USER_ENTERED", data },
    });
  } catch (err) {
    console.warn("[support-sheets] updateBugRowContent failed:", err);
  }
}

/**
 * Send a row back to the AI fixer: un-tick "AI fixed" (F), reset Status (G) to
 * "open", and refresh the "What is wrong" cell (C) with the appended note.
 * Conditional formatting turns the row red again so the AI picks it up. No-op if
 * unconfigured.
 */
export async function markBugRowNotFixed(
  rowNumber: number | null | undefined,
  message: string,
): Promise<void> {
  if (!isSheetsConfigured() || !rowNumber) return;
  try {
    const sheets = getClient();
    await ensureSheet(sheets);
    // C = What is wrong; F = AI fixed → FALSE; G = Status → "open".
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: spreadsheetId(),
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          { range: `${TAB}!C${rowNumber}`, values: [[message]] },
          { range: `${TAB}!F${rowNumber}:G${rowNumber}`, values: [[false, "open"]] },
        ],
      },
    });
  } catch (err) {
    console.warn("[support-sheets] markBugRowNotFixed failed:", err);
  }
}
