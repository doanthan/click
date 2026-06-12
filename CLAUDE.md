# CLAUDE.md

Project guide for Claude Code working in this repo.

## Project status — PRE-PRODUCTION

This app has **not launched**. There are no real users, merchants, bookings, or payments — everything in the database is seed/demo/test data.

- It is safe to truncate, reseed, or delete rows for testing. Do not stop to ask before clearing demo data.
- **Stripe is test mode only** — no real charges exist. Never assume a payment row is real money.
- Destructive migrations, `TRUNCATE`, and re-running seed scripts are all fine.
- One caution: `profiles` may be tied to the developer's real Google/Facebook OAuth logins, and `email_events` is the audit/dev-inbox trail — prefer reseeding these over blind-wiping, but they're still not production data.
- **Remove this section at launch.** Once it's gone, treat all data as production and ask before any destructive operation.

## Stack

- Next.js 16 (App Router) + React 19
- NextAuth v5 (beta) for auth
- Postgres via `pg` (no ORM). Hosted on Supabase — **use the pooler host**; direct `db.*.supabase.co` is IPv6-only and won't resolve.
- Tailwind 4
- Stripe for checkout
- Mapbox + Google Maps for geo
- Supabase Storage for user-uploaded media. See **File storage** below.

## File storage

All uploads go to **Supabase Storage**, split by privacy into two buckets — pick by privacy, not convenience.

Both buckets are written via the service-role admin client in `src/utils/supabase/admin.ts` (`getSupabaseAdmin()`). The service-role key bypasses RLS, so no per-bucket policies are required for our server-side writes; reads are governed by whether the bucket is public.

### Public bucket — `avatars`

- Helper: `src/lib/avatar-storage.ts`.
- Bucket: `avatars`, **public** (Supabase dashboard → Storage → New bucket → Public bucket = ON). Public URL format: `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/<key>`.
- Object key: `<profileId>.jpg`, always 512×512 JPG via `sharp`, cache-busted by an appended `?v=<timestamp>` query string so replacements show immediately even though the key is stable.
- Two write paths:
  - `uploadAvatarFromUrl(profileId, sourceUrl)` — best-effort rehost of an OAuth provider photo (called from `ensureProfileForSession` after Google/Facebook signup). Returns `null` on failure; never throws into the auth path.
  - `uploadAvatarFromBuffer(profileId, buf)` — used by `POST /api/upload/avatar` for user-initiated uploads. Throws on failure.
- Env: needs `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. Missing either → `isAvatarStorageConfigured()` returns false and the upload route returns 503.
- When adding new **public**-media features (event images, gallery uploads, shoppable assets), reuse this bucket with a key prefix (`events/<id>.jpg`, `gallery/<id>.jpg`, …) and add a sibling helper next to `avatar-storage.ts` — not a new bucket.

### Private bucket — `merchant-documents`

- Helper: `src/utils/supabase/admin.ts` (the same service-role client).
- Bucket: `merchant-documents`, **private**. Access requires a signed URL.
- Upload route: `POST /api/merchant/documents` (Step 3 of `/merchant/signup`). Key scheme `<profileId>/<documentType>/<uuid>.<ext>`; metadata persisted via `recordMerchantDocument()`.
- There is currently **no admin read path** — when adding one, use `createSignedUrl()` with a short TTL; never expose object paths to the browser directly.

### Why two buckets

Public bucket = anyone with the URL can read (avatars rendered on event cards, hero images). Private bucket = the object endpoint refuses anonymous reads, so KYC docs / liquor licences need signed URLs. **Never put private docs in the `avatars` bucket** — it's world-readable.

## Email events

**Every server action that "sends" or should send an email also logs a row to `email_events`.** No exceptions — if a flow conceptually triggers a notification, the handler MUST call `logEmailEvent(...)` even when we haven't wired the SMTP provider for it yet. The row IS the audit trail and the dev/staging inbox.

- Helper: `src/lib/email.ts` — `logEmailEvent({ template, toEmail, toProfileId?, vars })` and `renderTemplate(template, vars)`. Fire-and-forget; warn-logs on failure, never throws into the calling request. Call it AFTER the txn commits so a render/insert hiccup can't roll back the booking, merchant signup, etc.
- Templates: `/emails/<template>.html` — single source of truth for both the dev log and the (future) real provider. See `/emails/README.md` for the variable contract per template.
- Template names are typed by the `EmailTemplate` union in `src/lib/email.ts`. **When adding a new transactional email, add the variant to that union, drop the `<name>.html` in `/emails`, register a subject line in the `SUBJECTS` map, then call `logEmailEvent` from the trigger site.** The union keeps trigger sites typecheck-tight.
- Table: `email_events` (migration `database/012_email_events.sql`). Columns: `template`, `to_email`, `to_profile_id` (nullable FK), `subject`, `html`, `vars` (jsonb), `created_at`. View in Supabase Studio → Table Editor → `email_events` → click a row → side drawer renders the full `html` + `vars`.

### Wired triggers (do not duplicate)

| Template | Trigger site |
| --- | --- |
| `account-welcome` | `ensureProfileForSession` in `src/lib/event-repository.ts`, on fresh insert only (detected via `xmax = 0`) |
| `rsvp-attendee` + `rsvp-merchant` | `registerForEvent` in `src/lib/event-repository.ts`, after commit on the confirmed-RSVP branch (waitlisted still uses legacy `sendWorkflowEmail`) |
| `event-created-merchant` | `createEventForMerchant` in `src/lib/event-repository.ts`, after the events insert + tag upsert |
| `merchant-verified-merchant` + `merchant-rejected-merchant` | `updateMerchantVerificationForAdmin` in `src/lib/event-repository.ts`, branched on approved/rejected |
| `merchant-application-received` | `registerMerchantWizardSubmit` in `src/lib/event-repository.ts`, after commit, first submission only (`xmax = 0`) |
| `event-approved-merchant` | `approveEventForAdmin` in `src/lib/event-repository.ts`, via `logEventApprovedEmail` helper (looks up the owning merchant; skipped for platform-owned events) |
| `event-rejected-merchant` | `rejectEventForAdmin` in `src/lib/event-repository.ts`, via `logEventRejectedEmail` helper (carries the admin's free-text reason; skipped for platform-owned events) |
| `rsvp-cancelled-attendee` + `rsvp-cancelled-merchant` | `cancelRegistration` in `src/lib/event-repository.ts`, after commit, via `logRsvpCancelledEmails` helper |
| `event-cancelled-attendee` | `cancelMerchantEvent` in `src/lib/event-repository.ts`, fan-out to every affected attendee after commit |
| `payment-receipt-attendee` | `markPaymentSucceeded` in `src/lib/event-repository.ts`, via `logPaymentReceiptEmail` helper (GST receipt, tax = total / 11) |
| `password-reset` | `requestPasswordReset` in `src/app/forgot-password/actions.ts`, alongside the legacy `sendTransactionalEmail` magic-link send |

Still unwired: `event-reminder-attendee` (needs a ~24h-out cron, not a request handler). When you add that trigger site, call `logEmailEvent` — same shape as the wired ones above.

### Existing `sendTransactionalEmail` (Resend)

`src/lib/email.ts` also still exports `sendTransactionalEmail`, used by `forgot-password/actions.ts` and the waitlist branch of `registerForEvent`. Treat it as a separate, legacy path — when wiring a new template, prefer `logEmailEvent` and let the real-provider migration happen once for everything. **Don't add new callers of `sendTransactionalEmail`.**

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
| `/refund-policy` | `src/app/refund-policy/page.tsx` |
| `/safety` | `src/app/safety/page.tsx` |

### Auth & onboarding

| URI | File |
| --- | --- |
| `/login` | `src/app/login/page.tsx` |
| `/signup` | `src/app/signup/page.tsx` |
| `/register` | `src/app/register/page.tsx` |
| `/auth` | `src/app/auth/page.tsx` |
| `/forgot-password` | `src/app/forgot-password/page.tsx` |
| `/post-login` | `src/app/post-login/page.tsx` |
| `/onboarding` | `src/app/onboarding/page.tsx` |
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
| `/merchant/onboarding/welcome` | `src/app/merchant/onboarding/welcome/page.tsx` (walkthrough step 1/4) |
| `/merchant/onboarding/create-events` | `src/app/merchant/onboarding/create-events/page.tsx` (walkthrough step 2/4) |
| `/merchant/onboarding/payouts` | `src/app/merchant/onboarding/payouts/page.tsx` (walkthrough step 3/4 — Stripe Connect, skippable) |
| `/merchant/onboarding/done` | `src/app/merchant/onboarding/done/page.tsx` (walkthrough step 4/4 → stamps `onboarding_completed_at`) |
| `/merchant/events/create` | `src/app/merchant/events/create/page.tsx` (redirects → `/merchant/events/create/basics`) |
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
| `/algo` | `src/app/algo/page.tsx` (Matching v2 inspector — server-rendered; pick a member → cohort, feature vector, active per-cohort weights, and live people/event candidates with per-feature score breakdowns. Runs the real `src/lib/matching/` engine on the `user_features` store. Also hosts the admin **v2 kill-switch** (`system_settings.matching_v2_enabled`, **default ON** — v2 is the live engine; only an explicit `false` row reverts to v1): when on, `getSuggestedPeople` + `getPersonalizedDiscovery` re-rank their existing candidate pools with v2 (`scorePair` / `scoreUserEvent`), falling back to v1 per-member when the feature store has no row. Toggle action in `src/app/algo/actions.ts`. See `context/04_MATCHING_ALGORITHM_V2.md`) |
| `/business` | `src/app/business/page.tsx` (founder forecasting + VC reality-check dashboard; modelled off `context/BUSINESS_CASE.md`, not in public nav) |

## API routes

Mounted under `src/app/api/**`. Notable groups:

- `api/auth/[...nextauth]` — NextAuth handler
- `api/admin/events`, `api/admin/events/[eventId]/approve` (approving also flips the owning merchant's `auto_approve_events` flag on — their future events then publish straight to `live`, skipping the pending queue; see below), `api/admin/events/[eventId]/reject` (declines a pending event → `rejected`; optional `{ reason }` body rides through to the merchant email + audit log), `api/admin/merchants/[merchantId]/verification`, `api/admin/merchants/[merchantId]/auto-approve` (`{ autoApprove: boolean }` — admins grant/revoke a merchant's trusted status), `api/admin/tags` (POST upsert, PATCH edit by `{ id }` keeping the slug stable, DELETE `?id=` removes the tag + its `event_tags`/`user_tags` links)

  **Trusted-merchant auto-approval:** `merchant_profiles.auto_approve_events` (migration `database/031_merchant_auto_approve_events.sql`) gates whether `createEventForMerchant` inserts an event as `pending` (untrusted → admin reviews, all admins get a "Event awaiting review" notification) or `live` (trusted → no review). The first time an admin approves any one of a merchant's events, the flag turns on automatically; admins can revoke it from the merchant detail page.
- `api/events`, `api/events/[eventId]`, `api/events/[eventId]/{bookmark,checkout,register}`, `api/events/[eventId]/waitlist/accept` (POST — a waitlisted attendee claims a promotion offer created by `cancelRegistration`; free events confirm in place + stamp `event_waitlists.accepted_at`, paid events return 402 → Stripe checkout)
- `api/merchant/events`, `api/merchant/events/[eventId]/cancel`
- `api/merchant/finances/export` (GET `?year=&month=` → streams a `text/csv` attachment of the merchant's full transaction set, optionally scoped to a calendar year or month in Australia/Sydney; backs the Finances-tab "Export CSV" period picker via `getMerchantTransactionsForExport`)
- `api/merchant/location-waitlist` (POST `{ address?, suburb?, latitude?, longitude?, note? }` → records a merchant's interest in a non-Sydney location via `addMerchantLocationWaitlist`; powers the Sydney-only pilot gate on the event-create location step, surfaced in `/admin/location-waitlist`)
- `api/merchant/stripe/connect` (creates the Connect account + returns a hosted-onboarding URL; approved merchants only), `api/merchant/onboarding/complete` (marks the walkthrough done)
- `api/tables`, `api/tables/[table]/rows` — generic admin table CRUD
- `api/test/cases`, `api/test/cases/[id]/comments`, `api/test/comments/[id]`
- `api/clicks`, `api/onboarding`, `api/webhooks/stripe`
- `api/cron/waitlist-expiry` (GET/POST — sweeps lapsed 30-min waitlist offers via `expireWaitlistOffers()`, re-offers each freed seat to the next person; guarded by `Authorization: Bearer ${CRON_SECRET}`, returns 503 until that env var is set. Wire to a scheduler, e.g. a Vercel cron every ~5 min)
- `api/cron/reconcile-payments` (GET/POST — Stripe webhook safety net: walks recent Checkout Sessions Stripe reports paid via `reconcilePendingPayments()` and promotes any booking stuck on `pending`; idempotent, same `CRON_SECRET` bearer guard, wired in `vercel.json` every 15 min. The primary path is the snapshot webhook endpoint `we_1ThNNbJXwQuYjRDjMTjoD0Er` → `https://www.letsclick.app/api/webhooks/stripe` — always the **www** host, the apex 307-redirects and Stripe won't follow it)
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

## Conventions

- Whenever you add a new page under `src/app/**/page.tsx`, append it to the URI map above.
- Server queries go through `src/lib/postgres.ts` / `src/lib/event-repository.ts` — use the pool, never spawn a new `pg.Client`.
- Auth helpers in `src/lib/last-login.ts` and the NextAuth config; use server-side session for protected pages.
