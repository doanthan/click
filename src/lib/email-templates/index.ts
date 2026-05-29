// Email-template registry. The `/email` page reads `scenarios` to render its
// sidebar and uses `findScenario(id)` to resolve the `?scenario=` query param
// into a builder. Adding a new template means: write the module, add a
// fixture in `fixtures.ts`, append one entry here.

import {
  eventCancelledFixture,
  merchantEventCreatedFixture,
  merchantNewRsvpFixture,
  merchantSignupReceivedFixture,
  merchantVerificationApprovedFixture,
  merchantVerificationRejectedFixture,
  merchantVerificationSuspendedFixture,
  paymentConfirmedFixture,
  rsvpConfirmationFixture,
  userSignupFixture,
  waitlistJoinedFixture,
  waitlistPromotedFixture,
} from "./fixtures";
import { buildEventCancelledEmail } from "./event-cancelled";
import { buildMerchantEventCreatedEmail } from "./merchant-event-created";
import { buildMerchantNewRsvpEmail } from "./merchant-new-rsvp";
import { buildMerchantSignupReceivedEmail } from "./merchant-signup-received";
import { buildMerchantVerificationStatusEmail } from "./merchant-verification-status";
import { buildPaymentConfirmedEmail } from "./payment-confirmed";
import { buildRsvpConfirmationEmail } from "./rsvp-confirmation";
import { buildUserSignupEmail } from "./user-signup";
import { buildWaitlistJoinedEmail } from "./waitlist-joined";
import { buildWaitlistPromotedEmail } from "./waitlist-promoted";

export type EmailScenarioGroup = "Attendees" | "Merchants";

export type BuiltEmail = { subject: string; html: string; text: string };

export type EmailScenario = {
  id: string;
  label: string;
  description: string;
  group: EmailScenarioGroup;
  to: string;
  /** Whether this scenario is already firing in production (vs. a draft). */
  wired: boolean;
  build: () => BuiltEmail;
};

export const scenarios: EmailScenario[] = [
  // ── Attendee-facing ──────────────────────────────────────────────────
  {
    id: "user-signup",
    label: "User signup welcome",
    description: "Sent the moment a new attendee finishes signup.",
    group: "Attendees",
    to: "maya@click.local",
    wired: false,
    build: () => buildUserSignupEmail(userSignupFixture),
  },
  {
    id: "rsvp-confirmation",
    label: "RSVP confirmed",
    description: "Sent when an attendee's status lands on 'confirmed'.",
    group: "Attendees",
    to: "maya@click.local",
    wired: false,
    build: () => buildRsvpConfirmationEmail(rsvpConfirmationFixture),
  },
  {
    id: "waitlist-joined",
    label: "Waitlist joined",
    description: "Sent when an attendee lands on a full event's waitlist.",
    group: "Attendees",
    to: "maya@click.local",
    wired: true,
    build: () => buildWaitlistJoinedEmail(waitlistJoinedFixture),
  },
  {
    id: "waitlist-promoted",
    label: "Waitlist spot opened",
    description: "Sent when a confirmed attendee cancels and the seat is offered to the next waitlister.",
    group: "Attendees",
    to: "maya@click.local",
    wired: true,
    build: () => buildWaitlistPromotedEmail(waitlistPromotedFixture),
  },
  {
    id: "event-cancelled",
    label: "Event cancelled",
    description: "Sent to every confirmed attendee when a host cancels an event.",
    group: "Attendees",
    to: "maya@click.local",
    wired: true,
    build: () => buildEventCancelledEmail(eventCancelledFixture),
  },
  {
    id: "payment-confirmed",
    label: "Payment confirmed",
    description: "Sent from the Stripe webhook once a paid event payment is captured.",
    group: "Attendees",
    to: "maya@click.local",
    wired: true,
    build: () => buildPaymentConfirmedEmail(paymentConfirmedFixture),
  },
  // ── Merchant-facing ──────────────────────────────────────────────────
  {
    id: "merchant-signup-received",
    label: "Merchant signup received",
    description: "Sent when a merchant submits the 3-step signup wizard.",
    group: "Merchants",
    to: "noah@click.local",
    wired: false,
    build: () => buildMerchantSignupReceivedEmail(merchantSignupReceivedFixture),
  },
  {
    id: "merchant-event-created",
    label: "Event pending review",
    description: "Sent when an approved merchant creates an event awaiting moderation.",
    group: "Merchants",
    to: "noah@click.local",
    wired: false,
    build: () => buildMerchantEventCreatedEmail(merchantEventCreatedFixture),
  },
  {
    id: "merchant-new-rsvp",
    label: "New RSVP for your event",
    description: "Sent to the host when a new attendee RSVPs to their event.",
    group: "Merchants",
    to: "theo@click.local",
    wired: false,
    build: () => buildMerchantNewRsvpEmail(merchantNewRsvpFixture),
  },
  {
    id: "merchant-verification-approved",
    label: "Merchant approved",
    description: "Sent when an admin approves a merchant application.",
    group: "Merchants",
    to: "noah@click.local",
    wired: true,
    build: () => buildMerchantVerificationStatusEmail(merchantVerificationApprovedFixture),
  },
  {
    id: "merchant-verification-rejected",
    label: "Merchant rejected",
    description: "Sent when an admin rejects a merchant application.",
    group: "Merchants",
    to: "noah@click.local",
    wired: true,
    build: () => buildMerchantVerificationStatusEmail(merchantVerificationRejectedFixture),
  },
  {
    id: "merchant-verification-suspended",
    label: "Merchant suspended",
    description: "Sent when an admin suspends a previously approved merchant.",
    group: "Merchants",
    to: "noah@click.local",
    wired: true,
    build: () => buildMerchantVerificationStatusEmail(merchantVerificationSuspendedFixture),
  },
];

/** First match wins. Falls back to the first scenario when the id is unknown
 *  so the page always renders something (and the search-param URL "heals"). */
export function findScenario(id: string | undefined | null): EmailScenario {
  if (!id) return scenarios[0];
  return scenarios.find((s) => s.id === id) ?? scenarios[0];
}
