# Click email templates

Plain HTML templates for the transactional emails Click sends today. Each file is a complete, standalone document with inlined styles — open one in a browser to see the design, or feed it through any templating engine (Handlebars, Mustache, hand-rolled string replace) to fill in the `{{variables}}`.

These follow the Click design system (`context/Click Design System/`, palette canon in `context/DESIGN.MD`):

- Cream `#F9F6F0` page ground, white cards, Ink `#1C1830` type, Slate `#6B6580` meta, Mist `#ECEAF0` hairlines.
- Deep Purple `#3B2F81` is the only CTA / heading accent colour - flat, never a gradient. Lavender `#C8B8F8` is an accent hairline only.
- Schibsted Grotesk headings + wordmark, Inter body.
- Warm, specific, practical copy. No "AI-powered" anything. Hyphens ` - `, never em-dashes.
- Ticket-stub visual cues on event cards.

## Files

Every template listed here is wired through `logEmailEvent` and fires today, with one exception noted in "Open to-dos". Adding a new one means: drop the `.html` here, add the variant to the `EmailTemplate` union and a subject to `SUBJECTS` in `src/lib/email.ts`, then call `logEmailEvent({ template: "…", … })` from the trigger site.

### Attendee-facing

| File | When to send | Subject suggestion |
| --- | --- | --- |
| `account-welcome.html` | Right after a new attendee finishes signup (`ensureProfileForSession`). | `Welcome to Click — let's find your people` |
| `rsvp-attendee.html` | After `POST /api/events/[eventId]/register` succeeds. | `You're in — {{eventTitle}}, {{eventShortDate}}` |
| `rsvp-cancelled-attendee.html` | After an attendee uses the `cancelRsvpUrl` flow. | `RSVP cancelled — {{eventTitle}}` |
| `event-reminder-attendee.html` | ~24h before `events.starts_at` (cron job — not request-triggered). | `Tomorrow — {{eventTitle}}` |
| `event-cancelled-attendee.html` | Fan-out to every confirmed RSVP after `POST /api/merchant/events/[eventId]/cancel`. | `{{eventTitle}} has been cancelled` |
| `payment-receipt-attendee.html` | From the Stripe webhook (`checkout.session.completed`) on paid events. | `Receipt — {{eventTitle}} ({{totalLabel}})` |
| `waitlist-joined-attendee.html` | When an RSVP lands on a full event's waitlist (`registerForEvent`). | `You're on the waitlist - {{eventTitle}}` |
| `waitlist-promoted-attendee.html` | When a freed seat is offered to the next person in the queue. Time-sensitive - the hold is already ticking. | `A spot opened - {{eventTitle}}` |

### Auth and security

No `unsubscribeUrl` on any of these — security mail is transactional and exempt from preference lists.

| File | When to send | Subject suggestion |
| --- | --- | --- |
| `password-reset.html` | When a user starts the `/forgot-password` flow. | `Reset your Click password` |
| `signin-link.html` | Magic-link sign-in for an existing account (`requestEmailSignIn`, `mode: "login"`). | `Your Click sign-in link` |
| `signup-link.html` | Magic-link confirmation that finishes creating a new account (`mode: "signup"`). | `Finish creating your Click account` |
| `signin-no-account.html` | Someone tried to sign in on an address with no Click account. Carries a working signup link so one tap sets the account up. | `No Click account on this address yet` |

### Merchant-facing

| File | When to send | Subject suggestion |
| --- | --- | --- |
| `merchant-application-received.html` | After the `/merchant/signup/documents` wizard step submits (venue inside the pilot area). | `We've got your application — {{businessName}}` |
| `merchant-waitlisted-merchant.html` | Same step, when the venue is outside the launch pilot (Greater Sydney) — parked on the host waitlist. | `You're on the Click waitlist — {{suburb}} is coming soon` |
| `merchant-verified-merchant.html` | After `POST /api/admin/merchants/[merchantId]/verification` approves. | `{{businessName}} is verified — post your first event` |
| `merchant-rejected-merchant.html` | Same route, declined. | `{{businessName}} application — one small change` |
| `merchant-suspended-merchant.html` | Same route, suspended. Their live events are hidden from Discover until an admin reinstates them. | `{{businessName}} has been suspended on Click` |
| `event-created-merchant.html` | After a merchant submits an event for review (`POST /api/merchant/events`). | `Your event is in review — {{eventTitle}}` |
| `event-approved-merchant.html` | After `POST /api/admin/events/[eventId]/approve` succeeds. | `{{eventTitle}} is live` |
| `event-rejected-merchant.html` | After `POST /api/admin/events/[eventId]/reject` succeeds. | `{{eventTitle}} needs another pass` |
| `event-cancelled-merchant.html` | After an admin cancels/unpublishes a live event. | `{{eventTitle}} was cancelled by Click` |
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
| `cancellationReason` | Optional free-text explaining why the host or Click cancelled the event. |
| `refundLabel` | e.g. `A $28 refund is on its way to your Visa ending 4242` or `This event was free — nothing to refund`. |
| `discoverUrl` |  |
| `supportEmail` |  |
| `unsubscribeUrl` |  |

### `event-cancelled-merchant.html`

| Variable | Notes |
| --- | --- |
| `merchantFirstName` | Owning host's first name. |
| `eventTitle` | Cancelled event title. |
| `cancellationReason` | Required reason supplied by the admin. |
| `attendeeCount` | Number of affected attendee records. |
| `refundCount` | Number of full refunds initiated successfully. |
| `eventDashboardUrl` | Absolute merchant event-record URL. |
| `supportEmail` | Monitored Click support address. |

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

### `signin-link.html`, `signup-link.html` and `signin-no-account.html`

Same variables, different copy. These carry a live one-time credential, which is why they are the only templated emails that do **not** go through `logEmailEvent` — see the comment in `src/app/login/actions.ts`.

| Variable | Notes |
| --- | --- |
| `verifyUrl` | One-shot signed URL. Also rendered as plain text below the button. |
| `expiryWindowLabel` | e.g. `15 minutes`. Derived from `TOKEN_TTL_MINUTES` in `src/lib/auth-magic-link.ts` — never hard-code it, the copy and the token must not disagree. |
| `attemptedEmail` | `signin-no-account` only. The address that was typed into the sign-in form. It is echoed back only in the mail sent *to* that address, so it leaks nothing. |
| `supportEmail` |  |

**Why `signin-no-account` exists.** A sign-in attempt on an unknown address used to return "Email sent" to the browser and send nothing at all, so a genuinely new person who landed on `/login` instead of `/signup` waited forever for mail that was never coming. Answering "no such account" in the browser instead is not an option — that is a user-enumeration oracle. So the token is now issued on both paths, the browser response stays byte-identical, and only the template differs. Only someone reading that inbox learns anything.

This also closed a real leak: the old early return never reached `issueMagicLink`, and the rate limiter counts `auth_magic_links` rows, so a *known* address started throwing `RateLimitError` on the 6th attempt within an hour while an unknown one never did. Six posts told you whether an account existed. `tests/release-config.test.mjs` guards both properties.

### `waitlist-joined-attendee.html`

| Variable | Notes |
| --- | --- |
| `firstName` |  |
| `eventTitle` |  |
| `eventLongDate` |  |
| `eventStartTime` |  |
| `eventVenue` |  |
| `eventCity` |  |
| `offerWindowLabel` | How long a freed seat is held, e.g. `30 minutes`. Comes from `WAITLIST_OFFER_MINUTES`. |
| `eventDetailsUrl` | `/events/[slug]`. |
| `discoverUrl` | Offered as a genuine alternative, never as consolation. |
| `supportEmail` |  |
| `unsubscribeUrl` |  |

### `waitlist-promoted-attendee.html`

| Variable | Notes |
| --- | --- |
| `firstName` |  |
| `eventTitle` |  |
| `eventLongDate` |  |
| `eventStartTime` |  |
| `eventVenue` |  |
| `eventCity` |  |
| `claimUrl` | Where they accept the seat — `/events/[slug]`. Single CTA, no competing links. |
| `offerExpiresLabel` | Absolute wall-clock deadline in the venue's timezone, e.g. `Thu, 7:42 PM`. A relative "30 minutes" goes stale the moment the mail queues. |
| `offerWindowLabel` | e.g. `30 minutes`. |
| `supportEmail` |  |
| `unsubscribeUrl` |  |

### `merchant-suspended-merchant.html`

| Variable | Notes |
| --- | --- |
| `merchantFirstName` |  |
| `businessName` |  |
| `suspensionReason` | Free-text from the admin. Rendered as a single paragraph — newlines OK but no markdown. Falls back to a neutral sentence when the admin left it blank. |
| `merchantDashboardUrl` | `/merchant`. |
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

Every rendered email is persisted to a Postgres table as well as delivered, so you can inspect exactly what went out. Quick path:

1. Apply migration `database/012_email_events.sql` (run it through your usual Supabase migration flow). It creates the `email_events` table.
2. Trigger something that fires a template — easiest is to sign in with a brand-new Google account. `ensureProfileForSession` in `src/lib/event-repository.ts` detects a freshly-inserted profile (`xmax = 0` on the upsert) and calls `logEmailEvent({ template: "account-welcome", … })`.
3. Open Supabase Studio → **Table Editor** → `email_events` → click the row. The **side drawer** shows every column: `to_email`, `subject`, the substituted `html` (long text), and the `vars` jsonb you passed in.

The helper lives in `src/lib/email.ts` (`logEmailEvent`, `renderTemplate`). It loads the matching `.html` file from this directory, replaces `{{vars}}`, and inserts a row. Failures are warn-logged and swallowed — a missing template will never break the signup/RSVP flow it's attached to. Restart the dev server to pick up template edits (`.html` files are cached in-process).

The per-template trigger site is listed in the "Wired triggers" table in `CLAUDE.md`.

## Sending these

Resend is live. `logEmailEvent` inserts the `email_events` row first, then delivers through Resend using the row id as the provider idempotency key, then writes back `delivery_status` / `provider_message_id`. Rows that failed or were logged while the key was missing are retried by `retryPendingEmailEvents` (cron route `api/cron/email-delivery`), up to 5 attempts within 7 days.

Resend verifies the sending **subdomain**, not the root: `send.letsclick.app` is verified and `letsclick.app` is not, so a from address on the root gets a 403. `RESEND_FROM_EMAIL` must stay on the subdomain; replies are pointed at the real inbox via `reply_to`.

### Testing the whole set

```
node scripts/send-test-emails.mjs --to=you@example.com            # real send, one of each
node scripts/send-test-emails.mjs --to=you@example.com --dry-run  # render only
node scripts/send-test-emails.mjs --to=you@example.com --only=signin-link
```

It renders every `.html` in this directory with realistic sample data and posts straight to Resend — no `email_events` rows, so a test blast never pollutes the audit trail. It exits non-zero if a template leaves any `{{variable}}` unreplaced, or if a `.html` has no subject in `SUBJECTS` (or vice versa), so adding half of a template pair fails the run.

## Editing

- Email clients still don't agree on CSS. Inline the critical layout styles even when the `<style>` block sets them — many clients drop the head styles silently.
- Don't add `<img>` tags with copy baked into the image. Brand wordmarks rendered as text degrade better and stay readable in dark mode.
- Test in Litmus or Email on Acid before changing the structural tables — Outlook on Windows will reflow anything it doesn't understand.
- Keep total weight under ~100 KB. Gmail clips messages over ~102 KB and hides the unsubscribe footer behind a "View entire message" link.

## Open to-dos

- Every template here is wired. The one remaining plain-text notice is the merchant status change to `pending` in `updateMerchantVerificationForAdmin` — a rare internal action with no `.html` and no `email_events` row. Draft `merchant-pending-merchant.html` if an admin ever uses it in anger.
- Hook the unsubscribe link to a real preferences page — placeholder `unsubscribeUrl` won't satisfy CAN-SPAM/CASL on its own.
- `payment-receipt-attendee.html` footer hard-codes a placeholder ABN. Fill in the real ABN once Click Pty Ltd is registered, and reconsider the GST line if you launch outside AU first.
