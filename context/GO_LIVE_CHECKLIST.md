# letsclick.app go-live checklist

Updated: 30 July 2026

## Current verdict

The application code is release-ready locally. The currently deployed site is
still the old build and is **not ready for public launch**: the live smoke test
still finds the internal tools exposed and the new security/SEO/health routes
missing. Complete the production configuration and deploy this changeset before
accepting real users or payments.

## Completed in this changeset

- [x] Replaced arbitrary-email sign-in with 15-minute, single-use magic links.
- [x] Kept seeded account impersonation strictly local and `@click.local` only.
- [x] Made internal/test/data/finance routes return a production 404.
- [x] Removed demo credentials and dev drawers from production rendering.
- [x] Upgraded Next.js/Auth dependencies and cleared `npm audit`.
- [x] Added CSP, HSTS, anti-clickjacking, nosniff, referrer and permissions headers.
- [x] Added database-backed limits for magic links, checkout, Clicks, support,
  uploads and image generation; the image studio itself is production-disabled.
- [x] Added Stripe checkout idempotency and a live-key production backstop.
- [x] Required `payment_status=paid` before webhook fulfilment.
- [x] Made paid fulfilment terminal-safe: refunded, cancelled, expired-hold and
  unpublished-event replays cannot restore a seat or resend confirmation email.
- [x] Enforced refunded/partially-refunded terminal states with a Postgres
  trigger, so even stale webhook deployments cannot reopen refunded money.
- [x] Made duplicate checkout requests reuse one active hold, one payment ledger
  row and one Stripe Checkout Session; retry failures cannot cancel the first hold.
- [x] Blocked direct RSVP/checkout writes to draft, pending, rejected and cancelled events.
- [x] Restored paid waitlist checkout for the person holding the live waitlist offer.
- [x] Unified Stripe application-fee calculation with the snapshotted reporting value.
- [x] Turned email logging into Resend delivery with status, provider id and retries.
- [x] Added event-reminder, email-retry and Click-lifecycle cron jobs.
- [x] Removed the dead cron and scheduled matching-feature refresh.
- [x] Added Click lifecycle expiry, soft “not feeling it” suppression and a production kill switch.
- [x] Made support screenshots validated, re-encoded, private and admin-signed.
- [x] Added robots, sitemap, manifest, OG image, event share metadata and health endpoint.
- [x] Added a Sydney deployment region, Node runtime pin and legal footer links.
- [x] Added admin live-event cancellation/unpublish with a required reason,
  attendee/host notifications, full-refund fan-out and attributable audit history.
- [x] Made event cancellation retries resume any refund left between the database
  commit and Stripe, with idempotency protection and automatic failure-queue resolution.
- [x] Added resilient event imagery: the failed legacy Supabase Storage host is
  bypassed server-side and every public event surface has a local runtime fallback.
- [x] Added the same preflight fallback for legacy avatar URLs, so attendee,
  people, merchant and admin screens no longer request the HTTP 402 storage host.
- [x] Added a Cloudflare R2 public-media backend for event images, avatars and
  galleries, with the existing Supabase bucket retained only as a fallback.
- [x] Applied migrations `052`, `053`, `054` and `055` to the currently configured database;
  baselined the already-present `044` schema change.
- [x] Passed build, TypeScript, zero-warning lint, tests and zero-vulnerability audit.
- [x] Passed all eight isolated Click database QA harnesses, including 30/30
  simultaneous mutual-click races.
- [x] Passed attendee, merchant and admin route/role smokes; anonymous write APIs
  return `401`, and an attendee receives `403` from admin event cancellation.
- [x] Completed a real Stripe test-mode `$2.00` checkout, confirmed venue unlock,
  then cancelled it and verified a full `$2.00` refund in Stripe and Postgres.
- [x] Replayed that paid Checkout success URL after cancellation and verified the
  transaction remained refunded, the attendee remained cancelled, and no new
  notification/email was produced.
- [x] Verified duplicate paid-checkout requests return the same Checkout while
  creating no second payment row or booking lifecycle event.
- [x] Verified merchant event history/bookings/finances and admin live-event
  cancellation UI; cancelled/rejected events no longer count as upcoming work.
- [x] Recovered two historical test-mode cancellation gaps: both $15.00 Stripe
  test charges are fully refunded and no cancelled event retains an active booking.
- [x] Verified booking/cancellation/Click invariants in Postgres: no expired live
  holds, clicks, mutuals or proposals; no blocked active mutuals; and no future
  bookable event is over capacity.
- [x] Passed the local production smoke test, including internal-route 404s.

## Remaining launch blockers — external configuration

### 1. Production environment

- [ ] Create a Vercel Production environment using `.env.example` as the map.
- [ ] Set `AUTH_SECRET` and `CRON_SECRET` to independent 32+ byte random values.
- [ ] Set both `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to
  `https://www.letsclick.app`.
- [ ] Unset `NEXT_PUBLIC_MODE`.
- [ ] Set the production Supabase pooler URL, public URL/key, and one server-only
  `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Confirm the private `merchant-documents` bucket and public `avatars` bucket exist.
- [ ] Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET_NAME` and `R2_PUBLIC_URL`; this is the preferred production upload
  path because the legacy Supabase Storage project currently returns HTTP 402.
- [ ] Set a real monitored `ADMIN_EMAILS` list and `SAFETY_INBOX_EMAIL`.
- [ ] Set `CLICK_MECHANIC_ENABLED=true` only for the release that passed Click QA.
- [ ] Run `npm run release:check -- --env=.env.production.local` until it passes.

### 2. Stripe live mode

- [ ] Choose and approve `PLATFORM_FEE_BPS` (must be greater than zero because
  the platform collects Stripe fees and losses).
- [ ] Set `sk_live_…` and matching `pk_live_…` keys.
- [ ] Register `https://www.letsclick.app/api/webhooks/stripe` in live mode.
- [ ] Subscribe the webhook to Checkout, PaymentIntent, refund, dispute, payout
  and Connect account events used by the handler.
- [ ] Set the resulting live `STRIPE_WEBHOOK_SECRET`.
- [ ] Complete one low-value live purchase, webhook fulfilment, refund and
  connected-account payout test.

### 3. Email and DNS

- [ ] Verify `letsclick.app` in Resend and set `RESEND_API_KEY`.
- [ ] Set `RESEND_FROM_EMAIL=Click <hello@letsclick.app>`.
- [ ] Publish the exact SPF and DKIM records supplied by Resend.
- [ ] Publish a DMARC record (start with monitored `p=none`, then tighten).
- [ ] Send a real magic link, RSVP confirmation, reminder and receipt to Gmail
  and Outlook; verify links, From alignment and spam placement.

### 4. OAuth and domain

- [ ] Create production Google OAuth credentials and set `AUTH_GOOGLE_ID` /
  `AUTH_GOOGLE_SECRET` if Google login should be available at launch.
- [ ] Register the exact Auth.js callback on the canonical `www` host.
- [ ] Confirm apex → `www` redirect, TLS renewal and no redirect in Stripe/email URLs.

### 5. Deploy and launch verification

- [ ] Review and commit this changeset without overwriting the pre-existing
  `mutual-toast.tsx` work or the untracked `_seed_maya_qa.mjs` file.
- [ ] Deploy to a protected preview with production-shaped non-live credentials.
- [ ] Exercise signup → magic link → onboarding → discover → Click → mutual →
  proposal, attendee checkout, and merchant approval/onboarding.
- [ ] Deploy to Production only after `npm run check` and `npm run release:check` pass.
- [ ] Run `npm run smoke -- https://www.letsclick.app`; every line must pass.
- [ ] Configure uptime monitoring against `/api/health` and alerts for 5xx,
  webhook failures, failed email rows and cron failures.
- [ ] Keep Stripe payment links/checkout disabled until the production smoke and
  one live end-to-end payment both pass.

## Known non-blocking follow-ups

- The `002_seed.sql` ledger checksum differs from the file now in the repo. The
  release checker reports it as a warning; do not rewrite historical production
  data to make the checksum match. Keep future migrations immutable.
- Move from self-declared editable age to an immutable date-of-birth / age-
  assurance flow before expanding beyond the controlled Sydney launch.
- Add a dedicated error-tracking provider in addition to Vercel logs/health alerts.
- Migrate any legacy support screenshots already stored as public URLs; all new
  screenshots use private signed storage.

## Commands

```bash
npm run check
npm run release:check -- --env=.env.production.local
npm run smoke -- https://www.letsclick.app
```
