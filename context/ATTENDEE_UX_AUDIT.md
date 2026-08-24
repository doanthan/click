# Click - attendee audit

## Does it make sense?

Yes, on paper. "Book a real-world thing in Sydney, then afterwards privately pick anyone you'd like to see again, and if they pick you too, you both find out." That's one sentence, a normal person can repeat it, and the code behind it is genuinely well built - the asymmetry is real, the refusal messages are byte-identical across every ineligibility reason so a sender can't learn why someone is unavailable (`src/lib/event-repository.ts:7822, 7836, 7857, 7871`), and there's no messaging inbox to pretend otherwise (`src/app/proposals/page.tsx:33-36`). The booking half is a competent events product with real edge-case care: a clash warning before you commit (`src/app/events/[slug]/page.tsx:517-523`), a locked venue that still names the suburb (`:447-452`), and a "you paid but the host pulled the event" page that names the amount and the refund (`:160-193`).

The single biggest conceptual gap: **the click layer is invisible to everyone who hasn't already bought in, and thinnest on the one screen it exists for.** A stranger arriving from a share link reads a page that is indistinguishable from Eventbrite - grep for "mutual", "click with" or "after the event" across `src/app/events/[slug]/page.tsx` and `src/components/event-detail-modal.tsx` returns nothing. On a phone the homepage carries the whole social half in seven words, because the one illustration is `hidden lg:block` (`src/app/page.tsx:220`). And when you finally reach the post-event roster - the moment the product exists for - you get identical grey silhouettes and first names for people you met two hours ago (`src/components/post-event-click-card.tsx:57`, no `src` on the Avatar), with a silent three-pick budget (`src/lib/clicks/constants.ts:15`) and no stated deadline, while the discovery query one file over hard-requires a photo because "clicking is a face-first decision" (`src/lib/event-repository.ts:12038-12040`). The product enforces on strangers a rule it breaks on people you actually met.

Second gap, smaller but real: the loop has never run. There are no live events, so `/discover` - the destination of the homepage's one primary CTA - currently renders an empty state whose only button says "Host an event" (`src/components/event-explorer.tsx:465-473`). Everything below is written on the assumption that supply arrives; if it doesn't, none of it matters.

## What's genuinely working

- **Money is handled with real care.** Fulfil-on-return reconciles Stripe server-side before the page renders (`src/app/events/[slug]/page.tsx:130-132`), the cron re-checks Stripe before reaping a lapsed hold (`src/lib/event-repository.ts:9285-9295`), and `createPaymentHold` promotes an already-paid seat in place rather than opening a second checkout (`:10197-10240`).
- **The social proof is not decorated.** Headcounts come from a live SQL count of confirmed attendees plus paid guest seats (`src/lib/event-repository.ts:2854-2871`); the marquee renders nothing rather than something invented (`src/components/live-activity-marquee.tsx:14`); face rows need three real faces (`src/components/event-card.tsx:142-143`).
- **The venue privacy promise is enforced at the serialisation boundary**, not just in markup - `successDetailsForViewer` is gated on `venueUnlocked` so the address never reaches the client of someone being told it's hidden (`src/app/events/[slug]/page.tsx:270-278`), and the .ics honours the same gate (`src/app/api/events/[eventId]/ics/route.ts:56-63`).
- **Empty and loading states are thought about.** Two different empty states with different advice on Discover (`src/components/event-explorer.tsx:450, 465-489`), and 13 geometry-matched `loading.tsx` files across the attendee routes, one of which deliberately omits a conditional rail so its absence isn't a layout shift (`src/app/discover/loading.tsx:5-12`).
- **Modal behaviour is centralised** after four copies had drifted - Escape, a real Tab trap, scroll lock with restore (`src/components/modal-shell.tsx:144-205`) - and `ConfirmDialog` focuses the *safe* button (`src/components/confirm-dialog.tsx:103-106`).
- **Every internal dev route really is 404'd in production** (`src/lib/runtime-mode.ts:1-11`, enforced per-route), and the QA switcher needs a keyed cookie (`src/app/qa-unlock/route.ts:31-36`). That is rare.
- **Network failures never imply the mutation went through** - "your spot is unchanged" (`src/components/event-registration-button.tsx:203-208`), "We couldn't reach Click" with no silent retry (`src/components/event-payment-button.tsx:206-212`).

## The top 5 things to fix, in order

**1. The footer's contact address is a dead domain.**
`src/components/site-chrome.tsx:195-196` renders `mailto:hello@click.au`. A `dig` this session returns no MX and no A record for `click.au`; `letsclick.app` has an MX. Every other address in the codebase is `@letsclick.app` (`src/lib/email.ts:47`, `src/app/login/actions.ts:17`, `src/lib/event-repository.ts:685`). This is on every page, it is the only human contact route on the marketing surfaces, and Stripe is in live mode - so a refund dispute mails a black hole.
Fix: two tokens in `src/components/site-chrome.tsx:195-196`. **Minutes.**

**2. The safety exit tells people the opposite of what it does.**
"Not feeling it" shows: *"{name} isn't told, and nothing is sent. This plan just stops showing up for you."* (`src/components/coordination-drawer.tsx:359-360`). What runs is `releaseMutualForSession` (`src/lib/event-repository.ts:13437-13489`): it withdraws the proposal, invalidates both directions' clicks, sets the shared row to `released`, and installs a 90-day pair suppression. Both readers filter `m.status = 'active'` (`:12224`, `:12970`), so the other person's live plan silently vanishes mid-coordination. This is the one control someone reaches for when they feel uncomfortable, and it is the one whose stated behaviour is false.
Fix: rewrite the one description string at `coordination-drawer.tsx:360` to match the code. **Minutes.**

**3. Prices are rounded to whole dollars; Stripe charges the real number.**
`formatPrice` sets `maximumFractionDigits: 0` in both `src/app/events/[slug]/page.tsx:91-98` and `src/lib/event-repository.ts:555-562`. Merchants can enter cents - the create wizard validates "e.g. 12.50" (`src/components/event-create-wizard.tsx:184-185`). So a $12.50 event advertises "$12" everywhere including the dialog title and the pay button, and tapping "2 seats" flips the same button to "$25.00" via a different formatter (`src/components/event-payment-button.tsx:50-54, 277`). Two money formats in one control, on live Stripe.
Fix: in both helpers, `minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2` - keeps "$35" clean, shows "$12.50" honestly. **Minutes.**

**4. The post-event prompt - the whole point - is the least-built screen.**
Three cheap fixes to one card:
- No faces. `src/components/post-event-click-card.tsx:57` renders `<Avatar name={...} size={40} />` with no `src`, and `PostEventCoAttendee` (`src/lib/event-repository.ts:12557-12561`) has no `photoUrl`. With no src you get a generic silhouette, so the roster is identical grey figures. Fix: add `other.photo_url` to the select at `:12596`, the field to the type, `src=` on the Avatar.
- The window is 48 hours (`src/lib/clicks/constants.ts:11`, enforced `src/lib/event-repository.ts:12624-12625`) and the dashboard says *"No rush"* (`src/app/dashboard/page.tsx:158-161`). Nothing anywhere names a deadline until the refusal you get after missing it (`:7919`). Fix: one line - "Open for 48 hours after the event".
- The cap is 3 (`src/lib/clicks/constants.ts:15`) and the copy says *"Tap anyone you'd like to see again"* (`post-event-click-card.tsx:27-30`), surfacing as a thrown error on the fourth. Fix: "Pick up to three people you'd like to see again."

**An hour, all three.** This is the highest pain-to-cost ratio in the audit after the two one-liners above.

**5. A cancelled booking still says "You're going", and every route to it 404s.**
`getConfirmedEvents` has no cancelled filter (`src/lib/event-repository.ts:11176-11177`) while its sibling does (`:6573`). `src/components/event-card.tsx:58-70` has no Cancelled branch, so it resolves to `going` → `"You're going"` in sage with a tick (`src/components/ds.tsx:609`). Tapping it hits `notFound()` (`src/app/events/[slug]/page.tsx:159`, `PUBLIC_EVENT_STATUSES` at `:3225`), and so does the cancellation notification's own View link (`action_url` set at `src/lib/event-repository.ts:9685`). The calendar deliberately keeps cancelled events visible and links to the same dead URL (`src/components/user-calendar.tsx:178-182, 418`).
Fix: a `Cancelled` branch in `event-card.tsx:58` with a neutral `EVENT_STATUS` entry, and let a viewer who holds a seat past the gate at `page.tsx:159` so the page can say it was called off. **A few hours.**

Sixth, honourable mention because it's two strings: tapping RSVP as a new member returns `redirectTo: "/onboarding"` with no destination (`src/app/api/events/[eventId]/register/route.ts:41-46`, `checkout/route.ts:36-39`) even though the sibling 402 branch right above it already carries one, and `/onboarding` already reads `next` through `safeNext`. Finish signup and you land on `/dashboard` with the event gone.

## Everything else, by journey stage

### Arrival
- **"Request an invite" is an open signup form** - the page that explains the product says access is gated, twice, then hands over a plain form - medium (`src/app/how-it-works/page.tsx:72, 211`; `src/app/signup/page.tsx:16-19`).
- **The no-events homepage state names an action with no button** - "Take the vibe quiz now" with nothing to tap, under a name the page never uses - medium (`src/app/page.tsx:264-266`; the quiz is "Pick your vibe", `src/components/home-quiz.tsx:152`).
- **Focus ring invisible on the hero header** - purple ring over a dark photo scrim; the fix pattern already exists one block away - medium (`src/app/globals.css:662-680`, cf. `:381`).
- **Two infinite animations with no stop on touch** - the H1 word cycle and the marquee, pause on `:hover` only - medium, WCAG 2.2.2 (`src/app/globals.css:878-879, 979`). Cap the iteration count; the track is duplicated so it lands where it started.
- **Footer meta text is 2.3:1** - `--ink-faint` on cream at 12.5px, including the contact link - medium (`src/components/site-chrome.tsx:181, 185`; swap to `--slate`).
- **The empty-Discover CTA bounces to a merchant login** - `/merchant` redirects a logged-out visitor; the footer already uses `/merchant/signup` for exactly this reason - low, one word (`src/components/event-explorer.tsx:471`; `src/components/site-chrome.tsx:141-146`).
- *Not re-verified:* the streamed header shell carries `site-header--marketing` while the real signed-in header doesn't, which on `/` swaps absolute for sticky and shoves the page down (`src/components/site-chrome.tsx:22`).

### Browsing
- **Most filters vanish on Back** - only tag/category/q/date reach the URL; free, time-of-day, distance, suburb and sort are plain state - medium, the most repeated action in browsing (`src/components/event-explorer.tsx:279-283`).
- **"This weekend" includes next weekend** on Saturdays and Sundays - the implementation contradicts its own comment - medium (`:67-73`).
- **Denying the location prompt gives no feedback** - `denied` and `unsupported` are computed and never rendered, so the button is dead with no explanation - medium (`:302, 306`, only read at `:428`).
- **"Ranked by the v2 cohort model."** is the first line a signed-in user reads, on the default path - medium; the v1 fallback right below already has correct consumer copy (`src/lib/event-repository.ts:3011` vs `:3029`).
- **The "Add interests" on-ramp is switched off by default** - the v2 branch returns a hardcoded `fallback: false`, so a tag-less member gets "Picked for you" over nothing, forever - medium (`:3009`).
- **"N events on this week"** counts the entire future catalogue - medium (`src/components/event-explorer.tsx:499`).
- **Vibe tags render as kebab-case slugs** - "low-pressure", "new-to-town" - while attendee cards on the same surfaces use labels - medium; note the fix must touch all three aggregates (`:2887`, `:3345`, `:6525`) and make `matchesTag` slug-tolerant or deep links break.
- **The mobile filter sheet claims `aria-modal` with no Escape, no trap, no scroll lock** - medium; wrap it in the existing `ModalShell` with `align="sheet"` rather than hand-rolling a third copy (`:641-681`).
- **Discover runs the heaviest query twice per signed-in load** - `getPersonalizedDiscovery` calls `getEventsForExplore()` again internally - medium; wrap it in `cache()`, already imported (`src/app/discover/page.tsx:14-18`, `src/lib/event-repository.ts:2942, 2826`).
- **Every card prints an unlabelled distance from Sydney CBD** - low; the filter group *is* labelled, the card suffix isn't (`src/components/event-card.tsx:118-121`).
- **"Free" price fails AA at 3.87:1** - `--sage-ink` exists for exactly this - low (`src/components/event-card.tsx:155`).
- **A selected category leaves no chip and no badge count** - on mobile, nothing on screen shows the list is narrowed - low (`src/components/event-explorer.tsx:339-363`).
- **Result-count changes are never announced** - low, one attribute (`:569`).
- **The first card image isn't priority-loaded** - the prop exists and the homepage uses it - low (`src/app/discover/page.tsx:51-56`, cf. `src/app/page.tsx:254`).
- **Modal tag links take a redirect hop through `/events`** and can leave the URL filtered while the list isn't - low (`src/components/event-detail-modal.tsx:256`).
- **`/categories` and every `/categories/[slug]` are orphaned** - nothing in the app links to them - low; link them or delete the tree.
- *Not re-verified:* `isNightEvent` buckets on `getHours()` in the viewer's timezone while the card prints Sydney time (`src/components/event-explorer.tsx:78-80`).

### Event page
- **On mobile the booking panel is below the hero, title, tags, description and who's-going** - price and date are two screens down, with no sticky CTA - medium (`src/app/events/[slug]/page.tsx:340, 417`). Do *not* `order-first` the aside; add a mobile-only date + price line under the host line at `:352`.
- **The capacity meter counts a different set of people than the "full" check** - `totalConfirmed` vs `event.attendees` (which includes guest seats and live holds), so a party-heavy event reads "5 of 20 going" right up to "Fully booked" - medium (`:280` vs `:223`; `src/lib/event-repository.ts:15269-15278` vs `:3310-3341`).
- **The waitlist dialog describes a process that doesn't happen** - "the host will reach out via email" when it's an automated platform mail with a hard 30-minute fuse - medium (`:584-587`; `src/lib/event-repository.ts:976-1035, 8378`).
- **Every event without host copy asserts social proof** - "People with overlapping interests are attending." in a trending-icon card, a few hundred pixels below "No one has RSVP'd yet" - medium; admin approval nulls the placeholder so this fires on *every* approved merchant event (`src/lib/event-repository.ts:616, 619, 4604-4606`).
- **The description collapses to one run-on paragraph** - the host typed it into a 5-row textarea - low, one class (`:371`, `src/components/event-detail-modal.tsx:242`).
- **You can't bring anyone to a free event and the page never says so** - paid gets a 1-4 ticket picker, free gets a bare button - low, one sentence (`:648-653`).
- **Tags render as slugs beside attendee cards showing labels** - low (`:361`).
- **Coral capacity fill and sage "Free"** - status colours as page chrome - low (`:500`, `:423`).
- **The desktop 5+ gallery promotes the third photo to the hero** - the host's cover is the hero on phone, a thumbnail on desktop - low (`src/components/event-media-gallery.tsx:154-162`).
- **Times are unlabelled Sydney time** - one `timeZoneName: "short"` (`:79-83`). Don't plumb `events.timezone` - nothing writes it.
- *Not re-verified:* the host is an unlinked, unverified string even though `VerifiedTick` exists and merchants must be approved to publish (`:352-354`).

### Signup
- **No Terms or Privacy link anywhere on the auth surfaces** - `ChromeGate` strips the footer on `/login`, `/register`, `/signup`, `/onboarding`, `/auth/email/verify`, and this flow takes birth date, postcode, dating intent and a face - medium (`src/components/chrome-gate.tsx:31-44`). Cheapest: one line of fine print in `AuthShell`'s footer slot.
- **"Check your inbox" never names the inbox, can't resend, doesn't mention the 15-minute clock** - and on `/login` the redirect wipes what you typed - medium (`src/app/login/page.tsx:107-109, 145-153`; TTL at `src/lib/auth-magic-link.ts:7`). The modal's "Email sent" label is also stale after you edit the address (`src/components/login-modal.tsx:283`).
- **"Create your account" and "Log in instead" throw away the callbackUrl** - both pages computed one and neither interpolates it - medium (`src/app/login/page.tsx:81`, `src/app/register/page.tsx:65`; same at `claim/[token]/page.tsx:113`).
- **"Email sent" is never announced to screen readers** - `AuthNote` has no role while its sibling `AuthError` does - medium (`src/components/auth-ui.tsx:231-240`).
- **The RSVP gate greets a first-timer with "Welcome back"** - low; seed the modal's mode from the opening intent (`src/components/login-modal.tsx:58`).
- **Step labels contradict the counter** - "Step three" beside "4 of 5", and "Three steps, start to finish" beside a five-step bar - low (`src/components/onboarding-form.tsx:116-148, 577, 631`).
- **`/forgot-password` contradicts itself** - talks about passwords that don't exist, uses the word "MVP", and its own success panel is unreachable because the form posts no `formPath` - low (`src/app/forgot-password/page.tsx:29, 48-78`). The load-bearing half is turning `src/app/login/page.tsx:159-164` into plain helper text.
- **A mistyped birth date silently blanks itself** - low, one error string in the picker's own footprint (`src/components/birth-date-picker.tsx:274-275`).
- **The modal autofocuses the email field, pushing "Continue with Google" off screen on Android** - low; focus the dialog card instead, don't delete the line - it's the modal's only focus management (`src/components/login-modal.tsx:91`).
- **An expired link drops the destination** - even a successful retry lands on the dashboard - low (`src/app/auth/email/verify/actions.ts:10-13`); the plain submit button also has no pending state (`verify/page.tsx:28-34`).

### Booking & payment
- **`?booked=1` with no confirmed seat says nothing about the money** - you either get "Complete payment to lock it in" with another pay button or the plain RSVP button - medium. The copy already exists (`getUnfulfilledPaymentNotice`, `src/lib/event-repository.ts:1072`) but is only wired into a branch this case never reaches (`src/app/events/[slug]/page.tsx:167`). A second tap is guarded, so this is wrong copy rather than a double charge.
- **Escape inside Stripe closes the booking dialog too and wipes every guest row** - both `ModalShell`s register a document listener with no stacking - medium, ~5 lines (`src/components/modal-shell.tsx:153-158, 188`). The checkout modal literally instructs it: "Press Esc to cancel" (`src/components/event-checkout-modal.tsx:124`).
- **Naming a +1 then unticking "Name your +1s" blocks payment** - the error points at a consent checkbox that is no longer mounted - medium, one `onChange` (`src/components/event-payment-button.tsx:310-317`).
- **The dialog you commit to pay in says "Cancel anytime before the event"** while the tiered policy (100% / 50% / nothing inside 24h) sits behind the scrim - medium, one string (`src/app/events/[slug]/page.tsx:617`, policy at `src/lib/refund-policy.ts:45-55`, honest line at `:665`).
- **A paid waitlist offer shows no countdown** - the mm:ss timer is fully built and just isn't passed `offerExpiresAt`; the free path two lines below gets one - medium (`:553-566` vs `:568-575`). Interpolate the time into the panel copy; don't add the second CTA.
- **Sage-on-sage at 3.31:1 on the "a seat opened up" panel** - `--sage-ink` already exists and is already used over the identical 14% mix - medium, one token (`:557`).
- **Closing the Stripe modal gives no feedback and the 31-minute hold is never dated** - low (`src/components/event-payment-button.tsx:255-258`); one non-error message in the existing slot, not a new query field.
- **"Leave waitlist" is one unconfirmed tap under "Confirm your spot"** - it deletes the queue row and rolls the seat on - low; route it through the existing `onCancelClick` (`src/components/event-registration-button.tsx:341`).
- **Joining a waitlist leaves the modal open with the button flipped in place** - the queue position is behind the scrim - low (`:136-141`, position at `page.tsx:523-528`).
- **The Discover quick-view quotes the pre-fee price** - latent while `booking_fee_bps` is 0, a real mismatch the day it isn't - low (`src/components/event-detail-modal.tsx:287, 319`).
- **Em-dashes in the refund label and checkout errors** - the two highest-stakes strings in the product - low (`src/lib/refund-policy.ts:79-81`; `src/lib/event-repository.ts:10037, 10069, 10079, 10236, 10960`).
- *Not re-verified:* the coral capacity fill (`src/app/events/[slug]/page.tsx:500`) as a booking-panel DS violation.

### After booking
- **An event that has already started drops out of Upcoming** - `getConfirmedEvents` buckets on `starts_at` while the dashboard uses `coalesce(ends_at, starts_at)`, so at 8pm the 7pm event is "Past" on one page and "You're going" on the other - medium, two tokens (`src/lib/event-repository.ts:11177, 11193`).
- **The "Saved & waitlist" section contains no waitlist** - the rows are fetched two lines away and never read; with no bookmarks it says "Nothing saved yet" - medium (`src/app/dashboard/page.tsx:353`, data at `src/lib/event-repository.ts:6580-6596, 6625`).
- **Cancelling a free RSVP is one tap with no confirmation** - the paid path gets a careful two-step with the refund spelled out; free is most of the catalogue and the seat rolls straight to the next waitlister - medium, 3 lines (`src/components/event-registration-button.tsx:262-268`).
- **The month grid is unreadable on a phone** - ~42px cells, ~30px of chip text, and it leads the page the post-booking banner sends you to - medium; hide the chip text below `sm` and show a dot, the agenda list already carries the detail (`src/components/user-calendar.tsx:305, 360, 417-426`).
- **Agenda rows badge your booking with the event's moderation status** - "Live", "Featured", "Locked" in confirmed sage, while the grid directly above says "You're going" - medium, one line (`src/components/event-agenda-list.tsx:79`).
- **Four destinations for "my bookings", with four names** - "Events" / "Your events" / "Calendar" / "Bookmarks", two of them duplicates - medium; rename "Bookmarks" → "Saved" and drop it or point it at `?tab=saved` (`src/components/header-role-switcher.tsx:27-29`). Leave `/dashboard/calendar` alone - it also runs `reconcileCheckoutSession`.
- **A rejected post-event click renders in the same grey `role="status"` as a success** - you're left ambiguous, not falsely confirmed, but on this screen that's still wrong - low, one ternary (`src/components/post-event-click-card.tsx:80-84`).
- **"Read the email" can dead-end on a developer's TODO** - "the trigger that created it hasn't been wired to `logEmailEvent` yet", reachable from real attendee notifications - low, copy only (`src/app/notifications/[id]/email/page.tsx:138-142`).
- **`/notifications` promises event reminders it never puts in the feed** - `sendEventReminders` only logs an email - low, drop three words (`src/app/notifications/page.tsx:40`; `src/lib/event-repository.ts:15103-15201`).
- **The Waitlist tab never shows your position** - low; make a waitlisted card link straight to the event page rather than plumbing a new column (`src/components/event-detail-modal.tsx:165`).
- **The bell badge says "9+" while its accessible name says "37"** - low, one variable (`src/components/header-notifications-bell.tsx:12, 27`).
- **The mutual-click "Add to calendar" produces an entry with no venue and a made-up 2h block** - point it at the .ics route that already carries LOCATION and URL; net deletion - low (`src/components/coordination-drawer.tsx:47-56, 473`).

### The click layer
- **No deadline is ever shown anywhere** - `expiresAt` is fetched and never rendered in any of the three surfaces; the 48-hour and 7-day clocks are disclosed only in the refusal after you miss them - medium (`src/lib/event-repository.ts:13007`; zero render sites across `coordination-drawer.tsx`, `clicks-list.tsx`, `people/page.tsx`).
- **The coordination surfaces have no faces either** - `getMutualClicksForSession` returns `otherPhotoUrl` and `/people` renders `<Avatar name={name} />` with no `src`, so the mutual reveal and "See you there" are pure text - medium; the `/people` half is a wiring bug, fix that alone (`src/lib/event-repository.ts:12241`, `src/app/people/page.tsx:204`).
- **A lapsed mutual vanishes with no trace and no notice** - `expireClickLifecycles` sends nothing, and both readers filter `status = 'active'`, so the "This plan wound down" screen is real code that can never run for a mutual-clock lapse - medium; admit recently-expired rows in `getProposalsForSession` only (`src/lib/event-repository.ts:8342-8346, 12970`).
- **The greyed-out "Suggest alternative" is never explained** - and the *other* side keeps an enabled button that fails server-side, so there are two unexplained dead ends - medium, one conditional line shown to both (`src/components/coordination-drawer.tsx:592-599`).
- **Every "How clicking works" link lands on a marketing page that deliberately doesn't explain it** - and offers a logged-in member "Request an invite", twice - medium; add two sentences to the existing "The bonus" section (`src/app/how-it-works/page.tsx:9-11, 109-124`). The page that does explain it is behind a production 404 (`src/app/test-click/page.tsx:43`).
- **"Here for" intents are described as a private tuning dial** - they're on your public profile, on your card in strangers' feeds, and in the mutual reveal line - low, one string (`src/components/profile-edit-form.tsx:566`).
- **`/people` rows say "See their plan →" and link to the bare list** - low; the deep link exists and the notifications already use it (`src/app/people/page.tsx:222`; `src/components/clicks-list.tsx:92-93`).
- **`suggestionUnavailable` is computed with a comment promising the card will explain it, and nothing reads it** - so a sold-out suggested event just disappears - low (`src/lib/event-repository.ts:13003-13005`).
- **Two pages both titled "Your clicks"** with different state vocabularies - low, rename one heading (`src/app/people/page.tsx:116` vs `src/app/proposals/page.tsx:31`).
- **Em-dashes and a capital-C verb in click errors** - "You cannot Click yourself.", "The window to click people from this event has closed —" - low, three strings (`src/lib/event-repository.ts:7787, 7919, 7972`).

### Trust & polish
- **The internal bug widget ships to every production visitor** - a periwinkle pill over every route including checkout, panel copy about "the AI fixer", `role="dialog" aria-modal="true"` with no focus management at all - medium (`src/app/layout.tsx:169`, unconditional while both neighbours are gated; `src/components/support/support-widget.tsx:24, 493, 510-513, 562`). Gate it and the whole design-system + copy + a11y list disappears in one line.
- **The save-event star fails silently and can deaden itself for the session** - the error message renders only in the non-star branch, and an unguarded `response.json()` inside an un-try/caught handler leaves `state` stuck at `"submitting"`, which disables the button - medium (`src/components/event-bookmark-button.tsx:25-51, 53-80`). try/catch + `finally` + a toast.
- **Block and mute silently do nothing on an expired session** - four bare `return`s where the report path's own comment explains why that's unacceptable; the ConfirmDialog closes and the page refreshes as if it worked - medium (`src/app/profile/[userId]/actions.ts:23, 33, 43, 52` - and `:61` on the report path too).
- **Member profiles are publicly readable and indexable** - `robots.ts` disallows `/profile/edit` but not `/profile`, and the page has no `robots: { index: false }` - medium, two lines (`src/app/robots.ts:17-28`, `src/app/profile/[userId]/page.tsx:9-11`). Don't gate the page - the signed-out branch is deliberate.
- **A resolved report silently reverts to a plain "Report" button** - `getSafetyState` computes `reported` from `status = 'open'`, and `resolveReport` sends nothing - medium; fix the expectation in copy, not with a new email template (`src/components/profile-safety-controls.tsx:122-126`).
- **"Delete account · coming soon" is disabled with no alternative offered**, while `/privacy` says the email route works today - low, one sentence (`src/app/account-settings/page.tsx:245`).
- **The error page hands out a ref with nowhere to send it** - low, one line (`src/app/error.tsx:36-40`).
- **Two rendered en-dashes** - `refund-policy/page.tsx:82`, `birth-date-picker.tsx:439`. Worth doing only because it makes the rule grep-enforceable.

## What I would NOT do

- **Don't unhide the `MutualToast` on mobile, and don't add nav links to the logged-out header.** Both are documented decisions (`src/components/site-chrome.tsx:50-54`; the toast is an absolutely-positioned flourish in dead space beside a 760px hero). The mechanic is already explained in prose on mobile at `src/app/page.tsx:116-118`. Fix the comprehension gap by extending the subhead by one clause, not by re-architecting the hero.
- **Don't paginate Discover or build the map.** The catalogue query has no LIMIT and ships every description to the browser (`src/lib/event-repository.ts:2906-2907`), but there are no events. And `description`/`relationshipGoal` *are* read on that surface for the modal's instant open (`src/components/event-detail-modal.tsx:98-106, 243`), so trimming the select ships a regression. `src/components/event-map.tsx` is dead pre-redesign code carrying coral CTAs - delete it or comment it, don't wire it back in.
- **Don't add "incl. GST" to the booking panel.** GST is inclusive, computed off the amount already charged (`src/lib/event-repository.ts:1502-1503`), and `src/app/terms/page.tsx:149-150` says Click is not registered for GST. Stamping it on listings asserts a tax position the platform disclaims. If anything needs attention it's the receipt's unconditional GST row, and that's a finance question.
- **Don't restyle the bug widget, and don't route it through `ModalShell`.** `ModalShell`'s `align` union has no `"right"` variant (`src/components/modal-shell.tsx:56-62`), so both are bigger than they look. Gate it out of production and every one of those findings evaporates.