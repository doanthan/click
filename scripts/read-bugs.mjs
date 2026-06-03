import { readFileSync } from "node:fs";
import { google } from "googleapis";

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

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
auth.useJWTAccessWithScope = false;
const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const tab = process.env.GOOGLE_SHEETS_TAB || "Bugs";

// Get formulas (so we capture HYPERLINK URLs) and values.
const resp = await sheets.spreadsheets.get({
  spreadsheetId,
  ranges: [`${tab}!A1:K200`],
  fields: "sheets(data(rowData(values(formattedValue,hyperlink,userEnteredValue))))",
});
const rows = resp.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
const out = [];
rows.forEach((r, i) => {
  const rowNum = i + 1;
  const cells = (r.values || []).map((c) => ({
    text: c.formattedValue ?? "",
    link: c.hyperlink ?? (c.userEnteredValue?.formulaValue?.match(/HYPERLINK\("([^"]+)"/)?.[1]) ?? null,
    formula: c.userEnteredValue?.formulaValue ?? null,
  }));
  out.push({ rowNum, cells });
});
console.log(JSON.stringify(out, null, 2));
