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
// Re-verified against HEAD on 2026-06-22 (re-audit of the stale 2026-06-17 /md coverage data).
// Open items lead (P0→P2); a "Done" section (verified shipped since the audit) is appended at the end.
const BACKLOG_HEADER = ["Done", "Priority", "Area (spec)", "Work item", "Type", "Current", "Description / what to build", "Key files / tables", "Spec ref"];
const BACKLOG = [
  // ── P0 — launch blockers: correctness, privacy, non-negotiables ──
  [false, "P0", "Non-Negotiables / Click Mechanic", "Remove chat & direct messaging", "Bug", "Missing", "004_messages.sql still ships conversations + messages tables (with RLS) — violates the non-negotiable 'no chat / no DM' rule. Drop both tables, keep /messages absent (or 410), and route ALL post-mutual coordination through the Proposal UI (already built). Verified present 2026-06-22.", "database/004_messages.sql", "00 Non-Negotiables · 06_INFRA T5"],
  [false, "P0", "User Journey", "Profile-snapshot privacy gate", "Bug", "Missing", "Mutual-click partner data is read via service-role queries that select ALL profile columns (email, DOB, postcode, dating prefs). Add a limited-column snapshot (get_profile_snapshot SECURITY DEFINER, or an explicit column projection) returning only first_name/age/suburb/avatar/bio/shared-tags/intent; remove the broad reads.", "src/lib/event-repository.ts (snapshot reads) · profiles", "01 §6.1 · 09 §7.1"],
  [false, "P0", "User Journey / Onboarding", "Onboarding completion + step tracking + routing", "Schema/Bug", "Missing", "No profiles.onboarding_completed/_at or onboarding_step for users (only merchants). Add the columns, set completion on Step 4, persist step for resume, and drive §1.4 sign-in routing — incl. active_role so a merchant is NEVER diverted into /onboarding (spec flags that as a live bug).", "profiles · src/components/onboarding-form.tsx · src/app/post-login", "01 §1.4 / §2"],
  [false, "P0", "Booking / Infra", "Booking race hardening (lock + idempotency + rate limit)", "Feature", "Partial", "Holds work via event_attendees.status='pending_payment' + 30-min TTL, but spec wants pg_advisory_xact_lock(hashtext(event_id)) around the capacity check, a 15-min TTL, a client_idempotency_key (duplicate within window returns the cached Stripe session), and a 10/hour per-user checkout rate limit. Load-test cases 1/4/5/13 depend on this.", "src/app/api/events/[eventId]/checkout/route.ts · event-repository.ts", "06_INFRA T1 · 05 §3.1/§6.1"],
  [false, "P0", "Booking / Analytics", "Verify Stripe webhook signature active", "Verify", "Partial", "booking_events append-only log now EXISTS + is wired (045). Remaining pre-launch gate: confirm checkout.session.completed signature verification is enforced on the live webhook (www host) and no unsigned path can confirm a booking.", "src/app/api/webhooks/stripe/route.ts", "05_LIFECYCLE · 22 Phase A"],

  // ── P1 — high value before / soon after launch ──
  [false, "P1", "Romantic Intent & Dating Mode", "Build romantic/dating mode (0%)", "Feature", "Missing", "Add romantic_visible (DEFAULT false), dating_preference, bidirectional gender consent, is_romantically_compatible(), and Account Settings → Dating Preferences UI. dating_visible exists with DEFAULT true + wrong semantics — replace it. Depends on the intent-taxonomy decision below.", "profiles.dating_visible (005) · account-settings", "10"],
  [false, "P1", "Algorithm", "Reconcile intent taxonomy (decision)", "Schema/Decision", "Partial", "Code uses 8 intents (dating/friendship/networking/exploring/hobbies/wellness/community/new_in_town); spec 13 mandates 6 (romantic/friends/locals/activities/networking/relationship_friends). CLAUDE.md currently treats the 8-set as an accepted divergence — DECIDE: amend the spec to 8, or migrate enum+onboarding+matching to the 6 slugs. romantic + relationship_friends are prerequisites for the dating gate.", "database/008_intent_extras.sql · src/lib/matching/* · onboarding-form.tsx", "13 · 00 conflict map"],
  [false, "P1", "Romantic / Safety", "relationship_friends ↔ romantic hard exclusion", "Safety", "Missing", "Once the intents exist, enforce the safety-critical mutual-exclusion (no override) in every eligibility query so relationship_friends users are never shown romantically and vice-versa.", "matching eligibility queries", "10 · 00 Non-Negotiables"],
  [false, "P1", "Click Mechanic / Proposals", "Proposal note + decline/counter data model", "Feature/Schema", "Partial", "Accept + suggest-alternative (max-3, catalogue-only) + 7-day expiry + RSVP reminder are DONE. Still missing the sanctioned expression channel: a 200-char note (note_by_user_id/note_at) with a contact-info blocklist (URLs/emails/phones/@handles → invalid_content), decline-with-reason, and the richer proposal_status enum + accept flags.", "database/019_proposals.sql · src/app/proposals/actions.ts", "06_INFRA T5 · QA §6.3 · 21"],
  [false, "P1", "Retention & Engagement", "Activity feed + weekly digest + milestones", "Feature/Schema", "Missing", "Add user_activity (+ booking/mutual triggers) and the dashboard last-5 / profile full feed; weekly digest cron (Tue 8am AEST, 14-day-inactive) + email template + email_sends A/B + booking source attribution; milestone notifications (first booking, 5, 10, first mutual). Keystone retention surface.", "(no migration) · src/app/api/cron/* · emails/", "06 §3/§4/§5"],
  [false, "P1", "Retention / Click Mechanic", "Post-event loop — feedback + email", "Feature/Schema", "Partial", "In-app prompt + hourly cron + idempotency are DONE. Missing: event_feedback (sentiment) + user_activity writes (event_attended / 'just me'), the post-event EMAIL alongside the in-app card, quiet-hours deferral (22:00–09:00), and the 4-button 'I didn't make it' response.", "src/app/api/cron/post-event-clicks · post-event-click-card.tsx", "06 §2.2 · 21 §6.8"],
  [false, "P1", "Click With Me & Radar", "Pre-computed scores + Radar formula + nudge", "Feature/Schema", "Missing", "Add user_event_scores / user_match_scores / click_radar_scores + refresh crons (4h / 30min) so feeds read precomputed rows (spec's #1 pre-launch infra task); implement the Radar 4-dim score (tag 40 / people 30 / trending 20 / proximity 10); add nudge_sent_log + RSVP trigger for the soft nudge.", "event-repository.ts (getPersonalizedDiscovery/getSuggestedPeople) · click-radar.tsx", "09 · 04_TAG"],
  [false, "P1", "Algorithm", "Wire recordImpressions() into serving", "Bug", "Partial", "recordImpressions() is defined but NEVER called by dashboard/discovery/people surfaces → no impression rows, so no 14-day anti-repeat history and no negative training labels accrue. Call it at render time on each serving surface. Cheap, high-leverage; unblocks the ML training loop.", "src/lib/matching/candidates.ts:250 · serving surfaces", "04_MATCHING_V2 §10"],
  [false, "P1", "Algorithm", "Engagement weighting multiplier", "Feature/Schema", "Missing", "Add user_features.engagement_weight [0.700–1.000] DEFAULT 1.000; nightly batch 0.700 + 0.300·min(1, clicks_made/attended·2); multiply into scorePair ranked_score. Ranking-only — eligibility + send path untouched; new users stay full-weight.", "src/lib/matching/feature-store.ts · score.ts · 041", "04_ENGAGEMENT"],
  [false, "P1", "Infra / Dashboard", "Pull-on-focus realtime refetch", "Feature", "Missing", "Add a useLiveTable hook + LastUpdated component that refetch on document.visibilitychange + window.online (+ a manual refresh) so dropped realtime subscriptions self-correct; wire dashboard / notifications / event-detail. Realtime alone is not the correctness mechanism.", "(no hook yet) · src/app/dashboard · notifications", "06_INFRA T2"],
  [false, "P1", "Admin / Security", "Admin MFA enforcement", "Security", "Missing", "Admin portal is reachable on an isAdminEmail() check alone. Enforce MFA enrolment after JWT (redirect to setup if no factor). Pre-launch security gate.", "src/app/admin/layout.tsx · src/auth.ts", "03 §0/§1"],
  [false, "P1", "Merchant Journey", "Founding-merchant deal (0% commission)", "Feature/Schema", "Missing", "First 35 merchants: add merchant_profiles.is_founding_partner + founding_deal_expiry (3 months from approval), a getCommissionRate() returning 0% in-window (checkout fee is currently a flat PLATFORM_FEE_BPS), a badge on cards/profile, and a feed boost. Launch economics.", "merchant_profiles · checkout fee calc", "02 §2/§9"],
  [false, "P1", "Merchant / Admin / Booking", "Payment-suspended event status", "Feature/Schema", "Missing", "When a merchant's Stripe account flips charges_enabled true→false (account.updated webhook), move their paid events to payment_suspended (block new bookings, keep existing, auto-restore) and surface them in /admin with an affected-events filter. Buyer protection.", "event_status enum (001) · api/webhooks/stripe · /admin/events", "02 §9.1 · 03"],
  [false, "P1", "Admin Journey / Safety", "Event unpublish (live takedown)", "Feature", "Missing", "Admins can't take down a LIVE event short of merchant cancellation. Add an 'unpublished' status + /api/admin/events/[eventId]/unpublish with reason, optional auto-refund to confirmed attendees, and attendee notification.", "event_status enum · src/app/api/admin/events · event-repository.ts", "03 §4"],
  [false, "P1", "Booking Lifecycle", "Promote waitlist on admin/Stripe-dashboard refund", "Bug", "Missing", "User + per-seat cancels now promote the waitlist, but the charge.refunded webhook path does not — an admin/Stripe-dashboard refund frees a seat that is never re-offered. Add promoteNextWaitlister to the charge.refunded handler (or issueRefund).", "src/app/api/webhooks/stripe/route.ts · event-repository.ts", "05 §3.5"],
  [false, "P1", "Booking Lifecycle", "Capture refund_failures for admin refunds", "Bug", "Missing", "issueRefund()'s stripe.refunds.create is not wrapped — an admin-initiated refund that fails (closed card) throws uncaught and creates no operator-queue row. User-initiated cancels are already protected. Wrap it + insert refund_failures.", "src/lib/stripe-sync.ts (issueRefund) · database/035_refund_failures.sql", "05 §2.4/§3.5"],

  // ── P2 — important, post-launch / scale / polish ──
  [false, "P2", "Referral & Invite", "Build referral + invite (0%)", "Feature/Schema", "Missing", "Create referrals / click_credit_ledger / profile_badges / referral_link_clicks; /join/{code} landing; get-or-create-referral-code; invite cap 4/24h shared with guest invites; Phase-0 badges only (credit behind a referral_credit_enabled flag). Hook the guest-claim flow into referral creation.", "(no migration) · /join/[code]", "20 · 19 §12"],
  [false, "P2", "Click Mechanic", "Send-layer correctness", "Feature", "Partial", "Add intent_mode + surface to user_clicks; a shared 3-send cap across pre+post surfaces; a booking→event-end+48h window; mutual detection inside the send transaction with FOR UPDATE lock ordering; expiry/invalidation refunds the send budget.", "src/app/api/clicks/route.ts · user_clicks/mutual_clicks", "21 Part A · 04_TAG"],
  [false, "P2", "Algorithm / FOMO", "event_fomo_cache + data-driven FOMO", "Feature/Schema", "Missing", "events.fomo is static admin text. Add event_fomo_cache(event_id, fomo_data jsonb, computed_at) recomputed on each booking (trigger) with a ≥5-attendee privacy guard + platform_settings.fomo_min_cohort, and sensitivity filtering on tags.", "events.fomo · (no cache table)", "04_TAG §4d · 08"],
  [false, "P2", "Algorithm", "Mutual-click lifecycle (expiry + top-3)", "Schema/Feature", "Missing", "mutual_clicks lacks expires_at/status/renewed; add them + a daily expiry cron (7-day, one extension) and a mutual_click_suggestions top-3 shared-event table so the proposal UI has fallbacks; add a 'you're both already going to X' skip.", "mutual_clicks (001) · (no suggestions table)", "04_TAG §5 · 09"],
  [false, "P2", "Matching v2 / Infra", "Serving views + feature triggers + training job", "Feature/Schema", "Missing", "Add materialised candidate views (match_candidates_user_user/_user_event) + 4h/30m refresh; real-time declared-feature sync triggers + user_features_dirty; the external per-cohort logistic-regression training job (AUC≥0.60 → cohort_weights) + offline eval (AUC/Precision@10/Brier). Weights are hand-curated until this ships.", "src/lib/matching/* · 041 · admin/matching-lab", "04_MATCHING_V2 §1.5/§4.3/§5.3/§7"],
  [false, "P2", "Merchant Journey", "Under-attended alert + minimum-viable-attendees", "Feature/Schema", "Missing", "Add visibility_boosted_until + minimum_viable_attendees/minimum_decision_hours, an hourly viability cron, and the dashboard alert (72h / <30% capacity) with boost / lower-price / set-minimum actions + matched-people nudge. Main fill-rate lever.", "merchant events schema · src/app/api/cron · merchant dashboard", "02 §3.1/§3.2"],
  [false, "P2", "Merchant Journey", "Two-tier trusted-merchant gating + 4h SLA", "Feature", "Partial", "auto_approve_events is granted on the FIRST event approval; spec wants it after 3 approved events with zero issues, auto-revoke on >10% cancellations/90d, plus a 4-hour SLA queue indicator (amber 2h / red 4h) in /admin/events.", "event-repository.ts (auto_approve) · src/app/admin/events", "02 §2"],
  [false, "P2", "Merchant / Booking", "Merchant cancel-reason capture", "Feature/Schema", "Partial", "Cancel uses window.confirm with no reason. Add a CancelEventDialog requiring a ≥20-char reason, read it in POST /api/merchant/events/[eventId]/cancel, persist events.cancellation_reason/cancelled_at, and ride it into the attendee email + admin audit log.", "merchant-event-cancel-button.tsx · api/merchant/events/[eventId]/cancel · events", "02 §6 · 05 §6b"],
  [false, "P2", "Merchant Journey", "Event accessibility data + demand nudge", "Feature/Schema", "Missing", "Add events.accessibility (step-free / accessible bathroom / quiet-low-sensory / hearing loop / seating) checkboxes to the create wizard + a one-off merchant nudge when a needs-flagged user views an event with empty data.", "events schema · merchant/events/create/location", "02 §5 · 08 functional tags"],
  [false, "P2", "Admin Journey", "Permanent user ban", "Feature/Schema", "Missing", "Only reversible suspension exists. Add profiles.is_banned + ban_reason/banned_at/banned_by, a Restore action, and an is-active gate on auth + write paths.", "profiles · src/app/admin/members · event-repository.ts", "03 §5"],
  [false, "P2", "Admin Journey", "Tag merge & archive", "Feature", "Partial", "Tags support create/edit/delete only. Add merge (move all event_tags/user_tags refs A→B then archive A, with affected-count confirm) and archive (hide from selection UI, preserve refs) + category reorder.", "src/app/api/admin/tags/route.ts · src/app/admin/tags", "03 · 07"],
  [false, "P2", "Admin / Booking", "Refund-failures admin queue UI", "Feature", "Missing", "refund_failures rows are written but there is no admin surface to view/retry/issue discretionary refunds. Add the queue + actions (and §7 mark-resolved / flag-transaction).", "refund_failures · src/app/admin", "05 §6a · 03 §7"],
  [false, "P2", "Booking Lifecycle", "event_capacity_v / event_headcount_v views", "Schema", "Missing", "Capacity (confirmed+pending+offered) and seats-vs-people headcount logic is correct but re-implemented inline in ~4 code paths. Add SQL views as the single source of truth and reuse everywhere.", "database/*.sql · event-repository.ts (inline counts)", "05 §2.5/§2.5a · QA §15"],
  [false, "P2", "Admin / Booking", "platform_settings config table", "Schema/Feature", "Missing", "Refund tiers (48/24/0) are hard-coded constants; waitlist_offer_minutes / mutual_click_expiry_days / fomo_min_cohort aren't in settings. Add a platform_settings table read at runtime so admins tune policy without a deploy.", "src/lib/refund-policy.ts · admin-system-settings.tsx", "05 §6 · 03 §10 · 04_TAG"],
  [false, "P2", "Booking / Email", "Waitlist-join email → email_events", "Bug", "Partial", "The waitlist-join confirmation still sends via legacy sendWorkflowEmail, so it's absent from the email_events audit/dev-inbox. Wire it through logEmailEvent like the other booking emails (project convention).", "event-repository.ts registerForEvent (waitlisted branch)", "05 · project email convention"],
  [false, "P2", "Discovery", "Discovery page parity", "Feature", "Partial", "Move filtering server-side (master query: category/tag/search/when/price/vibe/audience/distance/format), add URL state for all filters, pagination (12/page + load-more), debounced search, and PostGIS distance with spec presets [2/5/10/30km]. Ensure already-booked excluded and sold-out → 'Join waitlist'.", "src/app/discover · event-explorer.tsx", "12"],
  [false, "P2", "UI/UX (Merchant)", "Public merchant marketing pages", "Feature", "Missing", "Build /for-merchants + /for-merchants/how-it-works (hero, founding-partner deal, commission rationale, Eventbrite comparison). /merchant is an authed portal only.", "src/app/merchant (authed only)", "UIUX merchant landing"],
  [false, "P2", "UI/UX", "Meeting-point + post-event copy + no-chat surfaces", "Feature/Copy", "Missing", "Add the Surface-7 meeting-point screen (venue nav + intent line when both clicked pre-event) and the post-event headline 'How was [Event]?' with the four-button selector. Complete the remaining no-chat copy surfaces (/messages 410, expired-mutual soft-release, onboarding completion).", "post-event-click-card.tsx", "UIUX · 21 §7 · 06 §7"],
  [false, "P2", "Safety", "Complete report reason taxonomy", "Schema", "Partial", "user_reports reason enum has 6 of 9 categories — add identity_misrep, underage, discrimination, event_misleading.", "database/018_safety.sql (user_reports)", "01 §6.3"],
  [false, "P2", "Operations", "Probing-attack anonymity test suite", "Test/Gate", "Missing", "Add the indistinguishability suite for send-click (mutual / blocked / hidden / duplicate) incl. timing floor; make it CI-blocking on any change to the click path. Pre-launch gate.", "(no tests yet) · src/app/api/clicks", "21A"],
  [false, "P2", "Merchant / Attendee", "Dual-identity persistence + data-bleed fix", "Schema/Feature", "Partial", "The header role-SWITCHER is DONE (header-role-switcher.tsx). Still missing: active_role persistence (DB column + login reset + refresh-load) so a mobile refresh doesn't drop merchant mode, and a check that business_name never bleeds into the attendee identity.", "header-role-switcher.tsx · profiles", "MERCHANT_ATTENDEE_TOGGLE"],
  [false, "P2", "Analytics", "Dashboards + materialized views + k-anon", "Feature/Schema", "Partial", "Add click_events / click_candidate_log, the materialized views (event_summary/merchant_daily/platform_daily/cohort_retention/...), k-anonymity (K=10) on merchant aggregates, and admin/merchant dashboards using canonical metric defs. Log attended/no_show/payout_included on booking_events.", "database/045_booking_events.sql · materialized views", "22"],
  [false, "P2", "Life Tags", "Complete life-tag system", "Schema/Feature", "Partial", "Seed all 37 life tags (~5 present); add quiz_tag_mapping (quiz→tag is currently hard-coded) + weights, sensitivity_class + privacy rules, and auto-generate event FOMO from attendee life tags (never expose sensitive tags).", "tags (023) · quiz/life/* · events.fomo", "08"],
  [false, "P2", "Interest Tags", "Progressive disclosure + seed parity", "Feature", "Partial", "Onboarding shows 8 categories + a single '+ Show more' expander (not all 16). Confirm the 223-tag seed (only ~75 present), is_active/archived/usable_by columns, admin-curated-only constraint, and ≥1-tag-per-event enforcement before publish.", "onboarding-form.tsx · tag migrations", "07"],
  [false, "P2", "Dashboard", "Strict Mode A / Mode B rendering", "Bug", "Partial", "Mode A (0 confirmed bookings) should render ONLY the 4 allowed sections — no empty states; flip to Mode B on first confirmed booking. Currently all sections render with empty states.", "src/app/dashboard/page.tsx", "01 §3"],

  // ── DONE — verified shipped since the 2026-06-17 audit (the /md data still lists these as gaps) ──
  [true, "Done", "Merchant / Attendee", "Header role switcher", "Feature", "Done", "Multi-portal switch (user/merchant/admin) with no re-login; roles derived from session + merchant profile + admin email. (active_role persistence is still open — see Dual-identity.)", "header-role-switcher.tsx · site-chrome.tsx", "03 §1 · verified 2026-06-22"],
  [true, "Done", "Safety", "Blocked-users system", "Feature", "Done", "user_blocks table + block/unblock; enforced symmetrically in candidate gen, suggestions, click eligibility, and post-event fan-out. (The audit grepped the wrong table name and reported it missing.)", "database/018_safety.sql · event-repository.ts", "01 §6 · QA · verified 2026-06-22"],
  [true, "Done", "Click Mechanic", "Proposal max-3 counter-proposals", "Feature", "Done", "Server-enforced (SELECT ... FOR UPDATE; alternatives_count >= 3 throws); catalogue-only, no free text; UI shows 'n of 3 left'.", "event-repository.ts · proposal-card.tsx · 019", "21 · verified 2026-06-22"],
  [true, "Done", "Retention", "Post-event click prompt (cron + idempotency)", "Feature", "Done", "Hourly CRON_SECRET-guarded cron at event-end+12h, block-aware, idempotent; dashboard pull card feeds the mutual-detection path. (Email + feedback/activity writes still open — see P1.)", "api/cron/post-event-clicks · post-event-click-card.tsx", "QA · verified 2026-06-22"],
  [true, "Done", "Click Mechanic", "Proposal 7-day expiry + RSVP reminder", "Feature", "Done", "Proposals expire_at = now()+7d; proposal-rsvp-reminders cron reminds both partners 24h+ later; expired proposals surface as isExpired.", "api/cron/proposal-rsvp-reminders · event-repository.ts", "QA · verified 2026-06-22"],
  [true, "Done", "Booking / Guest RSVP", "Guest RSVP: per-seat cancel/refund + door list + check-in", "Feature", "Done", "guest_spots model; seats (not rows) counted toward capacity/headcount on both display + enforcement; per-seat cancel frees the seat + promotes the waitlist + issues a policy refund; merchant door list with day-of check-in. (Commits 9bee1ce/3819c03/ce1d007.)", "database/046-048 · event-repository.ts · merchant/events/[eventId]", "19 §9/§10.1/§11 · verified 2026-06-22"],
  [true, "Done", "Booking Lifecycle", "Tiered cancellation refund (48h/24h/0% + merchant 100%)", "Feature", "Done", "quoteCancellationRefund: ≥48h=100%, 24–48h=50%, <24h=0%; wired into attendee cancel, per-seat cancel, and merchant full-refund cancel.", "src/lib/refund-policy.ts · event-repository.ts", "05 §5.2 · verified 2026-06-22"],
  [true, "Done", "Booking / Analytics", "booking_events append-only audit log", "Schema/Feature", "Done", "Append-only lifecycle log (reserved/confirmed/cancelled_by_*/refunded_*/refund_denied) with refund_tier + immutability trigger; wired at cancel/refund/webhook. (attended/no_show/payout_included not yet logged — see Analytics.)", "database/045_booking_events.sql · src/lib/booking-events.ts", "05 · 22 · verified 2026-06-22"],
  [true, "Done", "Privacy / Infra", "Social scraping removed + privacy/terms published", "Bug", "Done", "No scraping code anywhere; onboarding uses consented photo upload; /privacy + /terms published. (06_INFRA T4.)", "src/app/privacy · src/app/terms · profile-gallery-uploader.tsx", "06_INFRA T4 · verified 2026-06-22"],
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
  [false, "High", "payment_suspended missing from event_status", "event_status enum — 001_schema.sql", "Enum is draft/pending/live/featured/locked/waitlist/cancelled/rejected; no payment_suspended. A merchant's Stripe account going non-chargeable can't hold their paid events.", "ALTER TYPE event_status ADD VALUE 'payment_suspended'; move/restore on account.updated.", "02 §9.1 · 03"],
  [false, "High", "event_proposals enum + note/decline columns incomplete", "event_proposals — 019_proposals.sql", "proposal_status enum is only pending/confirmed/expired; no note (200ch)/note_by/note_at, decline_reason/declined_by, or accept flags — the sanctioned no-chat expression channel is absent.", "Extend the enum + add the note (w/ blocklist) + decline + accept-flag columns.", "06_INFRA T5 · 21"],
  [false, "Medium", "Booking-hold hardening columns missing", "event_attendees / checkout", "No client_idempotency_key column, 30-min (not 15-min) hold TTL, and no pg_advisory_xact_lock around the capacity check or per-user rate limit.", "Add client_idempotency_key + advisory-lock the capacity check; tighten TTL to 15 min; rate-limit checkout.", "06_INFRA T1 · 05 §3.1"],
  [false, "Medium", "Founding-partner columns missing", "merchant_profiles", "No is_founding_partner / founding_deal_expiry; commission is a flat PLATFORM_FEE_BPS env, so the first-35 0% window can't be honoured.", "Add is_founding_partner + founding_deal_expiry; gate commission on the window.", "02 §2/§9"],
  [false, "Medium", "Permanent-ban columns missing", "profiles", "Only suspended_at/suspended_reason exist (reversible). No is_banned/ban_reason/banned_at/banned_by + is-active gate.", "Add ban columns + a Restore action + an is-active write gate.", "03 §5"],
  [false, "Medium", "Merchant cancel-reason columns missing", "events", "No cancellation_reason / cancelled_at; merchant cancel is a window.confirm with no stored reason.", "Add cancellation_reason (≥20 chars) + cancelled_at; persist from the cancel dialog.", "02 §6 · 05 §6b"],
  [false, "Medium", "platform_settings table missing", "(no migration)", "Refund tiers + waitlist window + fomo_min_cohort are hard-coded constants, not runtime config.", "Add platform_settings (cancellation_policy jsonb, waitlist_offer_minutes, mutual_click_expiry_days, fomo_min_cohort) read at runtime.", "05 §6 · 03 §10"],
  [false, "Low", "event_capacity_v / event_headcount_v views missing", "(no migration)", "Capacity + seats-vs-people headcount are recomputed inline across ~4 call sites; no single source-of-truth view.", "Add the views and reuse them everywhere capacity is read.", "05 §2.5"],
  [false, "Low", "mutual_clicks expiry columns missing", "mutual_clicks — 001_schema.sql", "Only profile_a/b + suggested_event_id + created_at; no expires_at/status/renewed, so the 7-day expiry + one-extension can't be enforced.", "Add expires_at/status/renewed + a daily expiry cron.", "04_TAG §5 · 09"],
  [false, "Low", "clicks table naming vs spec", "user_clicks, mutual_clicks", "Spec wants ONE clicks table with intent_mode + surface + FK to mutual_clicks; current split lacks intent_mode/surface.", "Add intent_mode + surface to user_clicks; align to 21 §3.", "21 §3"],
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
console.log(`Spec Backlog: ${BACKLOG.length} rows (P0=${BACKLOG.filter(r=>r[1]==="P0").length}, P1=${BACKLOG.filter(r=>r[1]==="P1").length}, P2=${BACKLOG.filter(r=>r[1]==="P2").length}, Done=${BACKLOG.filter(r=>r[0]===true).length})`);
console.log(`Supabase Bugs: ${BUGS.length} items (Critical=${BUGS.filter(r=>r[1]==="Critical").length}, High=${BUGS.filter(r=>r[1]==="High").length}, Medium=${BUGS.filter(r=>r[1]==="Medium").length}, Low=${BUGS.filter(r=>r[1]==="Low").length})`);
