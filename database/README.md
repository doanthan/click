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

You can paste them into the Supabase SQL editor, or pipe them through `psql`
using the connection string from Project Settings -> Database.

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
