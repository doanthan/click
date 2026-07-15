// Mock data for every email preview. Personas + event titles are pulled from
// `database/002_seed.sql` so the gallery feels internally consistent with the
// rest of the app: Maya RSVPs to Theo's CrossFit class - that one RSVP is the
// fixture for both `rsvp-confirmation` (to Maya) and `merchant-new-rsvp`
// (to Theo). Touch this file when adjusting copy; templates stay generic.
//
// Each value satisfies the typed input of its template so a rename in a
// template's `Data` type immediately surfaces here.

import type { EventCancelledData } from "./event-cancelled";
import type { MerchantEventCreatedData } from "./merchant-event-created";
import type { MerchantNewRsvpData } from "./merchant-new-rsvp";
import type { MerchantSignupReceivedData } from "./merchant-signup-received";
import type { MerchantVerificationStatusData } from "./merchant-verification-status";
import type { PaymentConfirmedData } from "./payment-confirmed";
import type { RsvpConfirmationData } from "./rsvp-confirmation";
import type { UserSignupData } from "./user-signup";
import type { WaitlistJoinedData } from "./waitlist-joined";
import type { WaitlistPromotedData } from "./waitlist-promoted";

const APP = "https://click.local";
const SUPPORT = "hello@click.local";
const UNSUB = `${APP}/account/notifications`;

// ─── Reusable event records ────────────────────────────────────────────────
// Real seeded events from `database/002_seed.sql`. Keeping these in one place
// means a venue/date tweak propagates to every preview that references it.

const CROSSFIT = {
  title: "CrossFit Skills + Coffee Crew",
  slug: "crossfit-coffee",
  category: "Fitness",
  hostName: "Theo Morgan",
  hostBusiness: "Inner West Fitness Mates",
  longDate: "Saturday, 7 June",
  startTime: "8:30am",
  endTime: "10:00am",
  venue: "Inner West Strength",
  address: "412 Enmore Rd",
  city: "Enmore NSW 2042",
  priceLabel: "$12",
  spotsLabel: "18 of 24 confirmed",
};

const SLOW_DATING = {
  title: "Slow Dating: Dinner Tables of Six",
  slug: "slow-dating-six",
  category: "Relationships",
  hostName: "Amelia Hart",
  hostBusiness: "Real Conversations Sydney",
  longDate: "Friday, 13 June",
  startTime: "7:00pm",
  endTime: "9:30pm",
  venue: "Casa Tinta",
  address: "21 Brisbane St",
  city: "Surry Hills NSW 2010",
  priceLabel: "$45",
  spotsLabel: "Full - waitlist open",
};

const POTTERY = {
  title: "Ordinary Creatives: Pottery & Snacks",
  slug: "alexandria-pottery-night",
  category: "Creative",
  hostName: "Noah Singh",
  hostBusiness: "Ordinary People Making Things",
  longDate: "Thursday, 12 June",
  startTime: "6:30pm",
  endTime: "8:30pm",
  venue: "Studio Bowerbird",
  address: "8 Mitchell Rd",
  city: "Alexandria NSW 2015",
  priceLabel: "Free",
  spotsLabel: "9 of 24 confirmed",
  capacityLabel: "24 seats",
};

const FOUNDER_BREAKFAST = {
  title: "Women Founder Breakfast",
  slug: "women-founder-breakfast",
  category: "Career",
  hostName: "Priya Nair",
  hostBusiness: "Sydney Career Switchers",
  longDate: "Wednesday, 18 June",
  startTime: "7:30am",
  endTime: "9:00am",
  venue: "Bills The Rocks",
  address: "31 Argyle St",
  city: "The Rocks NSW 2000",
  priceLabel: "Free",
  spotsLabel: "12 of 20 confirmed",
};

// ─── Per-scenario typed fixtures ──────────────────────────────────────────

export const userSignupFixture: UserSignupData = {
  firstName: "Maya",
  quizUrl: `${APP}/quiz/life`,
  discoverUrl: `${APP}/discover`,
  supportEmail: SUPPORT,
  unsubscribeUrl: UNSUB,
};

export const rsvpConfirmationFixture: RsvpConfirmationData = {
  firstName: "Maya",
  eventTitle: CROSSFIT.title,
  eventCategory: CROSSFIT.category,
  eventHostName: CROSSFIT.hostName,
  eventLongDate: CROSSFIT.longDate,
  eventStartTime: CROSSFIT.startTime,
  eventEndTime: CROSSFIT.endTime,
  eventVenue: CROSSFIT.venue,
  eventAddress: CROSSFIT.address,
  eventCity: CROSSFIT.city,
  eventPriceLabel: CROSSFIT.priceLabel,
  eventSpotsFilledLabel: CROSSFIT.spotsLabel,
  eventDetailsUrl: `${APP}/events/${CROSSFIT.slug}`,
  addToCalendarUrl: `${APP}/events/${CROSSFIT.slug}/calendar.ics`,
  cancelRsvpUrl: `${APP}/events/${CROSSFIT.slug}/cancel`,
  socialSignalLabel: "Two people from your last event are also going.",
  supportEmail: SUPPORT,
  unsubscribeUrl: UNSUB,
};

export const merchantSignupReceivedFixture: MerchantSignupReceivedData = {
  merchantFirstName: "Noah",
  businessName: POTTERY.hostBusiness,
  dashboardUrl: `${APP}/merchant`,
  supportEmail: SUPPORT,
  unsubscribeUrl: UNSUB,
};

export const merchantEventCreatedFixture: MerchantEventCreatedData = {
  merchantFirstName: "Noah",
  eventTitle: POTTERY.title,
  eventCategory: POTTERY.category,
  eventLongDate: POTTERY.longDate,
  eventStartTime: POTTERY.startTime,
  eventCity: POTTERY.city,
  eventCapacityLabel: POTTERY.capacityLabel,
  eventDashboardUrl: `${APP}/merchant/events/${POTTERY.slug}`,
  editEventUrl: `${APP}/merchant/events/${POTTERY.slug}/edit`,
  supportEmail: SUPPORT,
  unsubscribeUrl: UNSUB,
};

export const merchantNewRsvpFixture: MerchantNewRsvpData = {
  merchantFirstName: "Theo",
  attendeeFirstName: "Maya",
  attendeeCity: "Barangaroo",
  attendeeIntentLabel: "Building a CrossFit habit",
  eventTitle: CROSSFIT.title,
  eventLongDate: CROSSFIT.longDate,
  eventStartTime: CROSSFIT.startTime,
  eventVenue: CROSSFIT.venue,
  eventSpotsFilledLabel: CROSSFIT.spotsLabel,
  attendeesUrl: `${APP}/merchant/events/${CROSSFIT.slug}/attendees`,
  eventDashboardUrl: `${APP}/merchant/events/${CROSSFIT.slug}`,
  supportEmail: SUPPORT,
  unsubscribeUrl: UNSUB,
};

export const waitlistJoinedFixture: WaitlistJoinedData = {
  firstName: "Maya",
  eventTitle: SLOW_DATING.title,
  eventLongDate: SLOW_DATING.longDate,
  eventStartTime: SLOW_DATING.startTime,
  eventVenue: SLOW_DATING.venue,
  eventCity: SLOW_DATING.city,
  eventDetailsUrl: `${APP}/events/${SLOW_DATING.slug}`,
  supportEmail: SUPPORT,
  unsubscribeUrl: UNSUB,
};

export const waitlistPromotedFixture: WaitlistPromotedData = {
  firstName: "Maya",
  eventTitle: SLOW_DATING.title,
  offeredUntil: "7:42 pm Thursday",
  eventDetailsUrl: `${APP}/events/${SLOW_DATING.slug}`,
  supportEmail: SUPPORT,
  unsubscribeUrl: UNSUB,
};

const merchantVerificationBase = {
  merchantFirstName: "Noah",
  businessName: POTTERY.hostBusiness,
  dashboardUrl: `${APP}/merchant`,
  supportEmail: SUPPORT,
  unsubscribeUrl: UNSUB,
};

export const merchantVerificationApprovedFixture: MerchantVerificationStatusData = {
  ...merchantVerificationBase,
  status: "approved",
};

export const merchantVerificationRejectedFixture: MerchantVerificationStatusData = {
  ...merchantVerificationBase,
  status: "rejected",
};

export const merchantVerificationSuspendedFixture: MerchantVerificationStatusData = {
  ...merchantVerificationBase,
  status: "suspended",
};

export const eventCancelledFixture: EventCancelledData = {
  firstName: "Maya",
  eventTitle: FOUNDER_BREAKFAST.title,
  eventHostName: FOUNDER_BREAKFAST.hostName,
  discoverUrl: `${APP}/discover`,
  supportEmail: SUPPORT,
  unsubscribeUrl: UNSUB,
};

export const paymentConfirmedFixture: PaymentConfirmedData = {
  firstName: "Maya",
  eventTitle: CROSSFIT.title,
  eventLongDate: CROSSFIT.longDate,
  eventStartTime: CROSSFIT.startTime,
  eventVenue: CROSSFIT.venue,
  eventCity: CROSSFIT.city,
  amountLabel: CROSSFIT.priceLabel,
  eventDetailsUrl: `${APP}/events/${CROSSFIT.slug}`,
  receiptUrl: `${APP}/account/receipts/inv_seed_001`,
  supportEmail: SUPPORT,
  unsubscribeUrl: UNSUB,
};
