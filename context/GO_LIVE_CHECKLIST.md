# letsclick.app go-live checklist

Updated: 2 August 2026

## Current verdict

The core application passes its local release gate, but Click is **not ready for
public launch**. The currently deployed site is still the old preview build: its
login permits unsafe preview behaviour, internal tools are exposed, and the new
security/SEO/health routes are missing. Resolve the code/content items below,
complete production configuration and deploy this changeset before accepting
real users or payments.

## Readiness audit — 2 August 2026

### Evidence collected

- [x] `npm run check` passed: zero-warning lint, TypeScript, 11/11 tests,
  production build (112 routes) and `npm audit --audit-level=high` with zero
  vulnerabilities.
- [x] The local member dashboard rendered recommendations, onboarding progress,
  notifications and event actions with no framework error overlay.
- [x] A normal member was denied `/admin` and redirected from `/merchant` into
  the host application flow as expected.
- [x] The local/test paid-event flow reached the Stripe Embedded Checkout form:
  checkout API `200`, database seat hold created, correct A$10 event and customer
  shown, and no browser console errors. The test hold expires automatically.
- [x] All eight Click database harnesses passed, including 30/30 simultaneous
  reciprocal Click races, capacity, proposals, reveal-once, safety teardown and
  lifecycle timing.
- [x] The merchant dashboard, bookings and finances tabs loaded live database
  rows without browser or server errors; non-admin merchant access to `/admin`
  was correctly denied.
- [ ] The final Stripe Pay submission, webhook fulfilment, confirmation email,
  dashboard booking, cancellation, refund and payout loop was not repeated in
  this audit; repeat the controlled full-flow test before enabling live payments.

### P0 — live deployment is unsafe for launch

- [ ] Deploy commit `ad69310` (or a reviewed descendant) to Production. It is
  currently 112 files ahead of `origin/main`, while `www.letsclick.app` serves
  the older preview build.
- [ ] Disable real-user acquisition and live checkout until the hardened build
  is deployed and every production smoke check passes.
- [ ] Verify the production login no longer says “Preview build - no password
  yet,” permits arbitrary-email impersonation, or exposes `admin@click.local`.
- [ ] Verify the Supabase write tracker and local test-account switcher are absent
  from every production page.
- [ ] Verify `/tables`, `/test`, `/business`, `/scale`,
  `/api/tables/profiles/rows`, `/api/generate` and `/api/test/*` return `404`.
  They currently return `200` or `405` on the live deployment.
- [ ] Verify CSP, Referrer-Policy, X-Content-Type-Options, X-Frame-Options and
  Permissions-Policy headers are present. They are currently missing live.
- [ ] Verify `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest` and
  `/api/health` return `200`; they currently return `404` live.
- [ ] Run `npm run smoke -- https://www.letsclick.app` and require zero failures;
  the 2 August run failed 14 checks.

### P0 — production data and customer-facing content

- [ ] Confirm every currently published event is real, approved and ready to
  accept money; unpublish all seed/QA events before opening checkout.
- [ ] Correct or confirm suspicious live listings, including “Fight Night (bare
  Nuckle),” “Jazz and Wine” at 4:00 am, “Mum's and Babies Sensory Group” at
  7:00 pm, generic “Merchant's Events” host copy and generic listing imagery.
- [ ] Replace the hard-coded merchant support address `support@click.local` with
  a monitored production address and make footer/policy contact domains
  consistent (`hello@click.au` versus `hello@letsclick.app`).
- [ ] Remove QA/test event, booking and attendee rows from the production database;
  the merchant portal currently exposes test-labelled events and invalid-looking
  attendee records alongside operational data.

### P1 — authentication and dashboard integrity

- [ ] Fix local `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to match the actual local
  server port. They currently point at `localhost:3001`, so a server running on
  port 3000 redirects a fresh login to the wrong origin.
- [ ] Configure and test Resend before relying on email login. The hardened login
  correctly creates 15-minute, single-use links, but `.env.local` currently has
  no `RESEND_API_KEY` or `RESEND_FROM_EMAIL`, so delivery cannot complete.
- [ ] Replace the admin dashboard's static-data fallbacks with an explicit
  unavailable/stale state. Several admin repository reads currently return demo
  metrics when Postgres fails, which can make a disconnected dashboard look live.
- [ ] Set `ADMIN_EMAILS` to a comma-separated allow-list of real operator emails,
  redeploy, and verify one allowed and one denied account. Database
  `profiles.role='admin'` alone does not grant portal access.

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
