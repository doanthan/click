import Link from "next/link";
import { getEventsForExplore } from "@/lib/event-repository";
import { startTestJourney } from "@/app/login/actions";
import { auth } from "@/auth";
import { TestAccountSwitcher } from "@/components/test-account-switcher";
import SupabaseLogDrawer from "./SupabaseLogDrawer";
import TestCasesBoard from "./TestCasesBoard";

export const metadata = {
  title: "Test personas | Click",
  description: "Jump into the key journeys for each kind of Click user.",
};

type Step = {
  href: string;
  label: string;
  // True when this step exercises a route or feature described in the
  // journey spec that isn't built in the app yet. Rendered dimmed + dashed.
  gap?: boolean;
};

type Story = {
  title: string;
  description: string;
  // Optional spec reference shown as a small caption (e.g. "spec §3.1").
  spec?: string;
  steps: Step[];
};

type Persona = {
  name: string;
  tagline: string;
  // Tailwind utility classes for the persona's accent header.
  accent: string;
  // Seeded dev account (database/002_seed.sql) whose role matches this persona.
  // Starting a story signs in as this account so the journey runs with the
  // right role. Dev-only — startTestJourney no-ops outside DEVELOPMENT.
  account: { email: string; label: string };
  stories: Story[];
};

export default async function TestPage() {
  const session = await auth();
  const events = await getEventsForExplore();
  const sampleSlug = events[0]?.id ?? "sample-event";
  const sampleTitle = events[0]?.title ?? "an event";

  const personas: Persona[] = [
    {
      name: "Customer",
      tagline: "Browse events, book a spot, and Click with someone.",
      accent: "bg-[color:var(--rose)] text-[color:var(--surface-deep)]",
      account: { email: "maya@click.local", label: "Maya (Attendee)" },
      stories: [
        {
          title: "Sign up process",
          description:
            "Create an account, finish the attendee profile, and land on the dashboard.",
          steps: [
            { href: "/auth", label: "Sign up" },
            { href: "/onboarding", label: "Onboarding" },
            { href: "/dashboard", label: "Dashboard" },
          ],
        },
        {
          title: "Sign in & role routing",
          description:
            "Existing user signs in — admin lands on /admin, merchant on /merchant, attendee on /dashboard (or /onboarding if incomplete).",
          steps: [
            { href: "/auth", label: "Sign in" },
            { href: "/post-login", label: "Post-login routing" },
            { href: "/dashboard", label: "Dashboard" },
          ],
        },
        {
          title: "Email verification gate",
          description:
            "Unverified users can browse /events in a locked state but RSVP / Click actions 403 with a verification nudge.",
          steps: [
            { href: "/events", label: "Events (locked browse)" },
            { href: `/events/${sampleSlug}`, label: "Try to RSVP → nudge" },
          ],
        },
        {
          title: "Take the Click Life quiz",
          description:
            "Optional but feeds the matching algorithm — life tags, persona, and dating prefs.",
          steps: [
            { href: "/quiz", label: "Quiz" },
            { href: "/quiz/life", label: "Life" },
            { href: "/quiz/personality", label: "Personality" },
          ],
        },
        {
          title: "Edit profile & settings",
          description:
            "Update name, photo, tags, intent — then tune notification and privacy settings.",
          steps: [
            { href: "/profile/edit", label: "Edit profile" },
            { href: "/account-settings", label: "Settings" },
          ],
        },
        {
          title: "View events",
          description:
            "Browse the live events grid, then open one for the full detail page.",
          steps: [
            { href: "/events", label: "Events grid" },
            { href: `/events/${sampleSlug}`, label: `Detail — ${sampleTitle}` },
          ],
        },
        {
          title: "Discover near you",
          description:
            "Map-driven discovery with radius-from-user (Mapbox). Entry point for new attendees who don't know what they want yet.",
          steps: [
            { href: "/discover", label: "Discover" },
            { href: `/events/${sampleSlug}`, label: "Open from map" },
          ],
        },
        {
          title: "Browse categories",
          description:
            "Category-led entry into events — the alternative to search + filters.",
          steps: [
            { href: "/categories", label: "Categories" },
            { href: "/events", label: "Filtered events" },
          ],
        },
        {
          title: "Book an event",
          description:
            "RSVP (or Reserve & pay) on the detail page, then find it in confirmed events and the calendar.",
          steps: [
            { href: `/events/${sampleSlug}`, label: "RSVP / pay" },
            { href: "/confirmed-events", label: "Confirmed" },
            { href: "/dashboard/calendar", label: "Calendar" },
          ],
        },
        {
          title: "Cancel an RSVP",
          description:
            "Open a confirmed booking and cancel — capacity returns and the waitlist gets offered.",
          steps: [
            { href: "/confirmed-events", label: "Confirmed" },
            { href: `/events/${sampleSlug}`, label: "Cancel RSVP" },
          ],
        },
        {
          title: "Join a waitlist",
          description:
            "When an event is full, join its waitlist — spot offers expire after 15 min.",
          steps: [
            { href: `/events/${sampleSlug}`, label: "Join waitlist" },
            { href: "/dashboard", label: "Waitlist tab" },
          ],
        },
        {
          title: "Save events",
          description:
            "Tap Save on an event to bookmark it, then find it in your saved list.",
          steps: [
            { href: `/events/${sampleSlug}`, label: "Save event" },
            { href: "/bookmarks", label: "Saved" },
          ],
        },
        {
          title: "Legacy /saved-events redirect",
          description:
            "Old links land on /saved-events; the route is a permanent redirect to /bookmarks so external bookmarks don't 404.",
          steps: [
            { href: "/saved-events", label: "/saved-events" },
            { href: "/bookmarks", label: "→ /bookmarks" },
          ],
        },
        {
          title: "Click with someone",
          description:
            "See suggested people, Click privately, watch for a mutual match — clicks are anonymous to the target until both sides Click.",
          steps: [{ href: "/people", label: "People" }],
        },
        {
          title: "Mutual click → snapshot → proposal",
          description:
            "On a mutual Click, both users see a read-only profile snapshot, then the Proposal UI suggests a shared event. No chat — pick from Click's catalogue, max 3 proposals.",
          steps: [
            { href: "/notifications", label: "Mutual Click notif" },
            { href: "/people", label: "Snapshot modal" },
            { href: "/dashboard", label: "Proposal → shared event" },
          ],
        },
        {
          title: "Post-event: did you Click?",
          description:
            "12h after the event ends, dashboard shows 'You went to X' with attendee picker. Selections feed mutual-click detection and the activity feed.",
          steps: [
            { href: "/dashboard", label: "Post-event prompt" },
            { href: "/profile", label: "Your Click Story" },
          ],
        },
        {
          title: "Switch intent mode",
          description:
            "Dating / Friends / Networking toggle in the dashboard header — writes profiles.active_intent and re-tones the feed.",
          steps: [{ href: "/dashboard", label: "Intent toggle" }],
        },
        {
          title: "Notifications",
          description:
            "Mutual Clicks, waitlist offers, and event reminders land here and on the dashboard.",
          steps: [
            { href: "/notifications", label: "Notifications" },
            { href: "/dashboard", label: "Dashboard" },
          ],
        },
      ],
    },
    {
      name: "Merchant",
      tagline:
        "Register → wait for approval → list events → fill seats. Mirrors context/02_MERCHANT_JOURNEY.md.",
      accent: "bg-[color:var(--peach)] text-[color:var(--surface-deep)]",
      account: { email: "theo@click.local", label: "Theo (Merchant)" },
      stories: [
        {
          title: "Registration wizard (4 steps)",
          spec: "§1",
          description:
            "Inline Step 0 sign-in/up → business details + ABN (checksum validated server-side) → contact & address → document uploads (ABN cert, insurance, liquor if alcohol) → review & submit. Single merchants INSERT on final submit — no partial rows.",
          steps: [
            { href: "/merchant/signup", label: "Start signup" },
            { href: "/merchant", label: "Portal (gated until approved)" },
          ],
        },
        {
          title: "Merchant login (separate from customer)",
          spec: "§1 entry",
          description:
            "Dedicated host login surface — same NextAuth backend as /login, different branding + default callback of /merchant. Footer link sends new hosts to /merchant/signup.",
          steps: [
            { href: "/merchant/login", label: "Host login" },
            { href: "/merchant", label: "Portal" },
          ],
        },
        {
          title: "Pending application holding page",
          spec: "§1 post-submit",
          description:
            "After submit, merchant lands on a holding page with the first-event prep checklist and ETA messaging. /merchant redirects here while verification_status !== 'approved'.",
          steps: [
            { href: "/merchant-pending", label: "Pending page" },
          ],
        },
        {
          title: "First-event onboarding checklist",
          spec: "§4",
          description:
            "On first approved login, show the 5-step checklist (profile → Stripe → first event → preview → submit) instead of an empty dashboard. Persists in merchant_onboarding_checklist until complete.",
          steps: [
            { href: "/merchant?tab=dashboard", label: "Dashboard", gap: true },
            { href: "/merchant/events/create", label: "Create first event" },
          ],
        },
        {
          title: "Dashboard overview",
          spec: "§3",
          description:
            "Active events, confirmed attendees, revenue + commission this month, upcoming events with capacity bars, recent bookings, under-attended alert.",
          steps: [
            { href: "/merchant?tab=dashboard", label: "Dashboard" },
            { href: "/merchant?tab=events", label: "Events tab" },
          ],
        },
        {
          title: "Event creation wizard (5 steps)",
          spec: "§5",
          description:
            "Basics + tags + booking type → when & where (schedule conflict check) → capacity & price (Stripe Connect gate for paid) → media → review. Trusted merchants auto-publish via DB trigger; new merchants go to pending_review.",
          steps: [
            { href: "/merchant/events/create", label: "Create event" },
            { href: "/merchant?tab=events", label: "Status badge" },
          ],
        },
        {
          title: "Edit a published event",
          spec: "§6 lifecycle",
          description:
            "Description, banner, external URL → editable in place. Title/date/capacity/price → flips status back to pending_review for re-approval (trusted merchants: auto-approve applies to edits too).",
          steps: [
            { href: "/merchant?tab=events", label: "Events" },
            { href: `/merchant/events/${sampleSlug}`, label: "Edit event" },
          ],
        },
        {
          title: "Cancel an event (refund cascade)",
          spec: "§6 cancellation",
          description:
            "CancelEventDialog requires reason ≥20 chars → 100% Stripe refund to every confirmed booking, waitlists + pending offers cancelled, all parties emailed. Failures logged to payment_transactions.",
          steps: [
            { href: `/merchant/events/${sampleSlug}`, label: "Open event" },
            { href: `/merchant/events/${sampleSlug}`, label: "Cancel dialog", gap: true },
          ],
        },
        {
          title: "Under-attended alert (T-72h)",
          spec: "§3.1",
          description:
            "When confirmed < capacity × 0.3 and start_time < now + 72h, dashboard shows alert with three remediations: Boost visibility (admin_featured 48h), Lower price, or Set a minimum.",
          steps: [
            { href: "/merchant?tab=dashboard", label: "Alert card", gap: true },
          ],
        },
        {
          title: "Minimum viable attendees decision",
          spec: "§3.2",
          description:
            "Hourly cron: if confirmed < minimum and start_time < now + minimum_decision_hours, merchant gets 'run anyway' vs 'cancel with full refunds' notification.",
          steps: [
            { href: "/merchant/events/create", label: "Set minimum (Step 1)" },
            { href: "/merchant?tab=events", label: "Decision notif", gap: true },
          ],
        },
        {
          title: "Attendees + check-in",
          spec: "§7",
          description:
            "Attendees tab: bookings JOIN profiles for this merchant's events. Filters by event/status. Check-in flips checked_in + checked_in_at (RLS-scoped to merchant's events).",
          steps: [
            { href: "/merchant?tab=attendees", label: "Attendees" },
            { href: "/merchant?tab=bookings", label: "Bookings" },
          ],
        },
        {
          title: "CSV export (attendee list)",
          spec: "§7",
          description:
            "Export first_name, email, booking_date, payment_status, checked_in, checked_in_at. Excludes full address / DOB / private profile data.",
          steps: [
            { href: "/merchant?tab=attendees", label: "Export CSV", gap: true },
          ],
        },
        {
          title: "Venues & discount codes",
          spec: "§3 portal",
          description:
            "Reusable venue records (venues table) and merchant-scoped discount codes — both feed event creation and analytics.",
          steps: [
            { href: "/merchant?tab=venues", label: "Venues" },
            { href: "/merchant?tab=discounts", label: "Discounts" },
          ],
        },
        {
          title: "Analytics",
          spec: "§8",
          description:
            "Revenue over time, bookings per event, capacity utilisation, views → bookings, top tags, source attribution. Timeframe via ?timeframe= (7 / 30 / 90 / all).",
          steps: [
            { href: "/merchant?tab=analytics", label: "Analytics" },
            { href: "/merchant?tab=analytics&timeframe=90", label: "90-day" },
          ],
        },
        {
          title: "Finances + Stripe Connect",
          spec: "§9",
          description:
            "Founding partner: 0% until founding_deal_expiry. Standard: 10% commission. Weekly merchant-payout cron transfers net to Stripe. Connect onboarding is gated at event Step 3 for paid events.",
          steps: [
            { href: "/merchant?tab=finances", label: "Finances" },
            { href: "/merchant?tab=finances", label: "Connect Stripe", gap: true },
          ],
        },
        {
          title: "Support tickets",
          spec: "§3 portal",
          description:
            "Merchant raises and tracks support tickets — useSupportTickets / support_tickets table.",
          steps: [
            { href: "/merchant?tab=support", label: "Support" },
          ],
        },
        {
          title: "Settings (profile, 2FA, payout, danger zone)",
          spec: "§10",
          description:
            "Business profile edits, notification preferences (bookings/cancellations/capacity/under-attended), security + 2FA, Stripe Connect management, account deletion request.",
          steps: [
            { href: "/merchant?tab=settings", label: "Settings" },
          ],
        },
        {
          title: "Click with another user",
          description: "Hosts are people too — find and Click with someone.",
          steps: [{ href: "/people", label: "People" }],
        },
      ],
    },
    {
      name: "Admin",
      tagline: "Keep the platform clean and trustworthy.",
      accent: "bg-[color:var(--ink)] text-[color:var(--champagne)]",
      account: { email: "admin@click.local", label: "Click Admin" },
      stories: [
        {
          title: "Dashboard",
          description:
            "Platform totals, the pending-events queue, and the audit log.",
          steps: [{ href: "/admin", label: "Admin console" }],
        },
        {
          title: "Approve merchants",
          description:
            "Review pending merchants and flip verification to approved.",
          steps: [{ href: "/admin", label: "Merchant review" }],
        },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-6xl">
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          QA personas
        </p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
            Test by <span className="italic text-[color:var(--rose)]">who</span>.
          </h1>
          <SupabaseLogDrawer />
        </div>
        <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-[color:var(--mauve)]">
          Pick a persona and walk its key journeys. The ▶ first step signs you
          in as that persona&rsquo;s seeded account, then opens the step in the
          current tab; the rest open in new tabs. Open the Supabase log to
          confirm the writes landed.
        </p>

        <div className="mt-10 max-w-sm">
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Login
          </p>
          <p className="mb-3 mt-1 text-xs font-medium leading-5 text-[color:var(--mauve)]">
            Swap the active session — or sign out into the public, not-signed-in
            state. Same switcher as the floating pill, pinned here for quick
            access. Stays on /test after you switch.
          </p>
          <TestAccountSwitcher
            currentEmail={session?.user?.email ?? null}
            variant="inline"
            redirectTo="/test"
          />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {personas.map((persona) => (
            <section
              key={persona.name}
              className="flex flex-col rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm"
            >
              <header
                className={`-mx-5 -mt-5 mb-5 rounded-t-3xl border-b-2 border-[color:var(--line)] px-5 py-4 ${persona.accent}`}
              >
                <h2 className="font-display text-3xl font-light leading-tight">
                  {persona.name}
                </h2>
                <p className="mt-1 text-sm font-medium leading-5 opacity-90">
                  {persona.tagline}
                </p>
              </header>

              <ul className="grid gap-4">
                {persona.stories.map((story) => (
                  <li
                    key={story.title}
                    className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-bold text-[color:var(--ink)]">
                        {story.title}
                      </h3>
                      {story.spec ? (
                        <span className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[color:var(--mauve)]/70">
                          spec {story.spec}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--mauve)]">
                      {story.description}
                    </p>
                    <ol className="mt-3 flex flex-wrap items-center gap-1.5">
                      {story.steps.map((step, idx) => (
                        <li key={step.href + idx} className="flex items-center gap-1.5">
                          {idx > 0 ? (
                            <span aria-hidden className="text-[color:var(--mauve)]">
                              →
                            </span>
                          ) : null}
                          {idx === 0 ? (
                            // The first step doubles as the journey starter: it
                            // signs in as the persona's seeded account (so the
                            // journey runs with the right role) and then lands on
                            // this step. Submits in the current tab because the
                            // sign-in swaps the session cookie globally. The
                            // remaining steps stay plain new-tab links.
                            <form action={startTestJourney}>
                              <input
                                type="hidden"
                                name="email"
                                value={persona.account.email}
                              />
                              <input type="hidden" name="next" value={step.href} />
                              <button
                                type="submit"
                                title={`Sign in as ${persona.account.label}${
                                  step.gap ? " (route not built yet)" : ""
                                } and open this step`}
                                className={
                                  step.gap
                                    ? "rounded-full border-2 border-dashed border-[color:var(--mauve)]/60 bg-[color:var(--champagne)]/50 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[color:var(--mauve)] transition hover:border-[color:var(--mauve)] hover:text-[color:var(--ink)]"
                                    : "rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--ink)] px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[color:var(--champagne)] transition hover:bg-[color:var(--rose)] hover:text-[color:var(--surface-deep)]"
                                }
                              >
                                ▶ {step.label}
                              </button>
                            </form>
                          ) : (
                            <Link
                              href={step.href}
                              target="_blank"
                              rel="noreferrer"
                              title={
                                step.gap
                                  ? "Spec-only — route or feature not built yet"
                                  : undefined
                              }
                              className={
                                step.gap
                                  ? "rounded-full border-2 border-dashed border-[color:var(--mauve)]/50 bg-[color:var(--champagne)]/50 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[color:var(--mauve)] transition hover:border-[color:var(--mauve)] hover:text-[color:var(--ink)]"
                                  : "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[color:var(--ink)] transition hover:border-[color:var(--ink)] hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)]"
                              }
                            >
                              {step.label} {step.gap ? "⚠" : "↗"}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <TestCasesBoard />

        <p className="mt-10 text-center font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]/40">
          ✷ doan is the best ✷
        </p>
      </section>
    </main>
  );
}
