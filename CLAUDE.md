# CLAUDE.md

Project guide for Claude Code working in this repo.

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
| `/admin/members` | `src/app/admin/members/page.tsx` | Attendees Management |
| `/admin/transactions` | `src/app/admin/transactions/page.tsx` | Transactions Management |
| `/admin/reports` | `src/app/admin/reports/page.tsx` | Safety Reports |
| `/admin/tags` | `src/app/admin/tags/page.tsx` | Tags & Categories |
| `/admin/matching` | `src/app/admin/matching/page.tsx` | Matching Formula |
| `/admin/audit` | `src/app/admin/audit/page.tsx` | Audit Log |
| `/admin/system` | `src/app/admin/system/page.tsx` | System |

Admin layout: `src/app/admin/layout.tsx`. Sidebar nav: `src/components/admin-sidebar.tsx`.

### Dev / internal

| URI | File |
| --- | --- |
| `/tables` | `src/app/tables/page.tsx` |
| `/test` | `src/app/test/page.tsx` |
| `/business` | `src/app/business/page.tsx` (founder forecasting + VC reality-check dashboard; modelled off `context/BUSINESS_CASE.md`, not in public nav) |

## API routes

Mounted under `src/app/api/**`. Notable groups:

- `api/auth/[...nextauth]` — NextAuth handler
- `api/admin/events`, `api/admin/events/[eventId]/approve`, `api/admin/events/[eventId]/reject` (declines a pending event → `rejected`; optional `{ reason }` body rides through to the merchant email + audit log), `api/admin/merchants/[merchantId]/verification`, `api/admin/tags`
- `api/events`, `api/events/[eventId]`, `api/events/[eventId]/{bookmark,checkout,register}`
- `api/merchant/events`, `api/merchant/events/[eventId]/cancel`
- `api/merchant/stripe/connect` (creates the Connect account + returns a hosted-onboarding URL; approved merchants only), `api/merchant/onboarding/complete` (marks the walkthrough done)
- `api/tables`, `api/tables/[table]/rows` — generic admin table CRUD
- `api/test/cases`, `api/test/cases/[id]/comments`, `api/test/comments/[id]`
- `api/clicks`, `api/onboarding`, `api/webhooks/stripe`
- `api/upload/avatar` — multipart avatar upload, normalises via `sharp`, writes to the public Supabase `avatars` bucket and persists `profiles.photo_url`
- `api/merchant/documents` — multipart KYC doc upload (private Supabase Storage bucket `merchant-documents`)

## Conventions

- Whenever you add a new page under `src/app/**/page.tsx`, append it to the URI map above.
- Server queries go through `src/lib/postgres.ts` / `src/lib/event-repository.ts` — use the pool, never spawn a new `pg.Client`.
- Auth helpers in `src/lib/last-login.ts` and the NextAuth config; use server-side session for protected pages.
