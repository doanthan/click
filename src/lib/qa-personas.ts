// The QA personas the top-right switcher signs you in as.
//
// Data only, no imports - the client component and the server provisioner both
// read this list, so it stays importable from either side. The DB writes live
// in src/lib/qa-provision.ts.
//
// Every address is in the @click.local namespace that 032_clear_seed_data.sql
// sweeps, and the test-login provider refuses anything else.

export type QaPersona = {
  email: string;
  label: string;
  /** What this persona is for - the reason to pick it over the one above. */
  exercises: string;
  /** Grouping in the switcher panel. */
  group: "Start of the journey" | "Skip ahead" ;
  role: "attendee" | "merchant" | "admin";
  displayName: string;
  /**
   * null = provision as a BLANK account: any existing profile is deleted first,
   * so signing in lands on /onboarding with nothing filled in. That is what
   * makes the sign-up journeys re-runnable instead of one-shot.
   */
  suburb: string | null;
  merchant: {
    businessName: string;
    verificationStatus: "pending" | "approved";
    stripeAccountId: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  } | null;
};

// A merchant may only sell when the app sees BOTH a connected account id and
// charges_enabled (the PayoutsNotReadyError gate in event-repository.ts). The
// paid persona therefore carries a deliberately fake acct_ id: it clears the
// app's gate so the whole paid path is walkable, and then Stripe itself rejects
// the destination charge. On LIVE keys that is the point - the flow is testable
// end to end without a real card ever hitting a real connected account.
export const FAKE_CONNECT_ACCOUNT = "acct_qa_click_local_not_a_real_account";

export const QA_PERSONAS: QaPersona[] = [
  {
    email: "jamie@click.local",
    label: "New customer",
    exercises: "Signs up from scratch - lands on onboarding with nothing filled in",
    group: "Start of the journey",
    role: "attendee",
    displayName: "Jamie",
    suburb: null,
    merchant: null,
  },
  {
    email: "maya@click.local",
    label: "Customer",
    exercises: "Onboarded. Browse, RSVP, pay, the click mechanic",
    group: "Start of the journey",
    role: "attendee",
    displayName: "Maya Chen",
    suburb: "Barangaroo",
    merchant: null,
  },
  {
    email: "sam@click.local",
    label: "Customer becoming a host",
    exercises: "Onboarded, no host application yet - walks the 4-step merchant signup",
    group: "Start of the journey",
    role: "attendee",
    displayName: "Sam Whitfield",
    suburb: "Redfern",
    merchant: null,
  },
  {
    email: "otis@click.local",
    label: "Host - awaiting review",
    exercises: "Application submitted. The holding page before an admin approves",
    group: "Skip ahead",
    role: "merchant",
    displayName: "Otis Reed",
    suburb: "Newtown",
    merchant: {
      businessName: "Otis Runs Things",
      verificationStatus: "pending",
      stripeAccountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
    },
  },
  {
    email: "theo@click.local",
    label: "Host - free events only",
    exercises: "Approved, skipped payout setup. Can publish free events",
    group: "Skip ahead",
    role: "merchant",
    displayName: "Theo Morgan",
    suburb: "Marrickville",
    merchant: {
      businessName: "Inner West Fitness Mates",
      verificationStatus: "approved",
      stripeAccountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
    },
  },
  {
    email: "nadia@click.local",
    label: "Host - selling tickets",
    exercises: "Approved with payouts on. Paid ticketing and checkout",
    group: "Skip ahead",
    role: "merchant",
    displayName: "Nadia Barros",
    suburb: "Surry Hills",
    merchant: {
      businessName: "Surry Hills Supper Club",
      verificationStatus: "approved",
      stripeAccountId: FAKE_CONNECT_ACCOUNT,
      chargesEnabled: true,
      payoutsEnabled: true,
    },
  },
  {
    email: "admin@click.local",
    label: "Admin",
    exercises: "Approvals, merchant verification, reports",
    group: "Skip ahead",
    role: "admin",
    // Admins are routed to /admin by ADMIN_EMAILS, but a null suburb would
    // bounce them into /onboarding first.
    suburb: "Sydney",
    displayName: "Click Admin",
    merchant: null,
  },
];

// One free and one paid event so the customer personas always have something to
// book on both paths, owned by the two approved host personas. Dated forward on
// every provision so they never go stale.
export const QA_EVENTS = [
  {
    slug: "qa-free-morning-walk",
    ownerEmail: "theo@click.local",
    title: "QA - Marrickville Morning Walk",
    description:
      "Seeded QA event. A free, click-managed event for testing RSVP, capacity and the click mechanic.",
    // Must be one of `categories` in src/lib/click-data.ts, display-cased - an
    // unlisted category drops the event out of discover and 404s its page.
    category: "Wellness",
    priceCents: 0,
    capacity: 12,
    daysFromNow: 6,
    locationName: "Marrickville Library forecourt",
    suburb: "Marrickville",
  },
  {
    slug: "qa-paid-supper-club",
    ownerEmail: "nadia@click.local",
    title: "QA - Surry Hills Supper Club",
    description:
      "Seeded QA event. A paid, click-managed event for testing checkout, receipts and refunds.",
    category: "Food",
    priceCents: 2500,
    capacity: 10,
    daysFromNow: 9,
    locationName: "A long table in Surry Hills",
    suburb: "Surry Hills",
  },
];

export function findQaPersona(email: string) {
  const normalized = email.trim().toLowerCase();
  return QA_PERSONAS.find((persona) => persona.email === normalized) ?? null;
}
