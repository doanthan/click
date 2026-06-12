# Click email templates

Plain HTML templates for the transactional emails Click sends today. Each file is a complete, standalone document with inlined styles — open one in a browser to see the design, or feed it through any templating engine (Handlebars, Mustache, hand-rolled string replace) to fill in the `{{variables}}`.

These follow the design direction in `/design.md`:

- Porcelain background, Indigo Ink type, Bubblegum Pink CTAs, Icy Aqua tags.
- Editorial serif headings, refined sans body.
- Warm, specific, practical copy. No "AI-powered" anything.
- Ticket-stub visual cues on event cards (dashed indigo top border).

## Files

The first four are wired through `logEmailEvent` (see "Dev log" below). The rest are designed and templated — their trigger sites still need to call `logEmailEvent({ template: "…", … })`. The `EmailTemplate` union + subject lines in `src/lib/email.ts` already cover them, so once you call it, it'll typecheck and render.

### Attendee-facing

| File | When to send | Subject suggestion |
| --- | --- | --- |
| `account-welcome.html` | Right after a new attendee finishes signup (`ensureProfileForSession`). | `Welcome to Click — let's find your people` |
| `rsvp-attendee.html` | After `POST /api/events/[eventId]/register` succeeds. | `You're in — {{eventTitle}}, {{eventShortDate}}` |
| `rsvp-cancelled-attendee.html` | After an attendee uses the `cancelRsvpUrl` flow. | `RSVP cancelled — {{eventTitle}}` |
| `event-reminder-attendee.html` | ~24h before `events.starts_at` (cron job — not request-triggered). | `Tomorrow — {{eventTitle}}` |
| `event-cancelled-attendee.html` | Fan-out to every confirmed RSVP after `POST /api/merchant/events/[eventId]/cancel`. | `{{eventTitle}} has been cancelled` |
| `payment-receipt-attendee.html` | From the Stripe webhook (`checkout.session.completed`) on paid events. | `Receipt — {{eventTitle}} ({{totalLabel}})` |
| `password-reset.html` | When a user starts the `/forgot-password` flow. | `Reset your Click password` |

### Merchant-facing

| File | When to send | Subject suggestion |
| --- | --- | --- |
| `merchant-application-received.html` | After the `/merchant/signup/documents` wizard step submits (venue inside the pilot area). | `We've got your application — {{businessName}}` |
| `merchant-waitlisted-merchant.html` | Same step, when the venue is outside the launch pilot (Greater Sydney) — parked on the host waitlist. | `You're on the Click waitlist — {{suburb}} is coming soon` |
| `merchant-verified-merchant.html` | After `POST /api/admin/merchants/[merchantId]/verification` approves. | `{{businessName}} is verified — post your first event` |
| `merchant-rejected-merchant.html` | Same route, declined. | `{{businessName}} application — one small change` |
| `event-created-merchant.html` | After a merchant submits an event for review (`POST /api/merchant/events`). | `Your event is in review — {{eventTitle}}` |
| `event-approved-merchant.html` | After `POST /api/admin/events/[eventId]/approve` succeeds. | `{{eventTitle}} is live` |
| `event-rejected-merchant.html` | After `POST /api/admin/events/[eventId]/reject` succeeds. | `{{eventTitle}} needs another pass` |
| `rsvp-merchant.html` | Same trigger as `rsvp-attendee.html`, sent to the event's owning merchant. | `New RSVP — {{attendeeFirstName}} is going to {{eventTitle}}` |
| `rsvp-cancelled-merchant.html` | Same trigger as `rsvp-cancelled-attendee.html`, sent to the event's owning merchant. | `{{attendeeFirstName}} can't make {{eventTitle}}` |

## Variables

Variables are typed `{{likeThis}}`. Strings unless noted.

### `account-welcome.html`

| Variable | Notes |
| --- | --- |
| `firstName` | First name from `profiles.full_name` or OAuth payload. |
| `quizUrl` | Absolute URL, e.g. `https://click.app/quiz/life`. |
| `discoverUrl` | e.g. `https://click.app/discover`. |
| `supportEmail` | Support inbox shown in footer. |
| `unsubscribeUrl` | One-click unsubscribe URL. |

### `rsvp-attendee.html`

| Variable | Notes |
| --- | --- |
| `firstName` | Attendee's first name. |
| `eventTitle` | e.g. `Thursday Clay Club`. |
| `eventLongDate` | e.g. `Thursday 6 June 2026`. |
| `eventStartTime` | e.g. `7:00 PM`. |
| `eventEndTime` | e.g. `9:00 PM`. |
| `eventVenue` | Venue name, e.g. `Marrickville Clay Studio`. |
| `eventAddress` | Full street address. |
| `eventCity` | Suburb / city. |
| `eventHostName` | Merchant display name. |
| `eventPriceLabel` | e.g. `$28` or `Free`. |
| `eventCategory` | e.g. `Arts`. Shown as an Icy Aqua chip. |
| `eventSpotsFilledLabel` | e.g. `12 of 20 spots filled`. |
| `socialSignalLabel` | Optional. e.g. `4 people you might click with are also going`. Hide row if empty. |
| `eventDetailsUrl` | Link back to `/events/[slug]`. |
| `cancelRsvpUrl` | Link to cancel RSVP flow. |
| `addToCalendarUrl` | `.ics` download or Google Calendar link. |
| `supportEmail` |  |
| `unsubscribeUrl` |  |

### `rsvp-merchant.html`

| Variable | Notes |
| --- | --- |
| `merchantFirstName` | Merchant contact first name. |
| `attendeeFirstName` | Attendee first name only — never email or last name. |
| `attendeeCity` | Suburb. |
| `attendeeIntentLabel` | Optional. e.g. `Friends mode`, `Dating mode`. Hide row if empty. |
| `eventTitle` |  |
| `eventLongDate` |  |
| `eventStartTime` |  |
| `eventVenue` |  |
| `eventSpotsFilledLabel` | e.g. `12 of 20 spots filled`. |
| `attendeesUrl` | Link to `/merchant/events/[eventId]` attendees tab. |
| `eventDashboardUrl` | Link to the merchant event detail page. |
| `supportEmail` |  |
| `unsubscribeUrl` |  |

### `event-created-merchant.html`

| Variable | Notes |
| --- | --- |
| `merchantFirstName` |  |
| `eventTitle` |  |
| `eventLongDate` |  |
| `eventStartTime` |  |
| `eventCity` |  |
| `eventCategory` |  |
| `eventCapacityLabel` | e.g. `Capacity 20`. |
| `eventDashboardUrl` | Link to `/merchant/events/[eventId]`. |
| `editEventUrl` | Link to edit page if applicable. |
| `supportEmail` |  |
| `unsubscribeUrl` |  |

### `rsvp-cancelled-attendee.html`

| Variable | Notes |
| --- | --- |
| `firstName` |  |
| `eventTitle` |  |
| `eventLongDate` |  |
| `eventStartTime` |  |
| `discoverUrl` |  |
| `supportEmail` |  |
| `unsubscribeUrl` |  |

### `rsvp-cancelled-merchant.html`

| Variable | Notes |
| --- | --- |
| `merchantFirstName` |  |
| `attendeeFirstName` | First name only — never last name or email. |
| `eventTitle` |  |
| `eventLongDate` |  |
| `eventStartTime` |  |
| `eventSpotsFilledLabel` | Updated post-cancel headcount, e.g. `11 of 20 spots filled`. |
| `waitlistCountLabel` | e.g. `3 on the waitlist` or `0`. |
| `attendeesUrl` | `/merchant/events/[eventId]` attendees tab. |
| `eventDashboardUrl` |  |
| `supportEmail` |  |
| `unsubscribeUrl` |  |

### `event-reminder-attendee.html`

Day-before nudge. Variables overlap heavily with `rsvp-attendee.html` so the same query can build both payloads.

| Variable | Notes |
| --- | --- |
| `firstName` |  |
| `eventTitle` |  |
| `eventLongDate` |  |
| `eventStartTime` |  |
| `eventEndTime` |  |
| `eventVenue` |  |
| `eventAddress` |  |
| `eventCity` |  |
| `eventHostName` |  |
| `eventCategory` |  |
| `directionsUrl` | Maps deep link, e.g. `https://maps.google.com/?q={{eventAddress}}`. Reused as the primary CTA. |
| `eventDetailsUrl` | `/events/[slug]`. |
| `cancelRsvpUrl` |  |
| `whoElseLabel` | Optional. e.g. `12 going, 4 are first-timers`. Hide row if empty. |
| `supportEmail` |  |
| `unsubscribeUrl` |  |

### `event-approved-merchant.html`

| Variable | Notes |
| --- | --- |
| `merchantFirstName` |  |
| `eventTitle` |  |
| `eventLongDate` |  |
| `eventStartTime` |  |
| `eventCity` |  |
| `eventCategory` |  |
| `eventCapacityLabel` |  |
| `publicEventUrl` | Absolute `/events/[slug]` URL — used as both CTA and shareable link block. |
| `eventDashboardUrl` |  |
| `supportEmail` |  |
| `unsubscribeUrl` |  |

### `event-rejected-merchant.html`

| Variable | Notes |
| --- | --- |
| `merchantFirstName` |  |
| `eventTitle` |  |
| `rejectionReason` | Free-text from the admin. Rendered as a single paragraph — newlines OK but no markdown. |
| `editEventUrl` |  |
| `supportEmail` |  |
| `unsubscribeUrl` |  |

### `event-cancelled-attendee.html`

| Variable | Notes |
| --- | --- |
| `firstName` |  |
| `eventTitle` |  |
| `eventLongDate` |  |
| `eventStartTime` |  |
| `eventHostName` |  |
| `cancellationReason` | Optional free-text from the host. Hide the "note from the host" row if empty. |
| `refundLabel` | e.g. `A $28 refund is on its way to your Visa ending 4242` or `This event was free — nothing to refund`. |
| `discoverUrl` |  |
| `supportEmail` |  |
| `unsubscribeUrl` |  |

### `merchant-application-received.html`

| Variable | Notes |
| --- | --- |
| `merchantFirstName` |  |
| `businessName` |  |
| `submittedDate` | e.g. `29 May 2026`. Local timezone of the merchant. |
| `merchantDashboardUrl` | `/merchant`. |
| `supportEmail` |  |
| `unsubscribeUrl` |  |

### `merchant-waitlisted-merchant.html`

Sent instead of `merchant-application-received` when the signup venue is outside the launch pilot (Greater Sydney). The `email_events` row is the waitlist record.

| Variable | Notes |
| --- | --- |
| `merchantFirstName` |  |
| `businessName` |  |
| `suburb` | The merchant's signup suburb (falls back to state). |
| `pilotArea` | Human label for the live pilot region, e.g. `Greater Sydney`. |
| `supportEmail` |  |
| `unsubscribeUrl` |  |

### `merchant-verified-merchant.html`

| Variable | Notes |
| --- | --- |
| `merchantFirstName` |  |
| `businessName` |  |
| `createEventUrl` | `/merchant/events/create`. |
| `merchantDashboardUrl` |  |
| `supportEmail` |  |
| `unsubscribeUrl` |  |

### `merchant-rejected-merchant.html`

| Variable | Notes |
| --- | --- |
| `merchantFirstName` |  |
| `businessName` |  |
| `rejectionReason` | Free-text from the admin. |
| `resubmitUrl` | Where to fix it — typically `/merchant/signup/documents`. |
| `supportEmail` |  |
| `unsubscribeUrl` |  |

### `password-reset.html`

No `unsubscribeUrl` here — security mail is transactional and exempt from preference lists.

| Variable | Notes |
| --- | --- |
| `resetUrl` | One-shot signed URL. Also rendered as plain text below the button. |
| `expiryWindowLabel` | e.g. `60 minutes`, `1 hour`. |
| `requestIpLabel` | e.g. `an IP in Sydney, Australia` — never the raw IP. Optional but recommended for trust. |
| `supportEmail` |  |

### `payment-receipt-attendee.html`

This one is a tax document — `taxLabel` and the `ABN` line in the footer matter for AU GST receipts. If you launch outside AU first, swap the footer text accordingly.

| Variable | Notes |
| --- | --- |
| `firstName` |  |
| `eventTitle` |  |
| `eventLongDate` |  |
| `eventStartTime` |  |
| `eventVenue` |  |
| `eventHostName` | Shown in the statement-descriptor note. |
| `receiptDate` | e.g. `29 May 2026`. |
| `priceLabel` | Ticket subtotal, e.g. `$25.45`. |
| `taxLabel` | GST amount, e.g. `$2.55`. |
| `totalLabel` | Grand total, e.g. `$28.00`. |
| `paymentMethodLabel` | e.g. `Visa ending in 4242`. |
| `receiptNumber` | Stable, e.g. `CL-2026-08213`. |
| `eventDetailsUrl` | `/events/[slug]`. |
| `downloadInvoiceUrl` | PDF tax invoice. |
| `refundPolicyUrl` | Public refund policy page. |
| `supportEmail` |  |
| `unsubscribeUrl` |  |

## Dev log: viewing sends in Supabase

There's no SMTP provider wired yet, but rendered emails *are* persisted to a Postgres table so you can inspect what would have gone out. Quick path:

1. Apply migration `database/012_email_events.sql` (run it through your usual Supabase migration flow). It creates the `email_events` table.
2. Trigger something that fires a template — easiest is to sign in with a brand-new Google account. `ensureProfileForSession` in `src/lib/event-repository.ts` detects a freshly-inserted profile (`xmax = 0` on the upsert) and calls `logEmailEvent({ template: "account-welcome", … })`.
3. Open Supabase Studio → **Table Editor** → `email_events` → click the row. The **side drawer** shows every column: `to_email`, `subject`, the substituted `html` (long text), and the `vars` jsonb you passed in.

The helper lives in `src/lib/email.ts` (`logEmailEvent`, `renderTemplate`). It loads the matching `.html` file from this directory, replaces `{{vars}}`, and inserts a row. Failures are warn-logged and swallowed — a missing template will never break the signup/RSVP flow it's attached to. Restart the dev server to pick up template edits (`.html` files are cached in-process).

All four templates are wired:

- `account-welcome` → `ensureProfileForSession` (fires on `xmax = 0`, i.e. fresh inserts only)
- `rsvp-attendee` + `rsvp-merchant` → `registerForEvent`, after the confirmed-RSVP txn commits (waitlisted RSVPs still go through the existing `sendWorkflowEmail` path, not the dev log)
- `event-created-merchant` → `createEventForMerchant`, after the events insert (and tag upsert) succeeds

## Sending these

Click doesn't have an email backend wired up yet. When adding one, the recommended path is:

1. Pick a provider — Resend or AWS SES both work. Add the SDK in `package.json`.
2. Add a thin `src/lib/email.ts` that:
   - Loads the relevant `.html` file from `/emails`.
   - Runs it through a templater (or a regex replace over `{{var}}`).
   - Sends via the provider, with a generated plain-text fallback (strip tags + decode entities).
3. Trigger sites:
   - `account-welcome.html` → after `ensureProfileForSession` returns a freshly-inserted profile.
   - `rsvp-*.html` → at the end of `POST /api/events/[eventId]/register`, in a `Promise.all` so the response isn't blocked on SMTP.
   - `event-created-merchant.html` → at the end of `POST /api/merchant/events`.
4. Keep the templates here, not in `src/`. They're content, not code. The send wrapper in `src/lib/email.ts` should be the only thing that reads them.

## Editing

- Email clients still don't agree on CSS. Inline the critical layout styles even when the `<style>` block sets them — many clients drop the head styles silently.
- Don't add `<img>` tags with copy baked into the image. Brand wordmarks rendered as text degrade better and stay readable in dark mode.
- Test in Litmus or Email on Acid before changing the structural tables — Outlook on Windows will reflow anything it doesn't understand.
- Keep total weight under ~100 KB. Gmail clips messages over ~102 KB and hides the unsubscribe footer behind a "View entire message" link.

## Open to-dos

- Trigger sites are now wired for `event-approved-merchant`, `event-rejected-merchant`, `rsvp-cancelled-*`, `event-cancelled-attendee`, `merchant-application-received`, `merchant-verified/rejected-merchant`, `payment-receipt-attendee`, and `password-reset` (see the "Wired triggers" table in `CLAUDE.md` for the exact handler per template). Still unwired: `event-reminder-attendee` (cron, below).
- `event-reminder-attendee` needs a scheduler, not a request handler. Easiest path is a daily cron job that selects `events` starting ~24h out, joins confirmed RSVPs, and calls `logEmailEvent` per row. Pick the cron mechanism (Supabase `pg_cron`, Vercel cron, GitHub Actions) before building it.
- Hook the unsubscribe link to a real preferences page — placeholder `unsubscribeUrl` won't satisfy CAN-SPAM/CASL on its own.
- `payment-receipt-attendee.html` footer hard-codes a placeholder ABN. Fill in the real ABN once Click Pty Ltd is registered, and reconsider the GST line if you launch outside AU first.
