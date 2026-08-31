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
  /** Grouping shared by the quick switcher and the testing workspace. */
  group: "onboarding" | "ready" | "connections" | "admin";
  /** Where a fresh run of this scenario begins. */
  startPath: string;
  role: "attendee" | "merchant" | "admin";
  displayName: string;
  /**
   * null = provision as a BLANK account: any existing profile is deleted first,
   * so signing in lands on /onboarding with nothing filled in. That is what
   * makes the sign-up journeys re-runnable instead of one-shot.
   */
  suburb: string | null;
  /**
   * A real date of birth, not decoration. `birth_date` is half of "onboarding
   * complete" (getProfileStatus) AND the trust boundary every booking path
   * routes through (assertBookingEligible in event-repository.ts), so a persona
   * without one is bounced to /onboarding and refused at free RSVP, paid
   * checkout and the waitlist alike. `profiles.age` - the column the click
   * layer's independent 18+ gate reads - is derived from this in SQL, so the
   * two can never drift.
   */
  birthDate: string | null;
  /**
   * The click pool hard-requires a resolvable photo on BOTH sides: the daily
   * set filters on `photo_url is not null and photo_url <> ''` and then again
   * through resolveAvatarImage, and clicking is a face-first decision. A
   * photoless persona is invisible to discovery and cannot be clicked.
   * A leading "/" path is what resolveAvatarImage accepts unconditionally, so
   * these point at the generated faces already committed to public/home/avatars.
   */
  photoUrl: string | null;
  /**
   * Curated `tags` slugs (tag_type 'interest' / 'music') to write into
   * `user_tags`. Real accounts get these from onboarding and the profile-edit
   * music picker; the personas skip both, so without them the People Card had
   * no shared interests to list and no music axis for its commonality line -
   * it always fell through to "you're both nearby". Slugs must exist in
   * database/002_seed.sql / 029_seed_music_tags.sql; unknown ones are dropped.
   */
  interests: string[];
  music: string[];
  merchant: {
    businessName: string;
    verificationStatus: "pending" | "approved";
    stripeAccountId: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    /** Stripe's account-details flag, independent of Click's own walkthrough. */
    detailsSubmitted: boolean;
    /** Click's post-approval host walkthrough, independent of payout readiness. */
    onboardingComplete: boolean;
  } | null;
};

export const QA_SCENARIO_GROUPS = [
  {
    id: "onboarding",
    label: "Onboarding flows",
    description: "Start before a profile, host application, or approved-host setup is complete.",
  },
  {
    id: "ready",
    label: "Ready states",
    description: "Open a stable customer or host account and test everyday product work.",
  },
  {
    id: "connections",
    label: "Two-person Click tests",
    description: "Switch between people without resetting so their shared journey can continue.",
  },
  {
    id: "admin",
    label: "Operations",
    description: "Review applications, approvals, reports, and platform settings.",
  },
] as const;

// A merchant may only sell when the app sees BOTH a REAL connected account id
// (isRealConnectAccountId) and charges_enabled - the PayoutsNotReadyError gate
// in event-repository.ts. No persona fakes that: a placeholder acct_ id cannot
// receive a destination charge, so seeding one only ever bought a raw Stripe
// 403 at the moment of payment. The paid host starts un-onboarded and a human
// connects them once; see the merchant block on nadia@click.local.

export const QA_PERSONAS: QaPersona[] = [
  {
    email: "jamie@click.local",
    label: "New customer",
    exercises: "Signs up from scratch - lands on onboarding with nothing filled in",
    group: "onboarding",
    startPath: "/onboarding",
    role: "attendee",
    displayName: "Jamie",
    // Blank on purpose: this persona is DELETED on every provision, so anything
    // filled in here would be thrown away before the session is minted.
    suburb: null,
    birthDate: null,
    photoUrl: null,
    interests: [],
    music: [],
    merchant: null,
  },
  {
    email: "maya@click.local",
    label: "Customer ready to use Click",
    exercises: "Onboarded. Browse, RSVP, pay, the click mechanic",
    group: "ready",
    startPath: "/dashboard",
    role: "attendee",
    displayName: "Maya Chen",
    suburb: "Barangaroo",
    birthDate: "1995-06-12",
    photoUrl: "/home/avatars/av-2.jpg",
    interests: ["pottery", "running", "live-music", "food"],
    music: ["house-music", "electronic"],
    merchant: null,
  },
  {
    email: "sam@click.local",
    label: "New host application",
    exercises: "Onboarded customer with no application - starts the 3-step host form",
    group: "onboarding",
    startPath: "/merchant/signup/business",
    role: "attendee",
    displayName: "Sam Whitfield",
    suburb: "Redfern",
    birthDate: "1990-11-03",
    photoUrl: "/home/avatars/av-5.jpg",
    interests: ["fitness", "outdoors", "community"],
    music: ["indie"],
    merchant: null,
  },
  // The click mechanic takes two people, and switching to a persona is the only
  // way to be the second one. Ruby shares Maya's suburb so the People card has
  // its non-interest commonality ("you're both nearby") to show; Ollie is the
  // third body you need to walk "not feeling it" without burning the pair you
  // are mid-way through coordinating with.
  {
    email: "ruby@click.local",
    label: "Customer who clicks back",
    exercises: "Click with Maya from both sides to form a mutual and coordinate",
    group: "connections",
    startPath: "/people",
    role: "attendee",
    displayName: "Ruby Alvarez",
    suburb: "Barangaroo",
    birthDate: "1997-02-18",
    photoUrl: "/home/avatars/av-7.jpg",
    interests: ["pottery", "running", "live-music", "books"],
    music: ["house-music", "electronic"],
    merchant: null,
  },
  {
    email: "ollie@click.local",
    label: "Customer who does not",
    exercises: "The third person - one-way clicks, declines, 'not feeling it'",
    group: "connections",
    startPath: "/people",
    role: "attendee",
    displayName: "Ollie Brandt",
    suburb: "Surry Hills",
    birthDate: "1993-09-27",
    photoUrl: "/home/avatars/av-11.jpg",
    interests: ["food", "games", "photography"],
    music: ["jazz"],
    merchant: null,
  },
  {
    email: "otis@click.local",
    label: "Host - awaiting review",
    exercises: "Application submitted. The holding page before an admin approves",
    group: "ready",
    startPath: "/merchant-pending",
    role: "merchant",
    displayName: "Otis Reed",
    suburb: "Newtown",
    birthDate: "1988-04-05",
    photoUrl: "/home/avatars/av-9.jpg",
    interests: ["community", "food"],
    music: ["soul"],
    merchant: {
      businessName: "Otis Runs Things",
      verificationStatus: "pending",
      stripeAccountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
    },
  },
  {
    email: "theo@click.local",
    label: "Approved host onboarding",
    exercises: "Approved, first login - chooses a free event or connects payouts",
    group: "onboarding",
    startPath: "/merchant/onboarding/welcome",
    role: "merchant",
    displayName: "Theo Morgan",
    suburb: "Marrickville",
    birthDate: "1986-01-19",
    photoUrl: "/home/avatars/av-13.jpg",
    interests: ["fitness", "crossfit", "running"],
    music: ["funk"],
    merchant: {
      businessName: "Inner West Fitness Mates",
      verificationStatus: "approved",
      stripeAccountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
    },
  },
  {
    email: "leila@click.local",
    label: "Host - free events ready",
    exercises: "Approved and through setup, with no Stripe account. Free events publish",
    group: "ready",
    startPath: "/merchant",
    role: "merchant",
    displayName: "Leila Haddad",
    suburb: "Pyrmont",
    birthDate: "1989-08-14",
    photoUrl: "/home/avatars/av-12.jpg",
    interests: ["books", "brunch", "volunteering"],
    music: ["folk"],
    merchant: {
      businessName: "Harbour Book Club",
      verificationStatus: "approved",
      stripeAccountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: true,
    },
  },
  {
    email: "nadia@click.local",
    label: "Host - paid flow",
    exercises:
      "Paid checkout end to end. Connect payouts once via /merchant - it survives resets",
    group: "ready",
    startPath: "/merchant",
    role: "merchant",
    displayName: "Nadia Barros",
    suburb: "Surry Hills",
    birthDate: "1991-07-22",
    photoUrl: "/home/avatars/av-15.jpg",
    interests: ["food", "dinner", "restaurant"],
    music: ["latin"],
    merchant: {
      businessName: "Surry Hills Supper Club",
      verificationStatus: "approved",
      // Approved to host, but NOT payout-ready - and the row says so. This used
      // to seed a placeholder `acct_...` id with charges_enabled/payouts_enabled
      // true, which was a lie in both directions: the merchant portal ticked
      // "payments" green and hid the Connect CTA, so nobody could start
      // onboarding, while paid checkout sailed through the payout gate and
      // handed the placeholder to Stripe as transfer_data.destination - a 403
      // that surfaced to the buyer as a raw 500.
      //
      // Null instead, so the portal shows "Connect payments" and one pass
      // through Stripe's test-mode hosted onboarding mints a real account.
      // qa-provision.ts then PRESERVES that account across persona resets, so
      // this is a once-per-environment step, not once per scenario switch.
      stripeAccountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
    },
  },
  {
    email: "admin@click.local",
    label: "Admin",
    exercises: "Approvals, merchant verification, reports",
    group: "admin",
    startPath: "/admin",
    role: "admin",
    // Admins are routed to /admin by ADMIN_EMAILS, but a null suburb would
    // bounce them into /onboarding first.
    suburb: "Sydney",
    birthDate: "1985-05-05",
    photoUrl: "/home/avatars/av-16.jpg",
    interests: ["community"],
    music: [],
    displayName: "Click Admin",
    merchant: null,
  },
];

// One free and one paid event so the customer personas always have something to
// book on both paths, plus one that has already finished so the post-event side
// of the click mechanic has a room to look back at. Owned by the two approved
// ready host personas and dated forward (or back) on a fresh scenario, so they
// never go stale.
export const QA_EVENTS = [
  {
    slug: "qa-free-morning-walk",
    ownerEmail: "leila@click.local",
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
    attendeeEmails: [],
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
    attendeeEmails: [],
  },
  {
    // Process 2 (the "who was there" roster) only opens between event_end + 2h
    // and event_end + 48h, and only for people who actually attended. Nothing
    // you can do in the UI produces that: you cannot RSVP to a room that has
    // already happened. So this one is dated a day into the PAST and its
    // attendees are seeded, which is the only way the post-event surface is
    // reachable at all. Negative daysFromNow is deliberate.
    slug: "qa-past-pottery-night",
    ownerEmail: "leila@click.local",
    title: "QA - Last Night's Pottery Social",
    description:
      "Seeded QA event that has already finished, so the post-event 'who was there' click roster has a room to offer.",
    category: "Creative",
    priceCents: 0,
    capacity: 12,
    daysFromNow: -1,
    locationName: "A studio in Marrickville",
    suburb: "Marrickville",
    // Confirmed onto it so every customer persona sees every other one on the
    // roster the moment they open it.
    attendeeEmails: [
      "maya@click.local",
      "ruby@click.local",
      "ollie@click.local",
      "sam@click.local",
    ],
  },
];

export function findQaPersona(email: string) {
  const normalized = email.trim().toLowerCase();
  return QA_PERSONAS.find((persona) => persona.email === normalized) ?? null;
}
