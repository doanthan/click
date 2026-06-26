// Mark bug rows AI-fixed (amber) and optionally record what was changed.
//
//   node scripts/mark-ai-fixed.mjs 21 22 23
//     -> ticks "AI fixed" (col F) for each row, leaves Status "open" (amber),
//        and sets support_tickets.ai_fixed=true.
//
//   node scripts/mark-ai-fixed.mjs 21 "Fixed X by doing Y"
//     -> same as above for the single row, AND writes the comment to the
//        "AI Comment" column (K) + support_tickets.ai_comment.
//
// The human tester confirms a fix by setting Status="fixed" (green) — never do
// that here.
import { readFileSync } from "node:fs";
import { google } from "googleapis";
import pg from "pg";

function loadEnv(path) {
  let raw;
  try { raw = readFileSync(path, "utf8"); } catch { return; }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let [, key, val] = m;
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnv(new URL("../.env.local", import.meta.url).pathname);

const argv = process.argv.slice(2);
if (!argv.length) { console.error("Usage: mark-ai-fixed.mjs <row> [<row>...] | <row> \"<comment>\""); process.exit(1); }

// All-numeric args -> multi-row, no comment. Otherwise first arg is the row and
// the rest (joined) is the comment for that single row.
const allNumeric = argv.every((a) => /^\d+$/.test(a));
let rows, comment;
if (allNumeric) {
  rows = argv.map(Number);
  comment = null;
} else {
  rows = [Number(argv[0])];
  comment = argv.slice(1).join(" ");
}
if (rows.some((r) => !r)) { console.error("Invalid row number."); process.exit(1); }

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
auth.useJWTAccessWithScope = false;
const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const tab = process.env.GOOGLE_SHEETS_TAB || "Bugs";

const got = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A1:K1000` });
const all = got.data.values || [];

// 1) Sheet: tick "AI fixed" (col F = TRUE) -> amber; write AI Comment (col K) if given.
const data = rows.map((r) => ({ range: `${tab}!F${r}`, values: [[true]] }));
if (comment) data.push({ range: `${tab}!K${rows[0]}`, values: [[comment]] });
await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId,
  requestBody: { valueInputOption: "USER_ENTERED", data },
});
console.log("Sheet 'AI fixed' ticked (amber):", rows.join(", "), comment ? "(+ comment)" : "");

// 2) Postgres: support_tickets.ai_fixed=true (+ ai_comment when given).
const refs = rows.map((r) => all[r - 1]?.[9]).filter(Boolean);
if (refs.length && process.env.DATABASE_URL) {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(`update support_tickets set ai_fixed = true where ticket_ref = any($1::text[])`, [refs]);
  if (comment && refs[0]) {
    await pool.query(`update support_tickets set ai_comment = $2 where ticket_ref = $1`, [refs[0], comment]);
  }
  console.log(`Postgres ai_fixed=true for ${refs.length} ticket(s)`, comment ? "(+ ai_comment)" : "");
  await pool.end();
}
