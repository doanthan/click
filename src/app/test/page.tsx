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
      ],
    },
  ];

  return <TestPageClient groups={groups} />;
}
