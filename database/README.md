# Click Postgres (Supabase)

Click uses Supabase's hosted Postgres as the application database. Keep all
user-facing state here: profiles, merchants, events, RSVPs, waitlists,
bookmarks, payments, anonymous Clicks, mutual Clicks, notifications, tags, and
audit logs.

## Apply schema

Run the SQL files in this directory against your Supabase project in order:

1. `001_schema.sql`
2. `002_seed.sql` (optional sample data)
3. `003_stripe_hold.sql` (adds `pending_payment` RSVP status used while a Stripe Checkout session is in progress)
4. `004_messages.sql` (1-to-1 conversations + messages tables for the `/messages` route)
5. `005_profile_extras.sql` (adds `birth_date`, `dating_visible`, `flexible_discovery` to profiles)
6. `006_admin_extras.sql` (adds `suspended_at` / `suspended_reason` to profiles + creates `system_settings` KV)
7. `007_test_cases.sql` (creates `test_cases` + `test_case_comments` for the editable QA board on `/test`)
8. `008_intent_extras.sql`
9. `009_merchant_full_signup.sql` (extends `merchant_profiles` for the 4-step wizard; creates `merchant_event_categories` + `merchant_documents` + the `merchant_document_type` enum + the private `merchant-documents` storage bucket — required by `/merchant/signup`)
10. `010_merchant_suspended.sql` (adds `'suspended'` to the `merchant_profiles.verification_status` CHECK so admins can suspend approved merchants from the `/admin/merchants` row menu; suspended merchants' events are filtered out of the public Discover feed)
11. `011_extend_tag_categories.sql` (adds `tag_categories.internal_only` so Life + Music — matching signals, not event types — are hidden from the merchant signup picker and the public `/categories` page; seeds 8 new categories: Outdoors, Sports, Nightlife, Games, Learning, Wellness, Family, Travel)
12. `012_email_events.sql` (dev/staging email log — renders templates locally into `email_events` instead of wiring SMTP; see `src/lib/email.ts`)
13. `013_merchant_stripe_onboarding.sql` (adds `charges_enabled` / `payouts_enabled` / `details_submitted` / `onboarding_completed_at` to `merchant_profiles` for the post-approval `/merchant/onboarding` flow + Stripe Connect; the capability flags mirror the connected account and are kept in sync by the `account.updated` Connect webhook)

You can paste them into the Supabase SQL editor, or pipe them through `psql`
using the connection string from Project Settings -> Database.

## Migration runner + ledger

Prefer `scripts/run-migrations.mjs` over pasting by hand — it tracks what's been
applied in a `schema_migrations` ledger (filename + sha256 + applied_at, created
by `021_schema_migrations.sql`) and skips anything already recorded, so reruns
are safe and drift can't go silent.

```bash
# Apply every not-yet-recorded file in order (records each on success):
node scripts/run-migrations.mjs database/0*.sql

# Apply one new migration:
node scripts/run-migrations.mjs database/0NN_whatever.sql
```

The runner reads `DATABASE_URL` from `.env.local`/`.env`. Each file is sent as
one implicit transaction (a mid-file error rolls that file back and halts the
run). It warns — but does not block — if a recorded file's checksum later
changes on disk. `filename` is the basename, so every migration gets its own
ledger row. Keep migration numbers unique — one file per number.

**Baselining an existing database** (one-time, for a DB whose schema predates
the ledger): record the already-applied files *without* re-running their SQL,
so a later normal run won't try to re-execute non-idempotent migrations:

```bash
node scripts/run-migrations.mjs --baseline database/0*.sql
```

When you add a new migration, drop the numbered `.sql` in this directory and run
the runner — no need to edit the runner. The numbered list above is descriptive,
not the source of truth; the ledger is.

## App connection

Set `DATABASE_URL` to the Supabase connection pooler URL (Project Settings ->
Database -> Connection pooler -> Transaction mode):

```bash
DATABASE_URL=postgres://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

The Next app reads events from Postgres when `DATABASE_URL` is present. If the
database is unavailable, the UI falls back to the static sample data in
`src/lib/click-data.ts`.

## Stripe (paid events)

Set the following to enable the booking → pay → reserve flow. Free events keep
working without Stripe; only events with `price_cents > 0` require it.

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

In development, run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
and paste the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`. The CLI also
prints test card numbers; `4242 4242 4242 4242` is the standard success card.

When `STRIPE_SECRET_KEY` is unset the checkout API returns 503 and the detail
page hides the "Reserve & pay" button.

## Why this is Postgres

The schema uses relational constraints, ACID transactions, foreign keys,
capacity checks, and triggers for mutual Clicks. Those are primary application
database concerns and should stay in Postgres. ClickHouse can be introduced
later as an analytics warehouse fed by application events.
