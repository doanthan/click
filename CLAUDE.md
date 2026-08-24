# CLAUDE.md

Project guide for Claude Code working in this repo.

## Project status — LIVE INFRASTRUCTURE, NO TRAFFIC YET

The app has no public users yet, but **the production stack is armed**. Treat production data as real and **ask before any destructive operation**.

- **Stripe is LIVE mode.** `STRIPE_SECRET_KEY` is `sk_live_…` and the deployed bundle ships a `pk_live_…` publishable key. `scripts/release-check.mjs` *fails the release* on anything else, and `src/lib/stripe.ts` refuses to initialise a non-live key in production. A completed checkout moves real money — never assume a `payment_transactions` row is fake.
- **Do not `TRUNCATE`, wipe, or reseed production.** Query counts first; if a table looks like demo data, say so and ask. Destructive migrations need explicit sign-off.
- `profiles` is tied to real Google/Facebook OAuth logins and `email_events` is the audit/dev-inbox trail. Neither is disposable.
- **`.env.local` currently points at the production database** (same `aws-1-ap-southeast-1.pooler.supabase.com` host as `.env.production.local`) and has no `RESEND_API_KEY`. So `npm run dev` writes into production and logs mail as `delivery_status='skipped'` — every such row in production so far came from localhost, not the deployment. Point local dev at its own database before assuming otherwise.
- Local seeding against a **separate** database is fine and encouraged.

## Stack

Frameworks and deps are in `package.json`. The non-obvious bits:

- **No ORM** - Postgres via `pg` directly.
- Hosted on Supabase — **use the pooler host**; direct `db.*.supabase.co` is IPv6-only and won't resolve.
- Supabase Storage for user-uploaded media. See **File storage** below.

## Design system (binding)

The canonical design system is **`context/Click Design System/`** (a claude.ai/design export - re-exports replace the folder wholesale; never hand-edit it). `README.md` in that folder is the spec mirror; `context/DESIGN.MD` (CLICK_PALETTE) is the palette canon. Invoke the **`click-design` skill** before designing or restyling any UI. Per-screen build prompts live in the bundle's `docs/`, target renders in `screenshots/`.

Hard rules (fail on sight):

- **Deep Purple `#3B2F81` is the ONLY primary-action / selected colour** - flat, never a gradient or glow. Status colours (coral / amber / sage / teal) appear on **badges only**, never a CTA or hero accent. Destructive = `--danger` `#B5362F`, never coral.
- Cream `#F9F6F0` page ground (never stark white); white cards; Ink `#1C1830` text; Slate meta; Mist hairlines. Lavender `#C8B8F8` is an accent, **never a section-sized background** (big bands use `--lav-bg` `#F0ECF4`).
- **Poppins** (SemiBold) = display/headings/wordmark; **body = the system font stack**. Never paragraphs in Poppins, never Poppins-less headings.
- Buttons are **radius-12, never pills**; tags/avatars are the pills; badges ~8px rounded rects. Shadows soft, low, purple-tinted - never a glow.
- Tokens live in `src/app/globals.css` - **names stay stable, values track the DS** (the historic accent role `--rose` now resolves to Deep Purple; `--coral` is status-only). Use `var(--token)`, never hardcoded hex.
- **Language is binding:** it's a *mutual click*, never a "match"; always "click *with*", never "click on"; "click" is never a UI verb (use tap/select); no deficit or loss framing. Capital **Click** = platform, lowercase **click** = the feeling. **Hyphens ` - `, never em-dashes** - in copy, comments, docs, everywhere.

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
| `rsvp-attendee` + `rsvp-merchant` | `registerForEvent` in `src/lib/event-repository.ts`, after commit on the confirmed-RSVP branch (the waitlisted branch logs `waitlist-joined-attendee`) |
| `event-created-merchant` | `createEventForMerchant` in `src/lib/event-repository.ts`, after the events insert + tag upsert |
| `merchant-verified-merchant` + `merchant-rejected-merchant` | `updateMerchantVerificationForAdmin` in `src/lib/event-repository.ts`, branched on approved/rejected |
| `merchant-application-received` | `registerMerchantWizardSubmit` in `src/lib/event-repository.ts`, after commit, first submission only (`xmax = 0`) |
| `event-approved-merchant` | `approveEventForAdmin` in `src/lib/event-repository.ts`, via `logEventApprovedEmail` helper (looks up the owning merchant; skipped for platform-owned events) |
| `event-rejected-merchant` | `rejectEventForAdmin` in `src/lib/event-repository.ts`, via `logEventRejectedEmail` helper (carries the admin's free-text reason; skipped for platform-owned events) |
| `rsvp-cancelled-attendee` + `rsvp-cancelled-merchant` | `cancelRegistration` in `src/lib/event-repository.ts`, after commit, via `logRsvpCancelledEmails` helper |
| `event-cancelled-attendee` | `cancelMerchantEvent` in `src/lib/event-repository.ts`, fan-out to every affected attendee after commit |
| `payment-receipt-attendee` | `markPaymentSucceeded` in `src/lib/event-repository.ts`, via `logPaymentReceiptEmail` helper (GST receipt, tax = total / 11) |
| `password-reset` | **NOT WIRED - dead template.** Passwords are no longer stored; `requestPasswordReset` in `src/app/forgot-password/actions.ts` just delegates to `signInWithEmail`, so that page sends `signin-link` (or `signin-no-account`). Nothing calls `logEmailEvent({ template: "password-reset" })`. Delete the template + its union/`SUBJECTS` entries, or leave it parked - but do not trust this row's old claim that it fires. |
| `waitlist-joined-attendee` | `registerForEvent` in `src/lib/event-repository.ts`, after commit on the waitlisted branch, via `logWaitlistJoinedEmail` |
| `waitlist-promoted-attendee` | `logWaitlistPromotedEmail` in `src/lib/event-repository.ts`, called from all four promotion sites: `cancelRegistration`, `cancelGuestSeatForPurchaser`, `expireWaitlistOffers`, `expirePaymentHolds` |
| `merchant-suspended-merchant` | `updateMerchantVerificationForAdmin` in `src/lib/event-repository.ts`, on the `suspended` branch |
| `event-cancelled-merchant` | `cancelEvent` in `src/lib/event-repository.ts` (admin-initiated cancel), alongside the attendee fan-out |
| `merchant-waitlisted-merchant` | `registerMerchantWizardSubmit` in `src/lib/event-repository.ts`, when the venue falls outside the launch pilot |
| `mutual-click-attendee` | `sendClickInner` in `src/lib/event-repository.ts` - two sites, one per side of the mutual click |
| `guest-invite` + `guest-spot-existing-user` | `processGuestSpotsForSession` in `src/lib/event-repository.ts`, branched on whether the guest address already has a profile |
| `guest-spot-cancelled` | `cancelGuestSeatForPurchaser` in `src/lib/event-repository.ts` |
| `report-received-admin` | `reportUser` in `src/lib/event-repository.ts` |
| `booking-refunded-attendee` | `settleRefundedBooking` in `src/lib/event-repository.ts`, from two callers: `issueRefund` in `src/lib/stripe-sync.ts` when `settleBooking: true` and the refund is FULL (the admin console passes it; `cancelRegistration` and the bulk event-cancel path must not, they already cancel the seat and send their own copy), and `markPaymentSucceeded`'s settled-after-cancellation branch, which needed the email but not the seat release |
| `merchant-monthly-report` | `sendMerchantMonthlyReports` in `src/lib/event-repository.ts`, driven by the `api/cron/merchant-monthly-reports` cron — one row per approved merchant who hosted ≥1 event in the target month (events/attendees/paid-revenue/top event) |

`event-reminder-attendee` is wired too, via `sendEventReminders` in `src/lib/event-repository.ts` (cron route `api/cron/event-reminders`), which dedupes against existing `email_events` rows so a re-run can't double-send.

**The three deliberate exceptions**, all in `src/app/login/actions.ts` (`requestEmailSignIn`): `signin-link`, `signup-link` and `signin-no-account` render through `renderTemplate` but deliver through `sendTransactionalEmail`, NOT `logEmailEvent`. Two reasons, and both must still hold before you "fix" this — the delivery result gates a side effect (a failed send revokes the just-issued token, and `logEmailEvent` is `void` + fire-and-forget), and an `email_events` row would park a live one-time sign-in URL in a queryable table that `retryPendingEmailEvents` could re-deliver after the token was revoked.

`signin-no-account` also carries a **security invariant**: a sign-in attempt on an unknown address must still issue a token, so the browser response and the rate limiting stay identical to the known-address path. Returning early there is a user-enumeration oracle. `tests/release-config.test.mjs` fails if anyone reinstates the early return.

The one message still on plain text is the merchant status change to `pending` — rare, internal, no template.

### Existing `sendTransactionalEmail` (Resend)

`src/lib/email.ts` also still exports `sendTransactionalEmail`. Both callers this section used to name are gone: `forgot-password/actions.ts` now just delegates to `signInWithEmail`, and the waitlist branch of `registerForEvent` logs `waitlist-joined-attendee`. What remains is the magic-link trio in `login/actions.ts` (deliberate, see above) and the `pending` merchant-status notice. Treat it as a separate, legacy path — when wiring a new template, prefer `logEmailEvent` and let the real-provider migration happen once for everything. **Don't add new callers of `sendTransactionalEmail`.**

## Page URI map & API routes

The full route map - every page under `src/app`, every `api/**` group, with per-route gotchas (redirects, wizard steps, the matching-v2 kill-switch default-ON, trusted-merchant auto-approval, cron bearer guards) - lives in the **`repo-map` skill** (`.claude/skills/repo-map/SKILL.md`). Invoke it to locate a page or API route, or before wiring a new one.

## Conventions

- Whenever you add a new page under `src/app/**/page.tsx` or an `api/**` route, add it to the `repo-map` skill (`.claude/skills/repo-map/SKILL.md`).
- Server queries go through `src/lib/postgres.ts` / `src/lib/event-repository.ts` — use the pool, never spawn a new `pg.Client`.
- Auth helpers in `src/lib/last-login.ts` and the NextAuth config; use server-side session for protected pages.
