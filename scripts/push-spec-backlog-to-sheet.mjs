/**
 * One-off: push the click-tech spec-coverage backlog + Supabase bugs into the
 * working Google Sheet as two NEW tabs ("Spec Backlog", "Supabase Bugs"),
 * leaving the existing "Bugs" support board untouched.
 *
 * Reuses the project's Google service account (GOOGLE_SERVICE_ACCOUNT_* +
 * GOOGLE_SHEETS_SPREADSHEET_ID from .env.local). Run from project root:
 *   node scripts/push-spec-backlog-to-sheet.mjs
 */
import fs from "node:fs";
import path from "node:path";
import googleapis from "googleapis";
const { google } = googleapis;

// ── load .env.local (KEY=VALUE; strip one layer of quotes; unescape \n) ──────
function loadEnv(file) {
  const out = {};
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.replace(/\r$/, "");
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}
const env = loadEnv(path.resolve("./.env.local"));
const SPREADSHEET_ID = env.GOOGLE_SHEETS_SPREADSHEET_ID;
const auth = new google.auth.JWT({
  email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
auth.useJWTAccessWithScope = false;
const sheets = google.sheets({ version: "v4", auth });

// ── content ──────────────────────────────────────────────────────────────────
// Spec Backlog: [done, priority, area, item, type, currentState, description, files, specRef]
const BACKLOG_HEADER = ["Done", "Priority", "Area (spec)", "Work item", "Type", "Current", "Description / what to build", "Key files / tables", "Spec ref"];
const BACKLOG = [
  [false, "P0", "Click Mechanic / Non-negotiables", "Remove chat & direct messaging", "Bug", "Missing", "004_messages.sql ships conversations + messages tables with RLS — violates the non-negotiable 'no chat / no DM' rule. Drop the tables, ensure /messages is deprecated (410), and route ALL post-mutual coordination through the Proposal UI (already built).", "database/004_messages.sql", "00 Non-Negotiables · 06_INFRA T5 · QA §6.2"],
  [false, "P0", "User Journey", "Profile-snapshot privacy gate", "Bug", "Missing", "Mutual-click partner data is read by a service-role API that selects ALL profile columns (email, DOB, postcode, dating prefs). Add a get_profile_snapshot() SECURITY DEFINER returning only first_name/age/suburb/avatar/bio/shared-tags/intent; remove the broad reads.", "src/lib/click-data.ts · profiles", "01 §6.1 · 09 §7.1"],
  [false, "P0", "Algorithm", "Unify to 6 canonical intents", "Schema/Feature", "Missing", "Code uses 8 ad-hoc intents (dating/friendship/networking/exploring/hobbies/wellness/community/new_in_town); spec mandates 6 (romantic/friends/locals/activities/networking/relationship_friends). Migrate the enum + onboarding + all matching code to the 6 slugs.", "database/008_intent_extras.sql · src/lib/matching/* · onboarding-form.tsx", "13 · 00 conflict map"],
  [false, "P0", "Romantic / Safety", "relationship_friends ↔ romantic hard gate", "Safety", "Missing", "Neither 'romantic' nor 'relationship_friends' intents exist, so the safety-critical mutual-exclusion can't be enforced. After intent unification, add the hard DB gate (no override) in every eligibility query.", "matching eligibility queries", "10 · 00 Non-Negotiables"],
  [false, "P0", "User Journey / Onboarding", "Onboarding completion + step tracking", "Schema/Bug", "Missing", "No profiles.onboarding_completed/_at or onboarding_step columns for users (only merchants). Resume relies on localStorage. Add columns, set completion on Step 4, and drive sign-in routing (merchants must never be sent to /onboarding).", "profiles · onboarding-form.tsx · src/app/post-login", "01 §1.4 / §2"],
  [false, "P0", "Booking / Analytics", "Webhook signature + booking_events logging", "Verify/Bug", "Partial", "Confirm checkout.session.completed signature verification is active and that every booking-state mutation writes booking_events in-transaction BEFORE the first paid ticket (missing days = permanent financial + training-data loss). Table exists (045) — verify the write points + signature.", "src/app/api/webhooks/stripe/route.ts · database/045_booking_events.sql", "05_LIFECYCLE · 22 Phase A"],

  [false, "P1", "Romantic Intent & Dating Mode", "Build romantic/dating mode (0%)", "Feature", "Missing", "Add romantic_visible (DEFAULT false), dating_preference, bidirectional gender consent, is_romantically_compatible(), and an Account Settings → Dating Preferences UI. Note: dating_visible exists with DEFAULT true and wrong semantics — replace it.", "profiles (dating_visible, 005) · account-settings", "10"],
  [false, "P1", "Referral & Invite", "Build referral + invite (0%)", "Feature/Schema", "Missing", "Create referrals, click_credit_ledger, profile_badges, referral_link_clicks; /join/{code} landing; get-or-create-referral-code; invite_daily_cap = 4/24h shared with guest invites; Phase-0 badges only (credit behind referral_credit_enabled flag).", "(no migration yet)", "20 v2.0"],
  [false, "P1", "Algorithm", "Engagement weighting multiplier", "Feature/Schema", "Missing", "Add user_features.engagement_weight [0.700–1.000] DEFAULT 1.000; nightly batch formula 0.700 + 0.300·min(1, clicks_made/attended·2); multiply into scorePair ranked_score. Ranking-only — eligibility + send path untouched; new users stay full-weight.", "src/lib/matching/feature-store.ts · score.ts · 041_matching_v2_foundation.sql", "04_ENGAGEMENT"],
  [false, "P1", "Click Mechanic", "Send-layer correctness", "Feature", "Partial", "One clicks table (intent_mode, surface, FK to mutual_clicks); shared 3-send cap across pre+post surfaces; booking→event-end+48h window; mutual detection inside the send transaction w/ FOR UPDATE lock ordering; expiry + invalidation refund the budget.", "src/app/api/clicks/route.ts · user_clicks/mutual_clicks", "21 Part A"],
  [false, "P1", "Retention / Click Mechanic", "Post-event loop", "Feature/Schema", "Missing", "Prompt at event-end+2h (defer 22:00–09:00 → 09:00), one prompt with four responses incl. 'I didn't make it'. Add event_feedback + user_activity tables; wire 'Who was there' picker.", "src/app/api/cron/post-event-clicks · post-event-click-card.tsx", "06 §2.2 · 21 §6.8"],
  [false, "P1", "Retention & Engagement", "Activity feed + digest + milestones", "Feature/Schema", "Missing", "Add user_activity (+triggers), weekly digest cron + email, and milestone notifications (first booking, 5, 10 events). Currently absent — blocks the retention dashboard and 'Your Click story'.", "(no migration) · src/app/api/cron/*", "06"],
  [false, "P1", "Click With Me & Radar", "Pre-computed scores + Radar formula + nudge", "Feature/Schema", "Missing", "Add user_event_scores / user_click_scores / click_radar_scores + refresh crons (4h / 30min); implement Radar 4-dim score (tag 40 / people 30 / trending 20 / proximity 10); add nudge_sent_log + trigger for the soft nudge (a match RSVPs to your saved event).", "src/lib/personalized-matching.ts · click-radar.tsx", "09 · 04_TAG"],
  [false, "P1", "Life Tags", "Complete life-tag system", "Schema/Feature", "Partial", "Seed all 37 life tags (only ~5 present); add quiz_tag_mapping table (quiz→tag is currently hard-coded), sensitivity_class + privacy rules, and auto-generate event FOMO from attendee life tags (never expose sensitive tags).", "database/023_click_personas.sql · life-quiz-wizard.tsx · events.fomo", "08"],
  [false, "P1", "Interest Tags", "Progressive disclosure + seed parity", "Feature", "Partial", "Onboarding must show 8 categories + a single '+ Show more' expander (not all 16). Confirm the 223-tag seed, RLS, and admin-curated-only constraint.", "onboarding-form.tsx · 026/027/028 tag migrations", "07"],
  [false, "P1", "Dashboard", "Strict Mode A / Mode B rendering", "Bug", "Partial", "Mode A (0 confirmed bookings) must render ONLY the 4 allowed sections — no empty states; flip to Mode B on first confirmed booking with pull-on-focus + reconnect refetch (Realtime alone isn't the correctness mechanism).", "src/app/dashboard/page.tsx", "01 §3 · 06_INFRA T2"],

  [false, "P2", "Discovery", "Discovery page parity", "Feature", "Partial", "Align category strip, filters, search, sort, and the master query with the spec; ensure already-booked excluded and sold-out shows 'Join waitlist' from live capacity.", "src/app/discover · event-explorer.tsx", "12"],
  [false, "P2", "UI/UX (Merchant)", "Public merchant marketing pages", "Feature", "Missing", "Build /for-merchants + /for-merchants/how-it-works (hero, founding-partner deal, 10%-commission rationale, Eventbrite comparison). /merchant is currently an authed portal only.", "src/app/merchant (authed only)", "UIUX merchant landing"],
  [false, "P2", "UI/UX", "Meeting-point + post-event copy", "Feature/Copy", "Missing", "Add the Surface-7 meeting-point screen (venue nav + intent line, shown when both clicked pre-event) and fix the post-event headline to 'How was [Event]?' with the four-button selector.", "post-event-click-card.tsx", "UIUX explainer · 21 §7"],
  [false, "P2", "Safety", "Complete report reason taxonomy", "Schema", "Partial", "user_reports reason enum has 6 of 9 categories — add identity_misrep, underage, discrimination, event_misleading.", "database/018_safety.sql (user_reports)", "01 §6.3"],
  [false, "P2", "Operations", "Probing-attack anonymity test suite", "Test/Gate", "Missing", "Add the indistinguishability suite for send-click (mutual / blocked / hidden / duplicate) incl. timing floor; make it CI-blocking on any change to the click path. Pre-launch gate.", "(no tests yet) · src/app/api/clicks", "21A"],
  [false, "P2", "Merchant / Attendee", "Dual-identity toggle", "Schema/Feature", "Missing", "Add active_role persistence + identity switcher; fix the business_name data-bleed so a merchant's business name never leaks into their attendee identity.", "header-role-switcher.tsx · profiles", "MERCHANT_ATTENDEE_TOGGLE"],
  [false, "P2", "Analytics", "Dashboards + materialized views", "Feature/Schema", "Partial", "Add click_events / click_candidate_log, the materialized views, and merchant/admin dashboards using the canonical metric definitions (Appendix A).", "database/045_booking_events.sql", "22"],
];

// Supabase Bugs: [done, severity, bug, where, current, fix, specRef]
const BUGS_HEADER = ["Done", "Severity", "Bug", "Table / Migration", "Current state", "Fix", "Spec ref"];
const BUGS = [
  [false, "Critical", "Chat tables exist (no-chat violation)", "conversations, messages — 004_messages.sql", "Full 1:1 messaging with RLS is present in the schema.", "Drop conversations + messages (and RLS); 'no chat / no DM' is a non-negotiable. Coordinate only via the Proposal UI.", "00 Non-Negotiables"],
  [false, "Critical", "No profile-snapshot security-definer", "profiles", "Snapshots read via service-role API selecting all columns → email/DOB/postcode/dating-prefs leak to mutual partners.", "Add get_profile_snapshot() SECURITY DEFINER returning only limited columns; remove broad profile reads.", "01 §6.1"],
  [false, "High", "Email-verify gate is app-code, not RLS", "profiles.email_verified_at", "RSVP/book/click gated in event-repository.ts, not at the DB layer.", "Add RLS policies so the verification gate is enforced in Postgres, per spec.", "01 §1.2"],
  [false, "High", "Postcode stored in the wrong column", "profiles (no postcode col for users)", "Onboarding saves the AU 4-digit postcode into profiles.suburb. (postcode column only exists for merchants, 009.)", "Add profiles.postcode (4-digit, validated) + migrate; use it for proximity filtering.", "01 §2"],
  [false, "High", "connection_intent enum is the wrong set", "intent enum — 008_intent_extras.sql", "8 non-canonical intents; 'romantic' and 'relationship_friends' are absent.", "Migrate to the 6 canonical slugs (romantic/friends/locals/activities/networking/relationship_friends).", "13"],
  [false, "High", "dating_visible has wrong default & semantics", "profiles.dating_visible — 005_profile_extras.sql", "Column is DEFAULT true and ungated; spec wants romantic_visible DEFAULT false + bidirectional gating.", "Add/replace with romantic_visible DEFAULT false and gate every romantic surface.", "10"],
  [false, "High", "engagement_weight column missing", "user_features — 041_matching_v2_foundation.sql", "No engagement_weight column; batch population + scoring multiplier absent.", "Add engagement_weight [0.700–1.000] DEFAULT 1.000 + nightly batch + scorePair multiplier.", "04_ENGAGEMENT"],
  [false, "High", "referrals + credit ledger tables missing", "(no migration)", "Referral attribution + click_credit_ledger don't exist; referral feature is 0%.", "Create referrals, click_credit_ledger, profile_badges, referral_link_clicks per spec.", "20 v2.0"],
  [false, "High", "Retention tables missing", "(no migration)", "user_activity + event_feedback don't exist; activity feed, milestones, post-event loop blocked.", "Create user_activity (+triggers) and event_feedback.", "06"],
  [false, "Medium", "Pre-computed score tables missing", "(no migration)", "user_event_scores / user_click_scores / click_radar_scores absent; scoring is on-demand only (loses nightly-refresh guarantees).", "Add the score tables + refresh crons (4h / 30min).", "09 · 04_TAG"],
  [false, "Medium", "quiz_tag_mapping table missing", "(no migration)", "Quiz→tag mapping is hard-coded in the quiz component; admins can't edit without code change.", "Add quiz_tag_mapping (with weights) so mappings are data-driven.", "08"],
  [false, "Medium", "Life tags under-seeded + ungrouped", "tags — 023_click_personas.sql", "Only ~5 of 37 life tags seeded; no sensitivity_class or group structure.", "Seed all 37 + add sensitivity_class + group_slug/label.", "08"],
  [false, "Medium", "user_reports reason enum incomplete", "user_reports — 018_safety.sql", "6 of 9 reason categories present.", "Add identity_misrep, underage, discrimination, event_misleading.", "01 §6.3"],
  [false, "Medium", "Onboarding columns missing (users)", "profiles", "No onboarding_completed/_at or onboarding_step for users; resume relies on localStorage.", "Add onboarding_completed, onboarding_completed_at, onboarding_step; set on Step 4.", "01 §2"],
  [false, "Medium", "music_interest column missing", "profiles", "No music_interest enum; the Step-3 music question is absent.", "Add profiles.music_interest enum + the onboarding question.", "01 §2 (Step 3)"],
  [false, "Medium", "active_role column missing", "profiles", "No merchant/attendee mode persistence — risks sending merchants to /onboarding.", "Add active_role + identity switcher.", "MERCHANT_ATTENDEE_TOGGLE"],
  [false, "Medium", "nudge_sent_log missing", "(no migration)", "Soft nudge (a match RSVPs to your saved event) not implemented.", "Add nudge_sent_log + the RSVP trigger.", "09 §14"],
  [false, "Low", "clicks table naming vs spec", "user_clicks, mutual_clicks", "Spec wants ONE clicks table with intent_mode + surface + FK to mutual_clicks; current split may diverge.", "Verify/align schema to 21 §3.", "21 §3"],
];

// ── colours ────────────────────────────────────────────────────────────────
const GREEN = { red: 0.82, green: 0.94, blue: 0.82 };
const RED = { red: 0.97, green: 0.80, blue: 0.78 };
const AMBER = { red: 0.99, green: 0.90, blue: 0.66 };
const YELLOW = { red: 1.0, green: 0.97, blue: 0.80 };
const GRAY = { red: 0.90, green: 0.90, blue: 0.90 };

function rowRule(sheetId, cols, formula, color, index) {
  return {
    addConditionalFormatRule: {
      index,
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: cols }],
        booleanRule: {
          condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: formula }] },
          format: { backgroundColor: color },
        },
      },
    },
  };
}

async function ensureTab(title) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets(properties(sheetId,title))",
  });
  const found = meta.data.sheets?.find((s) => s.properties?.title === title);
  if (found) {
    const sheetId = found.properties.sheetId;
    // Clear values + existing conditional formats so a rerun is clean.
    await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `${title}` });
    const full = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [title],
      fields: "sheets(properties(sheetId),conditionalFormats)",
    });
    const cf = full.data.sheets?.find((s) => s.properties?.sheetId === sheetId)?.conditionalFormats ?? [];
    if (cf.length) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: cf.map(() => ({ deleteConditionalFormatRule: { sheetId, index: 0 } })) },
      });
    }
    return sheetId;
  }
  const added = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title, gridProperties: { rowCount: 200, columnCount: 12 } } } }] },
  });
  return added.data.replies[0].addSheet.properties.sheetId;
}

async function writeTab(title, header, rows, widths, kind) {
  const sheetId = await ensureTab(title);
  const cols = header.length;
  const lastCol = String.fromCharCode(64 + cols);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${title}!A1:${lastCol}${rows.length + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [header, ...rows] },
  });

  const requests = [
    // bold + frozen header
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.13, green: 0.14, blue: 0.16 }, wrapStrategy: "WRAP" } }, fields: "userEnteredFormat(textFormat,backgroundColor,wrapStrategy)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: cols }, cell: { userEnteredFormat: { textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true } } }, fields: "userEnteredFormat.textFormat" } },
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1, frozenColumnCount: 1 } }, fields: "gridProperties(frozenRowCount,frozenColumnCount)" } },
    // wrap all data cells, top-align
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: rows.length + 1, startColumnIndex: 0, endColumnIndex: cols }, cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } }, fields: "userEnteredFormat(wrapStrategy,verticalAlignment)" } },
    // Done checkboxes (col A, data rows)
    { setDataValidation: { range: { sheetId, startRowIndex: 1, endRowIndex: rows.length + 1, startColumnIndex: 0, endColumnIndex: 1 }, rule: { condition: { type: "BOOLEAN" }, showCustomUi: true } } },
  ];
  // column widths
  widths.forEach((w, i) => {
    requests.push({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 }, properties: { pixelSize: w }, fields: "pixelSize" } });
  });
  // conditional formatting — done wins, then priority/severity colour
  requests.push(rowRule(sheetId, cols, "=$A2=TRUE", GREEN, 0));
  if (kind === "backlog") {
    requests.push(rowRule(sheetId, cols, '=$B2="P0"', RED, 1));
    requests.push(rowRule(sheetId, cols, '=$B2="P1"', AMBER, 2));
    requests.push(rowRule(sheetId, cols, '=$B2="P2"', GRAY, 3));
  } else {
    requests.push(rowRule(sheetId, cols, '=$B2="Critical"', RED, 1));
    requests.push(rowRule(sheetId, cols, '=$B2="High"', AMBER, 2));
    requests.push(rowRule(sheetId, cols, '=$B2="Medium"', YELLOW, 3));
    requests.push(rowRule(sheetId, cols, '=$B2="Low"', GRAY, 4));
  }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } });
  return { title, sheetId, rows: rows.length };
}

const r1 = await writeTab("Spec Backlog", BACKLOG_HEADER, BACKLOG, [52, 70, 180, 220, 110, 90, 460, 260, 200], "backlog");
const r2 = await writeTab("Supabase Bugs", BUGS_HEADER, BUGS, [52, 90, 260, 240, 320, 360, 170], "bugs");
console.log("DONE:", JSON.stringify([r1, r2]));
console.log(`Spec Backlog: ${BACKLOG.length} items (P0=${BACKLOG.filter(r=>r[1]==="P0").length}, P1=${BACKLOG.filter(r=>r[1]==="P1").length}, P2=${BACKLOG.filter(r=>r[1]==="P2").length})`);
console.log(`Supabase Bugs: ${BUGS.length} items (Critical=${BUGS.filter(r=>r[1]==="Critical").length}, High=${BUGS.filter(r=>r[1]==="High").length}, Medium=${BUGS.filter(r=>r[1]==="Medium").length}, Low=${BUGS.filter(r=>r[1]==="Low").length})`);
