---
name: repo-map
description: Full URI-to-file route map and API-route index for the Click repo - every page under src/app and every api/** group, with per-route gotchas (redirects, wizard step chains, the matching-v2 kill-switch default-ON, trusted-merchant auto-approval, Stripe/cron bearer guards). Invoke when locating a page or API route, or before adding one.
---

## Page URI map

Every route in `src/app`. URI on the left, source file on the right. Use this to navigate — `Cmd+Click` the path.

### Public / marketing

| URI | File |
| --- | --- |
| `/` | `src/app/page.tsx` |
| `/how-it-works` | `src/app/how-it-works/page.tsx` |
| `/discover` | `src/app/discover/page.tsx` (canonical event browse: personalized rail + `EventExplorer`) |
| `/categories` | `src/app/categories/page.tsx` |
| `/categories/[slug]` | `src/app/categories/[slug]/page.tsx` |
| `/events` | `src/app/events/page.tsx` (redirect → `/discover`, preserving query string) |
| `/events/[slug]` | `src/app/events/[slug]/page.tsx` |
| `/people` | `src/app/people/page.tsx` |
| `/profile/[userId]` | `src/app/profile/[userId]/page.tsx` |
| `/terms` | `src/app/terms/page.tsx` |
| `/privacy` | `src/app/privacy/page.tsx` |
| `/security` | `src/app/security/page.tsx` |
| `/refund-policy` | `src/app/refund-policy/page.tsx` |
| `/safety` | `src/app/safety/page.tsx` |
| `/claim/[token]` | `src/app/claim/[token]/page.tsx` (guest-spot invite landing — spec 19; states valid/expired/claimed/gone + `?action=release\|remove` token-authed flows needing no account; signed-in visitors claim via `POST /api/claim/[token]`) |

### Auth & onboarding

| URI | File |
| --- | --- |
| `/login` | `src/app/login/page.tsx` |
| `/signup` | `src/app/signup/page.tsx` |
| `/register` | `src/app/register/page.tsx` |
| `/auth` | `src/app/auth/page.tsx` |
| `/forgot-password` | `src/app/forgot-password/page.tsx` |
| `/post-login` | `src/app/post-login/page.tsx` |
| `/onboarding` | `src/app/onboarding/page.tsx` - the attendee profile form, and a REQUIRED step: it collects the postcode + birth date that make up `onboardingComplete`. One route, five steps: `src/components/onboarding-form.tsx` holds the whole flow (basics → intent → value preview → interests → photo → done) in client state and marks each step with a hash (`#intent`, `#preview`, …) so browser Back walks the wizard; only the last step POSTs, to `api/onboarding`. The page also passes a slice of `getEventsForExplore()` down for the preview step's real event cards. Rendered **chromeless** (`ChromeGate` in `src/components/chrome-gate.tsx` drops the global header, mobile bottom nav, and footer here and on the auth routes) so the app nav can't be used to walk out of it. The real enforcement is server-side - `assertBookingEligible` in `event-repository.ts` refuses an RSVP or a checkout hold to a profile missing either field, and `saveOnboarding` rejects a missing/under-18 birth date. |
| `/qa-unlock` | `src/app/qa-unlock/route.ts` - GET only. `?key=<TEST_SWITCHER_KEY>` sets the httpOnly cookie that reveals the top-right QA persona switcher on a deployed environment; `?lock=1` clears it. 404s on a wrong/absent key or an unconfigured deployment. Gate lives in `src/lib/test-switcher.ts` and is re-checked by the `test-login` provider and every switcher server action. |
| `/quiz` | `src/app/quiz/page.tsx` |
| `/quiz/life` | `src/app/quiz/life/page.tsx` (auth gate in `layout.tsx`; redirects → `/quiz/life/life-stage`) |
| `/quiz/life/life-stage` | `src/app/quiz/life/life-stage/page.tsx` (wizard step 1/4) |
| `/quiz/life/availability` | `src/app/quiz/life/availability/page.tsx` (wizard step 2/4) |
| `/quiz/life/event-style` | `src/app/quiz/life/event-style/page.tsx` (wizard step 3/4) |
| `/quiz/life/energy` | `src/app/quiz/life/energy/page.tsx` (wizard step 4/4 → Save) |
| `/quiz/personality` | `src/app/quiz/personality/page.tsx` |
| `/scale` | `src/app/scale/page.tsx` |

### Authenticated attendee

| URI | File |
| --- | --- |
| `/dashboard` | `src/app/dashboard/page.tsx` |
| `/dashboard/calendar` | `src/app/dashboard/calendar/page.tsx` |
| `/profile` | `src/app/profile/page.tsx` |
| `/profile/edit` | `src/app/profile/edit/page.tsx` |
| `/account-settings` | `src/app/account-settings/page.tsx` |
| `/notifications` | `src/app/notifications/page.tsx` |
| `/bookmarks` | `src/app/bookmarks/page.tsx` |
| `/saved-events` | `src/app/saved-events/page.tsx` (redirect → `/bookmarks`) |
| `/confirmed-events` | `src/app/confirmed-events/page.tsx` |
| `/proposals` | `src/app/proposals/page.tsx` (post-mutual-click coordination UI; no free text) |

### Merchant

| URI | File |
| --- | --- |
| `/merchant` | `src/app/merchant/page.tsx` |
| `/merchant/signup` | `src/app/merchant/signup/page.tsx` (auth gate; redirects authed users → `/merchant/signup/business`) |
| `/merchant/signup/business` | `src/app/merchant/signup/business/page.tsx` (wizard step 1/3) |
| `/merchant/signup/contact` | `src/app/merchant/signup/contact/page.tsx` (wizard step 2/3) |
| `/merchant/signup/documents` | `src/app/merchant/signup/documents/page.tsx` (wizard step 3/3 → Submit) |
| `/merchant/onboarding` | `src/app/merchant/onboarding/page.tsx` (approved-merchant gate in `layout.tsx`; redirects → `/merchant/onboarding/welcome`) |
| `/merchant/onboarding/welcome` | `src/app/merchant/onboarding/welcome/page.tsx` (walkthrough step 1/3) |
| `/merchant/onboarding/payouts` | `src/app/merchant/onboarding/payouts/page.tsx` (walkthrough step 2/3 - Stripe Connect, skippable) |
| `/merchant/onboarding/done` | `src/app/merchant/onboarding/done/page.tsx` (walkthrough step 3/3 → stamps `onboarding_completed_at`) |
| `/merchant/events/create` | `src/app/merchant/events/create/page.tsx` (redirects → `/merchant/events/create/basics`; the layout gates on approval **and** on `onboarding_completed_at`, redirecting → `/merchant/onboarding` - the approval email's "Create your first event" link lands here, and without the gate it skipped the walkthrough entirely) |
| `/merchant/events/create/basics` | `src/app/merchant/events/create/basics/page.tsx` (wizard step 1/5) |
| `/merchant/events/create/schedule` | `src/app/merchant/events/create/schedule/page.tsx` (wizard step 2/5) |
| `/merchant/events/create/location` | `src/app/merchant/events/create/location/page.tsx` (wizard step 3/5) |
| `/merchant/events/create/media` | `src/app/merchant/events/create/media/page.tsx` (wizard step 4/5) |
| `/merchant/events/create/review` | `src/app/merchant/events/create/review/page.tsx` (wizard step 5/5 → Submit) |
| `/merchant/events/[eventId]` | `src/app/merchant/events/[eventId]/page.tsx` |

The signup wizard's shared chrome + form-state provider live in `src/app/merchant/signup/layout.tsx`, so React state persists across client-side navigation between the three step pages. The create-event wizard mirrors this: `src/app/merchant/events/create/layout.tsx` mounts the `EventCreateProvider` (and runs auth + merchant-approval gating) so form state survives navigation across the five step pages.

The post-approval onboarding (`/merchant/onboarding/*`) is a one-time walkthrough shown after an admin approves a merchant (the approval notification + email deep-link here). It teaches event creation and runs Stripe **Connect** payout onboarding (Accounts v2, hosted KYC/bank collection via `src/lib/stripe-connect.ts`). It's skippable; `/merchant` redirects approved merchants here once until `merchant_profiles.onboarding_completed_at` is set, and shows a "finish payout setup" banner while `payouts_enabled` is false.

### Admin

| URI | File | Page title |
| --- | --- | --- |
| `/admin` | `src/app/admin/page.tsx` | Dashboard |
| `/admin/events` | `src/app/admin/events/page.tsx` | Events Management |
| `/admin/merchants` | `src/app/admin/merchants/page.tsx` | Merchants Management |
| `/admin/location-waitlist` | `src/app/admin/location-waitlist/page.tsx` | Location Waitlist (non-Sydney merchant demand captured by the event-create pilot gate; `getAdminLocationWaitlist`) |
| `/admin/members` | `src/app/admin/members/page.tsx` | Attendees Management |
| `/admin/transactions` | `src/app/admin/transactions/page.tsx` | Transactions Management |
| `/admin/reports` | `src/app/admin/reports/page.tsx` | Safety Reports |
| `/admin/tags` | `src/app/admin/tags/page.tsx` | Tags & Categories |
| `/admin/matching` | `src/app/admin/matching/page.tsx` | Matching Formula |
| `/admin/matching-lab` | `src/app/admin/matching-lab/page.tsx` | Matching Lab (v2 Stage 6 — eval snapshot, per-cohort training readiness, and the curated-pair labeling tool → `curated_match_labels`; backed by `getCuratedPairToLabel`/`saveCuratedMatchLabel`/`getMatchingLabStats`. The ML fitting job itself is an external worker, not built) |
| `/admin/audit` | `src/app/admin/audit/page.tsx` | Audit Log |
| `/admin/system` | `src/app/admin/system/page.tsx` | System |

Admin layout: `src/app/admin/layout.tsx`. Sidebar nav: `src/components/admin-sidebar.tsx`.

### Dev / internal

| URI | File |
| --- | --- |
| `/tables` | `src/app/tables/page.tsx` |
| `/test` | `src/app/test/page.tsx` |
| `/test-click` | `src/app/test-click/page.tsx` — TWO things on one route, in this order. **(1) The two-person click driver** (`harness-board.tsx` + `actions.ts` + `harness-button.tsx`, backed by `src/lib/click-test-harness.ts` and `src/lib/click-test-fixtures.ts`). It mints a SYNTHETIC session per side (`harnessSession`) and drives the real repository functions as each person, so both halves of a click are visible at the same instant — the only way the "they are never told" invariant is observable at all. Gated three ways, all fail-closed: `isProductionDeployment()`, `isTestSwitcherUnlocked()` (same unlock as the QA persona switcher), and `@click.local` addresses ONLY, checked at the mint so no caller can route round it. `harnessAction` runs the gate once before its switch, because `run_sweep` calls the lifecycle cron body with no session of its own. Owns the `qa-click-*` fixture events, all built from `now()` — rebuild them from the Fixtures panel whenever the click surfaces look dead, because fixed-date fixtures age out of every window the mechanic reads. Destructive controls (reset pair, wind clock, fill event) resolve both ids from the QA roster first and refuse anything else. **(2) The static explainer** below it: hero + `ClickWalkthrough` island (5-step stepper cloning the real surfaces) + `ClickAuditReport` + TL;DR band, demo data only. Sibling to the public `/how-it-works`. 404s in production via `isInternalRoute` in `src/lib/runtime-mode.ts`. Keep all claims diffed against the real mechanic in `event-repository.ts` |
| `/test-stage` | `src/app/test-stage/page.tsx` (internal atmospheric email-image studio. `studio.tsx` builds a campaign world from concept, art-direction, glassware/product presence, composition, copy-zone, energy and palette controls. Hero-only and bottom-only modes make one image; paired mode generates the 4:5 hero first, then supplies it as the visual reference for a related 3:2 bottom image. Optional real product references are passed only to the protected server route. No images are persisted.) |
| `/algo` | `src/app/algo/page.tsx` (Matching v2 inspector — server-rendered; pick a member → cohort, feature vector, active per-cohort weights, and live people/event candidates with per-feature score breakdowns. Runs the real `src/lib/matching/` engine on the `user_features` store. Also hosts the admin **v2 kill-switch** (`system_settings.matching_v2_enabled`, **default ON** — v2 is the live engine; only an explicit `false` row reverts to v1): when on, `getSuggestedPeople` + `getPersonalizedDiscovery` re-rank their existing candidate pools with v2 (`scorePair` / `scoreUserEvent`), falling back to v1 per-member when the feature store has no row. Toggle action in `src/app/algo/actions.ts`. See `context/04_MATCHING_ALGORITHM_V2.md`) |
| `/business` | `src/app/business/page.tsx` (founder forecasting + VC reality-check dashboard; modelled off `context/BUSINESS_CASE.md`, not in public nav)
| `/images` | `src/app/images/page.tsx` (candid event-image studio for marketing/front-page assets - Gemini "nanobanana" generation with the anti-AI-slop prompt system in `src/lib/image-gen.ts` (verbatim port of the wizelfront spec: Sydney place block, alcohol-aware mess block, random moment pool, film grade, camera-style + UGC + partial-body directives). Server shell + `studio.tsx` client island firing 1-4 concurrent `POST /api/generate` calls; images return as data URLs with per-image download. Needs `GOOGLE_AI_API_KEY`) | |

## API routes

Mounted under `src/app/api/**`. Notable groups:

- `api/auth/[...nextauth]` — NextAuth handler
- `api/admin/events`, `api/admin/events/[eventId]/approve` (approving also flips the owning merchant's `auto_approve_events` flag on — their future events then publish straight to `live`, skipping the pending queue; see below), `api/admin/events/[eventId]/reject` (declines a pending event → `rejected`; optional `{ reason }` body rides through to the merchant email + audit log), `api/admin/merchants/[merchantId]/verification`, `api/admin/merchants/[merchantId]/auto-approve` (`{ autoApprove: boolean }` — admins grant/revoke a merchant's trusted status), `api/admin/tags` (POST upsert, PATCH edit by `{ id }` keeping the slug stable, DELETE `?id=` removes the tag + its `event_tags`/`user_tags` links)

- `api/admin/transactions/[id]/refund` (POST `{ amountCents?, reason? }` — manual Stripe refund; passes `settleBooking: true` because nothing else has released the seat or emailed the buyer), `api/admin/transactions/sync` (pulls recent charges/payouts back from Stripe), `api/admin/refund-failures/[id]` (POST `{ action: "retry" | "dismiss", note? }` — works one entry off the `refund_failures` queue; `retry` re-asks Stripe and does NOT pass `settleBooking`, because every writer of a failure row had already cancelled the seat, `dismiss` requires a note and sets `resolution = 'dismissed'`). All three guard with `isAdminEmail` directly, on top of `requireAdminProfile` inside the repository call.

  **Money queues:** `/admin/transactions` opens on a **Needs attention** tab whenever `refund_failures` has a pending row or `payment_disputes` has an open one, and the sidebar's Transactions badge counts the two together. Disputes are mirrored from `charge.dispute.*` webhooks into `payment_disputes` by `recordDisputeAudit` (`src/lib/stripe-sync.ts`), which still writes its audit_logs row - the table is current state, the log is history. Evidence is submitted in the Stripe Dashboard; the console only surfaces the deadline and deep-links out.

  **Trusted-merchant auto-approval:** `merchant_profiles.auto_approve_events` (migration `database/031_merchant_auto_approve_events.sql`) gates whether `createEventForMerchant` inserts an event as `pending` (untrusted → admin reviews, all admins get a "Event awaiting review" notification) or `live` (trusted → no review). The first time an admin approves any one of a merchant's events, the flag turns on automatically; admins can revoke it from the merchant detail page.
- `api/events`, `api/events/[eventId]`, `api/events/[eventId]/{bookmark,checkout,register}`, `api/events/[eventId]/waitlist/accept` (POST — a waitlisted attendee claims a promotion offer created by `cancelRegistration`; free events confirm in place + stamp `event_waitlists.accepted_at`, paid events return 402 → Stripe checkout)
- `api/events/suggestions` (GET `?q=` — the typeahead behind the coordination drawer's "suggest something else" picker (runbook B1 `GET /events/suggestions?q=`). Signed-in only: `getProposalCatalogue` reads the caller's own bookings and bookmarks. **Search arm only** — an empty `q` answers `{ events: [] }` rather than the whole catalogue, because the three curated sections ("Events you're going to" / "Saved" / "You'd both like") are server-rendered with `/proposals` and the empty-query case must make no request at all. ≤20 rows, each fitting the PAIR (`cap.available >= 2`); the payload carries slug/title/suburb/start and no score, rank or section)
- `api/merchant/events`, `api/merchant/events/[eventId]/cancel`
- `api/merchant/events/[eventId]/details` (PUT — the merchant event editor. Always accepts title / description / relationshipGoal / tagSlugs / address / images; ALSO accepts the event TERMS — `category`, `startsAt`, `durationMinutes`, `capacity`, `priceCents` — which `updateMerchantEventDetails` applies only while the event is neither publicly listed nor holding a seat, i.e. the rejected/pending/draft case the resubmit loop needs. A published or booked event silently keeps its terms, so a hand-rolled request cannot reprice or move an event someone booked)
- `api/merchant/profile` (PUT `{ contactEmail?, phone?, websiteUrl?, addressStreet?, socials? }` → merchant self-service for the CONTACTABLE half of a business profile, via `updateMerchantContactDetails`; backs the Settings tab's "Contact + venue" editor. Deliberately does NOT accept business_name / trading_name / abn / acn / address state+postcode — those are what an admin verified at approval and what decides the launch-pilot region, so they stay with support. Phone and website reuse the signup wizard's own validators)
- `api/merchant/finances/export` (GET `?year=&month=` → streams a `text/csv` attachment of the merchant's full transaction set, optionally scoped to a calendar year or month in Australia/Sydney; backs the Finances-tab "Export CSV" period picker via `getMerchantTransactionsForExport`)
- `api/merchant/location-waitlist` (POST `{ address?, suburb?, latitude?, longitude?, note? }` → records a merchant's interest in a non-Sydney location via `addMerchantLocationWaitlist`; powers the Sydney-only pilot gate on the event-create location step, surfaced in `/admin/location-waitlist`)
- `api/merchant/stripe/connect` (POST `{ returnTo? }` — creates the Connect account + returns a hosted-onboarding URL; approved merchants only. `returnTo` is validated to a single-slash-rooted `/merchant` path by `safeMerchantReturnTo` and becomes Stripe's return/refresh URL, so a host connecting from Finances, Settings, the dashboard setup bar or the create wizard's Schedule step is handed back THERE rather than into the first-run onboarding walkthrough. Entry points pass it as `?returnTo=` on the `/merchant/onboarding/payouts` link, which forwards it to `<ConnectPayoutsButton returnTo>`), `api/merchant/onboarding/complete` (marks the walkthrough done)
- `api/tables`, `api/tables/[table]/rows` — generic admin table CRUD
- `api/test/cases`, `api/test/cases/[id]/comments`, `api/test/comments/[id]`
- `api/clicks`, `api/onboarding`, `api/webhooks/stripe`
- `api/cron/waitlist-expiry` (GET/POST — sweeps lapsed 30-min waitlist offers via `expireWaitlistOffers()`, re-offers each freed seat to the next person; guarded by `Authorization: Bearer ${CRON_SECRET}`, returns 503 until that env var is set. Wire to a scheduler, e.g. a Vercel cron every ~5 min)
- `api/cron/reconcile-payments` (GET/POST — Stripe webhook safety net: walks recent Checkout Sessions Stripe reports paid via `reconcilePendingPayments()` and promotes any booking stuck on `pending`; idempotent, same `CRON_SECRET` bearer guard, wired in `vercel.json` every 15 min. The primary path is the snapshot webhook endpoint `we_1ThNdkJXwQuYjRDjUccyHFv4` → `https://www.letsclick.app/api/webhooks/stripe` — always the **www** host, the apex 307-redirects and Stripe won't follow it)
- `api/cron/merchant-monthly-reports` (GET/POST — monthly merchant recap email: logs a `merchant-monthly-report` `email_events` row for every approved merchant who hosted ≥1 event in the target month, with events/attendees/paid-revenue/top-event via `sendMerchantMonthlyReports()`; defaults to the previous calendar month, override with `?year=&month=`; same `CRON_SECRET` bearer guard, wired in `vercel.json` at `0 8 1 * *`)
- `api/cron/refresh-matching-features` (GET/POST — Matching v2 feature-population batch: rebuilds `events.sub_tags` + the `user_features` store (declared + behavioural features + cohort assignment) for every profile via `src/lib/matching/feature-store.ts`; same `CRON_SECRET` bearer guard. Intended nightly. See `context/04_MATCHING_ALGORITHM_V2.md`)
- `api/geo/postcode?code=NNNN` — resolves a 4-digit AU postcode → `{ state, suburbs[] }` from the bundled `src/lib/postcode.ts` table (server-only `au-postcodes.json`; powers the `/profile/edit` postcode→suburb picker)
- `api/upload/avatar` — multipart avatar upload, normalises via `sharp`, writes to the public Supabase `avatars` bucket and persists `profiles.photo_url`
- `api/upload/gallery` (POST multipart `file` → appends a 4:5-cropped photo to `profiles.gallery_photos`, max 5, stored in the `avatars` bucket under `gallery/<profileId>/` via `src/lib/gallery-storage.ts`; DELETE `{ url }` → removes it). Powers the "More photos" grid on `/profile/edit`. Profile **prompts** (Hinge-style, max 3, catalogue in `src/lib/profile-prompts.ts`) save through the normal profile-edit action into `profiles.prompts` jsonb. Both columns: migration `database/042_profile_gallery_prompts.sql`. The **verified tick** (`<VerifiedTick />`, shown next to names on profile pages) reads the pre-existing `profiles.photo_verified_at`, which admins stamp from the `/admin/members` row menu ("Mark verified ✓")
- `api/support/ticket` (POST multipart → file a bug; GET `?url=<pathname>` → open bugs for that page) + `api/support/ticket/[ticketRef]` (PATCH `{ status: "fixed" }` → user-confirm fixed) + `api/support/ticket/[ticketRef]/screenshot` (public 302 → the stored screenshot, so the Sheet links resolve from letsclick.app). Powers the in-app **Report-a-Bug** widget (`src/components/support/support-widget.tsx`, mounted in the root layout for logged-in users). The widget auto-captures a viewport screenshot (`src/lib/support-screenshot.ts`, uses **html2canvas-pro** because Tailwind 4's `oklch()` palette breaks classic html2canvas) plus the console logs + failed network requests buffered by the always-on `src/lib/support-capture.ts` (secrets redacted client-side), lets the reporter annotate the screenshot and describe it as **what is wrong** + **what it should be**, and saves to the `support_tickets` table (migrations `037`/`038`, source of truth) via `src/lib/support-repository.ts`. Screenshots → public `avatars` bucket under a `support/` prefix (`src/lib/support-storage.ts`).

  **Google Sheets triage board** (`src/lib/support-sheets.ts`, service-account auth via `useJWTAccessWithScope=false` — Sheets rejects self-signed JWTs; no-ops until the `GOOGLE_*` env vars in `.env.example` are set): each new bug appends a row `URL (clickable HYPERLINK to the full origin) · Logged in as (reporter role) · What is wrong · What it should be · Is issue · AI fixed · Status · Screenshot · Date added · Ticket`. Rows are written by explicit next-empty-row update (not `append`, whose table-detection mis-fires on the checkbox columns), with grid auto-grow. Row colour is driven by **conditional formatting set up once on the sheet** (not imperative recolouring), so colours stay correct no matter who edits: Status `fixed` → 🟢 green, AI fixed ✓ → 🟠 amber, Is issue ✗ → ⚪ gray, else → 🔴 red. (`scripts/test-sheets.mjs` appends three demo rows to verify the connection.) Intended workflow: a Claude Code "AI fixer" pass reads open rows, fixes each, ticks **AI fixed** (amber); a human confirms by setting **Status = fixed** (green) or sends it back by un-ticking AI fixed (→ red). The widget's second tab is a per-page checklist of open bugs you tick off (PATCH → Status fixed → green).

  **AI-fixer pass — how to fix a bug from the [triage board](https://docs.google.com/spreadsheets/d/1q7nqA1Ngsf53zfX3_ReSjV18nFyIW8cN07M9c37W2W4/edit?gid=0#gid=0).** When asked to work the bug board, do this loop:

  1. **Read the open rows.** Run `node scripts/read-bugs.mjs` — it prints every row as JSON (`rowNum` + `cells`, including the HYPERLINK URLs for the page link and screenshot). The board columns are: `A` URL · `B` Logged in as · `C` What is wrong · `D` What it should be · `E` Is issue · `F` AI fixed · `G` Status · `H` Screenshot · `I` Date added · `J` Ticket (the `ticket_ref`) · `K` AI Comment. Work the 🔴 red rows — `Status` = `open` **and** `AI fixed` = FALSE. Skip rows already amber (`AI fixed` ✓), green (`Status` = `fixed`), or gray (`Is issue` ✗ — reporter/triager marked it not-a-bug).
  2. **Fix the code.** Use column `A` (the page URL → map to a file via the Page URI map above) plus `C`/`D` (what is wrong / what it should be) and the screenshot link to locate and fix the actual bug. Make a real change — don't tick the box without an edit.
  3. **Record the fix — sheet + Supabase in one step.** Run `node scripts/mark-ai-fixed.mjs <row> "Fixed X by doing Y"`. This ticks `AI fixed` (col `F` → 🟠 amber) and writes your change summary to `AI Comment` (col `K`) on the sheet, **and** sets `support_tickets.ai_fixed = true` + `ai_comment = '…'` in Postgres (matched by `ticket_ref`). Pass several bare row numbers (`node scripts/mark-ai-fixed.mjs 21 22 23`) to tick multiple rows at once with no comment. Always include a comment for a real fix so the human tester can read what changed in the Supabase Studio row drawer before confirming.
  4. **Do not set `Status` = `fixed` yourself.** That green flag is the human tester's confirmation. If they un-tick `AI fixed`, the row goes red again and you pick it up on the next pass.

  Both scripts auto-load `.env.local` and need `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID` (+ optional `GOOGLE_SHEETS_TAB`, default `Bugs`) for the sheet, and `DATABASE_URL` for the Supabase write. The `ai_comment` column comes from migration `database/039_support_ticket_ai_comment.sql`.
- `api/merchant/documents` — multipart KYC doc upload (private Supabase Storage bucket `merchant-documents`)
- `api/generate` (POST, signed-in only - one candid event image per request via the Gemini image API; body = the `/images` studio controls (shot/event/customEvent/light/group/camera/vibe/extra/aspect/count is client-side/model), prompt assembled by `buildPrompt()` in `src/lib/image-gen.ts`, 120s timeout + 1 retry on 503/429, returns `{ image: dataUrl, prompt }`. 503 until `GOOGLE_AI_API_KEY` is set. The directive texts are verbatim from the ported spec - never reword them)
- `api/generate-stage` (POST, signed-in and non-production only - one atmospheric campaign image per request via Gemini. The prompt is assembled server-side by `src/lib/stage-image-gen.ts`; accepts optional product and paired-world data-URL references, each validated as JPG/PNG/WebP under 8 MB. Hero output is 4:5, closing output is 3:2. The prompt and API key stay server-side; returns `{ image: dataUrl }`.)
