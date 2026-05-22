import { getEventsForExplore } from "@/lib/event-repository";
import TestPageClient, {
  type RouteGroup,
} from "./TestPageClient";

export const metadata = {
  title: "Test routes | Click",
  description: "Index of every page in the app for manual QA.",
};

export default async function TestPage() {
  const events = await getEventsForExplore();
  const sampleSlug = events[0]?.id ?? "sample-event";
  const paidEvent = events.find((event) => event.price !== "Free");
  const paidSlug = paidEvent?.id ?? sampleSlug;
  const lockedEvent = events.find((event) => event.status === "Locked");
  const lockedSlug = lockedEvent?.id ?? sampleSlug;
  const waitlistEvent = events.find((event) => event.status === "Waitlist");
  const waitlistSlug = waitlistEvent?.id ?? sampleSlug;

  const groups: RouteGroup[] = [
    {
      heading: "Public",
      routes: [
        {
          href: "/",
          label: "Home",
          notes: "Landing page hero + AI prompt.",
          checks: [
            {
              label: "No moving banner at the top",
              description:
                "We removed the marquee strip — if you see scrolling capital-letter text, the change didn't ship.",
            },
            {
              label: "Subtitle is short",
              description:
                'Should read "Show up twice. Become familiar." If you see longer copy about "low-pressure ways to meet", the trim regressed.',
            },
            {
              label: "Events grid populated",
              description:
                "Below the hero, real seed events render as cards. Empty = Postgres connection is dead.",
            },
            {
              label: "Header Login button when logged out",
              description:
                "Right side of nav. Disappears when signed in and is replaced with a profile menu.",
            },
          ],
        },
        {
          href: "/events",
          label: "Events grid",
          notes: "Browse all live events.",
          checks: [
            {
              label: "20+ event cards from seed",
              description:
                "Seed file loads ~20 events. Fewer than 5 = seed wasn't applied or events are in 'pending' status.",
            },
            {
              label: "Card image is a link",
              description:
                "Clicking the image (not just the title) navigates to /events/[slug] — added in this MVP.",
            },
            {
              label: "Card title is a link",
              description:
                "Title also navigates to the detail page. Both targets exist so the click target is large.",
            },
            {
              label: "Prices render correctly",
              description:
                'Free events show "Free", paid show the dollar amount (e.g. $22). Mixed in the grid.',
            },
          ],
        },
        {
          href: `/events/${sampleSlug}`,
          label: "Event detail (free, sample)",
          notes: `Detail page for "${events[0]?.title ?? sampleSlug}".`,
          checks: [
            {
              label: "Full description renders",
              description:
                "Long-form event description shown in full — not the truncated card version.",
            },
            {
              label: "Date / time / suburb / capacity bar",
              description:
                "All four are visible in the right rail. Capacity bar fills proportional to confirmed attendees.",
            },
            {
              label: "Hero image without layout shift",
              description:
                "next/image with priority loading — the image should pop in immediately, not cause the page to jump.",
            },
            {
              label: 'Green "RSVP" button',
              description:
                "For a free event the CTA is the green Register/RSVP button, NOT the rose Stripe pay button.",
            },
          ],
        },
        {
          href: `/events/${paidSlug}`,
          label: "Event detail (paid, sample)",
          notes: paidEvent
            ? `Paid event "${paidEvent.title}" at ${paidEvent.price}.`
            : "Paid sample. Without Stripe env vars set, shows fail-closed hint.",
          checks: [
            {
              label: "Price shows the paid amount",
              description:
                "Right rail price card displays the dollar value (e.g. A$22), not 'Free'.",
            },
            {
              label: "Pay button when Stripe is configured",
              description:
                "If STRIPE_SECRET_KEY is set, the CTA is rose 'Reserve & pay A$N'. Different colour and copy from the free RSVP button.",
            },
            {
              label: "Fail-closed when Stripe is missing",
              description:
                "If STRIPE_SECRET_KEY is unset, the button is replaced with a dashed hint saying 'Stripe isn't configured'. No broken-button states.",
            },
            {
              label: "Pay redirects to checkout.stripe.com",
              description:
                "Click the pay button → URL bar changes to checkout.stripe.com/... and shows your event title + price on Stripe's hosted page.",
            },
          ],
        },
        {
          href: `/events/${lockedSlug}`,
          label: "Event detail (locked, sample)",
          notes: lockedEvent
            ? `Locked event "${lockedEvent.title}".`
            : "Locked sample (only present if seed has one).",
          checks: [
            {
              label: 'Status pill reads "Locked"',
              description:
                "Top-left corner of the hero image. If you see 'Live' instead, you're not on a locked event.",
            },
            {
              label: "Address hidden before RSVP",
              description:
                "Location section shows 🔒 + suburb only. The street address is not in the rendered HTML (verify via view-source if needed).",
            },
            {
              label: "Address revealed after RSVP",
              description:
                "RSVP then refresh — the full venue + address should now appear. This tests the viewerRsvpStatus query.",
            },
          ],
        },
        {
          href: `/events/${waitlistSlug}`,
          label: "Event detail (waitlist, sample)",
          notes: waitlistEvent
            ? `Waitlist event "${waitlistEvent.title}".`
            : "Waitlist sample (only present if seed has one).",
          checks: [
            {
              label: 'Status pill reads "Waitlist"',
              description:
                "Either the event is explicitly marked Waitlist OR it's full. Either way the pill should reflect it.",
            },
            {
              label: 'CTA is "Join waitlist", not pay',
              description:
                "Waitlist takes precedence over the pay button. Peach button, no Stripe redirect.",
            },
            {
              label: "Waitlist is always free",
              description:
                "Even for a paid event, joining the waitlist costs nothing. Confirms paid events aren't bypassing Stripe by going waitlist.",
            },
          ],
        },
        {
          href: "/discover",
          label: "Discover",
          notes: "AI prompt + recommendations.",
          checks: [
            {
              label: "Animated placeholder cycles",
              description:
                "Input field shows prompts being typed and deleted. If it's static, the useEffect typewriter broke.",
            },
            {
              label: "Submit re-ranks the grid",
              description:
                "Type something like 'food friends' and submit — the events below should re-order based on tag matching.",
            },
            {
              label: "People recommendations below events",
              description:
                "Bottom section shows seeded people cards with intent, suburb, shared event suggestion.",
            },
          ],
        },
        {
          href: "/login",
          label: "Login",
          notes: "OAuth + credentials sign-in.",
          checks: [
            {
              label: "OAuth buttons when env vars are set",
              description:
                "Google + Facebook buttons render only if AUTH_GOOGLE_ID / AUTH_FACEBOOK_ID are configured. Missing = no button (not a broken button).",
            },
            {
              label: "Email + password works in dev",
              description:
                "Credentials provider accepts any email + the AUTH_EMAIL_PASSWORD dev value. Real password matching is not enforced for the MVP.",
            },
            {
              label: "Redirects to callbackUrl on success",
              description:
                "If you arrived via a protected page, you return there after login. Otherwise lands on /dashboard.",
            },
          ],
        },
        {
          href: "/forgot-password",
          label: "Forgot password",
          notes: "Password reset flow.",
          checks: [
            {
              label: "Page renders without error",
              description:
                "Just confirms the route exists and isn't crashing — real reset isn't wired in dev (no email sender).",
            },
            {
              label: "Form accepts an email",
              description:
                "Submit doesn't 500. In production this would queue a reset email via Resend/SendGrid.",
            },
          ],
        },
      ],
    },
    {
      heading: "Attendee onboarding",
      routes: [
        {
          href: "/login",
          label: "Step 1 — Sign in or auto-register",
          notes:
            "There is no separate signup page. First-time email sign-in via the credentials provider auto-creates a profile row.",
          checks: [
            {
              label: "Use a brand-new email",
              description:
                "Pick an email that's never logged in before. Use the dev password from AUTH_EMAIL_PASSWORD env var.",
            },
            {
              label: "Lands logged in",
              description:
                "After submit you should arrive on the home/dashboard. No 'account not found' error — first-time login auto-provisions.",
            },
            {
              label: "Profile row exists",
              description:
                "DB check: `select email, role from profiles where email='<you>'` should return a row with role='attendee'.",
            },
          ],
          auth: "none",
        },
        {
          href: "/onboarding",
          label: "Step 2 — Complete attendee profile",
          notes:
            "Required: display name, suburb, bio. Optional: age, intents, interest tags. Until saved, the dashboard banner persists.",
          checks: [
            {
              label: "Form prefills your name",
              description:
                "Display name field pre-populated from your email or OAuth profile. Editable.",
            },
            {
              label: "Empty suburb/bio shows validation error",
              description:
                "Submitting blank required fields → server returns 400 with a friendly message. Don't get a generic 500.",
            },
            {
              label: "Save redirects to /dashboard",
              description:
                "On success, you bounce to /dashboard and the 'Finish your profile' banner is gone.",
            },
            {
              label: "Intent chips persist",
              description:
                "Selected intents (dating / friendship / networking / exploring) survive a page reload. Stored in profiles.connection_intents.",
            },
            {
              label: "Tags appear in DB",
              description:
                "Comma-separated tags you typed end up in `user_tags`. Each new tag also gets inserted into `tags` if it doesn't exist.",
            },
          ],
          auth: "user",
        },
        {
          href: "/dashboard",
          label: "Step 3 — Confirm onboarding complete",
          notes: "Dashboard should no longer show the 'Finish your profile' banner.",
          checks: [
            {
              label: "No yellow banner",
              description:
                "If the rose 'Finish your profile' banner is still visible, the suburb/bio fields didn't save.",
            },
            {
              label: 'Status card reads "attendee"',
              description:
                "Third metric card at the top. Confirms your role wasn't accidentally promoted to merchant/admin.",
            },
            {
              label: "Become a host banner appears",
              description:
                "Below the metrics. Confirms you haven't done merchant signup yet. Clicking it goes to /merchant/signup.",
            },
            {
              label: "Upcoming RSVPs populates",
              description:
                "If you've RSVP'd to any event, it shows under Upcoming. Empty state copy if not.",
            },
          ],
          auth: "user",
        },
      ],
    },
    {
      heading: "Logged-in user",
      routes: [
        {
          href: "/dashboard",
          label: "Dashboard",
          notes: "RSVPs, saved events, onboarding nudges.",
          checks: [
            {
              label: "Greeting uses first name",
              description:
                "Hero text reads 'Hi <FirstName>.' Falls back to email if display name is just the email itself.",
            },
            {
              label: "Four metric cards",
              description:
                "Upcoming / Saved / Status / Radar across the top. Values should match your actual DB state.",
            },
            {
              label: '"View calendar" link',
              description:
                "Near the Upcoming heading — peach pill linking to /dashboard/calendar. Easy to miss but is the entry point to the month grid.",
            },
            {
              label: "Empty states render gracefully",
              description:
                "0 RSVPs and 0 bookmarks should show friendly copy + 'Find events' button, not crashes.",
            },
          ],
          auth: "user",
        },
        {
          href: "/dashboard/calendar",
          label: "Booking calendar",
          notes: "Month-grid of your booked events.",
          checks: [
            {
              label: "Month-grid renders (Sydney TZ)",
              description:
                "Week starts Monday, Sydney timezone. If today is highlighted on the wrong day, timezone is off.",
            },
            {
              label: "Month navigation works",
              description:
                "Prev / Today / Next arrows update the visible month. Browser URL changes to ?month=YYYY-MM.",
            },
            {
              label: "Event chips on correct day",
              description:
                "Each booked event appears as a peach/ink chip on its date. Chip is a link to /events/[slug].",
            },
            {
              label: "Toast appears after paying",
              description:
                "After a successful Stripe purchase you land on ?booked=<slug> and see a peach 'You\\'re in for ...' banner at the top of the calendar.",
            },
            {
              label: "Empty state when no RSVPs",
              description:
                "Brand-new account → 'No bookings yet' card under the calendar, not a crash.",
            },
          ],
          auth: "user",
        },
      ],
    },
    {
      heading: "Merchant onboarding",
      routes: [
        {
          href: "/dashboard",
          label: "Step 1 — Find the 'Become a host' banner",
          notes:
            "After onboarding, the dashboard surfaces a 'Become a host' nudge pointing at /merchant/signup.",
          checks: [
            {
              label: "Peach banner visible",
              description:
                "Between the metric cards and the Upcoming events section. Says 'Host events?' eyebrow.",
            },
            {
              label: "CTA links to /merchant/signup",
              description:
                "Click 'Become a host' → lands on the signup form. Same URL whether you reach it from here or directly.",
            },
            {
              label: "Banner swaps after signup",
              description:
                "Once you complete merchant signup, this banner is replaced with 'Hosting as <business name>' (cream tone).",
            },
          ],
          auth: "user",
        },
        {
          href: "/merchant/signup",
          label: "Step 2 — Merchant profile form",
          notes:
            "Required: business name + contact email. Optional: website, ABN. Inserts into merchant_profiles and promotes your role to 'merchant'.",
          checks: [
            {
              label: "Form renders empty or prefilled",
              description:
                "New merchants see empty fields. Returning merchants see their existing row prefilled (upsert).",
            },
            {
              label: "Empty business name = error",
              description:
                "Server returns 400 with a clear message. Don't accept blank business names.",
            },
            {
              label: "Success redirects to /merchant",
              description:
                "After save you bounce to the merchant dashboard with the new merchant profile loaded.",
            },
            {
              label: "Role promoted in DB",
              description:
                "`select role from profiles where email='<you>'` → 'merchant'. Was 'attendee' before signup.",
            },
            {
              label: "Verification stays pending",
              description:
                "`select verification_status from merchant_profiles where contact_email='<email>'` → 'pending'. Admin must approve manually.",
            },
          ],
          auth: "user",
        },
        {
          href: "/merchant",
          label: "Step 3 — Merchant dashboard",
          notes:
            "Calendar + events panel + create-event form. New merchants see empty state until they create their first event.",
          checks: [
            {
              label: "Merchant calendar grid renders",
              description:
                "Same month-grid shape as the user calendar but filtered to YOUR hosted events. Empty for new merchants.",
            },
            {
              label: "Events panel below the grid",
              description:
                "Table of your events with confirmed/capacity, waitlist, price, status. Empty state copy if none.",
            },
            {
              label: "Metric cards at the top",
              description:
                "Total events, fill rate, revenue, pending count. Zero values for a new merchant — confirm no division-by-zero crashes.",
            },
            {
              label: "Create-event form works",
              description:
                "Fill title, date, suburb, capacity, price → submit. New event appears in the panel with status 'Pending', awaiting admin approval.",
            },
            {
              label: "Pending events hidden from /events",
              description:
                "Open /events as an attendee — your new event should NOT appear until an admin approves it. Tests the status filter.",
            },
          ],
          auth: "merchant",
        },
        {
          href: `/merchant/events/${sampleSlug}`,
          label: "Step 4 — Event detail (host view)",
          notes:
            "Attendee list for one of YOUR events. Replace the sample slug with your own event's slug after creating one.",
          checks: [
            {
              label: "Header shows event title + status + dates",
              description:
                "Top of the page mirrors the public detail page header but is host-focused.",
            },
            {
              label: "Confirmed + waitlist counts",
              description:
                "Two badges showing how many people are in vs on the list. Pending-payment holds are excluded from both.",
            },
            {
              label: "Attendee table populates",
              description:
                "Names, emails, RSVP status, RSVP timestamp. Confirmed rows first, then waitlisted.",
            },
            {
              label: "Other merchants' events 404",
              description:
                "Hit /merchant/events/someone-elses-slug → not found. Confirms ownership check.",
            },
          ],
          auth: "merchant",
        },
      ],
    },
    {
      heading: "Admin",
      routes: [
        {
          href: "/admin",
          label: "Admin console",
          notes:
            "Approve pending events, review merchants, audit log. Access gated by ADMIN_EMAILS env var (default admin@click.local).",
          checks: [
            {
              label: "Top-level totals render",
              description:
                "Members / merchants / events / RSVPs counts at the top. Sanity check they're not all zero (= broken query).",
            },
            {
              label: "Pending events queue shows pending events",
              description:
                "Any event with status='pending' (typically newly-created merchant events) is listed here.",
            },
            {
              label: "Approve flips status to Live",
              description:
                "Click approve → row disappears from queue and the event becomes visible on /events. An audit_logs row is inserted.",
            },
            {
              label: "Merchant table loads",
              description:
                "Business name, verification status, contact, events-hosted count. Easy to scan for pending merchants.",
            },
            {
              label: "Non-admin emails get bounced",
              description:
                "Log in as a regular user, visit /admin → redirected away. Tests the role gate.",
            },
          ],
          auth: "admin",
        },
        {
          href: "/admin?tab=analytics",
          label: "Admin → Analytics tab",
          notes:
            "30-day trend charts: new members, RSVPs, events created, paid revenue. Pure SVG (no Recharts dep).",
          checks: [
            {
              label: "Analytics tab is visible in the workspace pill bar",
              description:
                "Pill labelled 'Analytics' between 'Overview' and 'Members'. Click to switch panel.",
            },
            {
              label: "Four trend charts render with axes",
              description:
                "New members / RSVPs / Events created / Revenue. Each shows a polyline over the last 30 days plus the latest value.",
            },
            {
              label: "Totals match the chart sums",
              description:
                "Metric cards above the charts show summed totals over the same 30-day window. Eyeball the chart and the card should agree.",
            },
            {
              label: "Top categories bar chart renders",
              description:
                "Horizontal bars below the line charts, longest = most-used category. Empty state if no events yet.",
            },
            {
              label: "Empty database = empty state",
              description:
                "Fresh DB (no profiles/events) → charts show 'no data yet' or 30-day series of zeros without crashing.",
            },
          ],
          auth: "admin",
        },
      ],
    },
    {
      heading: "New: public pages",
      routes: [
        {
          href: "/how-it-works",
          label: "How it works",
          notes:
            "Dedicated explainer page: 3-step flow, benefits, testimonials, ink CTA at the bottom.",
          checks: [
            {
              label: "PageHero renders with primary + secondary CTA",
              description:
                "Logged-out: 'Sign in to start' + 'Or just explore'. Logged-in: 'Browse events' instead.",
            },
            {
              label: "Three numbered step cards",
              description:
                "Step 1 (Pick), Step 2 (RSVP), Step 3 (Show up) — each in an InfoCard with its accent bar.",
            },
            {
              label: "Benefits grid renders",
              description:
                "Two-column on desktop, four cards with bold titles and short bodies. Cream background section.",
            },
            {
              label: "Testimonials section",
              description:
                "Three figure blocks with quotes, names, and suburb pills. Don't link anywhere — purely social proof.",
            },
            {
              label: "Bottom CTA on ink background",
              description:
                "Dark section at the bottom with a single LinkButton matching the hero CTA. No layout shift.",
            },
          ],
        },
        {
          href: "/this-route-does-not-exist",
          label: "404 page",
          notes:
            "Global not-found.tsx renders for any unmatched route. Should look on-brand.",
          checks: [
            {
              label: "Custom 404 instead of Next default",
              description:
                "Paper-noise background, peach sticker reading '404', display headline. NOT the bare Next.js 'This page could not be found' text.",
            },
            {
              label: "Two CTAs work",
              description:
                "'Back home' → /, 'Browse events' → /events. Both styled as pill buttons.",
            },
          ],
        },
      ],
    },
    {
      heading: "New: user pages",
      routes: [
        {
          href: "/bookmarks",
          label: "Saved events (bookmarks)",
          notes:
            "Dedicated list of bookmarked events. /saved-events is an alias that redirects here.",
          checks: [
            {
              label: "All bookmarked events render as cards",
              description:
                "Two-column grid on desktop. Bookmark icon already shows as filled because they're saved.",
            },
            {
              label: "Category pills appear when bookmarks exist",
              description:
                "Above the grid: a row of category pills derived from your saved events. Quick visual summary.",
            },
            {
              label: "Empty state with CTA",
              description:
                "Brand new account → 'Nothing saved yet' card + 'Browse events →' button. Not a crash.",
            },
            {
              label: "/saved-events redirects here",
              description:
                "Type /saved-events in the URL bar — you land on /bookmarks. Confirms the alias.",
            },
          ],
          auth: "user",
        },
        {
          href: "/confirmed-events",
          label: "Confirmed events (Upcoming tab)",
          notes: "Events you've RSVP'd to, split into Upcoming / Past tabs.",
          checks: [
            {
              label: "Two tab pills with counts",
              description:
                "Upcoming and Past, each with a small badge showing the count. Active tab is ink-coloured.",
            },
            {
              label: "Upcoming shows only events with starts_at >= now",
              description:
                "If you RSVP'd to an event yesterday, it should NOT appear here — it should be on the Past tab instead.",
            },
            {
              label: "registered badge on cards",
              description:
                "EventCard shows the 'Confirmed' / RSVP'd visual state since you're registered.",
            },
            {
              label: "Empty state copy switches by tab",
              description:
                "Past tab empty: 'Nothing in the rear-view.' Upcoming empty: 'No plans on the calendar.'",
            },
          ],
          auth: "user",
        },
        {
          href: "/confirmed-events?tab=past",
          label: "Confirmed events (Past tab)",
          notes: "Same page, ?tab=past selected. Should deep-link cleanly.",
          checks: [
            {
              label: "Past tab is active on direct load",
              description:
                "Visiting /confirmed-events?tab=past lands with Past selected. URL drives state, not just clicks.",
            },
            {
              label: "Only past events listed",
              description:
                "Each card here has starts_at < now. If you see a future event, the split logic is off.",
            },
          ],
          auth: "user",
        },
        {
          href: "/events?category=Food&date=7&sort=soonest",
          label: "Events filters — URL sync",
          notes:
            "EventExplorer filters now persist in the URL (?search, ?category, ?suburb, ?date, ?distance, ?sort).",
          checks: [
            {
              label: "Filters apply on page load",
              description:
                "Loading this URL pre-selects category=Food, date window=7 days, sort=soonest. List is filtered without clicking.",
            },
            {
              label: "Changing a filter updates the URL",
              description:
                "Pick a different category in the sidebar → ?category=... in the URL updates without reload. router.replace, not router.push.",
            },
            {
              label: "Resetting filters clears the URL",
              description:
                "Click 'Reset Filters' → URL drops back to /events with no query string. All defaults restored.",
            },
            {
              label: "Bookmarking the URL preserves filters",
              description:
                "Open /events?category=Food in a fresh tab — the filter is applied. Confirms the round-trip.",
            },
          ],
        },
        {
          href: "/account-settings",
          label: "Account settings — Account tab",
          notes:
            "5 tabs total: Account / Notifications / Privacy / Payments / Security. Account is the default tab.",
          checks: [
            {
              label: "Tabs render as pill row, active is ink-coloured",
              description:
                "Pill nav with five items. The active tab is dark; others are cream and hover to peach.",
            },
            {
              label: "Form prefills from your profile",
              description:
                "Display name, suburb, age, bio come from the DB. Intent chips reflect connection_intents.",
            },
            {
              label: "Save updates the DB",
              description:
                "Change suburb → 'Save changes' → toast 'Account updated.' Reload — value persists.",
            },
            {
              label: "Toast on save",
              description:
                "Sonner toast top-right with the success message. Errors show as red toasts.",
            },
          ],
          auth: "user",
        },
        {
          href: "/account-settings?tab=notifications",
          label: "Account settings — Notifications",
          notes:
            "Toggles for event reminders, mutual clicks, weekly picks, host announcements. Stored in localStorage for now.",
          checks: [
            {
              label: "Four toggles render",
              description:
                "Each in its own card with a label, body, and switch. Initial states match the defaultValue per option.",
            },
            {
              label: "Toggle persists across reload",
              description:
                "Flip one off, reload — it stays off. Stored under 'click:notification-prefs' in localStorage.",
            },
            {
              label: "Toast fires on every toggle",
              description:
                "Each click shows 'Preference saved.' — confirms the save path is wired.",
            },
          ],
          auth: "user",
        },
        {
          href: "/account-settings?tab=privacy",
          label: "Account settings — Privacy",
          notes:
            "Toggles for dating visibility, flexible discovery, public-attended events, public suburb. localStorage-backed.",
          checks: [
            {
              label: "Four privacy toggles render",
              description:
                "Same toggle component as Notifications, different copy. Storage key: 'click:privacy-prefs'.",
            },
            {
              label: "Defaults are sensible",
              description:
                "Dating visibility OFF by default. Suburb visible ON. Attended events visible ON.",
            },
          ],
          auth: "user",
        },
        {
          href: "/account-settings?tab=payments",
          label: "Account settings — Payments",
          notes:
            "Placeholder section: cards are added during checkout via Stripe; no card vault here.",
          checks: [
            {
              label: "Empty-state copy renders",
              description:
                "'No payment methods yet.' card with a Stripe pill and 'PayPal soon' pill.",
            },
            {
              label: "No fake card list",
              description:
                "Confirm we're NOT showing seed/fake credit cards — only the empty state copy.",
            },
          ],
          auth: "user",
        },
        {
          href: "/account-settings?tab=security",
          label: "Account settings — Security",
          notes:
            "Read-only rows (email, sign-in method, 2FA) plus a 'Sign out everywhere' server action.",
          checks: [
            {
              label: "Email row shows your address",
              description:
                "Pulled from the profile, not the session token. If you changed email in another session, it should still show the DB value.",
            },
            {
              label: "Sign out works",
              description:
                "'Sign out everywhere' button → session ends, redirected to '/'. Header should now show 'Login'.",
            },
          ],
          auth: "user",
        },
        {
          href: "/profile",
          label: "Profile — your own",
          notes:
            "Self profile lookup by your session email. Shows display name, suburb, intents, interest tags, recent attended events.",
          checks: [
            {
              label: "Edit profile button appears",
              description:
                "Top-right of the profile header. Links to /account-settings?tab=account. Only visible on your own profile.",
            },
            {
              label: "Intent + interest pills render",
              description:
                "Two cards mid-page. Intents from connection_intents, interests from your user_tags. Empty states are graceful.",
            },
            {
              label: "Recent events grid below",
              description:
                "Up to 8 confirmed events ordered by start date desc. Empty state if you've never attended one.",
            },
            {
              label: "/profile/edit redirects to settings",
              description:
                "Direct nav to /profile/edit → /account-settings?tab=account. Same target as the Edit button.",
            },
          ],
          auth: "user",
        },
        {
          href: "/notifications",
          label: "Notifications",
          notes:
            "Notifications feed from the notifications table. Auto-marks visible items as read after a delay.",
          checks: [
            {
              label: "Eyebrow shows unread count",
              description:
                "If unread > 0, eyebrow reads e.g. '3 unread'. If zero, eyebrow reads 'All caught up'.",
            },
            {
              label: "Unread items have a rose dot + peach background",
              description:
                "Visual difference between unread (peach card, rose dot) and read (cream card, light dot).",
            },
            {
              label: "Auto-mark read after ~1.5s",
              description:
                "Open the page → unread items flip to read state without clicking. Backed by POST /api/notifications.",
            },
            {
              label: "Mark all read button",
              description:
                "Top-right button. Click → toast 'All marked as read.' All cards flip to read state.",
            },
            {
              label: "Empty state copy",
              description:
                "If you have no notifications: 'Inbox zero.' headline with explanation copy.",
            },
          ],
          auth: "user",
        },
        {
          href: "/people",
          label: "People — Click Radar",
          notes:
            "Other members ranked by shared events first, shared interest tags second. Anonymous Clicks; mutual Clicks unlock event suggestions.",
          checks: [
            {
              label: "Suggested people grid renders",
              description:
                "Two-column grid on desktop. Each card shows name, suburb, bio snippet, intent pills, and a Click button.",
            },
            {
              label: "Click button sends an anonymous Click",
              description:
                "Click on a person → POST /api/clicks → button flips to 'Click sent'. They are NOT told who clicked them.",
            },
            {
              label: "Mutual Click banner appears",
              description:
                "If two members Click each other within 30 days, an ink banner at the top shows the count of mutual matches.",
            },
            {
              label: "Cannot Click yourself / cannot re-Click",
              description:
                "Your own profile isn't in the list. After clicking, the button is disabled — no spam.",
            },
            {
              label: "Empty radar copy",
              description:
                "If you share no events / tags with anyone: 'Your radar is quiet.' Not a crash.",
            },
          ],
          auth: "user",
        },
      ],
    },
    {
      heading: "New: merchant wizards + check-in",
      routes: [
        {
          href: "/merchant/signup",
          label: "Merchant signup — 4-step wizard",
          notes:
            "Now a wizard: Business → Web presence → ABN/ACN → Review. Per-step validation and ABN checksum.",
          checks: [
            {
              label: "Stepper shows 4 pills",
              description:
                "Across the top: 1. Business / 2. Web presence / 3. ABN-ACN / 4. Review. Current step is ink, completed steps are peach.",
            },
            {
              label: "Step 1 validates business name + email",
              description:
                "Try clicking Continue with blank fields → error message under the form. Invalid email format also rejected.",
            },
            {
              label: "Step 2 — website is optional and blank by default",
              description:
                "No prefilled 'google.com'. Empty field is allowed. Typing 'example' (no domain) shows a domain-format error.",
            },
            {
              label: "Step 3 — ABN checksum validation",
              description:
                "Enter '12 345 678 901' (random 11 digits) → 'ABN failed the checksum' message. Use a known-valid ABN to pass.",
            },
            {
              label: "Step 3 — ACN checksum validation",
              description:
                "9-digit input is treated as ACN. Valid ACN passes; random 9 digits fail the checksum with a clear reason.",
            },
            {
              label: "Step 4 — Review shows all values",
              description:
                "Business, Contact, Website (or 'Not provided'), ABN/ACN. Submit creates a merchant_profile row.",
            },
            {
              label: "Success → /merchant + toast",
              description:
                "Sonner toast 'Merchant profile created. Verification is pending.' Then redirected to /merchant.",
            },
          ],
          auth: "user",
        },
        {
          href: "/merchant",
          label: "Create-event — 5-step wizard",
          notes:
            "CreateEventForm is now a 5-step wizard: Basics → Schedule → Location → Story → Review.",
          checks: [
            {
              label: "Stepper shows 5 pills",
              description:
                "Basics / Schedule / Location / Story / Review across the top.",
            },
            {
              label: "Template selector prefills all steps",
              description:
                "Restaurant meetup / Coffee walk / Workshop table — picking one populates fields across every step (verify by clicking Continue all the way to Review).",
            },
            {
              label: "Template dates are upcoming, not in the past",
              description:
                "Templates now compute startsAt relative to today (21-27 days out). If you see 2026-05-15 in the date field, the dynamic helper failed.",
            },
            {
              label: "Per-step validation blocks Continue",
              description:
                "Clear the title on step 1 → Continue fails with 'Give your event a title.' Same for each required field.",
            },
            {
              label: "Description must be 30+ chars",
              description:
                "Short description ('Hello') is rejected on step 4 with a clear message. Real prose passes.",
            },
            {
              label: "Review preview matches submitted event",
              description:
                "Step 5 shows the listing as it'll appear publicly. Submit → event lands in /events with status='pending'.",
            },
            {
              label: "Toast on submit",
              description:
                "Sonner success toast 'Event submitted for review.'",
            },
          ],
          auth: "merchant",
        },
        {
          href: `/merchant/events/${sampleSlug}`,
          label: "Merchant event detail — check-in + CSV export",
          notes:
            "Attendee list now has per-row check-in toggle and an Export CSV button.",
          checks: [
            {
              label: "Check-in / x out of N progress",
              description:
                "Above the attendee table: '0 / N checked in' counter that updates as you toggle.",
            },
            {
              label: "Check-in toggle is per row",
              description:
                "Each confirmed attendee has a 'Check in' button. Click → flips to 'Checked ✓' (ink colour). Toggling again clears it.",
            },
            {
              label: "Waitlisted attendees can't check in",
              description:
                "Their toggle is disabled. Confirms check-in is gated on confirmed status.",
            },
            {
              label: "checked_in_at is persisted",
              description:
                "DB check: select checked_in_at from event_attendees where id=<attendee_id> — should be a timestamp after toggling, NULL after clearing.",
            },
            {
              label: "Export CSV downloads a file",
              description:
                "'Export CSV' button → browser download '<slug>-attendees.csv'. Open it: header row + one row per attendee with name, email, status, RSVP at, checked-in at.",
            },
            {
              label: "CSV escapes commas + quotes",
              description:
                "If an attendee has a comma in their display name, the CSV cell is double-quoted. Imports cleanly into Sheets/Excel.",
            },
          ],
          auth: "merchant",
        },
      ],
    },
    {
      heading: "New: global UI",
      routes: [
        {
          href: "/",
          label: "Global toaster (sonner)",
          notes:
            "Sonner is mounted in app/layout.tsx — toasts appear top-right with rich colours and a close button.",
          checks: [
            {
              label: "Toasts appear top-right on every page",
              description:
                "Trigger any action that calls toast.success / toast.error (e.g. bookmark, mark notifications read). The toast should slide in top-right.",
            },
            {
              label: "Rich colours: success green, error red",
              description:
                "Success toasts are green-tinted; errors are red-tinted. Confirms richColors prop on Toaster.",
            },
            {
              label: "Close button works",
              description:
                "Hover a toast → 'x' button appears. Click → toast dismisses early.",
            },
            {
              label: "Multiple toasts stack",
              description:
                "Fire two toasts quickly → they stack vertically, oldest on top. None get dropped.",
            },
          ],
        },
      ],
    },
  ];

  return <TestPageClient groups={groups} />;
}
