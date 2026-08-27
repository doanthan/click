import { cache } from "react";
import { after } from "next/server";
import type { Session } from "next-auth";
import type { Pool, PoolClient } from "pg";
import { mkdir, readFile, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import {
  normalizeAbn,
  normalizeAcn,
  validateOptionalAbn,
  validateOptionalAcn,
} from "./abn";
import { normalizeAuPhone, validateAuPhone } from "./au-phone";
import { normalizeWebsiteUrl } from "./website-url";
import { HOST_TERMS_VERSION, REFUND_POLICY_VERSION } from "./legal-versions";
import {
  clickEvents,
  interestTagCategories,
  musicTags as staticMusicTags,
  type EventItem,
  type EventStatus,
} from "./click-data";
import { LIFE_QUIZ_SECTION_OPTIONS } from "./life-quiz-sections";
import {
  DEFAULT_MATCHING_WEIGHTS,
  type MatchingWeights,
  type UserMatchContext,
  rankEditorialFallback,
  readinessScore,
  scorePersonalizedEvent,
} from "./personalized-matching";
import { resolveAvatarImage } from "./avatar-images";
import { PILOT_AREA_LABEL, isWithinSydneyPilot } from "./geo";
import { buildEventMediaGallery, type MediaItem } from "./event-media";
import {
  fallbackEventImage,
  resolveEventImage,
  resolveEventImages,
} from "./event-images";
import { deriveEventSubTagsBySlug } from "./matching/feature-store";
import {
  generateEventCandidates,
  generatePeopleCandidates,
  loadManyUserFeatures,
  loadUserFeatures,
} from "./matching/candidates";
import { buildPairFeatures, scorePair } from "./matching/score";
import { MODEL_VERSION } from "./matching/weights";
import type { UserFeatures } from "./matching/types";
import { logEmailEvent, sendTransactionalEmail } from "./email";
import { checkRateLimit } from "./rate-limit";
import { formatPriceLabel } from "./amounts";
import {
  resolveProfilePrompts,
  sanitizeProfilePrompts,
  type ProfilePromptAnswer,
} from "./profile-prompts";
import { regionForEvent, type Region } from "./geo";
import {
  DISCOVERY_CLICK_WINDOW_DAYS,
  POST_EVENT_CLICK_WINDOW_HOURS,
  POST_EVENT_PROMPT_DELAY_HOURS,
  POST_EVENT_CLICK_CAP,
  PROPOSAL_ALTERNATIVES_CAP,
  PAIR_SUPPRESSION_DAYS,
  DISCOVERY_CLICK_CAP,
  MUTUAL_CLOCK_DAYS,
  MIN_CLICK_AGE,
  SUGGESTION_LEADTIME_FLOOR_HOURS,
  SUGGESTION_WINDOW_DAYS,
  ACTIVE_MUTUAL_SOFT_CAP,
  REDISCOVERY_COOLDOWN_DAYS,
  NO_SHOW_SUPPRESSION_THRESHOLD,
  NO_SHOW_LOOKBACK_DAYS,
  NO_SHOW_SUPPRESSION_DAYS,
  INACTIVE_DOWNRANK_DAYS,
  REENGAGEMENT_GRACE_DAYS,
  SEND_CLICK_FLOOR_MS,
  SEND_CLICK_HOURLY_LIMIT,
  type SendClickOutcome,
} from "./clicks/constants";
import {
  severPairCoordination,
  severAllCoordinationForUser,
  pairCoordinationAllowed,
} from "./clicks/teardown";
import {
  calculateApplicationFee,
  getPlatformFeeBps,
  isRealConnectAccountId,
} from "./stripe-connect";
import { isClickMechanicEnabled, isProductionDeployment } from "./runtime-mode";
import { isAdminEmail } from "./admin-emails";
import { logBookingEvent, refundBandFromTier } from "./booking-events";
import {
  type GuestDetailInput,
  type NormalizedGuest,
  GUEST_MAX,
  validateGuestDetails,
  filterSuppressedEmails,
  liveGuestEmailsForEvent,
  reserveUnnamedGuestSeats,
  nameReservedGuestSeats,
  cancelGuestSeatsForTransaction,
  hashGuestEmail,
  isUuid,
} from "./guest-spots";
import { isDerivedFromEmail } from "./display-name";
import { lookupPostcode } from "./postcode";
import { getPostgresPool } from "./postgres";
import { getSupabaseAdmin } from "@/utils/supabase/admin";
import { toTitleCase } from "./text-format";
import { parseEventStart } from "./datetime";
import {
  quoteCancellationRefund,
  type RefundTier,
} from "./refund-policy";
import { writeAuditLog } from "@/utils/admin/audit-logger";

type EventRow = {
  slug: string;
  title: string;
  group_name: string;
  host_name: string;
  category: string;
  status: string;
  booking_model: string;
  starts_at: Date;
  ends_at: Date | null;
  location_name: string;
  suburb: string;
  latitude: string | null;
  longitude: string | null;
  price_cents: number;
  capacity: number;
  image_url: string | null;
  image_alt: string | null;
  description: string;
  relationship_goal: string | null;
  fomo: string | null;
  confirmed_attendees: string | number;
  attendee_avatars: string[] | null;
  tags: string[] | null;
  life_signals: string[] | null;
};

type ProfileRow = {
  id: string;
  role: "attendee" | "merchant" | "admin";
  email: string;
  display_name: string;
};

export type OnboardingInput = {
  displayName: string;
  suburb: string;
  bio: string;
  intents: string[];
  tags: string[];
  // Required: the 18+ gate is enforced from this, server-side. `age` is derived
  // from it and is no longer accepted from the client.
  birthDate: string;
  datingVisible?: boolean;
  flexibleDiscovery?: boolean;
};

// Full payload from the 4-step wizard - the only shape /api/merchant accepts.
// (The legacy short form and its MerchantSignupInput are gone: the non-wizard
// fallback route was removed, which skipped this payload's server-side
// validation.) Document uploads land separately via /api/merchant/documents
// (matched by profile_id) before this submit.
export type MerchantWizardInput = {
  businessName: string;
  tradingName: string;
  abn: string;
  acn: string;
  // Optional - the signup wizard no longer collects business type. Kept on the
  // type (nullable) so the Stripe Connect entity-type mapping still reads it for
  // merchants that have one, and older callers keep compiling.
  businessType?: "sole_trader" | "company" | "partnership" | "trust" | null;
  eventCategoryIds: string[];
  contactEmail: string;
  phone: string;
  websiteUrl: string;
  // Per-platform social handles, keyed by platform. Empty/missing = not on it.
  socials: Partial<Record<"instagram" | "tiktok" | "facebook" | "youtube" | "x", string>>;
  addressStreet: string;
  addressSuburb: string;
  addressState: "NSW" | "VIC" | "QLD" | "WA" | "SA" | "TAS" | "ACT" | "NT";
  addressPostcode: string;
};

export type MerchantProfileRow = {
  id: string;
  business_name: string;
  contact_email: string;
  verification_status: string;
  business_type: string | null;
  stripe_connect_account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_completed_at: string | null;
  auto_approve_events: boolean;
  // The venue address, carried so a surface can answer "is this host inside the
  // launch pilot?" without a second query - /merchant-pending needs it to stop
  // telling a waitlisted host they are in the review queue. Nullable: rows
  // predating the wizard were written without an address.
  address_state: string | null;
  address_postcode: string | null;
};

export type ProfileStatus = {
  exists: boolean;
  role: "attendee" | "merchant" | "admin";
  onboardingComplete: boolean;
  // Whatever is stored in profiles.suburb. Now a 4-digit AU postcode, but older
  // rows hold a suburb NAME - callers that re-display it must handle both.
  suburb: string | null;
  merchantProfile: MerchantProfileRow | null;
  // True only when the underlying read FAILED and the rest of this object is a
  // safe-but-untrue fallback. Surfaces that gate on merchantProfile must check
  // this before concluding the viewer has no merchant account - see the catch
  // in getProfileStatusUncached.
  degraded: boolean;
  bookmarkedEventIds: string[];
  registeredEventIds: string[];
  // Subset of registeredEventIds that are waitlist-only (status='waitlisted').
  // registeredEventIds conflates confirmed + waitlisted; this lets callers tell
  // them apart without a second query.
  waitlistedEventIds: string[];
  photoUrl: string | null;
  // Whether the viewer has at least one gallery photo. Lets the "add a photo"
  // nudge stand down for someone who already has a recognisable photo even
  // without an avatar set (bug board: nudge persisted with a photo on screen).
  hasGalleryPhotos: boolean;
  // Whether the viewer has opted into dating visibility. Used to gate
  // dating-related signals (e.g. the radar "open to dating" FOMO nudge) so they
  // only surface when BOTH parties are dating-visible.
  datingVisible: boolean;
};

type LocalEventStore = {
  events: EventItem[];
  registrations: Record<string, Record<string, "confirmed" | "waitlisted">>;
};

export type CreateEventInput = {
  title: string;
  groupName: string;
  category: string;
  startsAt: string;
  // Event length in minutes; combined with startsAt to derive ends_at. Falls
  // back to 120 (2 hours) when absent so older callers keep working.
  durationMinutes?: number;
  locationName: string;
  suburb: string;
  // Full street address shown to confirmed attendees on the event page.
  // Optional - falls back to venue + suburb when absent.
  address?: string;
  // Captured from the Mapbox address autocomplete in the create wizard. When
  // null we fall back to the Sydney CBD reference point used elsewhere.
  latitude: number | null;
  longitude: number | null;
  price: string;
  capacity: number;
  description: string;
  relationshipGoal: string;
  tags: string;
  imageUrl?: string;
  imageAlt?: string;
  // Full ordered gallery from the wizard's multi-photo Media step. Persisted
  // to events.image_urls (see 015_event_image_urls.sql). When set, the first
  // entry is mirrored to image_url so existing readers don't need to change.
  imageUrls?: string[];
};

export type AdminEventRow = {
  id: string;
  title: string;
  category: string;
  status: EventStatus;
  booking: EventItem["booking"];
  host: string;
  attendees: number;
  capacity: number;
  startsAt: string;
  createdAt: string | null;
  region: Region;
  suburb: string | null;
  locationName: string | null;
  address: string | null;
  // A merchant-proposed new address awaiting admin review (events with attendees
  // can't self-edit their address). Null when nothing's pending. Drives the
  // approve/reject address banner in the admin queue.
  pendingAddress: string | null;
  lat: number | null;
  lng: number | null;
  priceCents: number;
  // True when the event charges a price but the owning merchant hasn't
  // finished Stripe Connect payout setup (charges_enabled = false). Surfaces a
  // warning in the admin queue so reviewers know approving it publishes an
  // event no one can pay for until the merchant connects payouts. Always false
  // for free or platform-owned events.
  payoutsNotConnected: boolean;
  // False once the event has already finished (end time, or start time when no
  // end is set, is in the past). Drives the admin queue's "can't approve a past
  // event" gate. (When recurring events land, a still-repeating series should
  // stay approvable - extend this predicate then.)
  approvable: boolean;
  // Interest tags attached to the event, editable by admins from the queue.
  tags: { slug: string; label: string }[];
};

export type AdminMemberEventRef = {
  slug: string;
  title: string;
};

export type AdminMemberRow = {
  id: string;
  displayName: string;
  email: string;
  role: "attendee" | "merchant" | "admin";
  suburb: string | null;
  // False for profiles that entered an email but never finished onboarding -
  // they're listed (so admins can nudge them) but not counted as attendees.
  onboardingComplete: boolean;
  intents: string[];
  bookmarks: number;
  registrations: number;
  events: AdminMemberEventRef[];
  emailVerified: boolean;
  photoVerified: boolean;
  joinedAt: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  isBanned: boolean;
};

export type AdminMemberDetailTag = {
  slug: string;
  label: string;
  tagType: string;
  source: string;
};

export type AdminMemberDetailEvent = {
  slug: string;
  title: string;
  startsAt: string | null;
  status: string;
  checkedInAt: string | null;
  rsvpAt: string;
};

export type AdminMemberDetailBookmark = {
  slug: string;
  title: string;
  startsAt: string | null;
  createdAt: string;
};

export type AdminMemberDetailTransaction = {
  id: string;
  eventSlug: string | null;
  eventTitle: string | null;
  amountCents: number;
  currency: string;
  status: string;
  stripePaymentIntentId: string | null;
  createdAt: string;
};

export type AdminMemberDetailPersona = {
  personaName: string;
  socialEnergy: string;
  pace: string;
  openness: string;
  engagementFrequency: string;
  intentMix: Record<string, number>;
  generatedAt: string;
};

export type AdminMemberDetail = {
  id: string;
  displayName: string;
  email: string;
  role: "attendee" | "merchant" | "admin";
  city: string | null;
  suburb: string | null;
  bio: string | null;
  photoUrl: string | null;
  age: number | null;
  intents: string[];
  emailVerified: boolean;
  photoVerified: boolean;
  joinedAt: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  /** Set once the account has been de-identified at the member's request. */
  deletedAt: string | null;
  tags: AdminMemberDetailTag[];
  events: AdminMemberDetailEvent[];
  /**
   * Confirmed seats for events that have not started yet, counted in SQL.
   * The deletion panel warns on this: erasing the account leaves the seat held
   * and nobody to email about it.
   */
  upcomingConfirmedBookings: number;
  bookmarks: AdminMemberDetailBookmark[];
  transactions: AdminMemberDetailTransaction[];
  persona: AdminMemberDetailPersona | null;
};

export type AdminMerchantRow = {
  id: string;
  businessName: string;
  contactEmail: string;
  verificationStatus: "pending" | "approved" | "rejected" | "suspended" | string;
  websiteUrl: string | null;
  abn: string | null;
  ownerName: string;
  ownerEmail: string;
  eventsHosted: number;
  createdAt: string;
  autoApproveEvents: boolean;
};

export type AdminMerchantDetailEvent = {
  id: string;
  slug: string;
  title: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  locationName: string | null;
  suburb: string | null;
  capacity: number | null;
  priceCents: number;
  currency: string;
  confirmedAttendees: number;
  waitlistedAttendees: number;
  grossRevenueCents: number;
  paidRevenueCents: number;
};

export type AdminMerchantDetailTransaction = {
  id: string;
  eventSlug: string | null;
  eventTitle: string | null;
  attendeeName: string | null;
  attendeeEmail: string | null;
  amountCents: number;
  currency: string;
  status: string;
  stripePaymentIntentId: string | null;
  createdAt: string;
};

export type AdminMerchantDetailTotals = {
  upcomingEvents: number;
  pastEvents: number;
  totalEvents: number;
  totalBookings: number;
  paidBookings: number;
  totalRevenueCents: number;
  paidRevenueCents: number;
  pendingRevenueCents: number;
  refundedRevenueCents: number;
};

export type AdminMerchantDetail = {
  id: string;
  businessName: string;
  tradingName: string | null;
  contactEmail: string;
  phone: string | null;
  websiteUrl: string | null;
  abn: string | null;
  acn: string | null;
  businessType: string | null;
  socials: Record<string, string>;
  verificationStatus: "pending" | "approved" | "rejected" | "suspended" | string;
  autoApproveEvents: boolean;
  stripeConnectAccountId: string | null;
  addressStreet: string | null;
  addressSuburb: string | null;
  addressState: string | null;
  addressPostcode: string | null;
  submittedAt: string | null;
  createdAt: string;
  owner: {
    id: string;
    displayName: string;
    email: string;
    photoUrl: string | null;
  };
  eventCategories: string[];
  upcomingEvents: AdminMerchantDetailEvent[];
  pastEvents: AdminMerchantDetailEvent[];
  transactions: AdminMerchantDetailTransaction[];
  totals: AdminMerchantDetailTotals;
};

export type AdminTagRow = {
  id: string;
  label: string;
  slug: string;
  tagType: string;
  categoryName: string | null;
  usageCount: number;
  createdAt: string;
};

export type AdminAuditRow = {
  id: string;
  action: string;
  entityTable: string;
  actorName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AdminMetrics = {
  totalMembers: number;
  newMembersThisWeek: number;
  totalMerchants: number;
  pendingMerchants: number;
  totalEvents: number;
  pendingEvents: number;
  confirmedRsvps: number;
  mutualClicks: number;
};

export type DashboardData = {
  userName: string;
  upcomingEvents: EventItem[];
  // Events the member is waitlisted for - kept separate from confirmed
  // "upcoming plans" so a waitlist seat isn't presented as a confirmed RSVP.
  waitlistedEvents: EventItem[];
  savedEvents: EventItem[];
  stats: {
    upcoming: number;
    saved: number;
    clicks: number;
    radar: string;
  };
};

const sydneyReference = {
  lat: -33.8688,
  lng: 151.2093,
};

const isServerlessRuntime = Boolean(
  process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY ||
    process.env.AWS_EXECUTION_ENV,
);
const localStoreDir = isServerlessRuntime
  ? path.join(os.tmpdir(), "click-data")
  : path.join(process.cwd(), ".data");
const localStorePath = path.join(localStoreDir, "click-events.json");
const emptyLocalStore: LocalEventStore = { events: [], registrations: {} };

function distanceKmFromSydney(lat: number, lng: number) {
  const radiusKm = 6371;
  const latDelta = ((lat - sydneyReference.lat) * Math.PI) / 180;
  const lngDelta = ((lng - sydneyReference.lng) * Math.PI) / 180;
  const originLat = (sydneyReference.lat * Math.PI) / 180;
  const eventLat = (lat * Math.PI) / 180;
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(originLat) * Math.cos(eventLat) * Math.sin(lngDelta / 2) ** 2;

  return Math.round(radiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)) * 10) / 10;
}

const SYDNEY_DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Sydney",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatDate(date: Date) {
  // "Today" / "Tomorrow" in Sydney. At 5pm on the night of an event the
  // dashboard used to read "Tue, 25 Aug · 7:00 pm" among identical-looking
  // cards and never volunteer that tonight was the night. Resolved here, on the
  // server, so it stays out of client render (react-hooks/purity) and every
  // surface that shows a date agrees.
  const now = new Date();
  const key = SYDNEY_DAY_KEY.format(date);
  if (key === SYDNEY_DAY_KEY.format(now)) return "Today";
  if (key === SYDNEY_DAY_KEY.format(new Date(now.getTime() + 86_400_000))) return "Tomorrow";
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Australia/Sydney",
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Sydney",
  }).format(date);
}

function eventStatusFromDb(status: string): EventStatus {
  if (status === "featured") return "Featured";
  if (status === "waitlist") return "Waitlist";
  if (status === "locked") return "Locked";
  if (status === "pending") return "Pending";
  if (status === "rejected") return "Rejected";
  if (status === "cancelled") return "Cancelled";
  return "Live";
}

const BOOKABLE_EVENT_STATUSES = new Set(["live", "featured", "locked", "waitlist"]);

function isBookableEventStatus(status: string) {
  return BOOKABLE_EVENT_STATUSES.has(status);
}

function bookingFromDb(bookingModel: string): EventItem["booking"] {
  return bookingModel === "external" ? "External" : "Click-managed";
}

function eventFromRow(row: EventRow): EventItem {
  const startsAt = row.starts_at;
  // An event whose merchant never pinned an address has NO distance. Defaulting
  // it to the CBD made it read as 0.0 km, win the Nearest sort and pass a 2 km
  // filter, while rendering no distance at all on the card.
  const hasCoords = row.latitude != null && row.longitude != null;
  const lat = hasCoords ? Number(row.latitude) : sydneyReference.lat;
  const lng = hasCoords ? Number(row.longitude) : sydneyReference.lng;

  return {
    id: row.slug,
    title: row.title,
    group: row.group_name,
    host: row.host_name,
    category: row.category,
    date: formatDate(startsAt),
    time: formatTime(startsAt),
    startsAt: startsAt.toISOString(),
    endsAt: row.ends_at ? row.ends_at.toISOString() : null,
    location: row.location_name,
    suburb: row.suburb,
    distanceKm: hasCoords ? distanceKmFromSydney(lat, lng) : null,
    lat,
    lng,
    price: formatPriceLabel(row.price_cents),
    attendees: Number(row.confirmed_attendees),
    attendeeAvatars: row.attendee_avatars ?? [],
    capacity: row.capacity,
    // When a merchant hasn't uploaded a cover, fall back to a category-relevant
    // stock image rather than a single generic yoga photo (which read as a
    // "random" unrelated pic on, e.g., a floral or food event).
    image: resolveEventImage(row.image_url, row.category, row.title),
    imageAlt: row.image_alt ?? "Click event",
    description: row.description,
    tags: row.tags ?? [],
    lifeSignals: row.life_signals ?? [],
    // No invented social proof. The fallback was never null, so the render
    // guard could never fire and an empty event still claimed attendees.
    fomo: row.fomo ?? null,
    status: eventStatusFromDb(row.status),
    booking: bookingFromDb(row.booking_model),
    relationshipGoal: row.relationship_goal ?? "Help people meet through a shared plan.",
  };
}

function slugFromTitle(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug || `event-${Date.now()}`;
}

function parsePriceCents(price: string) {
  const trimmed = price.trim().toLowerCase();
  if (!trimmed || trimmed === "free") return 0;

  const numeric = Number(trimmed.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

function authError(message = "You need to log in first.") {
  const error = new Error(message);
  error.name = "AuthRequiredError";
  return error;
}

function databaseUnavailableError() {
  const error = new Error("Postgres is not configured or unavailable for this action.");
  error.name = "DatabaseUnavailableError";
  return error;
}

function isDatabaseConnectivityError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const code = (error as { code?: string }).code;

  return (
    error.name === "AggregateError" ||
    error.name === "DatabaseUnavailableError" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "EHOSTUNREACH" ||
    code === "ETIMEDOUT" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN"
  );
}

async function sendWorkflowEmail(input: {
  to: string;
  subject: string;
  text: string;
}) {
  try {
    await sendTransactionalEmail(input);
  } catch (error) {
    if (process.env.CLICK_EMAIL_DEBUG === "true") {
      console.warn("Click workflow email failed.", error);
    }
  }
}

// Support inbox printed in every templated email. letsclick.app is the domain
// Click actually owns - the old hello@click.app address bounced.
const SUPPORT_EMAIL = "hello@letsclick.app";

// Shared site-origin lookup for absolute URLs in templated emails. Falls back
// to localhost so dev sessions still produce clickable links in the drawer.
function emailOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

// Date/time formatting for the templated emails. We always use Sydney
// (defaulting events.timezone) so the subject line and body match the venue's
// local time rather than the merchant's clock.
function formatEmailDates(startsAt: Date, endsAt: Date | null, timezone: string) {
  const tz = timezone || "Australia/Sydney";
  const eventLongDate = new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: tz,
  }).format(startsAt);
  const eventShortDate = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: tz,
  }).format(startsAt);
  const eventStartTime = new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  }).format(startsAt);
  const eventEndTime = endsAt
    ? new Intl.DateTimeFormat("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: tz,
      }).format(endsAt)
    : "";
  return { eventLongDate, eventShortDate, eventStartTime, eventEndTime };
}

// Post-commit emailer for a confirmed RSVP. Runs OUTSIDE the txn so a failed
// template lookup never rolls back the booking. Pulls everything needed for
// both templates in a single query so we don't re-walk the tree twice.
async function logRsvpEmails(
  pool: NonNullable<ReturnType<typeof getPostgresPool>>,
  eventDbId: string,
  attendeeProfileId: string,
  // For paid bookings (called from markPaymentSucceeded), overrides the
  // displayed price label with the actual amount charged and surfaces the
  // receipt URL. Free RSVPs omit this and the templates render unchanged.
  receipt?: { amountPaidCents: number; currency: string },
) {
  try {
    const result = await pool.query<{
      event_id: string;
      event_slug: string;
      event_title: string;
      event_category: string;
      starts_at: Date;
      ends_at: Date | null;
      timezone: string;
      location_name: string;
      address: string | null;
      suburb: string;
      city: string;
      price_cents: number;
      currency: string;
      capacity: number;
      host_name: string;
      confirmed_count: string;
      attendee_email: string;
      attendee_display_name: string;
      attendee_suburb: string | null;
      merchant_id: string | null;
      merchant_business_name: string | null;
      merchant_contact_email: string | null;
      merchant_owner_profile_id: string | null;
      merchant_owner_display_name: string | null;
    }>(
      `
        select
          e.id::text as event_id,
          e.slug as event_slug,
          e.title as event_title,
          e.category as event_category,
          e.starts_at,
          e.ends_at,
          e.timezone,
          e.location_name,
          e.address,
          e.suburb,
          e.city,
          e.price_cents,
          e.currency::text as currency,
          e.capacity,
          e.host_name,
          (
            select count(*)::text
            from event_attendees a
            where a.event_id = e.id and a.status = 'confirmed'
          ) as confirmed_count,
          p.email::text as attendee_email,
          p.display_name as attendee_display_name,
          p.suburb as attendee_suburb,
          mp.id::text as merchant_id,
          mp.business_name as merchant_business_name,
          mp.contact_email::text as merchant_contact_email,
          mp.profile_id::text as merchant_owner_profile_id,
          owner.display_name as merchant_owner_display_name
        from events e
        join profiles p on p.id = $2::uuid
        left join merchant_profiles mp on mp.id = e.merchant_profile_id
        left join profiles owner on owner.id = mp.profile_id
        where e.id = $1::uuid
        limit 1
      `,
      [eventDbId, attendeeProfileId],
    );

    const row = result.rows[0];
    if (!row) return;

    const origin = emailOrigin();
    const dates = formatEmailDates(
      row.starts_at,
      row.ends_at,
      row.timezone,
    );
    const confirmedCount = Number(row.confirmed_count) || 0;
    const spotsLabel = `${confirmedCount} of ${row.capacity} spots filled`;
    const attendeeFirstName =
      (row.attendee_display_name || "").split(/\s+/)[0] || "there";
    const merchantFirstName =
      (row.merchant_owner_display_name || row.merchant_business_name || "")
        .split(/\s+/)[0] || "there";

    // Paid bookings: show the actual amount charged with a "Paid" suffix in
    // the existing price slot. Falls back to the event's listed price for
    // free RSVPs.
    const priceLabelForEmail = receipt && receipt.amountPaidCents > 0
      ? `${formatPriceLabel(receipt.amountPaidCents, receipt.currency)} · Paid`
      : formatPriceLabel(row.price_cents, row.currency);

    await logEmailEvent({
      template: "rsvp-attendee",
      toEmail: row.attendee_email,
      toProfileId: attendeeProfileId,
      vars: {
        firstName: attendeeFirstName,
        eventTitle: row.event_title,
        eventLongDate: dates.eventLongDate,
        eventShortDate: dates.eventShortDate,
        eventStartTime: dates.eventStartTime,
        eventEndTime: dates.eventEndTime,
        eventVenue: row.location_name,
        eventAddress: row.address ?? "",
        eventCity: row.city,
        eventHostName: row.host_name,
        eventPriceLabel: priceLabelForEmail,
        eventCategory: row.event_category,
        eventSpotsFilledLabel: spotsLabel,
        socialSignalLabel: "",
        eventDetailsUrl: `${origin}/events/${row.event_slug}`,
        // /confirmed-events has no cancel affordance - its card CTA short-
        // circuits to a plain link. The control lives on the event page.
        cancelRsvpUrl: `${origin}/events/${row.event_slug}`,
        addToCalendarUrl: `${origin}/events/${row.event_slug}`,
        supportEmail: SUPPORT_EMAIL,
        unsubscribeUrl: `${origin}/account-settings`,
      },
    });

    if (row.merchant_contact_email) {
      await logEmailEvent({
        template: "rsvp-merchant",
        toEmail: row.merchant_contact_email,
        toProfileId: row.merchant_owner_profile_id,
        vars: {
          merchantFirstName,
          attendeeFirstName,
          attendeeCity: row.attendee_suburb ?? "",
          attendeeIntentLabel: "",
          eventTitle: row.event_title,
          eventLongDate: dates.eventLongDate,
          eventStartTime: dates.eventStartTime,
          eventVenue: row.location_name,
          eventSpotsFilledLabel: spotsLabel,
          // event_SLUG, not event_id. /merchant/events/[eventId] resolves its
          // param as a slug (getMerchantEventDetail: `where event.slug = $1`), so
          // a UUID matched nothing and the page called notFound(). Both CTAs in
          // the host's primary notification - "see your attendee list" and the
          // dashboard link - landed on a 404. logRsvpCancelledEmails at :1276
          // always had this right; only this one was passing the id.
          attendeesUrl: `${origin}/merchant/events/${row.event_slug}`,
          eventDashboardUrl: `${origin}/merchant/events/${row.event_slug}`,
          supportEmail: SUPPORT_EMAIL,
          unsubscribeUrl: `${origin}/account-settings`,
        },
      });
    }
  } catch (error) {
    console.warn("logRsvpEmails failed", { eventDbId, attendeeProfileId, error });
  }
}

// Post-commit emailer for a waitlist join. Same shape as logRsvpEmails: one
// supplementary SELECT outside the txn, fire-and-forget, so a template problem
// can never roll back the queue insert.
async function logWaitlistJoinedEmail(
  pool: NonNullable<ReturnType<typeof getPostgresPool>>,
  eventDbId: string,
  attendeeProfileId: string,
) {
  try {
    const result = await pool.query<{
      event_slug: string;
      event_title: string;
      starts_at: Date;
      ends_at: Date | null;
      timezone: string;
      location_name: string;
      city: string;
      attendee_email: string;
      attendee_display_name: string;
    }>(
      `
        select
          e.slug as event_slug,
          e.title as event_title,
          e.starts_at,
          e.ends_at,
          e.timezone,
          e.location_name,
          e.city,
          p.email::text as attendee_email,
          p.display_name as attendee_display_name
        from events e
        join profiles p on p.id = $2::uuid
        where e.id = $1::uuid
        limit 1
      `,
      [eventDbId, attendeeProfileId],
    );

    const row = result.rows[0];
    if (!row) return;

    const origin = emailOrigin();
    const dates = formatEmailDates(row.starts_at, row.ends_at, row.timezone);

    await logEmailEvent({
      template: "waitlist-joined-attendee",
      toEmail: row.attendee_email,
      toProfileId: attendeeProfileId,
      vars: {
        firstName: (row.attendee_display_name || "").split(/\s+/)[0] || "there",
        eventTitle: row.event_title,
        eventLongDate: dates.eventLongDate,
        eventStartTime: dates.eventStartTime,
        eventVenue: row.location_name,
        eventCity: row.city,
        eventDetailsUrl: `${origin}/events/${row.event_slug}`,
        discoverUrl: `${origin}/discover`,
        offerWindowLabel: `${WAITLIST_OFFER_MINUTES} minutes`,
        supportEmail: SUPPORT_EMAIL,
        unsubscribeUrl: `${origin}/account-settings`,
      },
    });
  } catch (error) {
    console.warn("logWaitlistJoinedEmail failed", {
      eventDbId,
      attendeeProfileId,
      error,
    });
  }
}

// A freed seat has been offered to the next person in the queue. Called from
// all four promotion sites (attendee cancel, guest-seat cancel, and the two
// expiry crons) so the offer email is identical wherever the seat came from.
// The offer window is already ticking when this runs, so it stays awaited
// rather than fire-and-forget - but it never throws into the caller.
async function logWaitlistPromotedEmail(
  pool: NonNullable<ReturnType<typeof getPostgresPool>>,
  promotion: WaitlistPromotion,
) {
  // Honoured here rather than at the four call sites, so a fifth promotion site
  // cannot reintroduce the mail. The in-app notification is written regardless.
  if (!promotion.wantsOfferEmail) return;
  try {
    const result = await pool.query<{
      starts_at: Date;
      ends_at: Date | null;
      timezone: string;
      location_name: string;
      city: string;
    }>(
      `
        select starts_at, ends_at, timezone, location_name, city
        from events
        where slug = $1
        limit 1
      `,
      [promotion.eventSlug],
    );

    const row = result.rows[0];
    if (!row) return;

    const origin = emailOrigin();
    const tz = row.timezone || "Australia/Sydney";
    const dates = formatEmailDates(row.starts_at, row.ends_at, tz);
    // Absolute wall-clock deadline in the venue's timezone. A relative "30
    // minutes" is wrong the moment the mail sits in a queue.
    const offerExpiresLabel = new Intl.DateTimeFormat("en-AU", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: tz,
    }).format(promotion.offeredUntil);

    await logEmailEvent({
      template: "waitlist-promoted-attendee",
      toEmail: promotion.email,
      toProfileId: promotion.profileId,
      vars: {
        firstName: (promotion.displayName || "").split(/\s+/)[0] || "there",
        eventTitle: promotion.eventTitle,
        eventLongDate: dates.eventLongDate,
        eventStartTime: dates.eventStartTime,
        eventVenue: row.location_name,
        eventCity: row.city,
        claimUrl: `${origin}/events/${promotion.eventSlug}`,
        offerExpiresLabel,
        offerWindowLabel: `${WAITLIST_OFFER_MINUTES} minutes`,
        supportEmail: SUPPORT_EMAIL,
        unsubscribeUrl: `${origin}/account-settings`,
      },
    });
  } catch (error) {
    console.warn("logWaitlistPromotedEmail failed", {
      eventSlug: promotion.eventSlug,
      error,
    });
  }
}

/**
 * Everything that has to happen to the BOOKING once money has gone back.
 *
 * issueRefund only ever touched the ledger. An admin refunding a ticket from
 * /admin/transactions moved the money and flipped payment_transactions to
 * 'refunded', and then: the attendee stayed `confirmed` on the merchant's
 * roster, kept holding a seat against capacity so the next waitlister was never
 * promoted, stayed on the reminder list, and was told nothing at all - no
 * notification, no email. They would have turned up to an event they had been
 * refunded for.
 *
 * `releaseSeat` is opt-in and defaults off on purpose. cancelRegistration and
 * the settled-after-cancellation auto-refund BOTH cancel the seat themselves
 * before calling issueRefund, and cancelRegistration also promotes the queue -
 * doing it again here would promote two people into one freed seat.
 *
 * Best-effort and post-commit throughout: the money has already moved, so
 * nothing in here may throw back into the refund.
 */
/**
 * "You paid, but the event died while you were paying."
 *
 * markPaymentSucceeded already handles the money for this case: it flips the
 * capture to paid, cancels the seat, and issues a full refund. What it could not
 * do is tell the buyer, because /events/[slug] hides a cancelled or unpublished
 * event from everyone - so Stripe returned them to a 404. Their card had been
 * charged real money on the LIVE key and the only trace was a notification
 * buried in the dashboard.
 *
 * Returns a notice when this viewer has a settled payment on this event whose
 * seat is cancelled, so the page can say what happened. Null otherwise, and the
 * 404 stands.
 */
export async function getUnfulfilledPaymentNotice(
  slug: string,
  session: Session | null,
): Promise<{ amountLabel: string; refunded: boolean; eventTitle: string } | null> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!pool || !email) return null;

  try {
    const result = await pool.query<{
      amount_cents: number;
      currency: string;
      status: string;
      event_title: string;
    }>(
      `
        select pt.amount_cents, pt.currency::text, pt.status::text, e.title as event_title
        from payment_transactions pt
        join events e on e.id = pt.event_id
        join profiles p on p.id = pt.profile_id
        join event_attendees ea
          on ea.event_id = pt.event_id and ea.profile_id = pt.profile_id
        where e.slug = $1
          and p.email = $2
          and pt.status in ('paid', 'refunded', 'partially_refunded')
          and ea.status = 'cancelled'
        order by pt.updated_at desc
        limit 1
      `,
      [slug, email],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      amountLabel: formatAud(row.amount_cents, row.currency || "AUD"),
      refunded: row.status === "refunded",
      eventTitle: row.event_title,
    };
  } catch (error) {
    console.warn("getUnfulfilledPaymentNotice failed", { slug, error });
    return null;
  }
}

/**
 * A viewer who holds (or held) a seat on an event that has since been cancelled
 * or unpublished. The event page 404'd these people - including the attendee the
 * in-app "Event cancelled" notification links straight here - so the only record
 * of a booking they paid for simply disappeared. Free RSVPs are covered too:
 * they have no payment row, and they were the ones getting nothing at all.
 */
export async function getCancelledBookingNotice(
  slug: string,
  session: Session | null,
): Promise<{
  eventTitle: string;
  amountLabel: string | null;
  refunded: boolean;
  wasPaid: boolean;
} | null> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!pool || !email) return null;

  try {
    const result = await pool.query<{
      event_title: string;
      amount_cents: number | null;
      currency: string | null;
      txn_status: string | null;
    }>(
      `
        select e.title as event_title,
               pt.amount_cents,
               pt.currency::text,
               pt.status::text as txn_status
        from event_attendees ea
        join events e on e.id = ea.event_id
        join profiles p on p.id = ea.profile_id
        left join payment_transactions pt
          on pt.id = ea.payment_transaction_id
         and pt.status in ('paid', 'refunded', 'partially_refunded')
        where e.slug = $1
          and p.email = $2
        order by ea.updated_at desc
        limit 1
      `,
      [slug, email],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      eventTitle: row.event_title,
      amountLabel:
        row.amount_cents != null ? formatAud(row.amount_cents, row.currency || "AUD") : null,
      refunded: row.txn_status === "refunded",
      wasPaid: row.amount_cents != null,
    };
  } catch (error) {
    console.warn("getCancelledBookingNotice failed", { slug, error });
    return null;
  }
}

export async function settleRefundedBooking(input: {
  paymentTransactionId: string;
  refundedAmountCents: number;
  /** Cancel the seat + guest seats and promote the queue. See above. */
  releaseSeat: boolean;
  /**
   * Skip the email when the caller already sends its own refund copy.
   *
   * `"if-released"` exists for the `charge.refunded` webhook, which fires for
   * EVERY refund - including the four paths that have already cancelled the
   * seat and told the attendee themselves. Emailing only when THIS call is
   * what freed the seat makes the webhook a backstop for refunds nothing else
   * handled (one taken in the Stripe dashboard) rather than a second copy
   * behind the ones that were.
   */
  notify: boolean | "if-released";
}) {
  const pool = getPostgresPool();
  if (!pool) return;

  try {
    const detail = await pool.query<{
      profile_id: string;
      email: string;
      display_name: string | null;
      event_id: string;
      event_title: string;
      event_slug: string;
      starts_at: Date;
      ends_at: Date | null;
      timezone: string;
      currency: string;
    }>(
      `
        select pt.profile_id::text,
               p.email::text,
               p.display_name,
               e.id::text as event_id,
               e.title as event_title,
               e.slug as event_slug,
               e.starts_at,
               e.ends_at,
               e.timezone,
               pt.currency::text
        from payment_transactions pt
        join profiles p on p.id = pt.profile_id
        join events e on e.id = pt.event_id
        where pt.id = $1::uuid
        limit 1
      `,
      [input.paymentTransactionId],
    );
    const row = detail.rows[0];
    if (!row) return;

    let promotion: WaitlistPromotion | null = null;
    // Whether this call is what moved the seat out of 'confirmed' /
    // 'pending_payment' - the signal `notify: "if-released"` gates on.
    let seatWasReleased = false;

    if (input.releaseSeat) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const cancelled = await client.query<{ id: string }>(
          `
            update event_attendees
            set status = 'cancelled', hold_expires_at = null, updated_at = now()
            where event_id = $1::uuid
              and profile_id = $2::uuid
              and status in ('confirmed', 'pending_payment')
            returning id::text
          `,
          [row.event_id, row.profile_id],
        );
        // Only touch the queue if THIS call is what freed the seat. A replayed
        // refund finds the row already cancelled and must not promote again.
        if ((cancelled.rowCount ?? 0) > 0) {
          seatWasReleased = true;
          await cancelGuestSeatsForTransaction(client, input.paymentTransactionId);
          promotion = await promoteNextWaitlister(
            client,
            row.event_id,
            row.event_title,
            row.event_slug,
          );
          await client.query(
            `
              insert into notifications (profile_id, title, body, action_url)
              values ($1::uuid, $2, $3, $4)
            `,
            [
              row.profile_id,
              "Booking refunded",
              `Your booking for ${row.event_title} was refunded. Your spot has been released.`,
              `/events/${row.event_slug}`,
            ],
          );
        }
        await client.query("commit");
      } catch (error) {
        await client.query("rollback").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    }

    if (promotion) await logWaitlistPromotedEmail(pool, promotion);

    const shouldNotify =
      input.notify === "if-released" ? seatWasReleased : input.notify;

    if (shouldNotify) {
      const origin = emailOrigin();
      const dates = formatEmailDates(
        row.starts_at,
        row.ends_at,
        row.timezone || "Australia/Sydney",
      );
      await logEmailEvent({
        template: "booking-refunded-attendee",
        toEmail: row.email,
        toProfileId: row.profile_id,
        vars: {
          firstName: (row.display_name || "").split(/\s+/)[0] || "there",
          eventTitle: row.event_title,
          eventLongDate: dates.eventLongDate,
          refundAmount: formatAud(input.refundedAmountCents, row.currency || "AUD"),
          refundReasonLine: input.releaseSeat
            ? "Your spot has been released, so there's nothing to cancel."
            : "Nothing more is needed from you.",
          discoverUrl: `${origin}/discover`,
          supportEmail: SUPPORT_EMAIL,
          unsubscribeUrl: `${origin}/account-settings`,
        },
      });
    }
  } catch (error) {
    console.warn("settleRefundedBooking failed", {
      paymentTransactionId: input.paymentTransactionId,
      error,
    });
  }
}

// Post-approval emailer. Fetches the event + owning merchant and logs the
// event-approved-merchant template. Standalone (like logRsvpEmails) so the
// admin approve handler stays lean and a template hiccup never bubbles up.
async function logEventApprovedEmail(
  pool: NonNullable<ReturnType<typeof getPostgresPool>>,
  eventSlug: string,
) {
  try {
    const result = await pool.query<{
      event_slug: string;
      event_title: string;
      event_category: string;
      starts_at: Date;
      ends_at: Date | null;
      timezone: string;
      city: string;
      capacity: number;
      merchant_contact_email: string | null;
      merchant_business_name: string | null;
      merchant_owner_profile_id: string | null;
      merchant_owner_display_name: string | null;
    }>(
      `
        select
          e.slug as event_slug,
          e.title as event_title,
          e.category as event_category,
          e.starts_at,
          e.ends_at,
          e.timezone,
          e.city,
          e.capacity,
          mp.contact_email::text as merchant_contact_email,
          mp.business_name as merchant_business_name,
          mp.profile_id::text as merchant_owner_profile_id,
          owner.display_name as merchant_owner_display_name
        from events e
        left join merchant_profiles mp on mp.id = e.merchant_profile_id
        left join profiles owner on owner.id = mp.profile_id
        where e.slug = $1
        limit 1
      `,
      [eventSlug],
    );

    const row = result.rows[0];
    // Platform-owned events have no merchant to notify - nothing to log.
    if (!row || !row.merchant_contact_email) return;

    const origin = emailOrigin();
    const dates = formatEmailDates(row.starts_at, row.ends_at, row.timezone);
    const merchantFirstName =
      (row.merchant_owner_display_name || row.merchant_business_name || "")
        .split(/\s+/)[0] || "there";

    await logEmailEvent({
      template: "event-approved-merchant",
      toEmail: row.merchant_contact_email,
      toProfileId: row.merchant_owner_profile_id,
      vars: {
        merchantFirstName,
        eventTitle: row.event_title,
        eventLongDate: dates.eventLongDate,
        eventStartTime: dates.eventStartTime,
        eventCity: row.city,
        eventCategory: row.event_category,
        eventCapacityLabel: `Capacity ${row.capacity}`,
        publicEventUrl: `${origin}/events/${row.event_slug}`,
        eventDashboardUrl: `${origin}/merchant/events/${row.event_slug}`,
        supportEmail: SUPPORT_EMAIL,
        unsubscribeUrl: `${origin}/account-settings`,
      },
    });
  } catch (error) {
    console.warn("logEventApprovedEmail failed", { eventSlug, error });
  }
}

// Post-commit emailer for a rejected event submission. Mirrors
// logEventApprovedEmail's merchant lookup, but carries the admin's free-text
// reason through to the template. Platform-owned events have no merchant to
// notify, so we skip them. Fire-and-forget - never bubbles into the reject
// response.
async function logEventRejectedEmail(
  pool: NonNullable<ReturnType<typeof getPostgresPool>>,
  eventSlug: string,
  rejectionReason: string,
) {
  try {
    const result = await pool.query<{
      event_title: string;
      merchant_contact_email: string | null;
      merchant_business_name: string | null;
      merchant_owner_profile_id: string | null;
      merchant_owner_display_name: string | null;
    }>(
      `
        select
          e.title as event_title,
          mp.contact_email::text as merchant_contact_email,
          mp.business_name as merchant_business_name,
          mp.profile_id::text as merchant_owner_profile_id,
          owner.display_name as merchant_owner_display_name
        from events e
        left join merchant_profiles mp on mp.id = e.merchant_profile_id
        left join profiles owner on owner.id = mp.profile_id
        where e.slug = $1
        limit 1
      `,
      [eventSlug],
    );

    const row = result.rows[0];
    if (!row || !row.merchant_contact_email) return;

    const origin = emailOrigin();
    const merchantFirstName =
      (row.merchant_owner_display_name || row.merchant_business_name || "")
        .split(/\s+/)[0] || "there";

    await logEmailEvent({
      template: "event-rejected-merchant",
      toEmail: row.merchant_contact_email,
      toProfileId: row.merchant_owner_profile_id,
      vars: {
        merchantFirstName,
        eventTitle: row.event_title,
        rejectionReason,
        editEventUrl: `${origin}/merchant/events/${eventSlug}`,
        supportEmail: SUPPORT_EMAIL,
        unsubscribeUrl: `${origin}/account-settings`,
      },
    });
  } catch (error) {
    console.warn("logEventRejectedEmail failed", { eventSlug, error });
  }
}

// Post-commit emailer for a cancelled RSVP. Mirrors logRsvpEmails - one
// supplementary SELECT gathers the event, owning merchant, and the updated
// headcount for both the attendee + merchant templates. Fire-and-forget.
async function logRsvpCancelledEmails(
  pool: NonNullable<ReturnType<typeof getPostgresPool>>,
  eventDbId: string,
  attendeeProfileId: string,
  // Pre-rendered refund sentence for the attendee email (empty for free events
  // or no-refund cancellations). Stored as the `refundLine` template var.
  refundLine = "",
) {
  try {
    const result = await pool.query<{
      event_slug: string;
      event_title: string;
      starts_at: Date;
      ends_at: Date | null;
      timezone: string;
      capacity: number;
      confirmed_count: string;
      waitlist_count: string;
      attendee_email: string;
      attendee_display_name: string;
      merchant_contact_email: string | null;
      merchant_business_name: string | null;
      merchant_owner_profile_id: string | null;
      merchant_owner_display_name: string | null;
    }>(
      `
        select
          e.slug as event_slug,
          e.title as event_title,
          e.starts_at,
          e.ends_at,
          e.timezone,
          e.capacity,
          (
            select count(*)::text
            from event_attendees a
            where a.event_id = e.id and a.status = 'confirmed'
          ) as confirmed_count,
          (
            select count(*)::text
            from event_waitlists w
            where w.event_id = e.id and w.accepted_at is null
          ) as waitlist_count,
          p.email::text as attendee_email,
          p.display_name as attendee_display_name,
          mp.contact_email::text as merchant_contact_email,
          mp.business_name as merchant_business_name,
          mp.profile_id::text as merchant_owner_profile_id,
          owner.display_name as merchant_owner_display_name
        from events e
        join profiles p on p.id = $2::uuid
        left join merchant_profiles mp on mp.id = e.merchant_profile_id
        left join profiles owner on owner.id = mp.profile_id
        where e.id = $1::uuid
        limit 1
      `,
      [eventDbId, attendeeProfileId],
    );

    const row = result.rows[0];
    if (!row) return;

    const origin = emailOrigin();
    const dates = formatEmailDates(row.starts_at, row.ends_at, row.timezone);
    const confirmedCount = Number(row.confirmed_count) || 0;
    const spotsLabel = `${confirmedCount} of ${row.capacity} spots filled`;
    const waitlistCount = Number(row.waitlist_count) || 0;
    const attendeeFirstName =
      (row.attendee_display_name || "").split(/\s+/)[0] || "there";
    const merchantFirstName =
      (row.merchant_owner_display_name || row.merchant_business_name || "")
        .split(/\s+/)[0] || "there";

    await logEmailEvent({
      template: "rsvp-cancelled-attendee",
      toEmail: row.attendee_email,
      toProfileId: attendeeProfileId,
      vars: {
        firstName: attendeeFirstName,
        eventTitle: row.event_title,
        eventLongDate: dates.eventLongDate,
        eventStartTime: dates.eventStartTime,
        refundLine,
        discoverUrl: `${origin}/discover`,
        supportEmail: SUPPORT_EMAIL,
        unsubscribeUrl: `${origin}/account-settings`,
      },
    });

    if (row.merchant_contact_email) {
      await logEmailEvent({
        template: "rsvp-cancelled-merchant",
        toEmail: row.merchant_contact_email,
        toProfileId: row.merchant_owner_profile_id,
        vars: {
          merchantFirstName,
          attendeeFirstName,
          eventTitle: row.event_title,
          eventLongDate: dates.eventLongDate,
          eventStartTime: dates.eventStartTime,
          eventSpotsFilledLabel: spotsLabel,
          waitlistCountLabel:
            waitlistCount === 1 ? "1 on the waitlist" : `${waitlistCount} on the waitlist`,
          attendeesUrl: `${origin}/merchant/events/${row.event_slug}`,
          eventDashboardUrl: `${origin}/merchant/events/${row.event_slug}`,
          supportEmail: SUPPORT_EMAIL,
          unsubscribeUrl: `${origin}/account-settings`,
        },
      });
    }
  } catch (error) {
    console.warn("logRsvpCancelledEmails failed", { eventDbId, attendeeProfileId, error });
  }
}

// Post-commit GST tax receipt. Joins the paid transaction → event → buyer in a
// single SELECT. AU GST is 10% included in the total, so tax = total / 11.
// Fire-and-forget - never rolls back the booking it's attached to.
async function logPaymentReceiptEmail(
  pool: NonNullable<ReturnType<typeof getPostgresPool>>,
  paymentTransactionId: string,
) {
  try {
    const result = await pool.query<{
      payment_id: string;
      amount_cents: number;
      currency: string;
      profile_id: string;
      profile_email: string;
      display_name: string;
      event_slug: string;
      event_title: string;
      starts_at: Date;
      ends_at: Date | null;
      timezone: string;
      location_name: string;
      host_name: string;
    }>(
      `
        select
          pt.id::text as payment_id,
          pt.amount_cents,
          pt.currency::text as currency,
          pt.profile_id::text as profile_id,
          p.email::text as profile_email,
          p.display_name,
          e.slug as event_slug,
          e.title as event_title,
          e.starts_at,
          e.ends_at,
          e.timezone,
          e.location_name,
          e.host_name
        from payment_transactions pt
        join events e on e.id = pt.event_id
        join profiles p on p.id = pt.profile_id
        where pt.id = $1::uuid
        limit 1
      `,
      [paymentTransactionId],
    );

    const row = result.rows[0];
    if (!row || row.amount_cents <= 0) return;

    const origin = emailOrigin();
    const dates = formatEmailDates(row.starts_at, row.ends_at, row.timezone);
    const currency = row.currency || "AUD";
    const money = (cents: number) =>
      new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(cents / 100);
    // No GST split. /terms states Click "is not currently registered for GST
    // and does not charge GST on its booking/service fee" - but this used to
    // compute Math.round(totalCents / 11) unconditionally and the template
    // printed it as a GST line, so every paid booking produced a receipt
    // contradicting the published terms. The ticket line is now the whole
    // charge. If GST is ever reinstated it must key off the host's actual
    // registration status, not a fixed divisor applied to everyone.
    const totalCents = row.amount_cents;
    const firstName = (row.display_name || "").split(/\s+/)[0] || "there";
    const receiptDate = new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Australia/Sydney",
    }).format(new Date());

    await logEmailEvent({
      template: "payment-receipt-attendee",
      toEmail: row.profile_email,
      toProfileId: row.profile_id,
      vars: {
        firstName,
        eventTitle: row.event_title,
        eventLongDate: dates.eventLongDate,
        eventStartTime: dates.eventStartTime,
        eventVenue: row.location_name,
        eventHostName: row.host_name,
        receiptDate,
        priceLabel: money(totalCents),
        totalLabel: money(totalCents),
        paymentMethodLabel: "Card",
        receiptNumber: `CL-${row.payment_id.slice(0, 8).toUpperCase()}`,
        eventDetailsUrl: `${origin}/events/${row.event_slug}`,
        downloadInvoiceUrl: `${origin}/confirmed-events`,
        refundPolicyUrl: `${origin}/refund-policy`,
        supportEmail: SUPPORT_EMAIL,
        unsubscribeUrl: `${origin}/account-settings`,
      },
    });
  } catch (error) {
    console.warn("logPaymentReceiptEmail failed", { paymentTransactionId, error });
  }
}

function getSessionEmail(session: Session | null) {
  return session?.user?.email?.trim().toLowerCase() ?? "";
}

// Per-request memo for session-scoped reads. A single page render calls
// ensureProfileForSession / getProfileStatus many times (layout header + page
// + every repository function), and each call used to be its own DB
// round-trip. React's cache() keys object arguments by REFERENCE and every
// auth() call returns a fresh Session object, so caching on the session
// itself would never hit - key on the session email (a string) instead and
// store the in-flight promise so concurrent Promise.all callers share one
// query. Outside a React request scope (route handlers, crons) cache() calls
// straight through uncached, which matches the previous behaviour.
const sessionMemoSlot = cache((scope: string, email: string) => {
  void scope;
  void email;
  return { promise: undefined as Promise<unknown> | undefined };
});

function memoizeBySessionEmail<T>(
  scope: string,
  session: Session | null,
  compute: () => Promise<T>,
): Promise<T> {
  const email = getSessionEmail(session);
  if (!email) return compute();
  const slot = sessionMemoSlot(scope, email);
  if (!slot.promise) slot.promise = compute();
  return slot.promise as Promise<T>;
}

function getSessionName(session: Session | null) {
  return session?.user?.name?.trim() || getSessionEmail(session) || "Click member";
}

// The OAuth provider's profile picture (e.g. Google `picture`). NextAuth's
// default JWT strategy copies this through to `session.user.image` on first
// sign-in. May be undefined for the email-credentials path.
function getSessionImage(session: Session | null): string | null {
  const image = session?.user?.image?.trim();
  return image && /^https?:\/\//i.test(image) ? image : null;
}

// Kept as a local name for the call sites below, but the answer now comes from
// the same place src/auth.ts asks. The old body here defaulted to
// "admin@click.local" with no environment guard, so it disagreed with auth.ts
// whenever ADMIN_EMAILS was unset.
const isConfiguredAdminEmail = isAdminEmail;

async function readLocalStore(): Promise<LocalEventStore> {
  try {
    const rawStore = await readFile(localStorePath, "utf8");
    const parsed = JSON.parse(rawStore) as Partial<LocalEventStore>;

    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
      registrations:
        parsed.registrations && typeof parsed.registrations === "object"
          ? parsed.registrations
          : {},
    };
  } catch {
    return emptyLocalStore;
  }
}

async function writeLocalStore(store: LocalEventStore) {
  await mkdir(path.dirname(localStorePath), { recursive: true });
  await writeFile(localStorePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function getFallbackEvents({ includePending = false } = {}) {
  const store = await readLocalStore();
  const knownIds = new Set(clickEvents.map((event) => event.id));
  const localEvents = store.events.filter(
    (event) => !knownIds.has(event.id) && (includePending || event.status !== "Pending"),
  );

  return [...clickEvents, ...localEvents];
}

function requireLocalSession(session: Session | null) {
  const email = getSessionEmail(session);
  if (!email) throw authError();

  return {
    email,
    displayName: getSessionName(session),
  };
}

function requireLocalAdminSession(session: Session | null) {
  const localProfile = requireLocalSession(session);

  if (!isConfiguredAdminEmail(localProfile.email)) {
    const error = new Error("Admin access is required.");
    error.name = "ForbiddenError";
    throw error;
  }

  return localProfile;
}

function eventItemFromInput(input: CreateEventInput, session: Session | null): EventItem {
  const localProfile = requireLocalSession(session);
  const title = input.title.trim();
  const description = input.description.trim();
  // datetime-local strings are Sydney wall time, not server/UTC time.
  const startsAt = parseEventStart(input.startsAt);
  const category = input.category.trim() || "Social";
  const capacity = Math.max(input.capacity, 1);

  if (!title || !description || Number.isNaN(startsAt.getTime())) {
    const error = new Error("Title, description, and valid start date are required.");
    error.name = "ValidationError";
    throw error;
  }

  const slug = `${slugFromTitle(title)}-${Date.now().toString(36)}`;
  const priceCents = parsePriceCents(input.price);
  const tags = input.tags
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

  return {
    id: slug,
    title,
    group: input.groupName.trim() || `${localProfile.displayName}'s Group`,
    host: localProfile.displayName,
    category,
    date: formatDate(startsAt),
    time: formatTime(startsAt),
    startsAt: startsAt.toISOString(),
    location: input.locationName.trim() || "Sydney NSW",
    suburb: input.suburb.trim() || "Sydney",
    distanceKm: distanceKmFromSydney(
      input.latitude ?? sydneyReference.lat,
      input.longitude ?? sydneyReference.lng,
    ),
    lat: input.latitude ?? sydneyReference.lat,
    lng: input.longitude ?? sydneyReference.lng,
    price: formatPriceLabel(priceCents),
    attendees: 0,
    capacity,
    image: fallbackEventImage(category, title),
    imageAlt: "Community event listing",
    description,
    tags,
    lifeSignals: ["Host submitted", "Pending review"],
    fomo: "Submitted through the easy host form for admin review.",
    status: "Pending",
    booking: "Click-managed",
    relationshipGoal:
      input.relationshipGoal.trim() || "Help people meet through a shared plan.",
  };
}

async function createLocalEventForMerchant(input: CreateEventInput, session: Session | null) {
  const event = eventItemFromInput(input, session);
  const store = await readLocalStore();

  await writeLocalStore({
    ...store,
    events: [event, ...store.events.filter((item) => item.id !== event.id)],
  });

  return {
    slug: event.id,
    title: event.title,
  };
}

async function approveLocalEventForAdmin(eventId: string, session: Session | null) {
  requireLocalAdminSession(session);

  const store = await readLocalStore();
  const target = store.events.find((event) => event.id === eventId);

  if (!target) {
    const error = new Error("Pending event not found.");
    error.name = "NotFoundError";
    throw error;
  }

  const nextEvent: EventItem = {
    ...target,
    status: "Live",
    lifeSignals: target.lifeSignals.filter((signal) => signal !== "Pending review"),
    fomo: "Approved by admin and ready for members to RSVP.",
  };

  await writeLocalStore({
    ...store,
    events: store.events.map((event) => (event.id === eventId ? nextEvent : event)),
  });

  return {
    slug: nextEvent.id,
    title: nextEvent.title,
  };
}

async function rejectLocalEventForAdmin(eventId: string, session: Session | null) {
  requireLocalAdminSession(session);

  const store = await readLocalStore();
  const target = store.events.find((event) => event.id === eventId);

  if (!target) {
    const error = new Error("Pending event not found.");
    error.name = "NotFoundError";
    throw error;
  }

  const nextEvent: EventItem = {
    ...target,
    status: "Rejected",
    lifeSignals: target.lifeSignals.filter((signal) => signal !== "Pending review"),
    fomo: "Declined by admin - needs another pass before it can go live.",
  };

  await writeLocalStore({
    ...store,
    events: store.events.map((event) => (event.id === eventId ? nextEvent : event)),
  });

  return {
    slug: nextEvent.id,
    title: nextEvent.title,
  };
}

async function getFallbackAdminEvents(): Promise<AdminEventRow[]> {
  // The admin console must never present fabricated rows as real activity. When
  // Postgres is unreachable we return an empty queue (matching the members /
  // merchants / audit / tags fallbacks) so the page degrades to an honest empty
  // state rather than seeded "demo" events that read as live data. If the
  // deployed admin shows nothing, that's a DB-connectivity signal (see the
  // Supabase pooler-host note), not real zero activity.
  return [];
}

async function registerLocallyForEvent(eventId: string, session: Session | null) {
  const localProfile = requireLocalSession(session);
  const store = await readLocalStore();
  const event = (await getFallbackEvents({ includePending: true })).find(
    (item) => item.id === eventId,
  );

  if (!event) {
    const error = new Error("Event not found.");
    error.name = "NotFoundError";
    throw error;
  }

  const eventRegistrations = store.registrations[eventId] ?? {};
  const confirmedLocalCount = Object.values(eventRegistrations).filter(
    (status) => status === "confirmed",
  ).length;
  const status =
    event.status === "Waitlist" ||
    event.attendees + confirmedLocalCount >= event.capacity
      ? "waitlisted"
      : "confirmed";

  await writeLocalStore({
    ...store,
    registrations: {
      ...store.registrations,
      [eventId]: {
        ...eventRegistrations,
        [localProfile.email]: status,
      },
    },
  });

  return {
    eventTitle: event.title,
    status,
  };
}

export function ensureProfileForSession(session: Session | null) {
  return memoizeBySessionEmail("ensureProfile", session, () =>
    ensureProfileForSessionUncached(session),
  );
}

async function ensureProfileForSessionUncached(session: Session | null) {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const displayName = getSessionName(session);
  const initialRole: ProfileRow["role"] = isConfiguredAdminEmail(email) ? "admin" : "attendee";

  // `xmax = 0` is the standard Postgres tell that the row came from the
  // INSERT branch of an upsert (no prior tuple version exists). We use it to
  // fire the account-welcome email exactly once, on the very first sign-in.
  const result = await pool.query<
    ProfileRow & { photo_url: string | null; is_new: boolean }
  >(
    `
      insert into profiles (auth_subject, role, email, display_name, email_verified_at)
      values ($1, $2::user_role, $3, $4, now())
      on conflict (email) do update
      set
        display_name = case
          when profiles.display_name = profiles.email then excluded.display_name
          else profiles.display_name
        end,
        role = case
          when profiles.role = 'admin' then profiles.role
          when excluded.role = 'admin' then excluded.role
          else profiles.role
        end,
        -- B7.4b liveness. Nothing wrote this column: it defaults to now() from
        -- migration 049, so every profile was frozen at whenever that ran, and any
        -- rule reading it ("inactive 30 days") would have been true of everyone at
        -- once, thirty days later. This upsert already runs on every authenticated
        -- request (ensureProfileForSession is cache()'d once per request), so the
        -- signal costs nothing but the column.
        last_active_at = now(),
        updated_at = now()
      returning id::text, role::text as role, email::text, display_name, photo_url,
        (xmax = 0) as is_new
    `,
    [`auth:${email}`, initialRole, email, displayName],
  );

  const row = result.rows[0];

  // First-time Google sign-in backfill: if the user has no avatar yet but the
  // OAuth provider gave us one, fetch it and rehost to Supabase Storage once
  // so we get a stable URL we control. Fire-and-forget - never blocks the page
  // render and never throws (failures are logged inside the helper).
  if (row && !row.photo_url) {
    const remote = getSessionImage(session);
    if (remote) {
      void backfillAvatarFromRemote(row.id, remote);
    }
  }

  // Log the account-welcome email for fresh signups only. Fire-and-forget so
  // a DB hiccup or missing template never blocks auth. Visible in Supabase
  // Studio → Table Editor → email_events.
  if (row?.is_new) {
    // The only mail that goes out BEFORE onboarding, so it is the only one that
    // can catch a display name we invented from the address. "Hi Willowthan1"
    // in the first thing they ever read from us is worse than "Hi there".
    const firstName = isDerivedFromEmail(row.display_name, row.email)
      ? "there"
      : (row.display_name || "").split(/\s+/)[0] || "there";
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
    await logEmailEvent({
      template: "account-welcome",
      toEmail: row.email,
      toProfileId: row.id,
      vars: {
        firstName,
        quizUrl: `${origin}/quiz/life`,
        discoverUrl: `${origin}/discover`,
        supportEmail: SUPPORT_EMAIL,
        unsubscribeUrl: `${origin}/account-settings`,
      },
    });
  }

  // Strip photo_url + is_new from the return so the shape stays ProfileRow for callers.
  return { id: row.id, role: row.role, email: row.email, display_name: row.display_name };
}

// Coalesce concurrent backfills for the same profile so two parallel page
// loads on a fresh session don't both try to PUT the same key.
const inFlightAvatarBackfills = new Set<string>();

async function backfillAvatarFromRemote(profileId: string, sourceUrl: string) {
  if (inFlightAvatarBackfills.has(profileId)) return;
  inFlightAvatarBackfills.add(profileId);
  try {
    const { uploadAvatarFromUrl } = await import("./avatar-storage");
    const publicUrl = await uploadAvatarFromUrl(profileId, sourceUrl);
    if (!publicUrl) return;

    const pool = getPostgresPool();
    if (!pool) return;
    // Race-safe: only write if still null, so a user upload that landed
    // between the read and now isn't clobbered.
    await pool.query(
      `update profiles set photo_url = $2, updated_at = now()
         where id = $1::uuid and photo_url is null`,
      [profileId, publicUrl],
    );
  } catch (error) {
    console.warn("backfillAvatarFromRemote failed", { profileId, error });
  } finally {
    inFlightAvatarBackfills.delete(profileId);
  }
}

export function getMerchantProfile(
  pool: ReturnType<typeof getPostgresPool>,
  profileId: string,
): Promise<MerchantProfileRow | null> {
  // Per-request memo, same shape as memoizeBySessionEmail (which also drives
  // sessionMemoSlot): a single render hits this many times (layout gate + page
  // + repository helpers) and each used to be its own round-trip. Keyed on the
  // string profileId - the pool is a process-wide singleton, so it never varies
  // per call. Outside a React request scope cache() falls through uncached,
  // matching the previous behaviour for route handlers / crons.
  const slot = sessionMemoSlot("merchantProfile", profileId);
  if (!slot.promise) slot.promise = loadMerchantProfile(pool, profileId);
  return slot.promise as Promise<MerchantProfileRow | null>;
}

async function loadMerchantProfile(
  pool: ReturnType<typeof getPostgresPool>,
  profileId: string,
): Promise<MerchantProfileRow | null> {
  if (!pool) return null;
  const result = await pool.query<MerchantProfileRow>(
    `
      select
        id::text,
        business_name,
        contact_email::text,
        verification_status,
        business_type,
        stripe_connect_account_id,
        charges_enabled,
        payouts_enabled,
        details_submitted,
        onboarding_completed_at::text,
        auto_approve_events,
        address_state,
        address_postcode
      from merchant_profiles
      where profile_id = $1::uuid
      limit 1
    `,
    [profileId],
  );
  return result.rows[0] ?? null;
}

// Full set of merchant-signup answers, shaped to seed the wizard's form state
// when a rejected merchant re-opens the wizard to edit + resubmit (bug board
// #203). Mirrors the wizard's `State` fields (minus uploads, which come via
// listMerchantDocuments). Returns null when the caller has no merchant profile.
export type MerchantSignupPrefill = {
  businessName: string;
  tradingName: string;
  businessType: string;
  abn: string;
  acn: string;
  eventCategoryIds: string[];
  contactEmail: string;
  phone: string;
  websiteUrl: string;
  socials: Record<string, string>;
  addressStreet: string;
  addressSuburb: string;
  addressState: string;
  addressPostcode: string;
};

export async function getMerchantSignupPrefill(
  session: Session | null,
): Promise<MerchantSignupPrefill | null> {
  const pool = getPostgresPool();
  if (!pool) return null;
  const profile = await ensureProfileForSession(session);

  const result = await pool.query<{
    business_name: string | null;
    trading_name: string | null;
    business_type: string | null;
    abn: string | null;
    acn: string | null;
    phone: string | null;
    contact_email: string | null;
    website_url: string | null;
    socials: Record<string, string> | null;
    address_street: string | null;
    address_suburb: string | null;
    address_state: string | null;
    address_postcode: string | null;
  }>(
    `
      select business_name, trading_name, business_type, abn, acn, phone, contact_email::text,
             website_url, socials, address_street, address_suburb,
             address_state, address_postcode
      from merchant_profiles
      where profile_id = $1::uuid
      limit 1
    `,
    [profile.id],
  );
  const row = result.rows[0];
  if (!row) return null;

  const cats = await pool.query<{ tag_category_id: string }>(
    `select tag_category_id::text from merchant_event_categories where merchant_profile_id = (
       select id from merchant_profiles where profile_id = $1::uuid limit 1
     )`,
    [profile.id],
  );

  return {
    businessName: row.business_name ?? "",
    tradingName: row.trading_name ?? "",
    businessType: row.business_type ?? "",
    abn: row.abn ?? "",
    acn: row.acn ?? "",
    eventCategoryIds: cats.rows.map((c) => c.tag_category_id),
    contactEmail: row.contact_email ?? "",
    phone: row.phone ?? "",
    websiteUrl: row.website_url ?? "",
    socials: row.socials ?? {},
    addressStreet: row.address_street ?? "",
    addressSuburb: row.address_suburb ?? "",
    addressState: row.address_state ?? "",
    addressPostcode: row.address_postcode ?? "",
  };
}

/**
 * The write boundary for every admin action - server actions and the eight
 * admin API routes that do not check isAdminEmail themselves.
 *
 * BOTH conditions are required, and the email one is the load-bearing half.
 * `profiles.role` is sticky: the upsert in ensureProfileForSessionUncached
 * promotes to 'admin' when the address is configured but never demotes when it
 * stops being (`when profiles.role = 'admin' then profiles.role`). So role
 * alone answers "was this address ever an admin", not "is it one now".
 * Removing someone from ADMIN_EMAILS used to lock them out of the console
 * shell while leaving them able to approve events, cancel bookings, refund
 * money and permanently ban members by posting straight at the routes.
 *
 * Checking the configured list here means offboarding an admin is a
 * single-variable change with no data migration - the stale role row is inert.
 */
async function requireAdminProfile(session: Session | null) {
  const profile = await ensureProfileForSession(session);

  if (profile.role !== "admin" || !isAdminEmail(profile.email)) {
    const error = new Error("Admin access is required.");
    error.name = "ForbiddenError";
    throw error;
  }

  return profile;
}

export type MerchantEventSummary = {
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: EventStatus;
  locationName: string;
  suburb: string;
  capacity: number;
  confirmed: number;
  waitlisted: number;
  priceCents: number;
  category: string;
};

export type MerchantAttendeeRow = {
  attendeeId: string;
  displayName: string;
  email: string;
  photoUrl: string | null;
  status: "confirmed" | "pending_payment" | "waitlisted" | "cancelled" | "refunded";
  rsvpAt: string;
  // Door state, same column the bookings tab's check-in writes. Carried here so
  // the event page can BE the door list instead of sending a host who is
  // standing at the venue back out to the portal to tick people off.
  checkedInAt: string | null;
};

// A named +1 on the merchant door list (spec 19 §11). First name + status + who
// bought the seat only - never the guest's email or DOB.
export type MerchantGuestRow = {
  guestId: string;
  // First name the purchaser entered for this seat. Nullable in the column, but
  // an 'invited'/'claimed' seat always has one in practice.
  firstName: string | null;
  // 'invited' = named, not yet on Click; 'claimed' = the friend joined Click.
  status: "invited" | "claimed";
  // Display name of the member who paid for the seat (already visible to the
  // merchant as a confirmed attendee). Not new PII exposure.
  purchasedBy: string;
  // Day-of check-in (spec 19 §9/§11): true once the merchant marks the guest
  // present. Toggled by name from the door list, like attendee check-in.
  attended: boolean;
};

export type MerchantEventDetail = MerchantEventSummary & {
  description: string;
  // Full street address (nullable), editable from the merchant edit form.
  address: string | null;
  // A proposed new address awaiting admin review (set when the merchant edits the
  // address of an event that already has attendees). Null when nothing's pending.
  pendingAddress: string | null;
  // The admin's free-text reason when this event was rejected (bug board #217).
  // Shown back to the merchant so they know what to fix before resubmitting.
  // Null unless status is Rejected.
  rejectionReason: string | null;
  images: string[];
  imageAlt: string | null;
  attendees: MerchantAttendeeRow[];
  // Named +1 guests for the door list (spec 19 §11): 'invited'/'claimed' seats
  // only. Unnamed +1s are NOT listed - they live solely in `guestSeats`.
  guests: MerchantGuestRow[];
  // Total live guest SEATS on confirmed bookings (named + unnamed), so the page's
  // "Confirmed N / capacity" headcount counts seats - matching the public event
  // page and the checkout capacity gate. guestSeats - guests.length = unnamed +1s.
  guestSeats: number;
  // Interest tags currently attached, so the merchant edit form can pre-fill.
  tags: { slug: string; label: string }[];
};

export async function getMerchantEvents(session: Session | null): Promise<MerchantEventSummary[]> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const merchant = await getMerchantProfile(pool, profile.id);
  if (!merchant) return [];

  const result = await pool.query<{
    slug: string;
    title: string;
    starts_at: Date;
    ends_at: Date | null;
    status: string;
    location_name: string;
    suburb: string;
    capacity: number;
    confirmed: string;
    guest_seats: string;
    waitlisted: string;
    price_cents: number;
    category: string;
  }>(
    `
      select
        event.slug,
        event.title,
        event.starts_at,
        event.ends_at,
        event.status::text,
        event.location_name,
        event.suburb,
        event.capacity,
        event.price_cents,
        event.category,
        count(attendee.id) filter (where attendee.status = 'confirmed') as confirmed,
        count(attendee.id) filter (where attendee.status = 'waitlisted') as waitlisted,
        -- Paid +1s hold a seat but have no event_attendees row, so counting
        -- attendees alone under-reported every headcount in the portal - the
        -- dashboard, the events list, the calendar and the fill rate all read
        -- from here, while the event DETAIL page counted seats properly and
        -- disagreed with all four. Same rule as getMerchantEventDetail:
        -- exists() rather than a join, so a seat cannot fan out across
        -- attendee rows and inflate the count (spec 19 §9/§11).
        coalesce((
          select count(*)
          from guest_spots gs
          where gs.event_id = event.id
            and gs.status <> 'cancelled'
            and exists (
              select 1 from event_attendees ea
              where ea.payment_transaction_id = gs.payment_transaction_id
                and ea.status = 'confirmed'
            )
        ), 0) as guest_seats
      from events event
      left join event_attendees attendee on attendee.event_id = event.id
      where event.merchant_profile_id = $1::uuid
      group by event.id
      order by event.starts_at asc
    `,
    [merchant.id],
  );

  return result.rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at ? row.ends_at.toISOString() : null,
    status: eventStatusFromDb(row.status),
    locationName: row.location_name,
    suburb: row.suburb,
    capacity: row.capacity,
    // SEATS, not attendee rows: a paid +1 occupies a seat but has no
    // event_attendees row of its own. Every portal surface fed by this
    // function - dashboard tiles, fill rate, capacity meters, the calendar -
    // is asking "how full is this event", so the +1s belong in the number.
    //
    // NOTE the deliberate difference from getMerchantEventDetail, which keeps
    // `confirmed` and `guestSeats` as separate fields because that page lists
    // named attendees and named guests in separate tables and has to reconcile
    // the two against the total.
    confirmed: Number(row.confirmed) + Number(row.guest_seats),
    waitlisted: Number(row.waitlisted),
    priceCents: row.price_cents,
    category: row.category,
  }));
}

export async function getMerchantEventDetail(
  eventSlug: string,
  session: Session | null,
): Promise<MerchantEventDetail | null> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const merchant = await getMerchantProfile(pool, profile.id);
  if (!merchant) return null;

  const eventResult = await pool.query<{
    id: string;
    slug: string;
    title: string;
    description: string;
    starts_at: Date;
    ends_at: Date | null;
    status: string;
    location_name: string;
    suburb: string;
    address: string | null;
    pending_address: string | null;
    rejection_reason: string | null;
    capacity: number;
    price_cents: number;
    category: string;
    image_url: string | null;
    image_urls: string[] | null;
    image_alt: string | null;
    confirmed: string;
    waitlisted: string;
    guest_seats: string;
  }>(
    `
      select
        event.id::text,
        event.slug,
        event.title,
        event.description,
        event.starts_at,
        event.ends_at,
        event.status::text,
        event.location_name,
        event.suburb,
        event.address,
        event.pending_address,
        event.rejection_reason,
        event.capacity,
        event.price_cents,
        event.category,
        event.image_url,
        event.image_urls,
        event.image_alt,
        count(attendee.id) filter (where attendee.status = 'confirmed') as confirmed,
        count(attendee.id) filter (where attendee.status = 'waitlisted') as waitlisted,
        -- Live guest SEATS on this event's confirmed bookings (named + unnamed),
        -- so the page counts seats, not just profile attendees (spec 19 §9/§11).
        -- exists() (not a join) so a seat can't fan out across attendee rows.
        coalesce((
          select count(*)
          from guest_spots gs
          where gs.event_id = event.id
            and gs.status <> 'cancelled'
            and exists (
              select 1 from event_attendees ea
              where ea.payment_transaction_id = gs.payment_transaction_id
                and ea.status = 'confirmed'
            )
        ), 0) as guest_seats
      from events event
      left join event_attendees attendee on attendee.event_id = event.id
      where event.slug = $1 and event.merchant_profile_id = $2::uuid
      group by event.id
      limit 1
    `,
    [eventSlug, merchant.id],
  );

  if (eventResult.rows.length === 0) return null;
  const row = eventResult.rows[0];

  const attendeeResult = await pool.query<{
    attendee_id: string;
    display_name: string;
    email: string;
    photo_url: string | null;
    status: string;
    created_at: Date;
    checked_in_at: Date | null;
  }>(
    `
      select
        attendee.id::text as attendee_id,
        attendee_profile.display_name,
        attendee_profile.email::text as email,
        attendee_profile.photo_url,
        attendee.status::text,
        attendee.created_at,
        attendee.checked_in_at
      from event_attendees attendee
      join profiles attendee_profile on attendee_profile.id = attendee.profile_id
      where attendee.event_id = $1::uuid
        and (
          attendee.status in ('confirmed', 'waitlisted')
          or (attendee.status = 'pending_payment' and attendee.hold_expires_at > now())
        )
      order by
        case attendee.status
          when 'confirmed' then 0
          when 'pending_payment' then 1
          else 2
        end,
        attendee.created_at asc
    `,
    [row.id],
  );

  const tagResult = await pool.query<{ slug: string; label: string }>(
    `
      select tag.slug, tag.label
      from event_tags et
      join tags tag on tag.id = et.tag_id and tag.tag_type = 'interest'
      where et.event_id = $1::uuid
      order by tag.label asc
    `,
    [row.id],
  );

  // Named +1 guests for the door list (spec 19 §11) - invited/claimed only,
  // first name + status + purchaser name, scoped to this merchant's event.
  const guestResult = await pool.query<{
    guest_id: string;
    first_name: string | null;
    status: string;
    purchased_by: string;
    attended: boolean;
  }>(
    `
      select guest_id::text, first_name, status, purchased_by, attended
      from merchant_event_guests_v
      where event_id = $1::uuid and merchant_profile_id = $2::uuid
      order by first_name asc nulls last, status asc
    `,
    [row.id, merchant.id],
  );

  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    tags: tagResult.rows.map((t) => ({ slug: t.slug, label: t.label })),
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at ? row.ends_at.toISOString() : null,
    status: eventStatusFromDb(row.status),
    locationName: row.location_name,
    suburb: row.suburb,
    address: row.address,
    pendingAddress: row.pending_address,
    rejectionReason: row.rejection_reason,
    capacity: row.capacity,
    confirmed: Number(row.confirmed),
    waitlisted: Number(row.waitlisted),
    priceCents: row.price_cents,
    category: row.category,
    images: resolveEventImages(
      row.image_urls && row.image_urls.length > 0 ? row.image_urls : [row.image_url],
      row.category,
      row.title,
    ),
    imageAlt: row.image_alt,
    attendees: attendeeResult.rows.map((entry) => ({
      attendeeId: entry.attendee_id,
      displayName: entry.display_name,
      email: entry.email,
      photoUrl: entry.photo_url,
      status: entry.status as MerchantAttendeeRow["status"],
      rsvpAt: entry.created_at.toISOString(),
      checkedInAt: entry.checked_in_at ? entry.checked_in_at.toISOString() : null,
    })),
    guests: guestResult.rows.map((g) => ({
      guestId: g.guest_id,
      firstName: g.first_name,
      status: g.status as MerchantGuestRow["status"],
      purchasedBy: g.purchased_by,
      attended: g.attended,
    })),
    guestSeats: Number(row.guest_seats),
  };
}

// Merchant self-service edit of an event's SAFE fields: title, description,
// relationship goal, and interest tags. Deliberately excludes price, time,
// location and capacity - those materially change a booking people may have paid
// for, so they stay locked here (the UI directs merchants to request a review).
// Ownership-scoped: only the owning merchant can edit, and only their own event.
//
// Address is a special case: it's free to change while the event is still a
// private draft/pending application, but once the event is LIVE (publicly
// visible) - or has any booked attendee - an address change is parked in
// `pending_address` for admin review instead of going live, so a published
// venue can't be silently moved out from under the public / people who planned
// around it (bug board #209). See approveEventAddressChange.
export async function updateMerchantEventDetails(
  eventSlug: string,
  input: {
    title: string;
    description: string;
    relationshipGoal?: string;
    tagSlugs: string[];
    // Street address. Free to self-edit before anyone books; once the event has
    // attendees an edit is queued for admin review. undefined → leave as-is.
    address?: string;
    // Ordered event photo gallery (public URLs, max 5). images[0] becomes the
    // cover (mirrored to image_url). undefined → leave as-is.
    images?: string[];
    // The TERMS of the event: what it is, when it runs, how many seats, what a
    // seat costs. Applied only while nobody can be affected - see termsEditable
    // below. undefined → leave as-is.
    //
    // These exist because of the resubmit path. A rejected event could only
    // edit its title, description, tags, address and photos, and those are
    // rarely why an admin rejects one - wrong category, a price that does not
    // match the listing, a capacity the venue cannot hold and a bad start time
    // are. So the fix loop was: read the rejection reason, find that the thing
    // it names is not editable, and email support.
    category?: string;
    // Sydney wall time, same "YYYY-MM-DDTHH:mm" shape the create wizard posts.
    startsAt?: string;
    durationMinutes?: number;
    capacity?: number;
    priceCents?: number;
  },
  session: Session | null,
): Promise<MerchantEventDetail | null> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const merchant = await getMerchantProfile(pool, profile.id);
  if (!merchant) throw authError("Merchant profile required.");

  const title = input.title.trim();
  if (!title) {
    const error = new Error("Event title is required.");
    error.name = "ValidationError";
    throw error;
  }

  const cleanedSlugs = Array.from(
    new Set(input.tagSlugs.map((s) => s.trim().toLowerCase()).filter(Boolean)),
  ).slice(0, 12);

  // Normalise the gallery the same way createEventForMerchant does: trim,
  // de-dupe, cap at 5. images[0] is the cover. When the merchant clears all
  // photos we keep image_urls null and leave image_url for the readers that
  // fall back to a category placeholder.
  const cleanedImages =
    input.images !== undefined
      ? Array.from(new Set(input.images.map((u) => u.trim()).filter(Boolean))).slice(0, 5)
      : undefined;

  const client = await pool.connect();
  try {
    await client.query("begin");

    const eventResult = await client.query<{
      id: string;
      address: string | null;
      status: string;
      attendee_count: string;
    }>(
      `
        select
          event.id::text,
          event.address,
          event.status::text as status,
          count(attendee.id) filter (
            where attendee.status = 'confirmed'
               or (attendee.status = 'pending_payment' and attendee.hold_expires_at > now())
          ) as attendee_count
        from events event
        left join event_attendees attendee on attendee.event_id = event.id
        where event.slug = $1 and event.merchant_profile_id = $2::uuid
        group by event.id
        limit 1
      `,
      [eventSlug, merchant.id],
    );
    const event = eventResult.rows[0];
    if (!event) {
      await client.query("rollback");
      const error = new Error("Event not found.");
      error.name = "NotFoundError";
      throw error;
    }

    // Decide how to handle the address: apply immediately, queue for review, or
    // leave untouched. An edit only counts as a change when the trimmed value
    // actually differs from what's stored - re-saving the form with the same
    // address never triggers a review.
    const newAddress = input.address?.trim() || null;
    const currentAddress = event.address?.trim() || null;
    const addressChanged = input.address !== undefined && newAddress !== currentAddress;
    const hasAttendees = Number(event.attendee_count) > 0;
    // "Live" = publicly visible statuses. A still-private draft/pending event
    // edits its address freely (it gets reviewed at approval anyway); once it's
    // public, or anyone has booked, the change goes to admin review (#209).
    const isPublished = ["live", "featured", "locked", "waitlist"].includes(event.status);
    const queueAddress = addressChanged && (isPublished || hasAttendees);
    const applyAddressNow = addressChanged && !queueAddress;

    // The terms of the event are the terms somebody booked against, so they are
    // editable ONLY while the event is neither publicly listed nor holding a
    // seat. That is exactly the rejected / pending / draft case the resubmit
    // loop needs, and it means no attendee can ever be moved, repriced or
    // squeezed out of a seat by an edit. Deliberately stricter than the address
    // rule above, which has a review queue to fall back on; these do not.
    const termsEditable = !isPublished && !hasAttendees;

    // Parsed before the update so a bad value fails the whole edit rather than
    // writing half of it. parseEventStart reads Sydney wall time, matching the
    // create wizard's datetime-local strings.
    let nextStartsAt: Date | null = null;
    let nextEndsAt: Date | null = null;
    if (termsEditable && input.startsAt !== undefined) {
      const parsed = parseEventStart(input.startsAt);
      if (Number.isNaN(parsed.getTime())) {
        await client.query("rollback");
        const error = new Error("That start date and time isn't valid.");
        error.name = "ValidationError";
        throw error;
      }
      nextStartsAt = parsed;
      const minutes =
        input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : 120;
      nextEndsAt = new Date(parsed.getTime() + minutes * 60 * 1000);
    }
    const nextCapacity =
      termsEditable && input.capacity !== undefined && input.capacity > 0
        ? Math.min(Math.floor(input.capacity), 1000)
        : null;
    const nextPriceCents =
      termsEditable && input.priceCents !== undefined && input.priceCents >= 0
        ? Math.floor(input.priceCents)
        : null;
    const nextCategory =
      termsEditable && input.category !== undefined && input.category.trim()
        ? input.category.trim()
        : null;

    await client.query(
      `
        update events
        set title = $2,
            description = $3,
            relationship_goal = coalesce($4, relationship_goal),
            address = case when $5::boolean then $6 else address end,
            -- Park the proposed address for review when queued; clear any prior
            -- pending value once a change is applied directly.
            pending_address = case
              when $9::boolean then $6
              when $5::boolean then null
              else pending_address
            end,
            image_urls = case when $7::boolean then $8::text[] else image_urls end,
            -- Subscripting a NULL array yields NULL, which is exactly what we
            -- want when the merchant removed every photo: $8 is null in that
            -- case, so the cover clears with the gallery. The old
            -- 'array_length($8, 1) >= 1' guard evaluated to NULL there, never
            -- true, so image_url kept the removed cover - the grid said
            -- "Photos (0/5)" and said "Saved.", then the old photo came back on
            -- reload with no way out of the loop. Every reader already handles a
            -- null cover through resolveEventImage's category fallback.
            image_url = case when $7::boolean then ($8::text[])[1] else image_url end,
            -- Terms. Each is coalesce'd against a value that is null unless
            -- termsEditable, so a published or booked event writes its own
            -- column back to itself and nothing moves.
            category = coalesce($10, category),
            starts_at = coalesce($11::timestamptz, starts_at),
            ends_at = coalesce($12::timestamptz, ends_at),
            capacity = coalesce($13::int, capacity),
            price_cents = coalesce($14::int, price_cents),
            updated_at = now()
        where id = $1::uuid
      `,
      [
        event.id,
        title,
        input.description ?? "",
        input.relationshipGoal?.trim() || null,
        applyAddressNow,
        newAddress,
        cleanedImages !== undefined,
        cleanedImages && cleanedImages.length > 0 ? cleanedImages : null,
        queueAddress,
        nextCategory,
        nextStartsAt,
        nextEndsAt,
        nextCapacity,
        nextPriceCents,
      ],
    );

    // Flag every admin so a queued address change doesn't sit unseen in
    // /admin/events. Inside the txn so it rolls back with a failed edit.
    if (queueAddress) {
      await client.query(
        `
          insert into notifications (profile_id, title, body, action_url)
          select id, $1, $2, $3
          from profiles
          where role = 'admin'
        `,
        [
          "Address change awaiting review",
          `${merchant.business_name} wants to move "${title}" to ${newAddress}.`,
          "/admin/events",
        ],
      );
    }

    // Replace interest tags only (leave life/vibe/music alone).
    await client.query(
      `
        delete from event_tags et
        using tags tag
        where et.event_id = $1::uuid
          and et.tag_id = tag.id
          and tag.tag_type = 'interest'
      `,
      [event.id],
    );
    if (cleanedSlugs.length > 0) {
      await client.query(
        `
          insert into event_tags (event_id, tag_id)
          select $1::uuid, tag.id
          from tags tag
          where tag.tag_type = 'interest' and tag.slug = any($2::text[])
          on conflict do nothing
        `,
        [event.id, cleanedSlugs],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  return getMerchantEventDetail(eventSlug, session);
}

// Merchant resubmits a REJECTED event for review after fixing it (bug board
// #217). Flips status rejected → pending (or straight to live for a trusted
// auto-approve merchant, mirroring createEventForMerchant), clears the stored
// rejection reason, and - when it re-enters the queue - notifies admins. The
// merchant edits the safe fields via updateMerchantEventDetails first; this is
// the explicit "send it back for review" step. Ownership-scoped.
export async function resubmitRejectedEvent(
  eventSlug: string,
  session: Session | null,
): Promise<{ slug: string; title: string; status: EventStatus }> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const merchant = await getMerchantProfile(pool, profile.id);
  if (!merchant) throw authError("Merchant profile required.");

  // Trusted merchants skip the queue, exactly like a freshly created event.
  const autoApprove = merchant.auto_approve_events === true;
  const newStatus = autoApprove ? "live" : "pending";

  const result = await pool.query<{ slug: string; title: string }>(
    `
      update events
      set status = $3,
          rejection_reason = null,
          rejected_at = null,
          updated_at = now()
      from (
        select id from events
        where slug = $1 and merchant_profile_id = $2::uuid and status = 'rejected'
      ) target
      where events.id = target.id
      returning events.slug, events.title
    `,
    [eventSlug, merchant.id, newStatus],
  );

  const event = result.rows[0];
  if (!event) {
    const error = new Error("Rejected event not found.");
    error.name = "NotFoundError";
    throw error;
  }

  // Put it back in front of the admins (unless it auto-published).
  if (!autoApprove) {
    void pool
      .query(
        `
          insert into notifications (profile_id, title, body, action_url)
          select id, $1, $2, $3
          from profiles
          where role = 'admin'
        `,
        [
          "Event awaiting review",
          `${merchant.business_name} updated and resubmitted "${event.title}" for review.`,
          "/admin/events",
        ],
      )
      .catch((error) => {
        console.warn("Failed to notify admins of resubmitted event.", error);
      });
  }

  return { slug: event.slug, title: event.title, status: eventStatusFromDb(newStatus) };
}

// Admin approves a merchant's queued address change: the parked pending_address
// becomes the live address (attendees now see the new location on the event
// page) and the pending slot is cleared. Notifies the owning merchant. No-op,
// reported back as { applied: false }, when nothing is actually pending.
export async function approveEventAddressChange(
  eventSlug: string,
  session: Session | null,
): Promise<{ applied: boolean; title: string; address: string | null }> {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  await requireAdminProfile(session);

  const result = await pool.query<{
    title: string;
    host_profile_id: string | null;
    address: string | null;
    applied: boolean;
  }>(
    `
      update events
      set address = pending_address,
          pending_address = null,
          updated_at = now()
      where slug = $1 and pending_address is not null
      returning title, host_profile_id::text, address, true as applied
    `,
    [eventSlug],
  );

  const row = result.rows[0];
  if (!row) {
    // Either the event doesn't exist or there's no pending change - surface the
    // current state so the admin UI can clear the banner either way.
    const current = await pool.query<{ title: string; address: string | null }>(
      `select title, address from events where slug = $1 limit 1`,
      [eventSlug],
    );
    return {
      applied: false,
      title: current.rows[0]?.title ?? "Event",
      address: current.rows[0]?.address ?? null,
    };
  }

  if (row.host_profile_id) {
    void pool
      .query(
        `insert into notifications (profile_id, title, body, action_url) values ($1::uuid, $2, $3, $4)`,
        [
          row.host_profile_id,
          "Address change approved",
          `The new address for "${row.title}" is now live for your attendees.`,
          `/merchant/events/${eventSlug}`,
        ],
      )
      .catch(() => {});
  }

  return { applied: true, title: row.title, address: row.address };
}

// Admin rejects a queued address change: the parked pending_address is discarded
// and the live address is left untouched. Notifies the owning merchant.
export async function rejectEventAddressChange(
  eventSlug: string,
  session: Session | null,
): Promise<{ rejected: boolean; title: string }> {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  await requireAdminProfile(session);

  const result = await pool.query<{ title: string; host_profile_id: string | null }>(
    `
      update events
      set pending_address = null,
          updated_at = now()
      where slug = $1 and pending_address is not null
      returning title, host_profile_id::text
    `,
    [eventSlug],
  );

  const row = result.rows[0];
  if (!row) {
    const current = await pool.query<{ title: string }>(
      `select title from events where slug = $1 limit 1`,
      [eventSlug],
    );
    return { rejected: false, title: current.rows[0]?.title ?? "Event" };
  }

  if (row.host_profile_id) {
    void pool
      .query(
        `insert into notifications (profile_id, title, body, action_url) values ($1::uuid, $2, $3, $4)`,
        [
          row.host_profile_id,
          "Address change declined",
          `Your address change for "${row.title}" wasn't approved - the original address stands.`,
          `/merchant/events/${eventSlug}`,
        ],
      )
      .catch(() => {});
  }

  return { rejected: true, title: row.title };
}

/** `degraded` marks "we could not read the catalogue", as distinct from "there is nothing in it". */
export type ExploreEvents = EventItem[] & { degraded?: boolean };

async function degradedExplore(): Promise<ExploreEvents> {
  // Only a real deployment can distinguish the two - locally the fallback set is
  // genuine content, not a failure.
  if (!isProductionDeployment()) return getFallbackEvents();
  const empty: ExploreEvents = [];
  empty.degraded = true;
  return empty;
}

// Memoised per request. /discover awaits this AND getPersonalizedDiscovery,
// which calls it again internally - so a signed-in load ran the heaviest query
// in the app twice for one page. `cache` collapses that to one.
export const getEventsForExplore = cache(getEventsForExploreUncached);

async function getEventsForExploreUncached(): Promise<ExploreEvents> {
  const pool = getPostgresPool();

  if (!pool) return await degradedExplore();

  try {
    const result = await pool.query<EventRow>(`
      select
        event.slug,
        event.title,
        event.group_name,
        event.host_name,
        event.category,
        event.status::text,
        event.booking_model::text,
        event.starts_at,
        event.ends_at,
        event.location_name,
        event.suburb,
        event.latitude::text,
        event.longitude::text,
        event.price_cents,
        event.capacity,
        event.image_url,
        event.image_alt,
        event.description,
        event.relationship_goal,
        event.fomo,
        (
          count(distinct attendee.id) filter (where (attendee.status = 'confirmed' or (attendee.status = 'pending_payment' and attendee.hold_expires_at > now())))
          -- Plus paid guest seats (spec 19): each live guest_spots row is a held
          -- seat exactly like a pending attendee, so it counts toward the
          -- "X going" headcount + capacity. exists (not a join) so a row can't
          -- fan out. Mirrors the checkout capacity gate in createPaymentHold.
          + coalesce((
            select count(*)
            from guest_spots gs
            where gs.event_id = event.id
              and gs.status <> 'cancelled'
              and exists (
                select 1 from event_attendees ga
                where ga.payment_transaction_id = gs.payment_transaction_id
                  and (ga.status = 'confirmed' or (ga.status = 'pending_payment' and ga.hold_expires_at > now()))
              )
          ), 0)
        ) as confirmed_attendees,
        (
          -- Up to 3 confirmed-attendee avatars for the "who's going" preview.
          select coalesce(array_agg(preview.photo_url order by preview.joined_at), '{}')
          from (
            select profile.photo_url, ea.created_at as joined_at
            from event_attendees ea
            join profiles profile on profile.id = ea.profile_id
            where ea.event_id = event.id
              and ea.status = 'confirmed'
              and profile.photo_url is not null
              -- Attendance is not public by face. This preview renders to anyone
              -- with the URL, signed out included, so it shows only people who
              -- have not opted out of attendee lists (profile default, per-booking
              -- override) and never a banned account. The columns landed in
              -- migration 049 and nothing read them until now, which meant the
              -- opt-out existed in the schema and did nothing in the product.
              and profile.default_attend_visibility
              and profile.is_banned = false
              and ea.visible_to_attendees
            order by ea.created_at asc
            limit 3
          ) preview
        ) as attendee_avatars,
        coalesce(
          -- tag.label, not tag.slug. The slug is kebab-case machine text, and it
          -- was rendering raw beside attendee cards that show proper labels:
          -- "low-pressure" and "new-to-town" next to "Low Pressure". Labels are
          -- not derivable from slugs either ("crossfit" -> "CrossFit"), so this
          -- has to come from the column. EventExplorer's matchesTag slugifies
          -- both sides, so /discover?tag=low-pressure still resolves.
          array_agg(distinct tag.label)
            filter (where tag.tag_type in ('interest', 'vibe', 'music')),
          '{}'
        ) as tags,
        coalesce(
          array_agg(distinct tag.label)
            filter (where tag.tag_type = 'life'),
          '{}'
        ) as life_signals
      from events event
      left join event_attendees attendee on attendee.event_id = event.id
      left join event_tags event_tag on event_tag.event_id = event.id
      left join tags tag on tag.id = event_tag.tag_id
      left join merchant_profiles merchant on merchant.id = event.merchant_profile_id
      where event.status in ('live', 'featured', 'locked', 'waitlist')
        and coalesce(merchant.verification_status, 'approved') <> 'suspended'
        -- Hide events that have already finished: once an event's end time
        -- (or its start, when no end is set) is in the past it's no longer
        -- discoverable and can't be RSVP'd to. Keeps "starting soon" honest.
        and coalesce(event.ends_at, event.starts_at) > now()
      group by event.id
      order by event.starts_at asc
    `);

    // The venue name never leaves the server on this path. EventExplorer is a
    // client component, so anything returned here is serialised into the page
    // HTML for every visitor - including the events whose cards say "Venue
    // shown when you RSVP". The card only renders suburb + distance while
    // locked; a viewer who holds a seat gets the name from
    // /api/events/[eventId], which knows the session.
    return result.rows.map((row) => ({ ...eventFromRow(row), location: "" }));
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("Falling back to static Click events because Postgres is unavailable.", error);
    }

    return await degradedExplore();
  }
}

export type PersonalizedDiscovery = {
  events: EventItem[];
  readiness: number;
  fallback: boolean;
  heading: string;
  blurb: string;
};

// Ranks the live catalogue for one member. Above the readiness threshold we
// sort by the tunable personalised score; below it (cold-start) we serve the
// editorial fallback feed of popular events. Returns null when signed out / no
// DB so callers can simply skip the rail.
export async function getPersonalizedDiscovery(
  session: Session | null,
  limit = 6,
): Promise<PersonalizedDiscovery | null> {
  const pool = getPostgresPool();
  if (!getSessionEmail(session) || !pool) return null;

  try {
    const profile = await ensureProfileForSession(session);
    const [allEvents, settings] = await Promise.all([getEventsForExplore(), getSystemSettings()]);
    if (allEvents.length === 0) return null;

    const [tagsResult, profileResult, personaResult, attendedResult, registeredResult] = await Promise.all([
      pool.query<{ slug: string }>(
        `select t.slug from user_tags ut join tags t on t.id = ut.tag_id where ut.profile_id = $1::uuid`,
        [profile.id],
      ),
      pool.query<{ intents: string[] }>(
        `select connection_intents::text[] as intents from profiles where id = $1::uuid`,
        [profile.id],
      ),
      pool.query<{ openness: string; social_energy: string }>(
        `select openness, social_energy from click_personas where profile_id = $1::uuid order by generated_at desc limit 1`,
        [profile.id],
      ),
      pool.query<{ count: string }>(
        `select count(*)::text as count from event_attendees where profile_id = $1::uuid and status = 'confirmed'`,
        [profile.id],
      ),
      // Slugs of events the member is already on (confirmed/waitlisted/holding a
      // seat) so we never suggest something they've already committed to.
      pool.query<{ slug: string }>(
        `select event.slug
           from event_attendees attendee
           join events event on event.id = attendee.event_id
          where attendee.profile_id = $1::uuid
            and attendee.status in ('confirmed', 'waitlisted', 'pending_payment')`,
        [profile.id],
      ),
    ]);

    const registeredSlugs = new Set(registeredResult.rows.map((r) => r.slug));
    const candidateEvents = allEvents.filter((event) => !registeredSlugs.has(event.id));

    const personaRow = personaResult.rows[0];
    const ctx: UserMatchContext = {
      tagSlugs: tagsResult.rows.map((r) => r.slug),
      intents: profileResult.rows[0]?.intents ?? [],
      persona: personaRow
        ? {
            openness: personaRow.openness as "cautious" | "curious" | "ready",
            socialEnergy: personaRow.social_energy as "introvert" | "ambivert" | "extrovert",
          }
        : null,
    };

    const attendedCount = Number(attendedResult.rows[0]?.count ?? 0);
    const weights = settings.matchingWeights;
    const readiness = readinessScore(ctx, attendedCount);
    const fallback = readiness < weights.readinessThreshold || ctx.tagSlugs.length === 0;

    // Matching v2 (flagged): re-rank candidates with the cohort-aware user↔event
    // model. EventItem.id is the slug, which is what generateEventCandidates
    // keys on. Falls through to v1 when the viewer has no features yet.
    if (settings.matchingV2Enabled) {
      const v2 = await generateEventCandidates(pool, profile.id, 50).catch(() => []);
      if (v2.length > 0) {
        const order = new Map(v2.map((c, i) => [c.slug, i] as const));
        const v2ranked = [...candidateEvents].sort(
          (a, b) =>
            (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
            (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
        );
        // `fallback`, not a hardcoded false. It means "this member has no tags
        // yet" - which is true no matter which ranker ran, and it is the only
        // thing that surfaces the add-interests on-ramp. Pinning it false meant
        // a tag-less member was told the feed was picked for them, forever,
        // with nothing on screen offering to make that true.
        return {
          events: v2ranked.slice(0, limit),
          readiness,
          fallback,
          heading: fallback ? "Popular in inner Sydney" : "Picked for you",
          blurb: fallback
            ? "Add a few interest tags to your profile and this becomes personalised to you."
            : "Ranked by your interests, intent, and persona.",
        };
      }
    }

    const ranked = fallback
      ? rankEditorialFallback(candidateEvents)
      : candidateEvents
          .map((event) => scorePersonalizedEvent(event, ctx, weights))
          .sort((a, b) => b.score - a.score)
          .map((scored) => scored.event);

    return {
      events: ranked.slice(0, limit),
      readiness,
      fallback,
      heading: fallback ? "Popular in inner Sydney" : "Picked for you",
      blurb: fallback
        ? "Add a few interest tags to your profile and this becomes personalised to you."
        : "Ranked by your interests, intent, and persona.",
    };
  } catch {
    return null;
  }
}

export type EventCategory = {
  name: string;
  slug: string;
  description: string | null;
  eventCount: number;
  tagCount: number;
  tags: string[];
};

// Canonical category metadata mirrors database/002_seed.sql so the Categories
// page still renders meaningfully when Postgres is unavailable (static mode).
const staticCategoryMeta: Array<{
  name: string;
  slug: string;
  description: string;
  tags: string[];
}> = [
  {
    name: "Social",
    slug: "social",
    description: "Friendship, low-pressure gatherings, and local community",
    tags: ["Friends", "New to Town", "Low Pressure", "Games", "Books", "Quiet"],
  },
  {
    name: "Fitness",
    slug: "fitness",
    description: "Training, movement, and accountability",
    tags: ["CrossFit", "Fitness", "Accountability", "Running", "Yoga", "Swimming", "Outdoors", "Morning", "Wellness"],
  },
  {
    name: "Relationships",
    slug: "relationships",
    description: "Dating and relationship-minded social events",
    tags: ["Dating", "Relationships"],
  },
  {
    name: "Food",
    slug: "food",
    description: "Restaurants, shared plates, dinners, and low-pressure table plans",
    tags: ["Restaurant", "Dinner", "Food", "Dumplings"],
  },
  {
    name: "Creative",
    slug: "creative",
    description: "Making, writing, art, music, and culture",
    tags: ["Creative", "Brunch", "Live Music", "Pottery", "Photography"],
  },
  {
    name: "Career",
    slug: "career",
    description: "Career change, networking, and professional support",
    tags: ["Career Change", "Confidence", "Founders", "Women"],
  },
  {
    name: "Community",
    slug: "community",
    description: "Volunteering, neighbourhood rituals, and local action",
    tags: ["Pets", "Community", "Volunteering"],
  },
  {
    name: "Music",
    slug: "music",
    description: "Music taste used as a subtle matching signal",
    tags: ["Jazz", "Indie"],
  },
  {
    name: "Life",
    slug: "life",
    description: "Life Quiz generated tags",
    tags: ["Ambivert", "Weekend"],
  },
];

function fallbackEventCategories(): EventCategory[] {
  const counts = new Map<string, number>();
  for (const event of clickEvents) {
    if (event.status === "Pending" || event.status === "Cancelled") continue;
    counts.set(event.category, (counts.get(event.category) ?? 0) + 1);
  }

  return staticCategoryMeta
    .map((meta) => ({
      name: meta.name,
      slug: meta.slug,
      description: meta.description,
      eventCount: counts.get(meta.name) ?? 0,
      tagCount: meta.tags.length,
      tags: meta.tags,
    }))
    .sort((a, b) => b.eventCount - a.eventCount || a.name.localeCompare(b.name));
}

export async function getEventCategories(): Promise<EventCategory[]> {
  const pool = getPostgresPool();

  if (!pool) return fallbackEventCategories();

  try {
    const result = await pool.query<{
      name: string;
      slug: string;
      description: string | null;
      tags: string[] | null;
      tag_count: string;
      event_count: string;
    }>(`
      select
        category.name,
        category.slug,
        category.description,
        coalesce(
          array_agg(distinct tag.label) filter (where tag.label is not null),
          '{}'
        ) as tags,
        count(distinct tag.id) as tag_count,
        coalesce(event_counts.event_count, 0) as event_count
      from tag_categories category
      left join tags tag on tag.category_id = category.id
      left join (
        select event.category, count(*)::int as event_count
        from events event
        left join merchant_profiles merchant on merchant.id = event.merchant_profile_id
        where event.status in ('live', 'featured', 'locked', 'waitlist')
          and coalesce(merchant.verification_status, 'approved') <> 'suspended'
        group by event.category
      ) event_counts on event_counts.category = category.name
      where category.internal_only = false
      group by category.id, event_counts.event_count
      order by event_count desc, category.name asc
    `);

    return result.rows.map((row): EventCategory => ({
      name: row.name,
      slug: row.slug,
      description: row.description,
      eventCount: Number(row.event_count),
      tagCount: Number(row.tag_count),
      tags: (row.tags ?? []).slice().sort((a, b) => a.localeCompare(b)),
    }));
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("Falling back to static event categories.", error);
    }

    return fallbackEventCategories();
  }
}

export type EventDetail = EventItem & {
  priceCents: number;
  address: string | null;
  // City/locality, shown alongside suburb so confirmed attendees see the fullest
  // available address (seed events have no street `address`, so suburb + city is
  // the most complete location we can reveal post-RSVP).
  city: string | null;
  endsAt: string | null;
  viewerRsvpStatus: "confirmed" | "waitlisted" | "pending_payment" | "cancelled" | null;
  // ISO timestamp of a live waitlist promotion offer for the viewer - set only
  // when the viewer is waitlisted, has been offered a freed seat, and the
  // 30-minute window is still open (offered_until > now, accepted_at is null).
  // Drives the "Confirm your spot" CTA. Null otherwise.
  waitlistOfferExpiresAt: string | null;
  // Seats on the viewer's own LIVE payment hold (purchaser + named guests).
  // Only set while viewerRsvpStatus === 'pending_payment'. The resume CTA has to
  // re-request exactly this many seats: createPaymentHold rejects a mismatched
  // party size, so a solo "Reserve & pay" against a 3-seat hold just errored for
  // the full 31 minutes with no way to act on it.
  heldSeatCount: number | null;
  /** ISO expiry of that same hold, so the panel can count it down. */
  heldSeatExpiresAt: string | null;
  // 1-based queue position when the viewer is on the waitlist (e.g. "#3"),
  // counting only people still ahead of them. Null when not waitlisted.
  waitlistPosition: number | null;
  media: MediaItem[];
  // Owning merchant (null for platform-owned / fallback events). Used by the
  // detail page to let an owner preview their own not-yet-approved event while
  // keeping pending/rejected events out of public reach.
  merchantProfileId: string | null;
  // Title of another event the viewer is already attending whose time window
  // overlaps this one - drives a non-blocking "schedule clash" warning on the
  // RSVP CTA. Null when there's no clash (or the viewer isn't signed in / is
  // already on this event).
  viewerClashEventTitle: string | null;
};

// Statuses an event must be in to be visible to the public. Pending (awaiting
// admin review), Rejected and Cancelled are hidden. Lives here, not in the page,
// because /events/[slug], /api/events/[eventId] and .../ics all have to agree:
// the page 404'd an unreviewed event while the JSON route beside it served the
// whole listing, so the gate was one `fetch` away from being pointless.
export const PUBLIC_EVENT_STATUSES = new Set(["Featured", "Live", "Waitlist", "Locked"]);

// The owning merchant and admins can preview their own not-yet-public event, and
// they also see the venue without RSVPing to their own listing.
export function isEventOperator(
  event: Pick<EventDetail, "merchantProfileId">,
  profileStatus: ProfileStatus | null,
) {
  if (!profileStatus) return false;
  if (profileStatus.role === "admin") return true;
  return (
    Boolean(event.merchantProfileId) &&
    profileStatus.merchantProfile?.id === event.merchantProfileId
  );
}

// The venue is what an RSVP buys: the page shows the suburb plus "venue revealed
// when you RSVP" and only unlocks `location`/`address` once you're confirmed.
// The API projections have to enforce the same thing or the gate is decorative -
// curl the JSON and the street address is right there, no account needed.
export function viewerCanSeeVenue(
  event: Pick<EventDetail, "merchantProfileId" | "viewerRsvpStatus">,
  profileStatus: ProfileStatus | null,
) {
  return event.viewerRsvpStatus === "confirmed" || isEventOperator(event, profileStatus);
}

export async function getEventBySlug(
  slug: string,
  session: Session | null,
): Promise<EventDetail | null> {
  const pool = getPostgresPool();

  if (!pool) {
    if (isProductionDeployment()) return null;
    const fallback = (await getFallbackEvents({ includePending: true })).find(
      (event) => event.id === slug,
    );
    if (!fallback) return null;
    return {
      ...fallback,
      priceCents: parsePriceCents(fallback.price),
      address: null,
      city: null,
      endsAt: null,
      viewerRsvpStatus: null,
      waitlistOfferExpiresAt: null,
      waitlistPosition: null,
      heldSeatCount: null,
      heldSeatExpiresAt: null,
      merchantProfileId: null,
      viewerClashEventTitle: null,
      media: buildEventMediaGallery({
        images: [fallback.image],
        primaryAlt: fallback.imageAlt,
      }),
    };
  }

  try {
    const result = await pool.query<EventRow & { price_cents: number; address: string | null; city: string | null; ends_at: Date | null; merchant_profile_id: string | null; image_urls: string[] | null }>(
      `
        select
          event.slug,
          event.title,
          event.group_name,
          event.host_name,
          event.category,
          event.status::text,
          event.merchant_profile_id::text as merchant_profile_id,
          event.booking_model::text,
          event.starts_at,
          event.ends_at,
          event.location_name,
          event.address,
          event.suburb,
          event.city,
          event.latitude::text,
          event.longitude::text,
          event.price_cents,
          event.capacity,
          event.image_url,
          event.image_urls,
          event.image_alt,
          event.description,
          event.relationship_goal,
          event.fomo,
          (
            count(distinct attendee.id) filter (where (attendee.status = 'confirmed' or (attendee.status = 'pending_payment' and attendee.hold_expires_at > now())))
            -- Plus paid guest seats (spec 19): a live guest_spots row is a held
            -- seat, so it counts toward the detail page's headcount + capacity.
            + coalesce((
              select count(*)
              from guest_spots gs
              where gs.event_id = event.id
                and gs.status <> 'cancelled'
                and exists (
                  select 1 from event_attendees ga
                  where ga.payment_transaction_id = gs.payment_transaction_id
                    and (ga.status = 'confirmed' or (ga.status = 'pending_payment' and ga.hold_expires_at > now()))
                )
            ), 0)
            -- Plus live waitlist offers held by anyone (bug board #114/#213): a
            -- freed seat that's been re-offered to the next in line is reserved
            -- for the 30-min window, so it must count toward the headcount this
            -- page shows. registerForEvent's capacity gate already counts these,
            -- so omitting them here made the page advertise "RSVP again" for a
            -- seat the register endpoint would correctly waitlist the user into.
            + coalesce((
              select count(*)
              from event_waitlists w
              join event_attendees wa
                on wa.event_id = w.event_id
               and wa.profile_id = w.profile_id
               and wa.status = 'waitlisted'
              where w.event_id = event.id
                and w.accepted_at is null
                and w.offered_until > now()
            ), 0)
          ) as confirmed_attendees,
          coalesce(
            -- See the tag.label note on the sibling aggregate above.
            array_agg(distinct tag.label)
              filter (where tag.tag_type in ('interest', 'vibe', 'music')),
            '{}'
          ) as tags,
          coalesce(
            array_agg(distinct tag.label)
              filter (where tag.tag_type = 'life'),
            '{}'
          ) as life_signals
        from events event
        left join event_attendees attendee on attendee.event_id = event.id
        left join event_tags event_tag on event_tag.event_id = event.id
        left join tags tag on tag.id = event_tag.tag_id
        where event.slug = $1
        group by event.id
        limit 1
      `,
      [slug],
    );

    const row = result.rows[0];
    if (!row) {
      if (isProductionDeployment()) return null;
      // Slug connected fine but has no row - e.g. a static seed event that was
      // never inserted into Supabase. Fall back to bundled Click data so shared
      // links and the event modal still resolve instead of 404ing.
      const fallback = (await getFallbackEvents({ includePending: true })).find(
        (event) => event.id === slug,
      );
      if (!fallback) return null;
      return {
        ...fallback,
        priceCents: parsePriceCents(fallback.price),
        address: null,
        city: null,
        endsAt: null,
        viewerRsvpStatus: null,
        waitlistOfferExpiresAt: null,
        waitlistPosition: null,
        heldSeatCount: null,
      heldSeatExpiresAt: null,
        merchantProfileId: null,
        viewerClashEventTitle: null,
        media: buildEventMediaGallery({
          images: [fallback.image],
          primaryAlt: fallback.imageAlt,
        }),
      };
    }

    const base = eventFromRow(row);
    // Capture this event's window before `row` is shadowed inside the viewer
    // block below - the clash query needs the event's own start/end.
    const eventStartsAt = row.starts_at;
    const eventEndsAt = row.ends_at;
    let viewerRsvpStatus: EventDetail["viewerRsvpStatus"] = null;
    let waitlistOfferExpiresAt: string | null = null;
    let waitlistPosition: number | null = null;
    let heldSeatCount: number | null = null;
    let heldSeatExpiresAt: string | null = null;
    let viewerClashEventTitle: string | null = null;
    const email = getSessionEmail(session);

    if (email) {
      const rsvpResult = await pool.query<{
        status: string;
        offered_until: Date | null;
        accepted_at: Date | null;
        waitlist_position: string | null;
      }>(
        `
          select
            attendee.status::text as status,
            waitlist.offered_until,
            waitlist.accepted_at,
            case
              when attendee.status = 'waitlisted' and waitlist.id is not null then (
                select count(*) + 1
                from event_waitlists ahead
                join event_attendees aa
                  on aa.event_id = ahead.event_id and aa.profile_id = ahead.profile_id
                 and aa.status = 'waitlisted'
                where ahead.event_id = waitlist.event_id
                  and ahead.accepted_at is null
                  -- The promoter's ordering key, not created_at alone: it
                  -- serves never-lapsed rows first (see promoteNextWaitlister).
                  -- Counting by arrival told someone who missed their 30-minute
                  -- window that they were still #1 while every freed seat went
                  -- past them.
                  and (ahead.last_offer_expired_at is not null, ahead.created_at)
                      < (waitlist.last_offer_expired_at is not null, waitlist.created_at)
              )
              else null
            end as waitlist_position
          from ${seatRowsSql} attendee
          join profiles profile on profile.id = attendee.profile_id
          join events event on event.id = attendee.event_id
          left join event_waitlists waitlist
            on waitlist.event_id = attendee.event_id
           and waitlist.profile_id = attendee.profile_id
          where profile.email = $1 and event.slug = $2
          -- Someone can hold their own seat AND have claimed a +1 for the same
          -- night. Their own booking is the row that carries the real status.
          order by case when attendee.seat_source = 'own' then 0 else 1 end
          limit 1
        `,
        [email, slug],
      );
      const row = rsvpResult.rows[0];
      const status = row?.status;
      if (status === "waitlisted" && row?.waitlist_position != null) {
        waitlistPosition = Number(row.waitlist_position);
      }
      if (
        status === "confirmed" ||
        status === "waitlisted" ||
        status === "pending_payment" ||
        status === "cancelled"
      ) {
        viewerRsvpStatus = status;
      }

      // Party size on the live hold, so the resume CTA can ask for the same
      // seats it already reserved. Mirrors createPaymentHold's own count:
      // the purchaser plus every guest_spots row that isn't cancelled.
      if (status === "pending_payment") {
        const seats = await pool.query<{ seat_count: string; hold_expires_at: Date | null }>(
          `
            select (
              1 + (
                select count(*)
                from guest_spots gs
                where gs.payment_transaction_id = pt.id and gs.status <> 'cancelled'
              )
            )::text as seat_count,
            ea.hold_expires_at
            from event_attendees ea
            join profiles p on p.id = ea.profile_id
            join events e on e.id = ea.event_id
            join payment_transactions pt on pt.id = ea.payment_transaction_id
            where p.email = $1 and e.slug = $2
              and ea.status = 'pending_payment'
              and ea.hold_expires_at > now()
              and pt.status = 'pending'
            limit 1
          `,
          [email, slug],
        );
        const parsed = Number(seats.rows[0]?.seat_count);
        heldSeatCount = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        const holdExpiry = seats.rows[0]?.hold_expires_at ?? null;
        heldSeatExpiresAt = holdExpiry ? new Date(holdExpiry).toISOString() : null;
      }
      // Surface a live promotion offer only while it's actually claimable: the
      // viewer is waitlisted, was offered the seat, hasn't accepted, and the
      // 30-minute window is still open.
      if (
        status === "waitlisted" &&
        row?.offered_until &&
        !row.accepted_at &&
        row.offered_until.getTime() > Date.now()
      ) {
        waitlistOfferExpiresAt = row.offered_until.toISOString();
      }

      // Schedule-clash check: warn the viewer if they already hold a spot at
      // another event whose time window overlaps this one. Only relevant when
      // they aren't already committed to THIS event. Two windows overlap when
      // start_a < end_b AND start_b < end_a; a null ends_at collapses to its
      // start. Non-blocking - just surfaces a heads-up on the RSVP CTA.
      if (status !== "confirmed" && status !== "waitlisted" && status !== "pending_payment") {
        const clashResult = await pool.query<{ title: string }>(
          `
            select other_event.title
            from event_attendees attendee
            join profiles profile on profile.id = attendee.profile_id
            join events other_event on other_event.id = attendee.event_id
            where profile.email = $1
              and other_event.slug <> $2
              and attendee.status in ('confirmed', 'waitlisted', 'pending_payment')
              and other_event.status <> 'cancelled'
              and other_event.starts_at < coalesce(($4)::timestamptz, ($3)::timestamptz)
              and coalesce(other_event.ends_at, other_event.starts_at) > ($3)::timestamptz
            order by other_event.starts_at asc
            limit 1
          `,
          [email, slug, eventStartsAt, eventEndsAt],
        );
        viewerClashEventTitle = clashResult.rows[0]?.title ?? null;
      }
    }

    return {
      ...base,
      priceCents: row.price_cents,
      viewerClashEventTitle,
      address: row.address,
      city: row.city ?? null,
      endsAt: row.ends_at ? row.ends_at.toISOString() : null,
      viewerRsvpStatus,
      waitlistOfferExpiresAt,
      waitlistPosition,
      heldSeatCount,
      heldSeatExpiresAt,
      merchantProfileId: row.merchant_profile_id ?? null,
      media: buildEventMediaGallery({
        // Real uploads only: the image_urls[] array when set, else the single
        // image_url. No synthetic stock fillers.
        images: resolveEventImages(
          row.image_urls && row.image_urls.length > 0 ? row.image_urls : [base.image],
          row.category,
          row.title,
        ),
        primaryAlt: base.imageAlt,
      }),
    };
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      if (isProductionDeployment()) return null;
      const fallback = (await getFallbackEvents({ includePending: true })).find(
        (event) => event.id === slug,
      );
      if (!fallback) return null;
      return {
        ...fallback,
        priceCents: parsePriceCents(fallback.price),
        address: null,
        city: null,
        endsAt: null,
        viewerRsvpStatus: null,
        waitlistOfferExpiresAt: null,
        waitlistPosition: null,
        heldSeatCount: null,
      heldSeatExpiresAt: null,
        merchantProfileId: null,
        viewerClashEventTitle: null,
        media: buildEventMediaGallery({
          images: [fallback.image],
          primaryAlt: fallback.imageAlt,
        }),
      };
    }
    throw error;
  }
}

export async function registerForEvent(eventId: string, session: Session | null) {
  const pool = getPostgresPool();

  if (!pool) return registerLocallyForEvent(eventId, session);

  try {
    const profile = await ensureProfileForSession(session);
    await assertBookingEligible(pool, profile.id);
    const client = await pool.connect();

    try {
      await client.query("begin");

      const eventResult = await client.query<{
        id: string;
        slug: string;
        title: string;
        capacity: number;
        status: string;
        price_cents: number;
        merchant_profile_id: string | null;
        confirmed_attendees: string;
        has_ended: boolean;
      }>(
        `
          select
            event.id::text,
            event.slug,
            event.title,
            event.capacity,
            event.status::text,
            event.price_cents,
            event.merchant_profile_id::text,
            (coalesce(event.ends_at, event.starts_at) <= now()) as has_ended,
            (
              (
                select count(*)
                from event_attendees attendee
                where attendee.event_id = event.id
                  -- Exclude the CALLER's own seat, exactly as the waitlist-offer
                  -- arm below and createPaymentHold's gate already do. Counting
                  -- it meant a replayed RSVP on a full event saw itself, flipped
                  -- isFull, and the upsert below demoted the caller's own
                  -- confirmed seat to 'waitlisted' - a double-tap gave away the
                  -- seat you already had. A caller with no row is unaffected.
                  and attendee.profile_id <> $2::uuid
                  and (attendee.status = 'confirmed' or (attendee.status = 'pending_payment' and attendee.hold_expires_at > now()))
              )
              +
              -- Guest +1 seats (spec 19). Without this arm the gate is blind to
              -- a whole class of seat, so an event full ONLY of guest seats read
              -- as open: a paid event then raised "requires payment" instead of
              -- offering the waitlist, and the buyer was refused again by
              -- createPaymentHold's own gate. Same liveness rule as that gate.
              (
                select count(*)
                from guest_spots gs
                join event_attendees ga
                  on ga.payment_transaction_id = gs.payment_transaction_id
                 and ga.profile_id = gs.purchaser_profile_id
                where gs.event_id = event.id
                  and gs.status <> 'cancelled'
                  and gs.purchaser_profile_id <> $2::uuid
                  and (ga.status = 'confirmed' or (ga.status = 'pending_payment' and ga.hold_expires_at > now()))
              )
              +
              -- Live waitlist offers held by OTHER people reserve their seat for
              -- the 30-min window so a stranger can't RSVP into a seat that was
              -- just offered to the next in line (bug board #114). The viewer's
              -- own offer is excluded (they claim via acceptWaitlistOffer).
              (
                select count(*)
                from event_waitlists w
                join event_attendees wa
                  on wa.event_id = w.event_id
                 and wa.profile_id = w.profile_id
                 and wa.status = 'waitlisted'
                where w.event_id = event.id
                  and w.accepted_at is null
                  and w.offered_until > now()
                  and w.profile_id <> $2::uuid
              )
            ) as confirmed_attendees
          from events event
          where event.slug = $1
          for update of event
        `,
        [eventId, profile.id],
      );

      const event = eventResult.rows[0];
      if (!event) {
        const error = new Error("Event not found.");
        error.name = "NotFoundError";
        throw error;
      }

      // Past events are closed: no new RSVPs once the event has ended.
      if (event.has_ended) {
        const error = new Error("This event has already ended.");
        error.name = "ValidationError";
        throw error;
      }
      if (!isBookableEventStatus(event.status)) {
        const error = new Error("This event is not accepting bookings.");
        error.name = "ValidationError";
        throw error;
      }

      const confirmedCount = Number(event.confirmed_attendees);
      const isFull =
        event.status === "waitlist" || confirmedCount >= event.capacity;

      if (event.price_cents > 0 && !isFull) {
        const error = new Error(
          "This event requires payment. Open the event to reserve and pay.",
        );
        error.name = "PaymentRequiredError";
        (error as Error & { eventSlug?: string }).eventSlug = eventId;
        throw error;
      }

      const status = isFull ? "waitlisted" : "confirmed";

      const rsvpRow = await client.query<{ id: string }>(
        `
          insert into event_attendees (event_id, profile_id, status)
          values ($1::uuid, $2::uuid, $3::rsvp_status)
          on conflict (event_id, profile_id) do update
          set status = excluded.status, updated_at = now()
          returning id::text
        `,
        [event.id, profile.id, status],
      );

      // Lifecycle log (spec 22 §2): a free RSVP confirming is a 'confirmed'
      // booking event with no money attached. Waitlist joins aren't booking
      // financial events, so they're not logged. In-txn for atomicity.
      if (status === "confirmed") {
        await logBookingEvent(client, {
          bookingId: rsvpRow.rows[0].id,
          eventId: event.id,
          merchantId: event.merchant_profile_id,
          userId: profile.id,
          eventType: "confirmed",
          amountCents: null,
          actor: "attendee",
          metadata: { free_rsvp: true },
        });
      }

      if (status === "waitlisted") {
        await client.query(
          `
            insert into event_waitlists (event_id, profile_id)
            values ($1::uuid, $2::uuid)
            on conflict (event_id, profile_id) do update
            set offered_until = null, accepted_at = null
          `,
          [event.id, profile.id],
        );
      }

      await client.query(
        `
          insert into notifications (profile_id, title, body, action_url)
          values ($1::uuid, $2, $3, $4)
        `,
        [
          profile.id,
          status === "confirmed" ? "RSVP confirmed" : "Waitlist joined",
          `${event.title} is now ${status} for ${profile.display_name}.`,
          `/events/${event.slug}`,
        ],
      );

      await client.query("commit");

      if (status === "waitlisted") {
        // Waitlist join → log waitlist-joined-attendee to email_events.
        // Fire-and-forget, same as the confirmed branch below.
        void logWaitlistJoinedEmail(pool, event.id, profile.id);
      } else {
        // Confirmed RSVP → log rsvp-attendee + rsvp-merchant to email_events.
        // One supplementary SELECT gathers everything both templates need so
        // we don't pollute the in-txn block above with email-shaped data.
        // Fire-and-forget - failures never bubble into the API response.
        void logRsvpEmails(pool, event.id, profile.id);
        // If this event is the suggested plan from a mutual-click proposal,
        // nudge the other person that their match has RSVP'd (bug board #107).
        void notifyProposalPartnerOfRsvp(pool, event.id, profile.id);
      }

      return {
        eventTitle: event.title,
        status,
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      return registerLocallyForEvent(eventId, session);
    }

    throw error;
  }
}

// Notify a mutual-click partner when the viewer RSVPs to the proposal's
// suggested event, so they know to RSVP too ("your click RSVP'd - your turn").
// Idempotent per (partner, event) via the action_url marker. Best-effort:
// swallows its own errors so it can be called void-style after a commit.
async function notifyProposalPartnerOfRsvp(
  pool: NonNullable<ReturnType<typeof getPostgresPool>>,
  eventId: string,
  rsvperProfileId: string,
): Promise<void> {
  try {
    await pool.query(
      `
        insert into notifications (profile_id, title, body, action_url)
        select
          case when mc.user_a_id = $2::uuid then mc.user_b_id else mc.user_a_id end,
          'Your click RSVP''d - your turn',
          rsvper.display_name || ' just RSVP''d to ' || e.title ||
            '. RSVP too so your plan is locked in.',
          '/events/' || e.slug || '?from=proposal-partner-rsvp'
        from click_proposals ep
        join mutual_clicks mc on mc.id = ep.mutual_click_id
        join events e on e.id = ep.suggested_event_id
        join profiles rsvper on rsvper.id = $2::uuid
        where ep.suggested_event_id = $1::uuid
          and ep.status in ('pending', 'accepted')
          and (mc.user_a_id = $2::uuid or mc.user_b_id = $2::uuid)
          -- SAFE-04: the same guard set remindProposalRsvps carries. Without it this
          -- was a one-way channel INTO a blocker's notification tray: block someone,
          -- they RSVP to the old suggested event, and their display name lands on
          -- your screen. Also skips a wound-down mutual and a banned/suspended pair.
          and mc.status = 'active'
          and not exists (
            select 1 from user_blocks b
            where (b.blocker_profile_id = mc.user_a_id and b.blocked_profile_id = mc.user_b_id)
               or (b.blocker_profile_id = mc.user_b_id and b.blocked_profile_id = mc.user_a_id)
          )
          and not exists (
            select 1 from profiles pf
            where pf.id in (mc.user_a_id, mc.user_b_id)
              and (pf.is_banned or pf.suspended_at is not null)
          )
          -- Mute is quieter than block, but it is still "stop telling me about
          -- this person" - and this was the one sender that ignored it, so a
          -- muted name still arrived in the muter's tray.
          and not exists (
            select 1 from user_mutes m
            where m.muter_profile_id = (
                case when mc.user_a_id = $2::uuid then mc.user_b_id else mc.user_a_id end
              )
              and m.muted_profile_id = $2::uuid
          )
          and not exists (
            select 1 from notifications n
            where n.profile_id = (
                case when mc.user_a_id = $2::uuid then mc.user_b_id else mc.user_a_id end
              )
              and n.action_url = '/events/' || e.slug || '?from=proposal-partner-rsvp'
          )
      `,
      [eventId, rsvperProfileId],
    );
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("notifyProposalPartnerOfRsvp failed", error);
    }
  }
}

// Send a one-time reminder to each proposal participant who still hasn't RSVP'd
// to the suggested event 24h+ after the proposal was created (and while it's
// still pending + the event is upcoming). Idempotent per (participant, event)
// via the action_url marker. Returns the count of reminders created.
// (Bug board #107 - the 24h RSVP reminder.)
export async function remindProposalRsvps(): Promise<number> {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const result = await pool.query(
    `
      with participants as (
        select ep.id as proposal_id, e.id as event_id, e.slug, e.title,
               mc.user_a_id as participant, mc.user_b_id as other_participant
        from click_proposals ep
        join mutual_clicks mc on mc.id = ep.mutual_click_id
        join events e on e.id = ep.suggested_event_id
        where ep.status = 'pending'
          -- SAFE-04: a lapsed-but-pending proposal must not fire a stray reminder, and
          -- the reminder only makes sense while the mutual is still live.
          and ep.expires_at > now()
          and mc.status = 'active'
          and ep.created_at <= now() - interval '24 hours'
          and coalesce(e.ends_at, e.starts_at) > now()
          -- SAFE-04: never remind a torn-down / frozen pair - skip if either party
          -- blocked the other, or either is banned/suspended.
          and not exists (
            select 1 from user_blocks b
            where (b.blocker_profile_id = mc.user_a_id and b.blocked_profile_id = mc.user_b_id)
               or (b.blocker_profile_id = mc.user_b_id and b.blocked_profile_id = mc.user_a_id)
          )
          and not exists (
            select 1 from profiles pf
            where pf.id in (mc.user_a_id, mc.user_b_id)
              and (pf.is_banned or pf.suspended_at is not null)
          )
        union all
        select ep.id, e.id, e.slug, e.title, mc.user_b_id, mc.user_a_id
        from click_proposals ep
        join mutual_clicks mc on mc.id = ep.mutual_click_id
        join events e on e.id = ep.suggested_event_id
        where ep.status = 'pending'
          -- SAFE-04: a lapsed-but-pending proposal must not fire a stray reminder, and
          -- the reminder only makes sense while the mutual is still live.
          and ep.expires_at > now()
          and mc.status = 'active'
          and ep.created_at <= now() - interval '24 hours'
          and coalesce(e.ends_at, e.starts_at) > now()
          -- SAFE-04: never remind a torn-down / frozen pair - skip if either party
          -- blocked the other, or either is banned/suspended.
          and not exists (
            select 1 from user_blocks b
            where (b.blocker_profile_id = mc.user_a_id and b.blocked_profile_id = mc.user_b_id)
               or (b.blocker_profile_id = mc.user_b_id and b.blocked_profile_id = mc.user_a_id)
          )
          and not exists (
            select 1 from profiles pf
            where pf.id in (mc.user_a_id, mc.user_b_id)
              and (pf.is_banned or pf.suspended_at is not null)
          )
      )
      insert into notifications (profile_id, title, body, action_url)
      select
        p.participant,
        'Your plan is still open',
        p.title || ' is still on the table. RSVP to lock in your spot before it fills up.',
        '/events/' || p.slug || '?from=proposal-rsvp-reminder'
      from participants p
      where p.participant is not null
        -- Hasn't RSVP'd to the suggested event yet.
        and not exists (
          select 1 from event_attendees a
          where a.event_id = p.event_id
            and a.profile_id = p.participant
            and a.status in ('confirmed', 'waitlisted', 'pending_payment')
        )
        -- Muted pairs stay quiet too, not just blocked ones.
        and not exists (
          select 1 from user_mutes m
          where m.muter_profile_id = p.participant
            and m.muted_profile_id = p.other_participant
        )
        -- One reminder per (participant, event).
        and not exists (
          select 1 from notifications n
          where n.profile_id = p.participant
            and n.action_url = '/events/' || p.slug || '?from=proposal-rsvp-reminder'
        )
    `,
  );
  return result.rowCount ?? 0;
}

/**
 * Claim a waitlist promotion offer made by `cancelRegistration`. When a confirmed
 * attendee cancels, the next waitlister is offered the freed seat for 30 minutes
 * (`event_waitlists.offered_until`). This is the accept side of that handshake:
 *
 *  - Free events: flips the viewer's RSVP `waitlisted → confirmed`, stamps
 *    `event_waitlists.accepted_at`, and logs the confirmation emails.
 *  - Paid events: there's no seat to confirm without payment, so we surface a
 *    `PaymentRequiredError` carrying the slug - the client routes to the normal
 *    Stripe checkout, which takes the freed seat via `createPaymentHold`.
 *
 * Throws if the offer has expired, was already taken, or the seat filled in the
 * meantime, so a stale "Confirm your spot" click can't double-book.
 */
export async function acceptWaitlistOffer(eventId: string, session: Session | null) {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);

  // JOINING a waitlist goes through registerForEvent and is gated there;
  // ACCEPTING the promotion did not go through anything. Someone banned after
  // they joined, then promoted by expireWaitlistOffers or cancelRegistration,
  // could POST straight at this and take the seat. Gated before pool.connect()
  // so a refusal never opens a transaction. Paid offers bounce to
  // createPaymentHold below, which has its own call - free ones confirmed here.
  await assertBookingEligible(pool, profile.id);

  const client = await pool.connect();

  try {
    await client.query("begin");

    const eventResult = await client.query<{
      id: string;
      slug: string;
      title: string;
      capacity: number;
      status: string;
      price_cents: number;
      confirmed_attendees: string;
    }>(
      `
        select
          event.id::text,
          event.slug,
          event.title,
          event.capacity,
          event.status::text,
          event.price_cents,
          (
            select count(*)
            from event_attendees attendee
            where attendee.event_id = event.id
              and (attendee.status = 'confirmed' or (attendee.status = 'pending_payment' and attendee.hold_expires_at > now()))
          ) as confirmed_attendees
        from events event
        where event.slug = $1
        for update of event
      `,
      [eventId],
    );

    const event = eventResult.rows[0];
    if (!event) {
      const error = new Error("Event not found.");
      error.name = "NotFoundError";
      throw error;
    }
    if (!isBookableEventStatus(event.status)) {
      const error = new Error("This event is not accepting bookings.");
      error.name = "ConflictError";
      throw error;
    }

    // Lock the viewer's waitlist + attendee rows and verify a live offer exists.
    const offerResult = await client.query<{
      waitlist_id: string;
      offered_until: Date | null;
      accepted_at: Date | null;
    }>(
      `
        select
          waitlist.id::text as waitlist_id,
          waitlist.offered_until,
          waitlist.accepted_at
        from event_waitlists waitlist
        join event_attendees attendee
          on attendee.event_id = waitlist.event_id
         and attendee.profile_id = waitlist.profile_id
         and attendee.status = 'waitlisted'
        where waitlist.event_id = $1::uuid
          and waitlist.profile_id = $2::uuid
        for update of waitlist, attendee
      `,
      [event.id, profile.id],
    );

    const offer = offerResult.rows[0];
    if (!offer) {
      const error = new Error("You don't have a waitlist spot to confirm for this event.");
      error.name = "NotFoundError";
      throw error;
    }
    if (offer.accepted_at) {
      const error = new Error("You've already confirmed this spot.");
      error.name = "ConflictError";
      throw error;
    }
    if (!offer.offered_until || offer.offered_until.getTime() <= Date.now()) {
      const error = new Error("This offer has expired. The seat was reopened to the queue.");
      error.name = "ConflictError";
      throw error;
    }
    if (Number(event.confirmed_attendees) >= event.capacity) {
      const error = new Error("This event just filled up. Your spot on the waitlist is kept.");
      error.name = "ConflictError";
      throw error;
    }

    // Paid events: the seat is only secured once payment completes. Hand off to
    // the existing Stripe checkout flow rather than confirming here.
    if (event.price_cents > 0) {
      const error = new Error(
        "This event requires payment. Open the event to reserve and pay.",
      );
      error.name = "PaymentRequiredError";
      (error as Error & { eventSlug?: string }).eventSlug = event.slug;
      throw error;
    }

    await client.query(
      `
        update event_attendees
        set status = 'confirmed', updated_at = now()
        where event_id = $1::uuid and profile_id = $2::uuid
      `,
      [event.id, profile.id],
    );

    await client.query(
      `
        update event_waitlists
        set accepted_at = now()
        where id = $1::uuid
      `,
      [offer.waitlist_id],
    );

    await client.query(
      `
        insert into notifications (profile_id, title, body, action_url)
        values ($1::uuid, $2, $3, $4)
      `,
      [
        profile.id,
        "RSVP confirmed",
        `You're confirmed for ${event.title}. See you there!`,
        `/events/${event.slug}`,
      ],
    );

    await client.query("commit");

    // Confirmed off the waitlist → same emails as a fresh confirmed RSVP.
    void logRsvpEmails(pool, event.id, profile.id);

    return { eventTitle: event.title, status: "confirmed" as const };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function createEventForMerchant(input: CreateEventInput, session: Session | null) {
  const pool = getPostgresPool();

  if (!pool) return createLocalEventForMerchant(input, session);

  try {
    const profile = await ensureProfileForSession(session);
    const merchantProfile = await getMerchantProfile(pool, profile.id);
    if (!merchantProfile) {
      const error = new Error("Complete merchant signup before creating events.");
      error.name = "MerchantSignupRequiredError";
      throw error;
    }
    if (merchantProfile.verification_status !== "approved") {
      const error = new Error("Admin approval is required before creating Click events.");
      error.name = "MerchantApprovalRequiredError";
      throw error;
    }
    // Trusted merchants (an admin has approved at least one of their events, see
    // approveEventForAdmin) skip the pending queue - their events publish straight
    // to 'live'. New/untrusted merchants still land in 'pending' for manual review.
    const autoApprove = merchantProfile.auto_approve_events === true;
    // Event titles are always title-cased ("table for eight" → "Table for
    // Eight"). The wizard does this live as the merchant types; we redo it here
    // so titles from any other path (or a bypassed client) stay consistent.
    const title = toTitleCase(input.title.trim());
    const description = input.description.trim();
    // datetime-local strings are Sydney wall time, not server/UTC time.
    const startsAt = parseEventStart(input.startsAt);
    const capacity = Math.max(input.capacity, 1);

    if (!title || !description || Number.isNaN(startsAt.getTime())) {
      const error = new Error("Title, description, and valid start date are required.");
      error.name = "ValidationError";
      throw error;
    }

    // No payout gate at creation time. Merchants can submit paid events
    // before connecting Stripe - the event sits in 'pending' for admin review,
    // and the admin can reject it (see rejectEventForAdmin). Stripe Connect is
    // still enforced later, at attendee checkout time (the checkout route
    // throws PayoutsNotReadyError if the merchant never finished payout setup),
    // so no one can pay into an account that can't receive funds.
    const priceCents = parsePriceCents(input.price);

    // The Stripe requirement belongs to events that TAKE MONEY, not to every
    // event. We can't push a PAID event live for a merchant we can't pay out,
    // so those stay 'pending' until Connect is finished (charges AND payouts).
    // A FREE event moves no money, so payout setup is irrelevant to it - and
    // gating it here was the bug: an approved host who deliberately skipped
    // payouts (see the "theo" persona in src/lib/qa-personas.ts, "Approved,
    // skipped payout setup. Can publish free events") had every free event
    // silently parked in the admin queue, while /merchant/onboarding told them
    // they were ready to go.
    const stripeReady =
      merchantProfile.charges_enabled === true &&
      merchantProfile.payouts_enabled === true;
    const needsStripe = priceCents > 0;
    const eventStatus = autoApprove && (!needsStripe || stripeReady) ? "live" : "pending";

    const slug = `${slugFromTitle(title)}-${Date.now().toString(36)}`;
    const durationMinutes =
      input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : 120;
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
    const category = input.category.trim() || "Social";
    const relationshipGoal =
      input.relationshipGoal.trim() || "Help people meet through a shared plan.";

    // Normalise the multi-photo gallery from the Media step. Drop empties,
    // de-dupe (paste-twice is easy to do), and treat the first as the cover
    // - mirrored into image_url so legacy readers keep working. We prefer
    // the gallery over the single imageUrl input so the cover stays in sync
    // with the first card the merchant sees in the UI.
    const galleryUrls = (input.imageUrls ?? [])
      .map((u) => u.trim())
      .filter(Boolean);
    const dedupedGallery = Array.from(new Set(galleryUrls));
    const coverImage =
      resolveEventImage(dedupedGallery[0] || input.imageUrl?.trim(), category, input.title);
    const imageUrlsForDb =
      dedupedGallery.length > 0 ? dedupedGallery : null;

    const result = await pool.query<{ slug: string; title: string }>(
      `
        insert into events (
          slug,
          title,
          description,
          host_profile_id,
          merchant_profile_id,
          group_name,
          host_name,
          category,
          status,
          booking_model,
          starts_at,
          ends_at,
          location_name,
          suburb,
          latitude,
          longitude,
          price_cents,
          capacity,
          image_url,
          image_urls,
          image_alt,
          relationship_goal,
          fomo,
          address
        )
        values (
          $1,
          $2,
          $3,
          $4::uuid,
          $5::uuid,
          $6,
          $7,
          $8,
          $22::event_status,
          'click_managed',
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18,
          $19,
          $20,
          $21,
          $23
        )
        returning slug, title
      `,
      [
        slug,
        title,
        description,
        profile.id,
        merchantProfile.id,
        input.groupName.trim() || merchantProfile.business_name,
        profile.display_name,
        category,
        startsAt,
        endsAt,
        input.locationName.trim() || "Sydney NSW",
        input.suburb.trim() || "Sydney",
        input.latitude,
        input.longitude,
        priceCents,
        capacity,
        coverImage,
        imageUrlsForDb,
        input.imageAlt?.trim() || "Community event listing",
        relationshipGoal,
        // fomo is PUBLIC social-proof copy (it renders on the event card next to
        // the trend icon), not a status field. Writing the publishing state into
        // it put an internal ops sentence on the listing every member reads, and
        // for a trusted host's auto-approved event nothing ever cleared it - the
        // sentinel-clearing case in approveEventForAdmin only catches the pending
        // string. Genuine host-written fomo copy still comes through untouched.
        null,
        eventStatus,
        input.address?.trim() || null,
      ],
    );

    const rawTags = input.tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);

    if (rawTags.length > 0) {
      // Tags are "click tags" - never free-form. Attach only tags that already
      // exist in the curated taxonomy, matched by slug; anything unrecognised is
      // silently dropped (the UI only offers existing tags, this is defence in
      // depth). New tags are created exclusively by admins via /api/admin/tags.
      await pool.query(
        `
          with target_event as (
            select id from events where slug = $1
          ),
          matched_tags as (
            select tag.id
            from unnest($2::text[]) as input(label)
            join tags tag
              on tag.slug = trim(both '-' from regexp_replace(input.label, '[^a-z0-9]+', '-', 'g'))
          )
          insert into event_tags (event_id, tag_id)
          select target_event.id, matched_tags.id
          from target_event, matched_tags
          on conflict do nothing
        `,
        [slug, rawTags],
      );
    }

    // Matching v2: derive behavioural sub-tags for the event from its title +
    // description, scoped to its interest tags (events.sub_tags). Fire-and-forget
    // after the tag attach so it can't roll back the event; the nightly batch
    // recomputes anyway. See src/lib/matching/feature-store.ts.
    void deriveEventSubTagsBySlug(pool, slug).catch(() => {});

    // Log event-created-merchant to email_events. Everything the template
    // needs is already in scope here, so no second SELECT. Fire-and-forget.
    const origin = emailOrigin();
    const dates = formatEmailDates(startsAt, endsAt, "Australia/Sydney");
    const merchantFirstName =
      (profile.display_name || merchantProfile.business_name || "").split(/\s+/)[0] ||
      "there";
    await logEmailEvent({
      template: "event-created-merchant",
      toEmail: merchantProfile.contact_email,
      toProfileId: profile.id,
      vars: {
        merchantFirstName,
        eventTitle: title,
        eventLongDate: dates.eventLongDate,
        eventStartTime: dates.eventStartTime,
        eventCity: input.suburb.trim() || "Sydney",
        eventCategory: category,
        eventCapacityLabel: `Capacity ${capacity}`,
        eventDashboardUrl: `${origin}/merchant/events/${slug}`,
        editEventUrl: `${origin}/merchant/events/${slug}`,
        supportEmail: SUPPORT_EMAIL,
        unsubscribeUrl: `${origin}/account-settings`,
      },
    });

    // Ping every admin's notification bell when an event needs review, so a fresh
    // submission doesn't sit unseen in /admin/events. Skipped for trusted
    // merchants whose events auto-publish (nothing to review). Fire-and-forget.
    if (!autoApprove) {
      void pool
        .query(
          `
            insert into notifications (profile_id, title, body, action_url)
            select id, $1, $2, $3
            from profiles
            where role = 'admin'
          `,
          [
            "Event awaiting review",
            `${merchantProfile.business_name} submitted "${title}" for review.`,
            "/admin/events",
          ],
        )
        .catch((error) => {
          console.warn("Failed to notify admins of new pending event.", error);
        });
    }

    // Hand back the resolved status so the create wizard can tell a trusted
    // merchant their event is LIVE (vs the generic "submitted for review"
    // message), which otherwise reads as a contradiction of auto-approval
    // (bug board #180).
    return { slug: result.rows[0].slug, title: result.rows[0].title, status: eventStatus };
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      return createLocalEventForMerchant(input, session);
    }

    // The prevent_merchant_event_overlap trigger (database/001_schema.sql) raises
    // "merchant has an overlapping live event" when this event's time window
    // collides with another live event of the same merchant. That fires most
    // often when DUPLICATING an event and re-picking the source's own date/time
    // (the source is still live) - the raw Postgres message reads like an
    // internal error. Translate it into a clear, actionable validation message
    // pointing the merchant back at the Schedule step (bug board #194).
    if (
      error instanceof Error &&
      /overlapping live event/i.test(error.message)
    ) {
      const friendly = new Error(
        "You already have a live event during that time. Pick a different date or time on the Schedule step.",
      );
      friendly.name = "ValidationError";
      throw friendly;
    }

    throw error;
  }
}

// Clone an existing merchant event into a fresh draft so a merchant can re-run a
// recurring event without re-typing everything. Copies all the content fields
// (title, description, venue, price, capacity, gallery, tags) but NEVER the
// attendee list - the copy starts empty - and re-dates it a week out so it isn't
// born in the past. Reuses createEventForMerchant so the copy goes through the
// exact same validation, trusted-merchant status logic, tag attach, sub-tag
// derivation and "event created" email as a hand-made event. Ownership-scoped:
// only the owning merchant can duplicate, and only their own event.
// A duplicate "draft" prefilled into the create wizard's sessionStorage, shaped
// to match the wizard's WizardValues (string fields). Date/time is deliberately
// LEFT BLANK so the merchant must pick a fresh date (bug board #184), and the
// title carries NO "Copy of" prefix (#185). The merchant then edits and
// publishes through the normal create flow so it actually lands in discovery
// (#191) - instead of the old path that silently created a re-dated clone.
export type EventDuplicateDraft = {
  title: string;
  groupName: string;
  category: string;
  startsAt: string;
  durationMinutes: string;
  capacity: string;
  locationName: string;
  suburb: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  price: string;
  tags: string;
  relationshipGoal: string;
  description: string;
  images: string[];
  imageAlt: string;
  recurrenceFreq: "none";
  recurrenceCount: string;
};

export async function getMerchantEventDuplicateDraft(
  sourceSlug: string,
  session: Session | null,
): Promise<EventDuplicateDraft> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const merchant = await getMerchantProfile(pool, profile.id);
  if (!merchant) {
    const error = new Error("Complete merchant signup before duplicating events.");
    error.name = "MerchantSignupRequiredError";
    throw error;
  }

  // Pull the full source row, scoped to this merchant so a merchant can never
  // clone another merchant's (or a platform-owned) event.
  const sourceResult = await pool.query<{
    title: string;
    description: string;
    starts_at: Date;
    ends_at: Date | null;
    group_name: string | null;
    category: string;
    location_name: string;
    suburb: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    price_cents: number;
    capacity: number;
    image_url: string | null;
    image_urls: string[] | null;
    image_alt: string | null;
    relationship_goal: string | null;
  }>(
    `
      select
        title, description, starts_at, ends_at, group_name, category,
        location_name, suburb, address, latitude, longitude, price_cents,
        capacity, image_url, image_urls, image_alt, relationship_goal
      from events
      where slug = $1 and merchant_profile_id = $2::uuid
      limit 1
    `,
    [sourceSlug, merchant.id],
  );

  const source = sourceResult.rows[0];
  if (!source) {
    const error = new Error("Event not found.");
    error.name = "NotFoundError";
    throw error;
  }

  // Keep the original duration so the merchant only has to re-pick a date.
  const durationMinutes =
    source.ends_at
      ? Math.max(
          30,
          Math.round((source.ends_at.getTime() - source.starts_at.getTime()) / 60000),
        )
      : 120;

  const gallery =
    source.image_urls && source.image_urls.length > 0
      ? source.image_urls
      : source.image_url
        ? [source.image_url]
        : [];

  // Interest tag slugs attached to the source, comma-joined to match the
  // wizard's tags field.
  const tagResult = await pool.query<{ slug: string }>(
    `
      select tag.slug
      from event_tags et
      join tags tag on tag.id = et.tag_id and tag.tag_type = 'interest'
      where et.event_id = (select id from events where slug = $1)
    `,
    [sourceSlug],
  );
  const tags = tagResult.rows.map((t) => t.slug).join(", ");

  return {
    // No "Copy of" prefix (#185) - the merchant renames if they want to.
    title: source.title,
    groupName: source.group_name ?? "",
    category: source.category,
    // Blank on purpose: the merchant must choose the new date/time (#184).
    startsAt: "",
    durationMinutes: String(durationMinutes),
    capacity: String(source.capacity),
    locationName: source.location_name,
    suburb: source.suburb,
    address: source.address ?? "",
    // pg returns `numeric` columns as strings; coerce so the wizard's
    // values.latitude.toFixed(5) (LocationSection) doesn't throw on a string (#223).
    latitude: source.latitude !== null ? Number(source.latitude) : null,
    longitude: source.longitude !== null ? Number(source.longitude) : null,
    price: (source.price_cents / 100).toString(),
    tags,
    relationshipGoal: source.relationship_goal ?? "",
    description: source.description,
    images: gallery,
    imageAlt: source.image_alt ?? "",
    recurrenceFreq: "none",
    recurrenceCount: "1",
  };
}

// True when a profile already exists for this email (case-insensitive). Lets the
// login surfaces reject an unknown / mistyped address with "no account found -
// sign up" instead of silently passwordless-creating a junk profile for the typo
// (bug board #181: a typo'd domain logged the tester into a brand-new account).
// Only returns false when we're CONFIDENT no account exists - a missing pool or a
// query error stays permissive so a DB hiccup can't lock anyone out, and signup
// surfaces skip this check entirely so new accounts still work.
export async function profileExistsByEmail(email: string): Promise<boolean> {
  const pool = getPostgresPool();
  if (!pool) return true;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  try {
    const result = await pool.query<{ found: boolean }>(
      `select exists (select 1 from profiles where lower(email) = $1) as found`,
      [normalized],
    );
    return Boolean(result.rows[0]?.found);
  } catch {
    return true;
  }
}

export async function approveEventForAdmin(eventId: string, session: Session | null) {
  const pool = getPostgresPool();

  if (!pool) return approveLocalEventForAdmin(eventId, session);

  try {
    const profile = await requireAdminProfile(session);

    // Block approving an event that has already happened (end time, or start
    // time when no end is set, is in the past). Only events still pending are
    // checked here; the update below stays the gate for not-found / wrong-status.
    // (When recurring events land, exempt a still-repeating series here.)
    const eligibility = await pool.query<{
      approvable: boolean;
      price_cents: number;
      merchant_profile_id: string | null;
      merchant_charges_enabled: boolean | null;
    }>(
      `
        select (coalesce(ends_at, starts_at) >= now()) as approvable,
               price_cents,
               merchant_profile_id::text,
               (select charges_enabled from merchant_profiles where id = events.merchant_profile_id) as merchant_charges_enabled
        from events
        where slug = $1 and status = 'pending'
      `,
      [eventId],
    );

    if ((eligibility.rowCount ?? 0) > 0 && !eligibility.rows[0].approvable) {
      const error = new Error(
        "This event has already passed and can no longer be approved.",
      );
      error.name = "ValidationError";
      throw error;
    }

    // Payment-publication gate: a paid, merchant-hosted event must not go live
    // unless the owning merchant has an active Stripe Connect account
    // (charges_enabled). The creation + trusted-auto-approve paths already
    // enforce this; the manual admin-approval path is the remaining hole - a
    // paid event would otherwise reach `live` with no way to route the money,
    // and checkout would dead-end on PayoutsNotReadyError. Platform-owned paid
    // events (no merchant_profile_id) settle to the platform account directly,
    // so they're exempt.
    if (
      (eligibility.rowCount ?? 0) > 0 &&
      eligibility.rows[0].price_cents > 0 &&
      eligibility.rows[0].merchant_profile_id &&
      eligibility.rows[0].merchant_charges_enabled !== true
    ) {
      const error = new Error(
        "This is a paid event, but the host hasn't finished Stripe Connect payout setup, so it can't accept payments yet. Approve it once their payouts are active.",
      );
      error.name = "ValidationError";
      throw error;
    }

    const result = await pool.query<{ slug: string; title: string }>(
      `
        update events
        set status = 'live',
            -- Clear the legacy "pending review" sentinel that createEventForMerchant
            -- used to seed into fomo; otherwise the approved/live event keeps
            -- rendering it publicly. Genuine merchant fomo copy is preserved.
            fomo = case
              when fomo = 'Pending admin review before being promoted to members.' then null
              else fomo
            end,
            updated_at = now()
        where slug = $1 and status = 'pending'
        returning slug, title
      `,
      [eventId],
    );

    const event = result.rows[0];
    if (!event) {
      const error = new Error("Pending event not found.");
      error.name = "NotFoundError";
      throw error;
    }

    await pool.query(
      `
        insert into audit_logs (actor_profile_id, action, entity_table, metadata)
        values ($1::uuid, 'approve_event', 'events', $2::jsonb)
      `,
      [profile.id, JSON.stringify({ slug: event.slug, title: event.title })],
    );

    // Trust the merchant going forward: this manual approval is the one-time QA
    // pass, so the owning merchant's future events auto-publish without review.
    // Admins can revoke this from the merchant detail page. Best-effort - a
    // failure here must not fail the approval the admin just made.
    void pool
      .query(
        `
          update merchant_profiles
          set auto_approve_events = true, updated_at = now()
          from events
          where events.slug = $1
            and events.merchant_profile_id = merchant_profiles.id
            and merchant_profiles.auto_approve_events = false
        `,
        [event.slug],
      )
      .catch((error) => {
        console.warn("Failed to mark merchant as auto-approve after event approval.", error);
      });

    // Notify the owning merchant their event is live. Fire-and-forget - never
    // bubbles into the approve response (see helper for the merchant lookup).
    void logEventApprovedEmail(pool, event.slug);

    return event;
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      return approveLocalEventForAdmin(eventId, session);
    }

    throw error;
  }
}

export async function rejectEventForAdmin(
  eventId: string,
  reason: string,
  session: Session | null,
) {
  const pool = getPostgresPool();

  if (!pool) return rejectLocalEventForAdmin(eventId, session);

  // The admin's free-text reason flows into the event-rejected-merchant email
  // and the audit log. Fall back to a generic line so the template never
  // renders an empty "why" paragraph.
  const rejectionReason =
    reason.trim() || "This event needs a few changes before it can go live.";

  try {
    const profile = await requireAdminProfile(session);

    const result = await pool.query<{
      slug: string;
      title: string;
      owner_profile_id: string | null;
    }>(
      `
        update events
        set status = 'rejected',
            rejection_reason = $2,
            rejected_at = now(),
            updated_at = now()
        from (select id from events where slug = $1 and status = 'pending') target
        where events.id = target.id
        returning events.slug, events.title, events.host_profile_id::text as owner_profile_id
      `,
      [eventId, rejectionReason],
    );

    const event = result.rows[0];
    if (!event) {
      const error = new Error("Pending event not found.");
      error.name = "NotFoundError";
      throw error;
    }

    await pool.query(
      `
        insert into audit_logs (actor_profile_id, action, entity_table, metadata)
        values ($1::uuid, 'reject_event', 'events', $2::jsonb)
      `,
      [
        profile.id,
        JSON.stringify({
          slug: event.slug,
          title: event.title,
          reason: rejectionReason,
        }),
      ],
    );

    // In-app notification for the host so the rejection shows up in their bell
    // even before they read the email.
    if (event.owner_profile_id) {
      await pool.query(
        `
          insert into notifications (profile_id, title, body, action_url)
          values ($1::uuid, $2, $3, $4)
        `,
        [
          event.owner_profile_id,
          "Event needs another pass",
          `${event.title} wasn't approved: ${rejectionReason}`,
          `/merchant/events/${event.slug}`,
        ],
      );
    }

    // Notify the owning merchant their event was declined. Fire-and-forget -
    // never bubbles into the reject response (see helper for the lookup).
    void logEventRejectedEmail(pool, event.slug, rejectionReason);

    return event;
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      return rejectLocalEventForAdmin(eventId, session);
    }

    throw error;
  }
}

export async function updateMerchantVerificationForAdmin(
  merchantId: string,
  status: "pending" | "approved" | "rejected" | "suspended",
  session: Session | null,
  reason?: string,
) {
  const pool = getPostgresPool();

  if (!pool) throw databaseUnavailableError();

  const profile = await requireAdminProfile(session);
  // Admin's free-text "why" for a rejection - rides through to the merchant
  // email + audit log so they know what to fix or resubmit.
  const trimmedReason = (reason ?? "").trim().slice(0, 1000);
  const result = await pool.query<{
    id: string;
    business_name: string;
    contact_email: string;
    owner_profile_id: string;
    owner_email: string;
    owner_name: string;
    verification_status: string;
  }>(
    `
      update merchant_profiles merchant
      set verification_status = $2,
          -- Approving a merchant's business (KYC) also trusts them to publish
          -- events without per-event admin review. Previously trust was only
          -- granted the first time an admin approved one of their EVENTS, so a
          -- freshly-verified merchant's first event still hit the review queue -
          -- admins asked "why am I approving every event?" for businesses
          -- they'd already vetted. Verifying the business now grants it directly.
          -- (A suspend/reject revokes auto-approval.)
          auto_approve_events = case
            when $2 = 'approved' then true
            when $2 in ('rejected', 'suspended') then false
            else merchant.auto_approve_events
          end,
          updated_at = now()
      from profiles owner
      where merchant.id = $1::uuid
        and owner.id = merchant.profile_id
      returning
        merchant.id::text,
        merchant.business_name,
        merchant.contact_email::text,
        owner.id::text as owner_profile_id,
        owner.email::text as owner_email,
        owner.display_name as owner_name,
        merchant.verification_status
    `,
    [merchantId, status],
  );

  const merchant = result.rows[0];
  if (!merchant) {
    const error = new Error("Merchant not found.");
    error.name = "NotFoundError";
    throw error;
  }

  await pool.query(
    `
      insert into audit_logs (actor_profile_id, action, entity_table, entity_id, metadata)
      values ($1::uuid, $2, 'merchant_profiles', $3::uuid, $4::jsonb)
    `,
    [
      profile.id,
      `merchant_${status}`,
      merchant.id,
      JSON.stringify({
        business: merchant.business_name,
        contactEmail: merchant.contact_email,
        ...(trimmedReason ? { reason: trimmedReason } : {}),
      }),
    ],
  );

  await pool.query(
    `
      insert into notifications (profile_id, title, body, action_url)
      values ($1::uuid, $2, $3, $4)
    `,
    [
      merchant.owner_profile_id,
      status === "approved"
        ? "Merchant approved"
        : status === "rejected"
          ? "Merchant needs review"
          : status === "suspended"
            ? "Merchant suspended"
            : "Merchant pending",
      status === "approved"
        ? `${merchant.business_name} is approved to host Click events. Finish a quick setup to start taking payments.`
        : status === "suspended"
          ? `${merchant.business_name} has been suspended. Your events are hidden from Discover until an admin reinstates the account.`
          : status === "rejected" && trimmedReason
            ? `${merchant.business_name} needs another look: ${trimmedReason}`
            : `${merchant.business_name} is now marked ${status}.`,
      // Approved merchants land in the post-approval onboarding (walkthrough +
      // Stripe payout setup); other statuses go to the portal/holding page.
      status === "approved" ? "/merchant/onboarding" : "/merchant",
    ],
  );

  // 'pending' is the one status with no template - an admin walking a merchant
  // back to review is rare and internal, so it keeps the plain-text notice.
  if (status !== "approved" && status !== "rejected" && status !== "suspended") {
    await sendWorkflowEmail({
      to: merchant.owner_email,
      subject: `${merchant.business_name} merchant status: ${status}`,
      text: [
        `Hi ${merchant.owner_name},`,
        `${merchant.business_name} is now marked ${status}.`,
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/merchant`,
      ].join("\n\n"),
    });
  }

  // Log the rendered HTML to email_events. Approved / rejected / suspended all
  // have templates in /emails; 'pending' falls through to the notice above.
  const origin = emailOrigin();
  const merchantFirstName =
    (merchant.owner_name || merchant.business_name || "").split(/\s+/)[0] || "there";
  if (status === "approved") {
    await logEmailEvent({
      template: "merchant-verified-merchant",
      toEmail: merchant.owner_email,
      toProfileId: merchant.owner_profile_id,
      vars: {
        businessName: merchant.business_name,
        merchantFirstName,
        createEventUrl: `${origin}/merchant/events/create`,
        merchantDashboardUrl: `${origin}/merchant`,
        supportEmail: SUPPORT_EMAIL,
        unsubscribeUrl: `${origin}/account-settings`,
      },
    });
  } else if (status === "rejected") {
    await logEmailEvent({
      template: "merchant-rejected-merchant",
      toEmail: merchant.owner_email,
      toProfileId: merchant.owner_profile_id,
      vars: {
        businessName: merchant.business_name,
        merchantFirstName,
        rejectionReason:
          trimmedReason ||
          "Our reviewer flagged something in your application. Reply to this email and we'll walk you through it.",
        // Step 1, not the Documents step: every document is optional, so the
        // flagged detail is almost never there, and the holding page's own
        // "Resubmit application" button already starts at the top.
        resubmitUrl: `${origin}/merchant/signup`,
        supportEmail: SUPPORT_EMAIL,
        unsubscribeUrl: `${origin}/account-settings`,
      },
    });
  } else if (status === "suspended") {
    await logEmailEvent({
      template: "merchant-suspended-merchant",
      toEmail: merchant.owner_email,
      toProfileId: merchant.owner_profile_id,
      vars: {
        businessName: merchant.business_name,
        merchantFirstName,
        suspensionReason:
          trimmedReason ||
          "An admin paused this account while we look into something. Reply to this email and we'll walk you through it.",
        merchantDashboardUrl: `${origin}/merchant`,
        supportEmail: SUPPORT_EMAIL,
      },
    });
  }

  return {
    id: merchant.id,
    verificationStatus: merchant.verification_status,
  };
}

// Grant or revoke a merchant's "trusted" status. When on, their new events skip
// the pending review queue and publish straight to 'live'. Approving an event
// flips this on automatically; admins use this to revoke trust (send a merchant
// back to manual review) or grant it ahead of a first approval.
export async function setMerchantAutoApproveForAdmin(
  merchantId: string,
  autoApprove: boolean,
  session: Session | null,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  if (!UUID_RE.test(merchantId)) {
    const error = new Error("Valid merchant id is required.");
    error.name = "ValidationError";
    throw error;
  }

  const profile = await requireAdminProfile(session);
  const result = await pool.query<{ id: string; auto_approve_events: boolean }>(
    `
      update merchant_profiles
      set auto_approve_events = $2, updated_at = now()
      where id = $1::uuid
      returning id::text, auto_approve_events
    `,
    [merchantId, autoApprove],
  );

  const merchant = result.rows[0];
  if (!merchant) {
    const error = new Error("Merchant not found.");
    error.name = "NotFoundError";
    throw error;
  }

  await pool.query(
    `
      insert into audit_logs (actor_profile_id, action, entity_table, entity_id, metadata)
      values ($1::uuid, $2, 'merchant_profiles', $3::uuid, $4::jsonb)
    `,
    [
      profile.id,
      autoApprove ? "merchant_auto_approve_on" : "merchant_auto_approve_off",
      merchant.id,
      JSON.stringify({ autoApprove }),
    ],
  );

  return { id: merchant.id, autoApproveEvents: merchant.auto_approve_events };
}

export async function getAdminEvents() {
  const pool = getPostgresPool();

  if (!pool) {
    return getFallbackAdminEvents();
  }

  try {
    const result = await pool.query<{
      slug: string;
      title: string;
      category: string;
      status: string;
      booking_model: string;
      host_name: string;
      capacity: number;
      starts_at: Date;
      created_at: Date;
      confirmed_attendees: string;
      suburb: string | null;
      location_name: string | null;
      address: string | null;
      pending_address: string | null;
      latitude: string | null;
      longitude: string | null;
      price_cents: number;
      has_merchant: boolean;
      merchant_charges_enabled: boolean | null;
      approvable: boolean;
    }>(`
      select
        event.slug,
        event.title,
        event.category,
        event.status::text,
        event.booking_model::text,
        event.host_name,
        event.capacity,
        event.starts_at,
        event.created_at,
        event.suburb,
        event.location_name,
        event.address,
        event.pending_address,
        event.latitude::text,
        event.longitude::text,
        event.price_cents,
        bool_or(merchant.id is not null) as has_merchant,
        bool_or(merchant.charges_enabled) as merchant_charges_enabled,
        (coalesce(event.ends_at, event.starts_at) >= now()) as approvable,
        count(attendee.id) filter (where attendee.status = 'confirmed') as confirmed_attendees
      from events event
      left join event_attendees attendee on attendee.event_id = event.id
      left join merchant_profiles merchant on merchant.id = event.merchant_profile_id
      group by event.id
      -- Pending events float to the top of the queue so a fresh submission never
      -- gets buried under already-live listings; everything else stays newest-first.
      order by (event.status = 'pending') desc, event.created_at desc
      limit 200
    `);

    // Interest tags per event, in a separate query so joining the tags table
    // doesn't multiply the attendee-count aggregation above. Scoped to the
    // (≤200) event slugs the main query actually returned - the previous
    // unscoped scan computed tags for every event in the table only to discard
    // any not present in `result.rows`. Output is identical: same per-event tag
    // lists, same `order by tag.label asc` ordering within each event.
    const eventSlugs = result.rows.map((row) => row.slug);
    const tagsBySlug = new Map<string, { slug: string; label: string }[]>();
    if (eventSlugs.length > 0) {
      const tagsResult = await pool.query<{ slug: string; tag_slug: string; tag_label: string }>(
        `
        select event.slug, tag.slug as tag_slug, tag.label as tag_label
        from events event
        join event_tags et on et.event_id = event.id
        join tags tag on tag.id = et.tag_id and tag.tag_type = 'interest'
        where event.slug = any($1::text[])
        order by tag.label asc
      `,
        [eventSlugs],
      );
      for (const row of tagsResult.rows) {
        const list = tagsBySlug.get(row.slug) ?? [];
        list.push({ slug: row.tag_slug, label: row.tag_label });
        tagsBySlug.set(row.slug, list);
      }
    }

    return result.rows.map((event): AdminEventRow => {
      const lat = event.latitude ? Number(event.latitude) : null;
      const lng = event.longitude ? Number(event.longitude) : null;
      const priceCents = Number(event.price_cents) || 0;
      return {
        id: event.slug,
        title: event.title,
        category: event.category,
        status: eventStatusFromDb(event.status),
        booking: bookingFromDb(event.booking_model),
        host: event.host_name,
        attendees: Number(event.confirmed_attendees),
        capacity: event.capacity,
        startsAt: event.starts_at.toISOString(),
        createdAt: event.created_at ? event.created_at.toISOString() : null,
        region: regionForEvent({ lat, lng, suburb: event.suburb }),
        suburb: event.suburb,
        locationName: event.location_name,
        address: event.address,
        pendingAddress: event.pending_address,
        lat,
        lng,
        priceCents,
        payoutsNotConnected:
          priceCents > 0 && event.has_merchant && !event.merchant_charges_enabled,
        approvable: event.approvable,
        tags: tagsBySlug.get(event.slug) ?? [],
      };
    });
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("Falling back to static admin events.", error);
    }

    return getFallbackAdminEvents();
  }
}

// Lightweight {slug,title} list for admin dropdowns (e.g. the members-page
// event filter), so callers that only need the event picker don't pull the full
// getAdminEvents() payload (attendee counts, avatars, tags subquery, geo, etc).
// Same DB-down contract as getFallbackAdminEvents(): an honest empty list.
export async function getAdminEventOptions(): Promise<{ slug: string; title: string }[]> {
  const pool = getPostgresPool();
  if (!pool) return [];

  try {
    const result = await pool.query<{ slug: string; title: string }>(`
      select slug, title
      from events
      order by title
    `);
    return result.rows.map((row) => ({ slug: row.slug, title: row.title }));
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("Falling back to empty admin event options.", error);
    }
    return [];
  }
}

// Admin fallbacks below are used only when Postgres is unreachable. They return
// empty data instead of seeded "Maya Chen / Kindred Kitchens" placeholders, so
// the admin console degrades to an honest empty state rather than showing fake
// members, merchants, and audit entries. Real data flows via the live queries.
const fallbackAdminMembers: AdminMemberRow[] = [];

const fallbackAdminMerchants: AdminMerchantRow[] = [];

function fallbackAdminTags(): AdminTagRow[] {
  // Empty rather than seeded-from-clickEvents: the tags admin must reflect the
  // real `tags` table, never synthetic "seed-*" rows that look live. An empty
  // list when Postgres is down is the honest signal (see Supabase pooler note).
  return [];
}

const fallbackAdminAudit: AdminAuditRow[] = [];

function fallbackAdminMetrics(eventCount: number, pendingCount: number): AdminMetrics {
  return {
    totalMembers: fallbackAdminMembers.length,
    newMembersThisWeek: 0,
    totalMerchants: fallbackAdminMerchants.length,
    pendingMerchants: fallbackAdminMerchants.filter((m) => m.verificationStatus === "pending").length,
    totalEvents: eventCount,
    pendingEvents: pendingCount,
    confirmedRsvps: fallbackAdminMembers.reduce((sum, m) => sum + m.registrations, 0),
    mutualClicks: 0,
  };
}

export async function getAdminMembers(): Promise<AdminMemberRow[]> {
  const pool = getPostgresPool();
  if (!pool) return fallbackAdminMembers;

  try {
    const result = await pool.query<{
      id: string;
      display_name: string;
      email: string;
      role: string;
      suburb: string | null;
      birth_date: Date | null;
      intents: string[] | null;
      bookmarks: string;
      registrations: string;
      events: AdminMemberEventRef[] | null;
      email_verified_at: Date | null;
      photo_verified_at: Date | null;
      created_at: Date;
      suspended_at: Date | null;
      suspended_reason: string | null;
      is_banned: boolean;
    }>(`
      select
        profile.id::text,
        profile.display_name,
        profile.email::text,
        profile.role::text,
        profile.suburb,
        profile.birth_date,
        profile.connection_intents::text[] as intents,
        coalesce(count(distinct bookmark.event_id), 0) as bookmarks,
        -- Confirmed seats only (bug board #161): a waitlist spot or an unpaid
        -- checkout hold is not attendance, so it must not show as an RSVP here.
        coalesce(count(distinct attendee.id) filter (where attendee.status = 'confirmed'), 0) as registrations,
        coalesce(
          jsonb_agg(distinct jsonb_build_object('slug', event.slug, 'title', event.title))
            filter (where attendee.status = 'confirmed' and event.id is not null),
          '[]'::jsonb
        ) as events,
        profile.email_verified_at,
        profile.photo_verified_at,
        profile.created_at,
        profile.suspended_at,
        profile.suspended_reason,
        profile.is_banned
      from profiles profile
      left join bookmarks bookmark on bookmark.profile_id = profile.id
      left join event_attendees attendee on attendee.profile_id = profile.id
      left join events event on event.id = attendee.event_id
      group by profile.id
      order by profile.created_at desc
      limit 250
    `);

    return result.rows.map((row): AdminMemberRow => ({
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      role: (row.role as AdminMemberRow["role"]) ?? "attendee",
      suburb: row.suburb,
      // Mirrors getProfileStatus's onboardingComplete: suburb + birth_date are
      // the fields saveOnboarding enforces. An email-only signup (bug board
      // #164) is not a countable attendee until they finish onboarding.
      onboardingComplete: !!row.suburb && !!row.birth_date,
      intents: row.intents ?? [],
      bookmarks: Number(row.bookmarks),
      registrations: Number(row.registrations),
      events: (row.events ?? []).filter(
        (event): event is AdminMemberEventRef => !!event && !!event.slug && !!event.title,
      ),
      emailVerified: !!row.email_verified_at,
      photoVerified: !!row.photo_verified_at,
      joinedAt: row.created_at.toISOString(),
      suspendedAt: row.suspended_at ? row.suspended_at.toISOString() : null,
      suspendedReason: row.suspended_reason,
      isBanned: !!row.is_banned,
    }));
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("Falling back to static admin members.", error);
    }
    return fallbackAdminMembers;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getAdminMemberDetail(
  memberId: string,
): Promise<AdminMemberDetail | null> {
  if (!UUID_RE.test(memberId)) return null;

  const pool = getPostgresPool();
  if (!pool) return null;

  try {
    const [
      profileResult,
      tagsResult,
      personaResult,
      eventsResult,
      bookmarksResult,
      transactionsResult,
    ] = await Promise.all([
        pool.query<{
          id: string;
          display_name: string;
          email: string;
          role: string;
          city: string | null;
          suburb: string | null;
          bio: string | null;
          photo_url: string | null;
          age: number | null;
          intents: string[] | null;
          email_verified_at: Date | null;
          photo_verified_at: Date | null;
          created_at: Date;
          suspended_at: Date | null;
          suspended_reason: string | null;
          deleted_at: Date | null;
        }>(
          `
            select id::text, display_name, email::text, role::text,
                   city, suburb, bio, photo_url, age,
                   connection_intents::text[] as intents,
                   email_verified_at, photo_verified_at, created_at,
                   suspended_at, suspended_reason, deleted_at
            from profiles
            where id = $1::uuid
          `,
          [memberId],
        ),
        pool.query<{
          slug: string;
          label: string;
          tag_type: string;
          source: string;
        }>(
          `
            select tag.slug, tag.label, tag.tag_type, ut.source
            from user_tags ut
            join tags tag on tag.id = ut.tag_id
            where ut.profile_id = $1::uuid
            order by tag.tag_type asc, tag.label asc
          `,
          [memberId],
        ),
        pool.query<{
          persona_name: string;
          social_energy: string;
          pace: string;
          openness: string;
          engagement_frequency: string;
          intent_mix: Record<string, number> | null;
          generated_at: Date;
        }>(
          `
            select persona_name, social_energy, pace, openness,
                   engagement_frequency, intent_mix, generated_at
            from click_personas
            where profile_id = $1::uuid
            order by generated_at desc
            limit 1
          `,
          [memberId],
        ),
        pool.query<{
          slug: string;
          title: string;
          starts_at: Date | null;
          status: string;
          checked_in_at: Date | null;
          rsvp_at: Date;
          is_upcoming: boolean;
        }>(
          // `is_upcoming` is decided by Postgres rather than the renderer: the
          // deletion panel needs to warn about seats that have not happened
          // yet, and reading the clock during render is both impure and a
          // hydration mismatch waiting to happen.
          `
            select event.slug, event.title, event.starts_at,
                   attendee.status::text as status,
                   attendee.checked_in_at,
                   attendee.created_at as rsvp_at,
                   (event.starts_at is not null and event.starts_at > now()) as is_upcoming
            from event_attendees attendee
            join events event on event.id = attendee.event_id
            where attendee.profile_id = $1::uuid
            order by event.starts_at desc nulls last
            limit 50
          `,
          [memberId],
        ),
        pool.query<{
          slug: string;
          title: string;
          starts_at: Date | null;
          created_at: Date;
        }>(
          `
            select event.slug, event.title, event.starts_at, b.created_at
            from bookmarks b
            join events event on event.id = b.event_id
            where b.profile_id = $1::uuid
            order by b.created_at desc
            limit 50
          `,
          [memberId],
        ),
        pool.query<{
          id: string;
          event_slug: string | null;
          event_title: string | null;
          amount_cents: number;
          currency: string;
          status: string;
          stripe_payment_intent_id: string | null;
          created_at: Date;
        }>(
          `
            select pt.id::text,
                   event.slug as event_slug,
                   event.title as event_title,
                   pt.amount_cents,
                   pt.currency::text as currency,
                   pt.status::text as status,
                   pt.stripe_payment_intent_id,
                   pt.created_at
            from payment_transactions pt
            left join events event on event.id = pt.event_id
            where pt.profile_id = $1::uuid
            order by pt.created_at desc
            limit 50
          `,
          [memberId],
        ),
      ]);

    const row = profileResult.rows[0];
    if (!row) return null;

    const personaRow = personaResult.rows[0];

    return {
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      role: (row.role as AdminMemberDetail["role"]) ?? "attendee",
      city: row.city,
      suburb: row.suburb,
      bio: row.bio,
      photoUrl: row.photo_url,
      age: row.age,
      intents: row.intents ?? [],
      emailVerified: !!row.email_verified_at,
      photoVerified: !!row.photo_verified_at,
      joinedAt: row.created_at.toISOString(),
      suspendedAt: row.suspended_at ? row.suspended_at.toISOString() : null,
      suspendedReason: row.suspended_reason,
      deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
      tags: tagsResult.rows.map((t) => ({
        slug: t.slug,
        label: t.label,
        tagType: t.tag_type,
        source: t.source,
      })),
      persona: personaRow
        ? {
            personaName: personaRow.persona_name,
            socialEnergy: personaRow.social_energy,
            pace: personaRow.pace,
            openness: personaRow.openness,
            engagementFrequency: personaRow.engagement_frequency,
            intentMix: personaRow.intent_mix ?? {},
            generatedAt: personaRow.generated_at.toISOString(),
          }
        : null,
      events: eventsResult.rows.map((e) => ({
        slug: e.slug,
        title: e.title,
        startsAt: e.starts_at ? e.starts_at.toISOString() : null,
        status: e.status,
        checkedInAt: e.checked_in_at ? e.checked_in_at.toISOString() : null,
        rsvpAt: e.rsvp_at.toISOString(),
      })),
      upcomingConfirmedBookings: eventsResult.rows.filter(
        (e) => e.is_upcoming && e.status === "confirmed",
      ).length,
      bookmarks: bookmarksResult.rows.map((b) => ({
        slug: b.slug,
        title: b.title,
        startsAt: b.starts_at ? b.starts_at.toISOString() : null,
        createdAt: b.created_at.toISOString(),
      })),
      transactions: transactionsResult.rows.map((t) => ({
        id: t.id,
        eventSlug: t.event_slug,
        eventTitle: t.event_title,
        amountCents: t.amount_cents,
        currency: t.currency,
        status: t.status,
        stripePaymentIntentId: t.stripe_payment_intent_id,
        createdAt: t.created_at.toISOString(),
      })),
    };
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("getAdminMemberDetail fallback", error);
    }
    return null;
  }
}

export async function getAdminMerchants(): Promise<AdminMerchantRow[]> {
  const pool = getPostgresPool();
  if (!pool) return fallbackAdminMerchants;

  try {
    const result = await pool.query<{
      id: string;
      business_name: string;
      contact_email: string;
      verification_status: string;
      website_url: string | null;
      abn: string | null;
      owner_name: string;
      owner_email: string;
      events_hosted: string;
      created_at: Date;
      auto_approve_events: boolean;
    }>(`
      select
        merchant.id::text,
        merchant.business_name,
        merchant.contact_email::text,
        merchant.verification_status,
        merchant.website_url,
        merchant.abn,
        owner.display_name as owner_name,
        owner.email::text as owner_email,
        coalesce(count(distinct event.id), 0) as events_hosted,
        merchant.created_at,
        coalesce(merchant.auto_approve_events, false) as auto_approve_events
      from merchant_profiles merchant
      join profiles owner on owner.id = merchant.profile_id
      left join events event on event.merchant_profile_id = merchant.id
      group by merchant.id, owner.id
      order by merchant.created_at desc
      limit 60
    `);

    return result.rows.map((row): AdminMerchantRow => ({
      id: row.id,
      businessName: row.business_name,
      contactEmail: row.contact_email,
      verificationStatus: row.verification_status,
      websiteUrl: row.website_url,
      abn: row.abn,
      ownerName: row.owner_name,
      ownerEmail: row.owner_email,
      eventsHosted: Number(row.events_hosted),
      createdAt: row.created_at.toISOString(),
      autoApproveEvents: Boolean(row.auto_approve_events),
    }));
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("Falling back to static admin merchants.", error);
    }
    return fallbackAdminMerchants;
  }
}

export async function getAdminMerchantDetail(
  merchantId: string,
): Promise<AdminMerchantDetail | null> {
  if (!UUID_RE.test(merchantId)) return null;

  const pool = getPostgresPool();
  if (!pool) return null;

  try {
    const [merchantResult, categoriesResult, eventsResult, transactionsResult, totalsResult] =
      await Promise.all([
        pool.query<{
          id: string;
          business_name: string;
          trading_name: string | null;
          contact_email: string;
          phone: string | null;
          website_url: string | null;
          abn: string | null;
          acn: string | null;
          business_type: string | null;
          socials: Record<string, string> | null;
          verification_status: string;
          auto_approve_events: boolean;
          stripe_connect_account_id: string | null;
          address_street: string | null;
          address_suburb: string | null;
          address_state: string | null;
          address_postcode: string | null;
          submitted_at: Date | null;
          created_at: Date;
          owner_id: string;
          owner_display_name: string;
          owner_email: string;
          owner_photo_url: string | null;
        }>(
          `
            select
              m.id::text,
              m.business_name,
              m.trading_name,
              m.contact_email::text,
              m.phone,
              m.website_url,
              m.abn,
              m.acn,
              m.business_type,
              m.socials,
              m.verification_status,
              m.auto_approve_events,
              m.stripe_connect_account_id,
              m.address_street,
              m.address_suburb,
              m.address_state,
              m.address_postcode,
              m.submitted_at,
              m.created_at,
              owner.id::text as owner_id,
              owner.display_name as owner_display_name,
              owner.email::text as owner_email,
              owner.photo_url as owner_photo_url
            from merchant_profiles m
            join profiles owner on owner.id = m.profile_id
            where m.id = $1::uuid
          `,
          [merchantId],
        ),
        pool.query<{ name: string }>(
          `
            select category.name
            from merchant_event_categories mec
            join tag_categories category on category.id = mec.tag_category_id
            where mec.merchant_profile_id = $1::uuid
            order by category.name asc
          `,
          [merchantId],
        ),
        pool.query<{
          id: string;
          slug: string;
          title: string;
          status: string;
          starts_at: Date | null;
          ends_at: Date | null;
          location_name: string | null;
          suburb: string | null;
          capacity: number | null;
          price_cents: number;
          currency: string;
          confirmed_attendees: string;
          waitlisted_attendees: string;
          gross_revenue_cents: string;
          paid_revenue_cents: string;
        }>(
          `
            select
              event.id::text,
              event.slug,
              event.title,
              event.status::text as status,
              event.starts_at,
              event.ends_at,
              event.location_name,
              event.suburb,
              event.capacity,
              event.price_cents,
              event.currency::text as currency,
              coalesce(count(distinct attendee.id) filter (where attendee.status = 'confirmed'), 0)::text as confirmed_attendees,
              coalesce(count(distinct attendee.id) filter (where attendee.status = 'waitlisted'), 0)::text as waitlisted_attendees,
              coalesce(sum(pt.amount_cents), 0)::text as gross_revenue_cents,
              coalesce(sum(pt.amount_cents) filter (where pt.status = 'paid'), 0)::text as paid_revenue_cents
            from events event
            left join event_attendees attendee on attendee.event_id = event.id
            left join payment_transactions pt on pt.event_id = event.id
            where event.merchant_profile_id = $1::uuid
            group by event.id
            order by event.starts_at desc nulls last
            limit 200
          `,
          [merchantId],
        ),
        pool.query<{
          id: string;
          event_slug: string | null;
          event_title: string | null;
          attendee_name: string | null;
          attendee_email: string | null;
          amount_cents: number;
          currency: string;
          status: string;
          stripe_payment_intent_id: string | null;
          created_at: Date;
        }>(
          `
            select
              pt.id::text,
              event.slug as event_slug,
              event.title as event_title,
              attendee.display_name as attendee_name,
              attendee.email::text as attendee_email,
              pt.amount_cents,
              pt.currency::text as currency,
              pt.status::text as status,
              pt.stripe_payment_intent_id,
              pt.created_at
            from payment_transactions pt
            left join events event on event.id = pt.event_id
            left join profiles attendee on attendee.id = pt.profile_id
            where pt.merchant_profile_id = $1::uuid
            order by pt.created_at desc
            limit 100
          `,
          [merchantId],
        ),
        pool.query<{
          total: string;
          paid: string;
          pending: string;
          refunded: string;
          total_bookings: string;
          paid_bookings: string;
        }>(
          `
            select
              coalesce(sum(amount_cents), 0)::text as total,
              coalesce(sum(amount_cents) filter (where status = 'paid'), 0)::text as paid,
              coalesce(sum(amount_cents) filter (where status = 'pending'), 0)::text as pending,
              coalesce(sum(amount_cents) filter (where status = 'refunded'), 0)::text as refunded,
              count(*)::text as total_bookings,
              count(*) filter (where status = 'paid')::text as paid_bookings
            from payment_transactions
            where merchant_profile_id = $1::uuid
          `,
          [merchantId],
        ),
      ]);

    const row = merchantResult.rows[0];
    if (!row) return null;

    const now = Date.now();
    const allEvents = eventsResult.rows.map((e): AdminMerchantDetailEvent => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      status: e.status,
      startsAt: e.starts_at ? e.starts_at.toISOString() : null,
      endsAt: e.ends_at ? e.ends_at.toISOString() : null,
      locationName: e.location_name,
      suburb: e.suburb,
      capacity: e.capacity,
      priceCents: e.price_cents,
      currency: e.currency,
      confirmedAttendees: Number(e.confirmed_attendees),
      waitlistedAttendees: Number(e.waitlisted_attendees),
      grossRevenueCents: Number(e.gross_revenue_cents),
      paidRevenueCents: Number(e.paid_revenue_cents),
    }));

    const isUpcomingAdminMerchantEvent = (event: AdminMerchantDetailEvent) =>
      event.status !== "cancelled" &&
      event.status !== "rejected" &&
      !!event.startsAt &&
      new Date(event.startsAt).getTime() >= now;
    const upcomingEvents = allEvents.filter(isUpcomingAdminMerchantEvent);
    // Cancelled/rejected future listings are historical records, not upcoming
    // work. Keep them visible to admins, but under history where their terminal
    // status cannot inflate the merchant's active-event count.
    const pastEvents = allEvents.filter((event) => !isUpcomingAdminMerchantEvent(event));

    // Upcoming should be soonest-first.
    upcomingEvents.sort((a, b) => {
      const aTime = a.startsAt ? new Date(a.startsAt).getTime() : Infinity;
      const bTime = b.startsAt ? new Date(b.startsAt).getTime() : Infinity;
      return aTime - bTime;
    });

    const totalsRow = totalsResult.rows[0];

    return {
      id: row.id,
      businessName: row.business_name,
      tradingName: row.trading_name,
      contactEmail: row.contact_email,
      phone: row.phone,
      websiteUrl: row.website_url,
      abn: row.abn,
      acn: row.acn,
      businessType: row.business_type,
      socials: row.socials ?? {},
      verificationStatus: row.verification_status,
      autoApproveEvents: row.auto_approve_events ?? false,
      stripeConnectAccountId: row.stripe_connect_account_id,
      addressStreet: row.address_street,
      addressSuburb: row.address_suburb,
      addressState: row.address_state,
      addressPostcode: row.address_postcode,
      submittedAt: row.submitted_at ? row.submitted_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
      owner: {
        id: row.owner_id,
        displayName: row.owner_display_name,
        email: row.owner_email,
        photoUrl: row.owner_photo_url,
      },
      eventCategories: categoriesResult.rows.map((c) => c.name),
      upcomingEvents,
      pastEvents,
      transactions: transactionsResult.rows.map((t) => ({
        id: t.id,
        eventSlug: t.event_slug,
        eventTitle: t.event_title,
        attendeeName: t.attendee_name,
        attendeeEmail: t.attendee_email,
        amountCents: t.amount_cents,
        currency: t.currency,
        status: t.status,
        stripePaymentIntentId: t.stripe_payment_intent_id,
        createdAt: t.created_at.toISOString(),
      })),
      totals: {
        upcomingEvents: upcomingEvents.length,
        pastEvents: pastEvents.length,
        totalEvents: allEvents.length,
        totalBookings: Number(totalsRow?.total_bookings ?? 0),
        paidBookings: Number(totalsRow?.paid_bookings ?? 0),
        totalRevenueCents: Number(totalsRow?.total ?? 0),
        paidRevenueCents: Number(totalsRow?.paid ?? 0),
        pendingRevenueCents: Number(totalsRow?.pending ?? 0),
        refundedRevenueCents: Number(totalsRow?.refunded ?? 0),
      },
    };
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("getAdminMerchantDetail fallback", error);
    }
    return null;
  }
}

export async function getAdminTags(): Promise<AdminTagRow[]> {
  const pool = getPostgresPool();
  if (!pool) return fallbackAdminTags();

  try {
    const result = await pool.query<{
      id: string;
      label: string;
      slug: string;
      tag_type: string;
      category_name: string | null;
      usage_count: string;
      created_at: Date;
    }>(`
      select
        tag.id::text,
        tag.label,
        tag.slug,
        tag.tag_type,
        category.name as category_name,
        (
          count(distinct user_tag.profile_id)
          + count(distinct event_tag.event_id)
        ) as usage_count,
        tag.created_at
      from tags tag
      left join tag_categories category on category.id = tag.category_id
      left join user_tags user_tag on user_tag.tag_id = tag.id
      left join event_tags event_tag on event_tag.tag_id = tag.id
      group by tag.id, category.id
      order by tag.tag_type asc, category.name asc nulls last, tag.label asc
      limit 200
    `);

    return result.rows.map((row): AdminTagRow => ({
      id: row.id,
      label: row.label,
      slug: row.slug,
      tagType: row.tag_type,
      categoryName: row.category_name,
      usageCount: Number(row.usage_count),
      createdAt: row.created_at.toISOString(),
    }));
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("Falling back to static admin tags.", error);
    }
    return fallbackAdminTags();
  }
}

export type ProfileTagOption = { slug: string; label: string };
export type ProfileTagOptions = {
  interestCategories: { category: string; tags: ProfileTagOption[] }[];
  musicTags: ProfileTagOption[];
};

// Slugify a label the same way the curated tag seeds do
// (database/026_curate_interest_tags.sql) so fallback slugs round-trip.
function tagSlugFromLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fallbackProfileTagOptions(): ProfileTagOptions {
  return {
    interestCategories: interestTagCategories.map(([category, ...labels]) => ({
      category,
      tags: labels.map((label) => ({ slug: tagSlugFromLabel(label), label })),
    })),
    musicTags: staticMusicTags.map((t) => ({ slug: t.slug, label: t.label })),
  };
}

// Interest + music tags the profile-edit picker offers, sourced live from the
// `tags` table so admin-created tags (POST /api/admin/tags) show up without a
// code change. Falls back to the static curated list when the DB is empty or
// unavailable.
export async function getProfileTagOptions(): Promise<ProfileTagOptions> {
  const pool = getPostgresPool();
  if (!pool) return fallbackProfileTagOptions();

  try {
    const result = await pool.query<{
      slug: string;
      label: string;
      tag_type: string;
      category_name: string | null;
    }>(`
      select tag.slug, tag.label, tag.tag_type, category.name as category_name
      from tags tag
      left join tag_categories category on category.id = tag.category_id
      where tag.tag_type in ('interest', 'music')
      order by category.name asc nulls last, tag.label asc
    `);

    if (result.rows.length === 0) return fallbackProfileTagOptions();

    const musicTags = result.rows
      .filter((r) => r.tag_type === "music")
      .map((r) => ({ slug: r.slug, label: r.label }));

    const byCategory = new Map<string, ProfileTagOption[]>();
    for (const row of result.rows) {
      if (row.tag_type !== "interest") continue;
      const category = row.category_name ?? "Other";
      const list = byCategory.get(category) ?? [];
      list.push({ slug: row.slug, label: row.label });
      byCategory.set(category, list);
    }

    const interestCategories = [...byCategory.entries()].map(([category, tags]) => ({
      category,
      tags,
    }));

    return {
      interestCategories: interestCategories.length > 0 ? interestCategories : fallbackProfileTagOptions().interestCategories,
      musicTags: musicTags.length > 0 ? musicTags : fallbackProfileTagOptions().musicTags,
    };
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("getProfileTagOptions fallback", error);
    }
    return fallbackProfileTagOptions();
  }
}

export async function createTagForAdmin(
  input: {
    label: string;
    categoryName: string;
    tagType: "interest" | "music" | "vibe";
  },
  session: Session | null,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const profile = await requireAdminProfile(session);
  const label = input.label.trim();
  const categoryName = input.categoryName.trim();
  const tagType = input.tagType;

  if (!label || !categoryName) {
    const error = new Error("Tag label and category are required.");
    error.name = "ValidationError";
    throw error;
  }

  const slug = slugFromTitle(label);
  const categorySlug = slugFromTitle(categoryName);

  const result = await pool.query<{
    id: string;
    label: string;
    slug: string;
    tag_type: string;
    category_name: string;
    created_at: Date;
  }>(
    `
      with category as (
        insert into tag_categories (name, slug)
        values ($3, $4)
        on conflict (slug) do update set name = excluded.name
        returning id, name
      ),
      upserted_tag as (
        insert into tags (label, slug, tag_type, category_id, admin_managed)
        select $1, $2, $5, category.id, true
        from category
        on conflict (slug) do update
        set
          label = excluded.label,
          category_id = excluded.category_id,
          tag_type = excluded.tag_type,
          admin_managed = true
        returning id::text, label, slug, tag_type, category_id, created_at
      )
      select
        upserted_tag.id,
        upserted_tag.label,
        upserted_tag.slug,
        upserted_tag.tag_type,
        category.name as category_name,
        upserted_tag.created_at
      from upserted_tag
      join category on category.id = upserted_tag.category_id
    `,
    [label, slug, categoryName, categorySlug, tagType],
  );

  const tag = result.rows[0];

  await pool.query(
    `
      insert into audit_logs (actor_profile_id, action, entity_table, entity_id, metadata)
      values ($1::uuid, 'upsert_tag', 'tags', $2::uuid, $3::jsonb)
    `,
    [
      profile.id,
      tag.id,
      JSON.stringify({
        label: tag.label,
        slug: tag.slug,
        tagType: tag.tag_type,
        category: tag.category_name,
      }),
    ],
  );

  return {
    id: tag.id,
    label: tag.label,
    slug: tag.slug,
    tagType: tag.tag_type,
    categoryName: tag.category_name,
    usageCount: 0,
    createdAt: tag.created_at.toISOString(),
  } satisfies AdminTagRow;
}

// Edit an existing tag in place, identified by id. The slug is the join key used
// by event_tags / user_tags, so we deliberately keep it stable - only the
// human-facing label, category and type change. (Renaming the slug would orphan
// every existing association; admins who want a different slug should delete and
// recreate.)
export async function updateTagForAdmin(
  input: {
    id: string;
    label: string;
    categoryName: string;
    tagType: "interest" | "music" | "vibe";
  },
  session: Session | null,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const profile = await requireAdminProfile(session);
  const id = input.id.trim();
  const label = input.label.trim();
  const categoryName = input.categoryName.trim();
  const tagType = input.tagType;

  if (!UUID_RE.test(id)) {
    const error = new Error("Valid tag id is required.");
    error.name = "ValidationError";
    throw error;
  }
  if (!label || !categoryName) {
    const error = new Error("Tag label and category are required.");
    error.name = "ValidationError";
    throw error;
  }

  const categorySlug = slugFromTitle(categoryName);

  const result = await pool.query<{
    id: string;
    label: string;
    slug: string;
    tag_type: string;
    category_name: string;
    created_at: Date;
  }>(
    `
      with category as (
        insert into tag_categories (name, slug)
        values ($3, $4)
        on conflict (slug) do update set name = excluded.name
        returning id, name
      ),
      updated_tag as (
        update tags
        set
          label = $2,
          category_id = category.id,
          tag_type = $5,
          admin_managed = true
        from category
        where tags.id = $1::uuid
        returning tags.id::text, tags.label, tags.slug, tags.tag_type, tags.category_id, tags.created_at
      )
      select
        updated_tag.id,
        updated_tag.label,
        updated_tag.slug,
        updated_tag.tag_type,
        category.name as category_name,
        updated_tag.created_at
      from updated_tag
      join category on category.id = updated_tag.category_id
    `,
    [id, label, categoryName, categorySlug, tagType],
  );

  const tag = result.rows[0];
  if (!tag) {
    const error = new Error("Tag not found.");
    error.name = "NotFoundError";
    throw error;
  }

  await pool.query(
    `
      insert into audit_logs (actor_profile_id, action, entity_table, entity_id, metadata)
      values ($1::uuid, 'update_tag', 'tags', $2::uuid, $3::jsonb)
    `,
    [
      profile.id,
      tag.id,
      JSON.stringify({
        label: tag.label,
        slug: tag.slug,
        tagType: tag.tag_type,
        category: tag.category_name,
      }),
    ],
  );

  // Usage count isn't returned by the update; recompute cheaply so the row the
  // client re-renders shows the right number rather than resetting to 0.
  const usage = await pool.query<{ usage_count: string }>(
    `
      select
        (
          count(distinct user_tag.profile_id)
          + count(distinct event_tag.event_id)
        )::text as usage_count
      from tags tag
      left join user_tags user_tag on user_tag.tag_id = tag.id
      left join event_tags event_tag on event_tag.tag_id = tag.id
      where tag.id = $1::uuid
      group by tag.id
    `,
    [tag.id],
  );

  return {
    id: tag.id,
    label: tag.label,
    slug: tag.slug,
    tagType: tag.tag_type,
    categoryName: tag.category_name,
    usageCount: Number(usage.rows[0]?.usage_count ?? 0),
    createdAt: tag.created_at.toISOString(),
  } satisfies AdminTagRow;
}

// Delete a tag and its associations. event_tags / user_tags rows are removed
// first so the delete never trips a foreign-key constraint regardless of whether
// the schema declares ON DELETE CASCADE.
export async function deleteTagForAdmin(id: string, session: Session | null) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const profile = await requireAdminProfile(session);
  const tagId = id.trim();

  if (!UUID_RE.test(tagId)) {
    const error = new Error("Valid tag id is required.");
    error.name = "ValidationError";
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const existing = await client.query<{ label: string; slug: string }>(
      `select label, slug from tags where id = $1::uuid`,
      [tagId],
    );
    if (existing.rowCount === 0) {
      await client.query("rollback");
      const error = new Error("Tag not found.");
      error.name = "NotFoundError";
      throw error;
    }

    await client.query(`delete from event_tags where tag_id = $1::uuid`, [tagId]);
    await client.query(`delete from user_tags where tag_id = $1::uuid`, [tagId]);
    await client.query(`delete from tags where id = $1::uuid`, [tagId]);

    await client.query(
      `
        insert into audit_logs (actor_profile_id, action, entity_table, entity_id, metadata)
        values ($1::uuid, 'delete_tag', 'tags', $2::uuid, $3::jsonb)
      `,
      [
        profile.id,
        tagId,
        JSON.stringify({
          label: existing.rows[0].label,
          slug: existing.rows[0].slug,
        }),
      ],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return { id: tagId };
}

// Replace an event's interest tags (admin-only). Other tag types (life/vibe/
// music, e.g. quiz-derived) are left untouched. `slugs` must already exist in
// `tags` as interest tags; unknown slugs are dropped. Identified by event slug
// (the AdminEventRow id).
export async function updateEventTagsForAdmin(
  eventSlug: string,
  slugs: string[],
  session: Session | null,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const profile = await requireAdminProfile(session);

  const cleaned = Array.from(
    new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean)),
  ).slice(0, 12);

  const client = await pool.connect();
  try {
    await client.query("begin");

    const eventResult = await client.query<{ id: string }>(
      `select id::text from events where slug = $1 limit 1`,
      [eventSlug],
    );
    const event = eventResult.rows[0];
    if (!event) {
      await client.query("rollback");
      const error = new Error("Event not found.");
      error.name = "NotFoundError";
      throw error;
    }

    // Drop existing interest links only.
    await client.query(
      `
        delete from event_tags et
        using tags tag
        where et.event_id = $1::uuid
          and et.tag_id = tag.id
          and tag.tag_type = 'interest'
      `,
      [event.id],
    );

    if (cleaned.length > 0) {
      await client.query(
        `
          insert into event_tags (event_id, tag_id)
          select $1::uuid, tag.id
          from tags tag
          where tag.tag_type = 'interest'
            and tag.slug = any($2::text[])
          on conflict do nothing
        `,
        [event.id, cleaned],
      );
    }

    // Read back the resulting interest tags for the response.
    const resultTags = await client.query<{ slug: string; label: string }>(
      `
        select tag.slug, tag.label
        from event_tags et
        join tags tag on tag.id = et.tag_id and tag.tag_type = 'interest'
        where et.event_id = $1::uuid
        order by tag.label asc
      `,
      [event.id],
    );

    await client.query(
      `
        insert into audit_logs (actor_profile_id, action, entity_table, entity_id, metadata)
        values ($1::uuid, 'update_event_tags', 'events', $2::uuid, $3::jsonb)
      `,
      [profile.id, event.id, JSON.stringify({ slug: eventSlug, tags: cleaned })],
    );

    await client.query("commit");
    return { id: eventSlug, tags: resultTags.rows };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function getAdminAuditLog(): Promise<AdminAuditRow[]> {
  const pool = getPostgresPool();
  if (!pool) return fallbackAdminAudit;

  try {
    const result = await pool.query<{
      id: string;
      action: string;
      entity_table: string;
      actor_name: string | null;
      metadata: unknown;
      created_at: Date;
    }>(`
      select
        log.id::text,
        log.action,
        log.entity_table,
        actor.display_name as actor_name,
        log.metadata,
        log.created_at
      from audit_logs log
      left join profiles actor on actor.id = log.actor_profile_id
      order by log.created_at desc
      limit 40
    `);

    return result.rows.map((row): AdminAuditRow => ({
      id: row.id,
      action: row.action,
      entityTable: row.entity_table,
      actorName: row.actor_name,
      metadata: (row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}),
      createdAt: row.created_at.toISOString(),
    }));
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("Falling back to static audit log.", error);
    }
    return fallbackAdminAudit;
  }
}

export type AdminSidebarCounts = {
  members: number;
  events: number;
  merchants: number;
  tags: number;
  audit: number;
  reports?: number;
  /** Failed refunds + open disputes. Optional: the DB-down fallbacks omit it. */
  transactions?: number;
};

export async function getAdminSidebarCounts(): Promise<AdminSidebarCounts> {
  const pool = getPostgresPool();
  if (!pool) {
    return {
      members: fallbackAdminMembers.length,
      events: (await getFallbackAdminEvents()).filter((event) => event.status === "Pending").length,
      merchants: fallbackAdminMerchants.filter((m) => m.verificationStatus === "pending").length,
      tags: fallbackAdminTags().length,
      audit: fallbackAdminAudit.length,
    };
  }

  try {
    const result = await pool.query<{
      members: string;
      events: string;
      merchants: string;
      tags: string;
      audit: string;
      reports: string;
      transactions: string;
    }>(`
      -- Badge semantics: triage queues (events, merchants, reports,
      -- transactions) count what needs an admin's attention; members matches
      -- the Attendees page, which lists EVERY profile (onboarded or not).
      --
      -- The transactions badge is the money queue, NOT the ledger size: refunds
      -- that failed to reach Stripe plus disputes still open. Both are people
      -- waiting on a decision, and both went unnoticed while nothing counted
      -- them.
      select
        (select count(*) from profiles) as members,
        (select count(*) from events where status = 'pending') as events,
        (select count(*) from merchant_profiles where verification_status = 'pending') as merchants,
        (select count(*) from tags) as tags,
        (select count(*) from audit_logs) as audit,
        (select count(*) from user_reports where status = 'open') as reports,
        (
          (select count(*) from refund_failures where resolution = 'pending')
          + (select count(*) from payment_disputes where is_open)
        ) as transactions
    `);

    const row = result.rows[0];
    return {
      members: Number(row?.members ?? 0),
      events: Number(row?.events ?? 0),
      merchants: Number(row?.merchants ?? 0),
      tags: Number(row?.tags ?? 0),
      audit: Number(row?.audit ?? 0),
      reports: Number(row?.reports ?? 0),
      transactions: Number(row?.transactions ?? 0),
    };
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("Falling back to static admin counts.", error);
    }
    return {
      members: fallbackAdminMembers.length,
      events: (await getFallbackAdminEvents()).filter((event) => event.status === "Pending").length,
      merchants: fallbackAdminMerchants.filter((m) => m.verificationStatus === "pending").length,
      tags: fallbackAdminTags().length,
      audit: fallbackAdminAudit.length,
    };
  }
}

export async function getAdminMetrics(events: AdminEventRow[]): Promise<AdminMetrics> {
  const pool = getPostgresPool();
  const pendingCount = events.filter((event) => event.status === "Pending").length;

  if (!pool) return fallbackAdminMetrics(events.length, pendingCount);

  try {
    const [profilesResult, merchantsResult, eventsResult, rsvpResult, mutualResult] = await Promise.all([
      pool.query<{ total: string; recent: string }>(`
        select
          count(*) as total,
          count(*) filter (where created_at > now() - interval '7 days') as recent
        from profiles
        -- Only onboarded members count as attendees (bug board #164): an
        -- email-only signup - including a merchant who never completed the
        -- attendee side - hasn't joined yet. suburb is the field onboarding
        -- enforces (same rule as getProfileStatus.onboardingComplete).
        where suburb is not null
      `),
      pool.query<{ total: string; pending: string }>(`
        select
          count(*) as total,
          count(*) filter (where verification_status = 'pending') as pending
        from merchant_profiles
      `),
      pool.query<{ total: string; pending: string }>(`
        select
          count(*) as total,
          count(*) filter (where status = 'pending') as pending
        from events
      `),
      pool.query<{ confirmed: string }>(`
        select count(*) as confirmed
        from event_attendees
        where status = 'confirmed'
      `),
      pool.query<{ mutual: string }>(`
        select count(*) as mutual from mutual_clicks
      `),
    ]);

    return {
      totalMembers: Number(profilesResult.rows[0]?.total ?? 0),
      newMembersThisWeek: Number(profilesResult.rows[0]?.recent ?? 0),
      totalMerchants: Number(merchantsResult.rows[0]?.total ?? 0),
      pendingMerchants: Number(merchantsResult.rows[0]?.pending ?? 0),
      totalEvents: Number(eventsResult.rows[0]?.total ?? 0),
      pendingEvents: Number(eventsResult.rows[0]?.pending ?? 0),
      confirmedRsvps: Number(rsvpResult.rows[0]?.confirmed ?? 0),
      mutualClicks: Number(mutualResult.rows[0]?.mutual ?? 0),
    };
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("Falling back to static admin metrics.", error);
    }
    return fallbackAdminMetrics(events.length, pendingCount);
  }
}

// A claimed guest +1 is a real seat, but it hangs off the PURCHASER's booking -
// the guest never gets an event_attendees row of their own. Migration 056 added
// event_participants_v for exactly this, and the click mechanic reads it; the
// booking surfaces could not, because the view carries no status and they branch
// on confirmed-vs-waitlisted. Same liveness rule the view enforces: a guest seat
// counts only while the purchaser's own booking is still confirmed.
const seatRowsSql = `(
          select ea.event_id, ea.profile_id, ea.status::text as status, 'own' as seat_source
          from event_attendees ea
          union all
          select gs.event_id, gs.claimed_profile_id as profile_id,
                 'confirmed' as status, 'guest' as seat_source
          from guest_spots gs
          join event_attendees purchaser
            on purchaser.payment_transaction_id = gs.payment_transaction_id
           and purchaser.profile_id = gs.purchaser_profile_id
          where gs.status = 'claimed'
            and gs.claimed_profile_id is not null
            and purchaser.status = 'confirmed'
        )`;

const eventSelectColumns = `
        event.slug,
        event.title,
        event.group_name,
        event.host_name,
        event.category,
        event.status::text,
        event.booking_model::text,
        event.starts_at,
        event.ends_at,
        event.location_name,
        event.suburb,
        event.latitude::text,
        event.longitude::text,
        event.price_cents,
        event.capacity,
        event.image_url,
        event.image_alt,
        event.description,
        event.relationship_goal,
        event.fomo,
        (
          count(distinct attendee_count.id) filter (where (attendee_count.status = 'confirmed' or (attendee_count.status = 'pending_payment' and attendee_count.hold_expires_at > now())))
          -- Plus paid guest seats (spec 19): a live guest_spots row is a held seat.
          + coalesce((
            select count(*)
            from guest_spots gs
            where gs.event_id = event.id
              and gs.status <> 'cancelled'
              and exists (
                select 1 from event_attendees ga
                where ga.payment_transaction_id = gs.payment_transaction_id
                  and (ga.status = 'confirmed' or (ga.status = 'pending_payment' and ga.hold_expires_at > now()))
              )
          ), 0)
        ) as confirmed_attendees,
        (
          -- Up to 3 confirmed-attendee avatars for the "who's going" preview.
          -- Correlated subquery so it stays correct under the GROUP BY above.
          select coalesce(array_agg(preview.photo_url order by preview.joined_at), '{}')
          from (
            select profile.photo_url, ea.created_at as joined_at
            from event_attendees ea
            join profiles profile on profile.id = ea.profile_id
            where ea.event_id = event.id
              and ea.status = 'confirmed'
              and profile.photo_url is not null
              -- Attendance is not public by face. This preview renders to anyone
              -- with the URL, signed out included, so it shows only people who
              -- have not opted out of attendee lists (profile default, per-booking
              -- override) and never a banned account. The columns landed in
              -- migration 049 and nothing read them until now, which meant the
              -- opt-out existed in the schema and did nothing in the product.
              and profile.default_attend_visibility
              and profile.is_banned = false
              and ea.visible_to_attendees
            order by ea.created_at asc
            limit 3
          ) preview
        ) as attendee_avatars,
        coalesce(
          -- tag.label, not tag.slug. The slug is kebab-case machine text, and it
          -- was rendering raw beside attendee cards that show proper labels:
          -- "low-pressure" and "new-to-town" next to "Low Pressure". Labels are
          -- not derivable from slugs either ("crossfit" -> "CrossFit"), so this
          -- has to come from the column. EventExplorer's matchesTag slugifies
          -- both sides, so /discover?tag=low-pressure still resolves.
          array_agg(distinct tag.label)
            filter (where tag.tag_type in ('interest', 'vibe', 'music')),
          '{}'
        ) as tags,
        coalesce(
          array_agg(distinct tag.label)
            filter (where tag.tag_type = 'life'),
          '{}'
        ) as life_signals
`;

export async function getDashboardData(session: Session | null): Promise<DashboardData> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  const userName = getSessionName(session);

  if (!pool || !email) {
    // No DB / no session: show an honest empty dashboard rather than slicing
    // the static clickEvents catalogue, which made freshly signed-up users see
    // fake "2 upcoming / 2 saved" plans they never RSVP'd to.
    return {
      userName,
      upcomingEvents: [],
      waitlistedEvents: [],
      savedEvents: [],
      stats: {
        upcoming: 0,
        saved: 0,
        clicks: 0,
        radar: "Offline",
      },
    };
  }

  try {
    const profile = await ensureProfileForSession(session);

    const [upcomingResult, waitlistedResult, savedResult, clickResult] = await Promise.all([
      pool.query<EventRow>(
        `
          select ${eventSelectColumns}
          from ${seatRowsSql} own_attendee
          join events event on event.id = own_attendee.event_id
          left join event_attendees attendee_count on attendee_count.event_id = event.id
          left join event_tags event_tag on event_tag.event_id = event.id
          left join tags tag on tag.id = event_tag.tag_id
          where own_attendee.profile_id = $1::uuid
            and own_attendee.status = 'confirmed'
            and event.status <> 'cancelled'
            and coalesce(event.ends_at, event.starts_at) > now()
          group by event.id
          order by event.starts_at asc
        `,
        [profile.id],
      ),
      pool.query<EventRow>(
        `
          select ${eventSelectColumns}
          from ${seatRowsSql} own_attendee
          join events event on event.id = own_attendee.event_id
          left join event_attendees attendee_count on attendee_count.event_id = event.id
          left join event_tags event_tag on event_tag.event_id = event.id
          left join tags tag on tag.id = event_tag.tag_id
          where own_attendee.profile_id = $1::uuid
            and own_attendee.status = 'waitlisted'
            and event.status <> 'cancelled'
            and coalesce(event.ends_at, event.starts_at) > now()
          group by event.id
          order by event.starts_at asc
        `,
        [profile.id],
      ),
      pool.query<EventRow>(
        `
          select ${eventSelectColumns}
          from bookmarks bookmark
          join events event on event.id = bookmark.event_id
          left join event_attendees attendee_count on attendee_count.event_id = event.id
          left join event_tags event_tag on event_tag.event_id = event.id
          left join tags tag on tag.id = event_tag.tag_id
          where bookmark.profile_id = $1::uuid
            and event.status <> 'cancelled'
            and coalesce(event.ends_at, event.starts_at) > now()
          group by event.id, bookmark.created_at
          order by bookmark.created_at desc
          limit 12
        `,
        [profile.id],
      ),
      pool.query<{ mutual_clicks: string }>(
        `
          select count(*) as mutual_clicks
          from mutual_clicks
          where user_a_id = $1::uuid or user_b_id = $1::uuid
        `,
        [profile.id],
      ),
    ]);

    const upcomingEvents = upcomingResult.rows.map(eventFromRow);
    const waitlistedEvents = waitlistedResult.rows.map(eventFromRow);
    const savedEvents = savedResult.rows.map(eventFromRow);

    return {
      userName: profile.display_name,
      upcomingEvents,
      waitlistedEvents,
      savedEvents,
      stats: {
        upcoming: upcomingEvents.length,
        saved: savedEvents.length,
        clicks: Number(clickResult.rows[0]?.mutual_clicks ?? 0),
        radar: upcomingEvents.length > 0 ? "Live" : "Quiet",
      },
    };
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("Falling back to empty dashboard data.", error);
    }

    // Query failed (e.g. Postgres unreachable): never fabricate RSVPs/bookmarks
    // for a real signed-in user - return an empty dashboard so the UI shows the
    // genuine "No RSVPs yet" state instead of seed events.
    return {
      userName,
      upcomingEvents: [],
      waitlistedEvents: [],
      savedEvents: [],
      stats: {
        upcoming: 0,
        saved: 0,
        clicks: 0,
        radar: "Offline",
      },
    };
  }
}

export function getProfileStatus(session: Session | null): Promise<ProfileStatus> {
  return memoizeBySessionEmail("profileStatus", session, () =>
    getProfileStatusUncached(session),
  );
}

async function getProfileStatusUncached(session: Session | null): Promise<ProfileStatus> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!pool || !email) {
    return {
      exists: false,
      role: "attendee",
      degraded: false,
      onboardingComplete: false,
      suburb: null,
      merchantProfile: null,
      bookmarkedEventIds: [],
      registeredEventIds: [],
      waitlistedEventIds: [],
      photoUrl: null,
      hasGalleryPhotos: false,
      datingVisible: false,
    };
  }

  try {
    const profile = await ensureProfileForSession(session);
    const [statusResult, bookmarksResult, registrationsResult, merchant] = await Promise.all([
      pool.query<{ suburb: string | null; bio: string | null; birth_date: Date | null; photo_url: string | null; dating_visible: boolean; has_gallery: boolean }>(
        `select suburb, bio, birth_date, photo_url, dating_visible, cardinality(gallery_photos) > 0 as has_gallery from profiles where id = $1::uuid`,
        [profile.id],
      ),
      pool.query<{ slug: string }>(
        `
          select event.slug
          from bookmarks bookmark
          join events event on event.id = bookmark.event_id
          where bookmark.profile_id = $1::uuid
        `,
        [profile.id],
      ),
      pool.query<{ slug: string; status: string }>(
        `
          -- Guest seats included, because registeredEventIds is what /discover,
          -- /dashboard, /people, /bookmarks, /categories and the explorer all ask
          -- "does this person hold a seat". Reading event_attendees alone here
          -- left a claimed +1 showing an RSVP button on their own night on every
          -- one of those surfaces, even after the event page itself was fixed.
          -- distinct on: holding your own seat AND a claimed +1 for the same
          -- night would otherwise list the slug twice and inflate the count
          -- /merchant reads off registeredEventIds.length.
          select distinct on (event.slug) event.slug, attendee.status::text as status
          from ${seatRowsSql} attendee
          join events event on event.id = attendee.event_id
          where attendee.profile_id = $1::uuid
            and attendee.status in ('confirmed', 'waitlisted')
          order by event.slug, case when attendee.seat_source = 'own' then 0 else 1 end
        `,
        [profile.id],
      ),
      getMerchantProfile(pool, profile.id),
    ]);

    const row = statusResult.rows[0];
    // Onboarding requires exactly the fields saveOnboarding enforces: suburb
    // (the postcode) and birth_date. Bio stays an OPTIONAL final step - gating
    // completion on it bounced anyone who skipped their bio back to /onboarding
    // on every login. birth_date IS required: it's the 18+ gate, and a profile
    // that never supplied one has never passed it, so it isn't onboarded.
    const onboardingComplete = !!row?.suburb && !!row?.birth_date;

    return {
      exists: true,
      role: profile.role,
      degraded: false,
      onboardingComplete,
      suburb: row?.suburb ?? null,
      merchantProfile: merchant,
      bookmarkedEventIds: bookmarksResult.rows.map((entry) => entry.slug),
      registeredEventIds: registrationsResult.rows.map((entry) => entry.slug),
      // Split out so callers can tell a confirmed booking from a waitlist spot
      // (registeredEventIds conflates both). Lets cards/modals show the right
      // "View your booking" vs "On the waitlist" state without re-querying.
      waitlistedEventIds: registrationsResult.rows
        .filter((entry) => entry.status === "waitlisted")
        .map((entry) => entry.slug),
      photoUrl: row?.photo_url ?? null,
      hasGalleryPhotos: Boolean(row?.has_gallery),
      datingVisible: Boolean(row?.dating_visible),
    };
  } catch (error) {
    console.error("getProfileStatus failed", { email, error });
    // This fallback keeps the ATTENDEE surfaces up through a transient blip,
    // which is why it exists and why it does not throw. But it reports
    // "role: attendee, merchantProfile: null", and the merchant gates read a
    // null merchantProfile as "this person has never applied" - so a failed
    // read sent an approved host to a blank signup wizard, on top of their real
    // record, via an upsert that would overwrite it. `degraded` lets those
    // gates tell "you have no merchant profile" apart from "we could not find
    // out", without turning every public page into an error screen.
    return {
      exists: !!email,
      role: "attendee",
      onboardingComplete: false,
      suburb: null,
      merchantProfile: null,
      degraded: true,
      bookmarkedEventIds: [],
      registeredEventIds: [],
      waitlistedEventIds: [],
      photoUrl: null,
      hasGalleryPhotos: false,
      datingVisible: false,
    };
  }
}

/**
 * Guard for the HOST surfaces. Every merchant gate reacts to a null
 * merchantProfile by sending the viewer to /merchant/signup - which is right
 * for someone who has never applied, and badly wrong for an approved host whose
 * profile read just failed: they get a blank application form on top of their
 * real record, backed by an upsert that would overwrite it.
 *
 * Attendee surfaces keep the soft fallback (a transient blip should not take
 * the public site down). Host surfaces call this instead and fail loudly, into
 * src/app/merchant/error.tsx, which offers a retry.
 */
export function assertProfileStatusUsable(status: ProfileStatus): void {
  if (!status.degraded) return;
  const error = new Error(
    "We couldn't load your host account just now. Please try again in a moment.",
  );
  error.name = "DatabaseUnavailableError";
  throw error;
}

export type ProfileCompletionItem = {
  key: string;
  label: string;
  done: boolean;
  href: string;
};

export type ProfileCompletion = {
  // 0–100, rounded. Drives the "complete your profile" progress ring.
  percent: number;
  complete: boolean;
  // Separate from `complete` so the dashboard can prompt the quiz on its own,
  // even when the rest of the profile is finished.
  quizComplete: boolean;
  items: ProfileCompletionItem[];
};

// Profile-completion checklist for the attendee dashboard. Each item is an
// equal-weight step; `percent` is done/total. Quiz completion is surfaced both
// as a checklist item and as a standalone `quizComplete` flag so the dashboard
// can show a dedicated "take the quiz" prompt at the top.
export async function getProfileCompletion(
  session: Session | null,
): Promise<ProfileCompletion> {
  const empty = (): ProfileCompletion => {
    const items: ProfileCompletionItem[] = [
      { key: "photo", label: "Add a photo to Click with others", done: false, href: "/profile/edit" },
      // /profile/edit, NOT /onboarding: the onboarding form writes a raw
      // postcode into profiles.suburb, which is exactly the legacy shape
      // /profile/edit now detects and repairs (splitSuburb + the postcode →
      // suburb lookup). Steering here at /onboarding recreated the bug.
      { key: "suburb", label: "Set your suburb", done: false, href: "/profile/edit" },
      { key: "bio", label: "Write a short bio", done: false, href: "/profile/edit" },
      { key: "tags", label: "Pick at least 3 interests", done: false, href: "/profile/edit" },
      { key: "quiz", label: "Take the Click quiz", done: false, href: "/quiz/life" },
    ];
    return { percent: 0, complete: false, quizComplete: false, items };
  };

  const pool = getPostgresPool();
  const emailPresent = !!getSessionEmail(session);
  if (!pool || !emailPresent) return empty();

  try {
    const profile = await ensureProfileForSession(session);
    const [fieldsResult, tagCountResult, quizResult] = await Promise.all([
      pool.query<{
        photo_url: string | null;
        gallery_count: number;
        suburb: string | null;
        bio: string | null;
      }>(
        `select photo_url, cardinality(coalesce(gallery_photos, '{}')) as gallery_count, suburb, bio
         from profiles where id = $1::uuid`,
        [profile.id],
      ),
      // Scoped to the tag type the label promises. Counting every user_tag row
      // meant the Life Quiz (source='quiz', tag_type 'life'/'music'/'vibe') ticked
      // "Pick at least 3 interests" for someone with no interests at all - and
      // the matcher, which only reads interest tags, then had nothing to work
      // with while the profile card said it was done.
      pool.query<{ count: string }>(
        `select count(*)::text as count
           from user_tags ut
           join tags t on t.id = ut.tag_id
          where ut.profile_id = $1::uuid and t.tag_type = 'interest'`,
        [profile.id],
      ),
      // The dashboard "Take the Click quiz" card links to the Life Quiz
      // (/quiz/life), which writes tags with source='quiz' via saveLifeQuizTags
      // - it does NOT write to click_personas (that's the separate personality
      // quiz). Detect completion from the same signal the Life Quiz produces so
      // the prompt clears once the user finishes it.
      pool.query<{ count: string }>(
        `select count(*)::text as count from user_tags where profile_id = $1::uuid and source = 'quiz'`,
        [profile.id],
      ),
    ]);

    const row = fieldsResult.rows[0];
    const tagCount = Number(tagCountResult.rows[0]?.count ?? 0);
    const quizComplete = Number(quizResult.rows[0]?.count ?? 0) > 0;

    const items: ProfileCompletionItem[] = [
      // Counts the avatar OR any "More photos" gallery image - a user who filled
      // the gallery but never set a primary avatar was still nagged to "add a
      // photo" (bug board #182). The gallery upload also seeds the avatar going
      // forward (api/upload/gallery), so this mainly clears already-affected profiles.
      {
        key: "photo",
        // Spell out WHY a photo matters: it's required to enter the "Click with
        // someone" pool (getSuggestedPeople filters out photoless profiles), so
        // the nudge doubles as the reminder a photoless user needs (#190).
        label: "Add a photo to Click with others",
        done: !!row?.photo_url || (row?.gallery_count ?? 0) > 0,
        href: "/profile/edit",
      },
      // Same reason as the `empty()` list above - /profile/edit is the only
      // surface that stores a real suburb name and repairs a legacy postcode.
      { key: "suburb", label: "Set your suburb", done: !!row?.suburb, href: "/profile/edit" },
      { key: "bio", label: "Write a short bio", done: !!row?.bio, href: "/profile/edit" },
      { key: "tags", label: "Pick at least 3 interests", done: tagCount >= 3, href: "/profile/edit" },
      { key: "quiz", label: "Take the Click quiz", done: quizComplete, href: "/quiz/life" },
    ];

    const doneCount = items.filter((i) => i.done).length;
    const percent = Math.round((doneCount / items.length) * 100);

    return { percent, complete: doneCount === items.length, quizComplete, items };
  } catch {
    return empty();
  }
}

// Resolves the caller's merchant profile and asserts it has been approved.
// Used by the post-approval Stripe Connect onboarding routes - those actions
// must never run for a pending/rejected/suspended merchant.
export async function getApprovedMerchantForSession(
  session: Session | null,
): Promise<MerchantProfileRow> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const merchant = await getMerchantProfile(pool, profile.id);
  if (!merchant) {
    const error = new Error("No merchant profile found for this account.");
    error.name = "NotFoundError";
    throw error;
  }
  if (merchant.verification_status !== "approved") {
    const error = new Error("Your merchant application isn't approved yet.");
    error.name = "ForbiddenError";
    throw error;
  }
  return merchant;
}

// Persists the connected account id created via the Accounts v2 API.
export async function setMerchantConnectAccountId(
  merchantProfileId: string,
  accountId: string,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  await pool.query(
    `
      update merchant_profiles
      set stripe_connect_account_id = $2, updated_at = now()
      where id = $1::uuid
    `,
    [merchantProfileId, accountId],
  );
}

// Caches the connected account's capability state on the merchant row. Keyed by
// the account id so the Stripe webhook can sync without knowing the profile.
// Returns true when a row matched (false if the account id is unknown to us).
export async function updateMerchantConnectStatus(
  accountId: string,
  status: { chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean },
): Promise<boolean> {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const result = await pool.query(
    `
      update merchant_profiles
      set charges_enabled = $2,
          payouts_enabled = $3,
          details_submitted = $4,
          updated_at = now()
      where stripe_connect_account_id = $1
    `,
    [accountId, status.chargesEnabled, status.payoutsEnabled, status.detailsSubmitted],
  );
  return (result.rowCount ?? 0) > 0;
}

// Marks the one-time post-approval walkthrough as done (or skipped), so
// /merchant stops redirecting the merchant into /merchant/onboarding.
export async function markMerchantOnboardingComplete(session: Session | null) {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  await pool.query(
    `
      update merchant_profiles
      set onboarding_completed_at = coalesce(onboarding_completed_at, now()),
          updated_at = now()
      where profile_id = $1::uuid
    `,
    [profile.id],
  );
}

/**
 * The seat-holding ban gate, as a pure predicate over a row the caller already
 * has - no second round-trip, and no second copy of the rule to drift out of
 * step. `assertBookingEligible` is the booking half (ban + onboarding); the
 * guest +1 claim wants only this half, because the invited friend signs up
 * through the invite and fills in their profile afterwards.
 */
function assertNotBannedFromSeats(row: { is_banned: boolean; suspended_at: Date | null } | undefined) {
  if (!row?.is_banned && !row?.suspended_at) return;
  const error = new Error(
    "This account can't book events right now. Email hello@letsclick.app if you think that's wrong.",
  );
  error.name = "ForbiddenError";
  throw error;
}

/**
 * Refuses a seat to anyone who hasn't finished onboarding.
 *
 * This is the trust boundary for the 18+ rule. /onboarding is a form, and a
 * form is not a gate: the app chrome used to render over the top of it, so a
 * fresh signup could tap "Discover" and book an event with no postcode and no
 * birth date on file. Both booking entry points (free RSVP and paid checkout)
 * route through here, so the age check can't be walked around by picking the
 * other one.
 *
 * Same rule as ProfileStatus.onboardingComplete - keep the two in step.
 */
async function assertBookingEligible(pool: Pool, profileId: string) {
  const result = await pool.query<{
    suburb: string | null;
    birth_date: Date | null;
    is_banned: boolean;
    suspended_at: Date | null;
  }>(
    `select suburb, birth_date, is_banned, suspended_at from profiles where id = $1::uuid`,
    [profileId],
  );
  const row = result.rows[0];

  // A ban or suspension only ever filtered the click and matching queries, so
  // someone removed for harassing another attendee could still sign in and buy a
  // seat at the same event as the person who reported them. This is the single
  // choke point most booking paths route through - the free RSVP, the paid
  // hold, joining a waitlist, and accepting a waitlist promotion - so the check
  // belongs here rather than in each one. The guest +1 claim is the one seat
  // route that wants the ban half WITHOUT the onboarding half, so it calls
  // assertNotBannedFromSeats directly. Five routes, one rule; if you add a
  // sixth way to hold a seat, it goes through one of these two.
  assertNotBannedFromSeats(row);

  if (row?.suburb && row.birth_date) return;

  const error = new Error("Finish setting up your profile before you book - it takes a minute.");
  error.name = "OnboardingRequiredError";
  throw error;
}

// Whole years elapsed since `birthDate`, counted on calendar boundaries so a
// birthday that hasn't landed yet this year doesn't round someone up into 18.
function ageFromBirthDate(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthday =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!hasHadBirthday) age -= 1;
  return age;
}

export async function saveOnboarding(input: OnboardingInput, session: Session | null) {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const displayName = input.displayName.trim();
  const rawSuburb = input.suburb.trim();
  // The wizard sends a postcode here (onboarding-form.tsx). Store the suburb it
  // names, falling back to whatever was typed for a code we don't have.
  const suburb = lookupPostcode(rawSuburb)?.suburbs[0] ?? rawSuburb;
  // Bio moved to an optional final onboarding step - accept empty string here.
  const bio = input.bio.trim();

  if (!displayName || !suburb) {
    const error = new Error("Name and suburb are required.");
    error.name = "ValidationError";
    throw error;
  }

  // The 18+ gate lives HERE, not only in the form. Birth date used to be
  // optional on this path, so a POST straight at /api/onboarding minted a
  // finished profile with birth_date null and an age nobody ever checked.
  const rawBirthDate = input.birthDate?.trim() ?? "";
  if (!rawBirthDate) {
    throw validationError("Your birth date is required - Click is 18+.");
  }
  const parsedBirthDate = new Date(rawBirthDate);
  if (Number.isNaN(parsedBirthDate.getTime())) {
    throw validationError("Birth date must be a valid date.");
  }
  const derivedAge = ageFromBirthDate(parsedBirthDate);
  if (derivedAge < 18) {
    throw validationError("You must be 18 or older to use Click.");
  }
  if (derivedAge > 120) {
    throw validationError("That birth date doesn't look right.");
  }
  const birthDateValue = parsedBirthDate.toISOString().slice(0, 10);

  // Mirrors the connection_intent enum in database/001_schema.sql + 008_intent_extras.sql.
  const allowedIntents = [
    "dating",
    "friendship",
    "networking",
    "exploring",
    "hobbies",
    "wellness",
    "community",
    "new_in_town",
  ];
  const intents = (input.intents.length ? input.intents : ["friendship"])
    .map((intent) => intent.toLowerCase())
    .filter((intent) => allowedIntents.includes(intent));

  const profile = await ensureProfileForSession(session);

  await pool.query(
    `
      update profiles
      set
        display_name = $2,
        suburb = $3,
        age = $4,
        bio = $5,
        connection_intents = $6::connection_intent[],
        birth_date = $7::date,
        dating_visible = coalesce($8::boolean, dating_visible),
        flexible_discovery = coalesce($9::boolean, flexible_discovery),
        updated_at = now()
      where id = $1::uuid
    `,
    [
      profile.id,
      displayName,
      suburb,
      derivedAge,
      bio,
      intents.length ? intents : ["friendship"],
      birthDateValue,
      input.datingVisible ?? null,
      input.flexibleDiscovery ?? null,
    ],
  );

  const rawTags = input.tags
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 24);

  if (rawTags.length > 0) {
    // Tags are "click tags" - never free-form. Attach only curated tags that
    // already exist, matched by slug (the onboarding chips are seeded as
    // admin-managed `interest` tags in database/026_curate_interest_tags.sql).
    // Anything unrecognised is dropped rather than minting a new tag.
    await pool.query(
      `
        with matched_tags as (
          select tag.id
          from unnest($2::text[]) as input(label)
          join tags tag
            on tag.slug = trim(both '-' from regexp_replace(input.label, '[^a-z0-9]+', '-', 'g'))
        )
        insert into user_tags (profile_id, tag_id, source)
        select $1::uuid, matched_tags.id, 'user'
        from matched_tags
        on conflict do nothing
      `,
      [profile.id, rawTags],
    );
  }

  return { ok: true, profileId: profile.id };
}

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;
const MERCHANT_SOCIAL_PLATFORMS = [
  "instagram",
  "tiktok",
  "facebook",
  "youtube",
  "x",
] as const;
const AU_POSTCODE_RE = /^[0-9]{4}$/;

// Launch pilot is Greater Sydney. A merchant whose venue is outside this area
// is parked on the host waitlist (emailed, not auto-rejected) until we open
// their region - see registerMerchantWizardSubmit. Both the ranges and the label
// come from geo.ts so the wizard's out-of-pilot notice and this branch can never
// drift apart again - see isWithinSydneyPilot for what they used to disagree on.
const isWithinPilotArea = isWithinSydneyPilot;

/**
 * `field` is optional and names the input the message is about, so a route can
 * hand it to the client and the client can mark that input instead of printing
 * a lone sentence on whatever page the submit happened to fire from. Callers
 * that have no single field to blame simply omit it.
 */
function validationError(message: string, field?: string): Error {
  const error = new Error(message);
  error.name = "ValidationError";
  if (field) (error as Error & { field?: string }).field = field;
  return error;
}

/**
 * Full merchant signup wizard submit - spec §1 Step 4.
 *
 * Validates every required field server-side (UI validation is not enough -
 * never trust the wizard), then commits everything in one transaction:
 *   1. upsert merchant_profiles with all wizard fields + submitted_at
 *   2. replace merchant_event_categories rows for this profile
 *   3. back-fill merchant_documents.merchant_profile_id (docs were uploaded
 *      during Step 3 and keyed off profile_id while the merchant row didn't
 *      yet exist)
 *   4. bump profiles.role from 'attendee' to 'merchant' if needed
 *
 * Returns the merchant profile row.
 */
export type MerchantCategoryOption = { id: string; name: string; slug: string };

/**
 * Lightweight category list for the merchant signup wizard Step 1. Returns
 * id + name so the wizard can submit FK references. Falls back to an empty
 * list if the DB isn't reachable - the wizard surfaces that as a load error.
 *
 * Filters out `internal_only` categories (e.g. Life, Music) - those are
 * matching signals from the Life Quiz and music-taste vibes, not event
 * types a merchant hosts.
 */
export async function getMerchantCategoryOptions(): Promise<MerchantCategoryOption[]> {
  const pool = getPostgresPool();
  if (!pool) return [];
  const result = await pool.query<{ id: string; name: string; slug: string }>(
    `select id::text, name, slug
       from tag_categories
      where internal_only = false
      order by name asc`,
  );
  return result.rows;
}

/**
 * Pre-made tag labels offered to merchants on the create-event Basics step.
 * Merchants search/pick these as pills - tags are "click tags", never
 * free-form, so this is the ONLY source of selectable event tags. Keeps tag
 * spelling consistent so events match the same tags users hold on their
 * profiles. Returns `interest` + `vibe` tags (the event-relevant types;
 * `life`/`music` are matching signals, not event descriptors), ordered by
 * how widely each tag is already used so the most common options surface
 * first. The submit path (`createEventForMerchant`) only attaches tags that
 * exist here; anything else is dropped. Falls back to an empty list if the DB
 * is down. New tags are created by admins via /api/admin/tags.
 */
export type MerchantEventTagOption = { label: string; category: string | null };

export async function getMerchantTagOptions(): Promise<MerchantEventTagOption[]> {
  const pool = getPostgresPool();
  if (!pool) return [];
  const result = await pool.query<MerchantEventTagOption & { usage: string }>(
    `select tag.label, category.name as category, count(event_tag.tag_id) as usage
       from tags tag
       left join tag_categories category on category.id = tag.category_id
       left join event_tags event_tag on event_tag.tag_id = tag.id
      where tag.tag_type in ('interest', 'vibe')
      group by tag.id, tag.label, category.name
      order by usage desc, tag.label asc`,
  );
  return result.rows.map(({ label, category }) => ({ label, category }));
}

export type MerchantEventCreateOptions = {
  // Host names the merchant can pick instead of retyping every event: their
  // business / trading name plus any group_name they've used before.
  hostNames: string[];
  // Venue names reused from their past events, for the location step's combobox.
  venues: string[];
};

/**
 * Dropdown options for the event-create wizard, scoped to one merchant. We don't
 * keep a separate "host names" or "venues" table - instead we derive the lists
 * from the merchant's profile and the events they've already created, so the
 * dropdowns fill themselves in as they host more. Both are still freetext in the
 * UI; these are just no-retyping suggestions.
 */
export async function getMerchantEventCreateOptions(
  merchantProfileId: string,
): Promise<MerchantEventCreateOptions> {
  const pool = getPostgresPool();
  if (!pool) return { hostNames: [], venues: [] };
  const result = await pool.query<{
    host_names: string[] | null;
    venues: string[] | null;
  }>(
    `
      with mp as (
        select business_name, nullif(trading_name, '') as trading_name
        from merchant_profiles
        where id = $1::uuid
      ),
      host_names as (
        select business_name as name from mp
        union
        select trading_name from mp where trading_name is not null
        union
        select distinct group_name
          from events
         where merchant_profile_id = $1::uuid
           and coalesce(group_name, '') <> ''
      ),
      venue_names as (
        select distinct location_name as name
          from events
         where merchant_profile_id = $1::uuid
           and coalesce(location_name, '') <> ''
      )
      select
        (select array_agg(name order by name)
           from host_names where coalesce(name, '') <> '') as host_names,
        (select array_agg(name order by name) from venue_names) as venues
    `,
    [merchantProfileId],
  );
  const row = result.rows[0];
  return {
    hostNames: row?.host_names ?? [],
    venues: row?.venues ?? [],
  };
}

export type MerchantDocumentType =
  | "abn_certificate"
  | "public_liability_insurance"
  | "liquor_licence";

export type MerchantDocumentRow = {
  id: string;
  document_type: MerchantDocumentType;
  file_path: string;
  file_name: string;
  uploaded_at: string;
};

/**
 * Record a merchant document upload. Called by /api/merchant/documents AFTER
 * the file has been pushed to Supabase Storage - this function only writes
 * the metadata row. The unique (profile_id, document_type) constraint means
 * re-uploading a doc replaces the previous row.
 */
export async function recordMerchantDocument(
  input: {
    documentType: MerchantDocumentType;
    filePath: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  },
  session: Session | null,
): Promise<MerchantDocumentRow & { previousFilePath: string | null }> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const merchant = await getMerchantProfile(pool, profile.id);

  // The row is replaced on re-upload, but the OLD storage object isn't - so
  // every re-pick used to leave a 5 MB orphan in the private bucket that
  // nothing referenced or cleaned up. Hand the previous key back so the route
  // can delete it, which caps an account at one object per document type.
  const previous = await pool.query<{ file_path: string }>(
    `select file_path from merchant_documents where profile_id = $1::uuid and document_type = $2::merchant_document_type`,
    [profile.id, input.documentType],
  );
  const previousFilePath = previous.rows[0]?.file_path ?? null;

  const result = await pool.query<MerchantDocumentRow>(
    `
      insert into merchant_documents (
        merchant_profile_id, profile_id, document_type,
        file_path, file_name, mime_type, size_bytes
      )
      values ($1::uuid, $2::uuid, $3::merchant_document_type, $4, $5, $6, $7)
      on conflict (profile_id, document_type) do update set
        merchant_profile_id = excluded.merchant_profile_id,
        file_path = excluded.file_path,
        file_name = excluded.file_name,
        mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes,
        uploaded_at = now()
      returning id::text, document_type, file_path, file_name, uploaded_at::text
    `,
    [
      merchant?.id ?? null,
      profile.id,
      input.documentType,
      input.filePath,
      input.fileName,
      input.mimeType,
      input.sizeBytes,
    ],
  );

  return { ...result.rows[0], previousFilePath };
}

/**
 * Remove one of the caller's own documents. Returns the storage key that is now
 * unreferenced so the route can delete the object too (the same pair of calls
 * the replace path in recordMerchantDocument already leaves the route to make),
 * or null when there was nothing on file for that type.
 *
 * Scoped to profile_id, so a host can only ever delete their own. All three
 * documents are optional at signup, and a host who picked the wrong file had no
 * way back to zero - only overwriting it with another one.
 */
export async function deleteMerchantDocument(
  documentType: MerchantDocumentType,
  session: Session | null,
): Promise<{ filePath: string } | null> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);

  // Not after approval: those documents are what an admin's decision was made
  // on, and the wizard (the only surface that removes them) is unreachable once
  // approved anyway - so this only ever fires on a hand-rolled request.
  const merchant = await getMerchantProfile(pool, profile.id);
  if (merchant?.verification_status === "approved") {
    throw validationError(
      "Your application is already approved - email hello@letsclick.app to change a document on file.",
    );
  }

  const result = await pool.query<{ file_path: string }>(
    `delete from merchant_documents
      where profile_id = $1::uuid and document_type = $2::merchant_document_type
      returning file_path`,
    [profile.id, documentType],
  );
  const filePath = result.rows[0]?.file_path;
  return filePath ? { filePath } : null;
}

export async function listMerchantDocuments(
  session: Session | null,
): Promise<MerchantDocumentRow[]> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const result = await pool.query<MerchantDocumentRow>(
    `
      select id::text, document_type, file_path, file_name, uploaded_at::text
      from merchant_documents
      where profile_id = $1::uuid
      order by uploaded_at desc
    `,
    [profile.id],
  );
  return result.rows;
}

export type AdminMerchantDocument = MerchantDocumentRow & {
  // Short-lived signed URL into the private merchant-documents bucket, or null
  // when storage is unconfigured / signing failed. Never expose the raw path.
  signedUrl: string | null;
};

/**
 * Admin read path for a merchant's KYC documents. Looks them up by the owning
 * profile (merchant_profile_id can be null for docs uploaded before the merchant
 * row existed - see the back-fill note above) and mints a short-TTL signed URL
 * for each so the admin can open them without the object paths leaking to the
 * browser. The page (an admin-gated server component) is the auth boundary.
 */
export async function getMerchantDocumentsForAdmin(
  merchantProfileId: string,
): Promise<AdminMerchantDocument[]> {
  const pool = getPostgresPool();
  if (!pool) return [];

  const result = await pool.query<MerchantDocumentRow>(
    `
      select d.id::text, d.document_type, d.file_path, d.file_name, d.uploaded_at::text
      from merchant_documents d
      where d.merchant_profile_id = $1::uuid
         or d.profile_id = (select profile_id from merchant_profiles where id = $1::uuid)
      order by d.uploaded_at desc
    `,
    [merchantProfileId],
  );

  // Sign each path (5-minute TTL). Best-effort: if storage isn't configured we
  // still return the metadata so the admin sees what was uploaded.
  let admin: ReturnType<typeof getSupabaseAdmin> | null = null;
  try {
    admin = getSupabaseAdmin();
  } catch {
    admin = null;
  }

  return Promise.all(
    result.rows.map(async (row) => {
      let signedUrl: string | null = null;
      if (admin) {
        try {
          const { data } = await admin.storage
            .from("merchant-documents")
            .createSignedUrl(row.file_path, 300);
          signedUrl = data?.signedUrl ?? null;
        } catch {
          signedUrl = null;
        }
      }
      return { ...row, signedUrl };
    }),
  );
}

/**
 * Merchant self-service for the CONTACTABLE half of a business profile: how we
 * and our members reach the host, and where their venue is.
 *
 * Deliberately NOT the identity half. business_name, trading_name, abn and acn
 * are what an admin verified when they approved this merchant, and
 * address_state / address_postcode decide whether the venue is inside the
 * launch pilot - letting an approved host rewrite any of those turns one
 * approval into a different business with the same trust. Those stay with
 * support, and the Settings note says so instead of claiming the whole thing
 * "ships with merchant self-service".
 *
 * Every field is optional: an omitted key leaves the column alone, so a form
 * that only changes a phone number cannot blank a website.
 */
export async function updateMerchantContactDetails(
  input: {
    contactEmail?: string;
    phone?: string;
    websiteUrl?: string;
    addressStreet?: string;
    socials?: Partial<Record<"instagram" | "tiktok" | "facebook" | "youtube" | "x", string>>;
  },
  session: Session | null,
): Promise<MerchantProfileRow> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const merchant = await getMerchantProfile(pool, profile.id);
  if (!merchant) throw authError("Merchant profile required.");

  // Validated with the SAME helpers the signup wizard uses, so a value that is
  // refused at signup cannot be introduced afterwards through this door.
  const contactEmail =
    input.contactEmail !== undefined ? input.contactEmail.trim() : undefined;
  if (contactEmail !== undefined) {
    if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      const error = new Error("Enter a valid contact email.");
      error.name = "ValidationError";
      throw error;
    }
  }

  let phone: string | undefined;
  if (input.phone !== undefined) {
    const phoneError = validateAuPhone(input.phone);
    if (phoneError) {
      const error = new Error(phoneError);
      error.name = "ValidationError";
      throw error;
    }
    phone = normalizeAuPhone(input.phone);
  }

  let websiteUrl: string | null | undefined;
  if (input.websiteUrl !== undefined) {
    const trimmed = input.websiteUrl.trim();
    if (!trimmed) {
      websiteUrl = null;
    } else {
      const normalized = normalizeWebsiteUrl(trimmed);
      if (normalized.error) {
        const error = new Error(normalized.error);
        error.name = "ValidationError";
        throw error;
      }
      websiteUrl = normalized.url || null;
    }
  }

  const addressStreet =
    input.addressStreet !== undefined ? input.addressStreet.trim() : undefined;

  const result = await pool.query<MerchantProfileRow>(
    `
      update merchant_profiles
      set contact_email = coalesce($2, contact_email),
          phone = coalesce($3, phone),
          -- Website is the one field a host can deliberately CLEAR, so it takes
          -- a separate "did they send it" flag rather than treating null as
          -- "unchanged" like the others.
          website_url = case when $4::boolean then $5 else website_url end,
          address_street = coalesce($6, address_street),
          socials = case when $7::boolean then $8::jsonb else socials end,
          updated_at = now()
      where id = $1::uuid
      returning
        id::text,
        business_name,
        contact_email::text as contact_email,
        verification_status::text as verification_status,
        business_type::text as business_type,
        stripe_connect_account_id,
        charges_enabled,
        payouts_enabled,
        details_submitted,
        onboarding_completed_at::text as onboarding_completed_at,
        auto_approve_events,
        address_state,
        address_postcode
    `,
    [
      merchant.id,
      contactEmail ?? null,
      phone ?? null,
      websiteUrl !== undefined,
      websiteUrl ?? null,
      addressStreet || null,
      input.socials !== undefined,
      input.socials ? JSON.stringify(input.socials) : null,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    const error = new Error("Merchant profile not found.");
    error.name = "NotFoundError";
    throw error;
  }
  return row;
}

/** The self-editable fields, for pre-filling the Settings form. */
export async function getMerchantContactDetails(session: Session | null): Promise<{
  contactEmail: string;
  phone: string;
  websiteUrl: string;
  addressStreet: string;
  addressSuburb: string;
  addressState: string;
  addressPostcode: string;
  abn: string;
  tradingName: string;
  socials: Record<string, string>;
} | null> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!pool || !email) return null;

  const profile = await ensureProfileForSession(session);
  const merchant = await getMerchantProfile(pool, profile.id);
  if (!merchant) return null;

  const result = await pool.query<{
    contact_email: string | null;
    phone: string | null;
    website_url: string | null;
    address_street: string | null;
    address_suburb: string | null;
    address_state: string | null;
    address_postcode: string | null;
    abn: string | null;
    trading_name: string | null;
    socials: Record<string, string> | null;
  }>(
    `
      select contact_email::text as contact_email, phone, website_url,
             address_street, address_suburb, address_state, address_postcode,
             abn, trading_name, socials
      from merchant_profiles
      where id = $1::uuid
      limit 1
    `,
    [merchant.id],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    contactEmail: row.contact_email ?? "",
    phone: row.phone ?? "",
    websiteUrl: row.website_url ?? "",
    addressStreet: row.address_street ?? "",
    addressSuburb: row.address_suburb ?? "",
    addressState: row.address_state ?? "",
    addressPostcode: row.address_postcode ?? "",
    abn: row.abn ?? "",
    tradingName: row.trading_name ?? "",
    socials: row.socials ?? {},
  };
}

export async function registerMerchantWizardSubmit(
  input: MerchantWizardInput,
  session: Session | null,
): Promise<MerchantProfileRow> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const businessName = input.businessName.trim();
  if (businessName.length < 2 || businessName.length > 100) {
    throw validationError("Business name must be 2 - 100 characters.", "businessName");
  }

  const tradingName = input.tradingName.trim();
  const contactEmail = input.contactEmail.trim().toLowerCase();
  if (!contactEmail || !contactEmail.includes("@")) {
    throw validationError("A valid contact email is required.", "contactEmail");
  }

  // ABN is optional for now - only validate format/checksum when supplied.
  const abnError = validateOptionalAbn(input.abn);
  if (abnError) throw validationError(abnError, "abn");
  const abn = normalizeAbn(input.abn);

  const acnError = validateOptionalAcn(input.acn);
  if (acnError) throw validationError(acnError, "acn");
  const acn = normalizeAcn(input.acn);

  if (!AU_STATES.includes(input.addressState)) {
    throw validationError("Pick an Australian state.", "addressState");
  }

  const postcode = input.addressPostcode.trim();
  if (!AU_POSTCODE_RE.test(postcode)) {
    throw validationError("Postcode must be 4 digits.", "addressPostcode");
  }

  // Same rule the wizard runs, from the same module - the server used to accept
  // only a 10-digit mobile/landline, so a 1300 or 13 line the wizard had just
  // called valid died here with a message two steps from the field.
  const phoneError = validateAuPhone(input.phone);
  if (phoneError) throw validationError(phoneError, "phone");
  const phoneDigits = normalizeAuPhone(input.phone);

  const street = input.addressStreet.trim();
  const suburb = input.addressSuburb.trim();
  if (!street) throw validationError("Add the street address.", "addressStreet");
  if (!suburb) throw validationError("Add the suburb.", "addressSuburb");

  // Socials are optional - keep only known platforms that carry a handle.
  const socials: Record<string, string> = {};
  for (const platform of MERCHANT_SOCIAL_PLATFORMS) {
    const handle = (input.socials[platform] ?? "").trim();
    if (handle) socials[platform] = handle;
  }

  const categoryIds = Array.from(new Set(input.eventCategoryIds.filter(Boolean)));
  if (categoryIds.length === 0) {
    throw validationError("Pick at least one event category.", "eventCategoryIds");
  }

  const profile = await ensureProfileForSession(session);

  const client = await pool.connect();
  try {
    await client.query("begin");

    // The status BEFORE the upsert. RETURNING only ever hands back the new row,
    // and the upsert's own CASE flips rejected → pending, so this is the only
    // way to tell "a rejected host just resubmitted" apart from "an already-
    // pending host edited a field". The first has to reach the admin queue; the
    // second must not spam it.
    const priorStatus = await client.query<{ verification_status: string }>(
      `select verification_status from merchant_profiles where profile_id = $1::uuid`,
      [profile.id],
    );
    const wasRejected = priorStatus.rows[0]?.verification_status === "rejected";

    const upsert = await client.query<MerchantProfileRow & { is_new: boolean }>(
      `
        insert into merchant_profiles (
          profile_id, business_name, trading_name, abn, acn, business_type,
          phone, contact_email, website_url, socials,
          address_street, address_suburb, address_state, address_postcode,
          submitted_at, host_agreement_accepted_at,
          host_terms_version, refund_policy_version
        )
        values (
          $1::uuid, $2, nullif($3, ''), $4, nullif($5, ''), $6,
          $7, $8, nullif($9, ''), $10::jsonb,
          $11, $12, $13, $14,
          now(), now(), $15, $16
        )
        on conflict (profile_id) do update set
          business_name = excluded.business_name,
          trading_name = excluded.trading_name,
          abn = excluded.abn,
          acn = excluded.acn,
          -- coalesce, not a bare overwrite: this upsert also runs for edits that
          -- don't carry every field, and assigning excluded.business_type
          -- directly wiped a good value back to null whenever the caller omitted
          -- it. Null here means "unchanged", which is what a partial edit means;
          -- the wizard now always sends a real value, so it can still change it.
          business_type = coalesce(excluded.business_type, merchant_profiles.business_type),
          phone = excluded.phone,
          contact_email = excluded.contact_email,
          website_url = excluded.website_url,
          socials = excluded.socials,
          address_street = excluded.address_street,
          address_suburb = excluded.address_suburb,
          address_state = excluded.address_state,
          address_postcode = excluded.address_postcode,
          -- A rejected merchant editing + resubmitting must re-enter the admin
          -- review queue, so flip rejected → pending and refresh the submitted
          -- timestamp. Approved/pending rows keep their status untouched (this
          -- upsert also runs for edits that shouldn't change review state).
          verification_status = case
            when merchant_profiles.verification_status = 'rejected' then 'pending'
            else merchant_profiles.verification_status
          end,
          submitted_at = case
            when merchant_profiles.verification_status = 'rejected' then now()
            else coalesce(merchant_profiles.submitted_at, now())
          end,
          -- Submitting is the affirmative action named by the disclosure directly
          -- under the button. Record the exact legal versions attached to this
          -- submission so support can later answer what the host agreed to.
          host_agreement_accepted_at = now(),
          host_terms_version = excluded.host_terms_version,
          refund_policy_version = excluded.refund_policy_version,
          updated_at = now()
        returning id::text, business_name, contact_email::text, verification_status,
          business_type, stripe_connect_account_id, charges_enabled, payouts_enabled,
          details_submitted, onboarding_completed_at::text, address_state,
          address_postcode, (xmax = 0) as is_new
      `,
      [
        profile.id,
        businessName,
        tradingName,
        abn,
        acn,
        input.businessType ?? null,
        phoneDigits,
        contactEmail,
        input.websiteUrl.trim(),
        JSON.stringify(socials),
        street,
        suburb,
        input.addressState,
        postcode,
        HOST_TERMS_VERSION,
        REFUND_POLICY_VERSION,
      ],
    );

    const merchantId = upsert.rows[0].id;

    // Replace categories - small set, simpler than diffing.
    await client.query(
      `delete from merchant_event_categories where merchant_profile_id = $1::uuid`,
      [merchantId],
    );
    await client.query(
      `
        insert into merchant_event_categories (merchant_profile_id, tag_category_id)
        select $1::uuid, cat_id::uuid
        from unnest($2::text[]) as cat_id
        on conflict do nothing
      `,
      [merchantId, categoryIds],
    );

    // All documents are optional at signup - admins can request follow-ups
    // during verification. Just back-fill merchant_profile_id on any docs the
    // user did upload before this commit.
    await client.query(
      `
        update merchant_documents
        set merchant_profile_id = $1::uuid
        where profile_id = $2::uuid and merchant_profile_id is null
      `,
      [merchantId, profile.id],
    );

    if (profile.role === "attendee") {
      await client.query(
        `update profiles set role = 'merchant', updated_at = now() where id = $1::uuid`,
        [profile.id],
      );
    }

    await client.query("commit");

    // First submission (xmax = 0), OR a rejected host resubmitting after fixing
    // what the admin flagged. Both put an application into the review queue, so
    // both owe the host a confirmation and the admins a notification.
    //
    // This used to be `is_new` alone, which meant a resubmission wrote no
    // email_events row and pinged no admin - while /merchant-pending promised
    // "your application goes back into the admin queue and we'll email you the
    // outcome". The application then sat invisible until someone happened to
    // open /admin/merchants, which is exactly the polling this notification
    // exists to remove. An edit by an already-pending or approved host still
    // fires nothing, which is the point of gating on wasRejected.
    const resubmitted = !upsert.rows[0].is_new && wasRejected;
    if (upsert.rows[0].is_new || resubmitted) {
      const origin = emailOrigin();
      const merchantFirstName =
        (profile.display_name || businessName).split(/\s+/)[0] || "there";
      const submittedDate = new Intl.DateTimeFormat("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Australia/Sydney",
      }).format(new Date());
      // Outside the launch pilot (Greater Sydney): the venue can't go live yet,
      // so we park the host on the waitlist and email them rather than running
      // them through verification for a region we don't serve. The email_events
      // row IS the waitlist record (the dev/staging inbox + audit trail).
      const withinPilot = isWithinPilotArea(input.addressState, postcode);
      if (!withinPilot) {
        await logEmailEvent({
          template: "merchant-waitlisted-merchant",
          toEmail: contactEmail,
          toProfileId: profile.id,
          vars: {
            merchantFirstName,
            businessName,
            suburb: suburb || input.addressState,
            pilotArea: PILOT_AREA_LABEL,
            supportEmail: SUPPORT_EMAIL,
            unsubscribeUrl: `${origin}/account-settings`,
          },
        });
      } else {
        await logEmailEvent({
          template: "merchant-application-received",
          toEmail: contactEmail,
          toProfileId: profile.id,
          vars: {
            merchantFirstName,
            businessName,
            submittedDate,
            merchantDashboardUrl: `${origin}/merchant`,
            supportEmail: SUPPORT_EMAIL,
            unsubscribeUrl: `${origin}/account-settings`,
          },
        });
      }

      // Notify every admin that a new merchant is awaiting verification, so the
      // verification queue surfaces in their bell without polling /admin/merchants.
      // Fire-and-forget, post-commit - a notification hiccup must not fail signup.
      void pool
        .query(
          `
            insert into notifications (profile_id, title, body, action_url)
            select id, $1, $2, $3
            from profiles
            where role = 'admin'
          `,
          [
            !withinPilot
              ? "New merchant on the waitlist (outside pilot)"
              : resubmitted
                ? "Merchant resubmitted after rejection"
                : "New merchant awaiting verification",
            !withinPilot
              ? `${businessName} signed up from ${suburb || input.addressState}, outside the ${PILOT_AREA_LABEL} pilot - parked on the host waitlist.`
              : resubmitted
                ? `${businessName} fixed their application and it's back in the queue.`
                : `${businessName} just signed up and is waiting for verification.`,
            "/admin/merchants",
          ],
        )
        .catch((error) => {
          console.warn("Failed to notify admins of new merchant signup.", error);
        });
    }

    return upsert.rows[0];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function toggleBookmark(eventId: string, session: Session | null, save: boolean) {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const eventRow = await pool.query<{ id: string }>(
    `select id::text from events where slug = $1`,
    [eventId],
  );

  if (eventRow.rows.length === 0) {
    const error = new Error("Event not found.");
    error.name = "NotFoundError";
    throw error;
  }

  const eventUuid = eventRow.rows[0].id;

  if (save) {
    await pool.query(
      `
        insert into bookmarks (event_id, profile_id)
        values ($1::uuid, $2::uuid)
        on conflict do nothing
      `,
      [eventUuid, profile.id],
    );
  } else {
    await pool.query(
      `delete from bookmarks where event_id = $1::uuid and profile_id = $2::uuid`,
      [eventUuid, profile.id],
    );
  }

  return { saved: save };
}

// §6.1 R_NOT_ELIGIBLE - the ONE refusal every receiver-state check is allowed to
// produce. Underage, banned, opted out of the social graph, paused, blocking (or
// blocked by) the sender, inside a "not feeling it" suppression, not actually at the
// event, hidden from that event's attendee list, or simply not a real profile id: all
// of it collapses to this. One string, one error name, one HTTP status - so no pair of
// requests can separate "they're unavailable" from "they weren't there" from "there's
// no such person". Built here rather than inlined so a future edit can't drift one
// call site's wording and quietly reopen the channel.
function notEligibleError() {
  const error = new Error("This person isn't available to click with right now.");
  error.name = "ValidationError";
  return error;
}

/**
 * Run work AFTER the response has been handed back, so how long it takes can never
 * be read off the reply. `after` is the Next primitive for this: it keeps the
 * serverless instance alive until the callback settles, which a bare floating
 * promise does not. Outside a request scope it throws synchronously (scripts, unit
 * runs, a direct repository call), and there a plain floating promise is right -
 * nothing is about to freeze the process.
 */
function afterResponse(work: () => Promise<void>) {
  try {
    after(work);
  } catch {
    void work().catch(() => {});
  }
}

async function sendClickInner(
  input: {
    clickedProfileId: string;
    sourceEventId?: string;
    /**
     * §6.9 post-event swap: the receiver of a still-pending post-event click at this
     * same event that the sender wants to release, freeing its budget slot for the
     * person they are clicking now. Runs INSIDE this transaction on purpose - the
     * per-event cap count already excludes 'invalidated' rows, so releasing before
     * the cap check frees exactly one slot with no special-casing, and the whole
     * thing is atomic: a failure anywhere cannot spend the one swap and lose the
     * click. Only meaningful on the post-event surface.
     */
    releaseReceiverId?: string;
  },
  session: Session | null,
) {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const client = await pool.connect();

  try {
    await client.query("begin");

    // §4 mutual-detection race: serialize all click activity for this *pair* on a
    // deterministic advisory lock taken before any read. Under READ COMMITTED the
    // FOR UPDATE reciprocal check alone is not enough - two perfectly-interleaved
    // reciprocal clicks can each commit before the other's select sees it, yielding
    // ZERO mutuals. The per-pair xact lock makes the second clicker block until the
    // first commits, so it always sees the committed reciprocal and forms exactly one
    // mutual (the partial-unique index then guarantees never two). Lock is keyed on the
    // ordered pair, so A→B and B→A contend on the same key; released at commit/rollback.
    const [pairLo, pairHi] = [profile.id, input.clickedProfileId].sort();
    await client.query(`select pg_advisory_xact_lock(hashtext($1)::bigint)`, [
      `click-pair:${pairLo}:${pairHi}`,
    ]);

    const clickedResult = await client.query<{
      id: string;
      display_name: string;
      email: string | null;
      age: number | null;
      is_banned: boolean;
      social_visible: boolean;
      paused_until: string | null;
      default_attend_visibility: boolean;
    }>(
      `
        select id::text, display_name, email::text, age, is_banned, social_visible,
               paused_until::text, default_attend_visibility
        from profiles
        where id = $1::uuid
        limit 1
      `,
      [input.clickedProfileId],
    );


    const clickedProfile = clickedResult.rows[0];
    if (!clickedProfile) {
      // NOT a 404. "That profile id doesn't exist" and "that person isn't
      // available to you" have to be the same answer, or the send endpoint is a
      // profile-existence oracle: a 404 vs a 400 tells an attacker which of the
      // ids they're walking are real accounts. Same string, same error name, same
      // status as every other receiver-state refusal below (§6.1 R_NOT_ELIGIBLE).
      throw notEligibleError();
    }
    if (clickedProfile.id === profile.id) {
      const error = new Error("You cannot Click yourself.");
      error.name = "ValidationError";
      throw error;
    }

    // Sender eligibility fields: age (independent age gate §6.7b), photo (R_PHOTO),
    // and the active intent the click is sent under (rule 6 - snapshotted onto the row).
    const senderResult = await client.query<{
      age: number | null;
      photo_url: string | null;
      is_banned: boolean;
      suspended_at: string | null;
      connection_intents: string[] | null;
      post_event_click_suppressed_until: string | null;
    }>(
      `select age, photo_url, is_banned, suspended_at::text,
              connection_intents::text[] as connection_intents,
              post_event_click_suppressed_until::text
         from profiles where id = $1::uuid limit 1`,
      [profile.id],
    );
    const sender = senderResult.rows[0];
    const senderIntent = sender?.connection_intents?.[0] ?? "friendship";

    // SAFE-06 hardening: a banned (or suspended) user must not be able to INITIATE new
    // clicks - the ban/suspend teardown only severs EXISTING coordination, so without
    // this gate a still-logged-in banned user could POST a fresh click and, if reciprocated,
    // form a new mutual that re-injects them into the social graph. Checked before any
    // receiver state so it never leaks the target's state (it's purely about the sender).
    if (sender?.is_banned || sender?.suspended_at) {
      const error = new Error("Your account can't send clicks right now.");
      error.name = "ValidationError";
      throw error;
    }

    // Age gate (§6.7b - non-negotiable, defence-in-depth on the highest-risk surface).
    // Asserted in the click layer independently of the signup gate: a sub-18 account
    // (data error / region defining minor >18) cannot send or receive a click, full stop.
    //
    // The two arms answer DIFFERENTLY on purpose, and the split is the whole point.
    // The receiver's age is receiver state, so it collapses into R_NOT_ELIGIBLE with
    // every other receiver refusal. The sender's age is the sender's OWN state - which
    // the ban/suspend gate a few lines up already treats as safe to name - and folding
    // it into the neutral string was actively harmful: `age` is nullable and
    // ensureProfileForSession never writes it, so every magic-link account that skipped
    // /onboarding (both admin logins included) coalesced to 0, failed this gate on every
    // send, and was told "This person isn't available to click with right now." That
    // blames the person they clicked, and reads to a tester as "clicking is broken".
    // Naming the sender's own missing field costs nothing in the §6.1 byte-identical
    // contract - it discloses nothing about the receiver - and the SEND_CLICK_FLOOR_MS
    // floor in createUserClickForSession already equalises the latency.
    if ((sender?.age ?? 0) < MIN_CLICK_AGE) {
      const error = new Error(
        "Add your date of birth in your profile before you can click with anyone.",
      );
      error.name = "ValidationError";
      throw error;
    }
    if ((clickedProfile.age ?? 0) < MIN_CLICK_AGE) {
      throw notEligibleError();
    }

    // Receiver eligibility (§6.7a ban, §B7.4 social opt-out / pause). A banned, opted-out,
    // or paused receiver is not in the social graph - refused with a single neutral reason
    // that never discloses which (the byte-identical R_NOT_ELIGIBLE contract, 21A, lands in
    // the 2.2 safety pass; this is the structural refusal it builds on).
    if (
      clickedProfile.is_banned ||
      !clickedProfile.social_visible ||
      (clickedProfile.paused_until && new Date(clickedProfile.paused_until) > new Date())
    ) {
      throw notEligibleError();
    }

    const blockResult = await client.query<{ blocked: boolean }>(
      `
        select exists (
          select 1 from user_blocks
          where (blocker_profile_id = $1::uuid and blocked_profile_id = $2::uuid)
             or (blocker_profile_id = $2::uuid and blocked_profile_id = $1::uuid)
        ) as blocked
      `,
      [profile.id, clickedProfile.id],
    );
    if (blockResult.rows[0]?.blocked) {
      throw notEligibleError();
    }

    const suppressionResult = await client.query<{ suppressed: boolean }>(
      `
        select exists (
          select 1 from pair_suppressions
          where expires_at > now()
            and ((user_a_id = $1::uuid and user_b_id = $2::uuid)
              or (user_a_id = $2::uuid and user_b_id = $1::uuid))
        ) as suppressed
      `,
      [profile.id, clickedProfile.id],
    );
    if (suppressionResult.rows[0]?.suppressed) {
      throw notEligibleError();
    }

    // Two click processes, two surfaces (§1, §2). The surface is decided by whether a
    // source event is supplied - never by anything the receiver can influence:
    //  • Process 1 - discovery "Click with someone" (no source event): anonymous,
    //    person-bound (event_id NULL), live 7 days from creation (§5).
    //  • Process 2 - post-event "Who was there" (a source event slug arrives): event-
    //    bound, attendance-gated, live from event_end until event_end + 48h (§5, §7B).
    //    Supersedes the old +12h gate (TW-3/TW-4).
    let surface: "discovery" | "who_was_there";
    let eventId: string | null = null;
    let expiresAt: Date;

    if (input.sourceEventId) {
      surface = "who_was_there";
      // §B7.3: repeated free-event no-shows cost you the post-event surface for 30
      // days. Payment is the commitment, so this is the only lever a free booking
      // has. The sender's OWN state, like the ban and age gates above - naming it
      // discloses nothing about the receiver, and a person who cannot act on a
      // silent refusal just reads the button as broken.
      if (
        sender?.post_event_click_suppressed_until &&
        new Date(sender.post_event_click_suppressed_until) > new Date()
      ) {
        throw validationError(
          "You can't click people from events right now - a couple of free spots you booked went unused. This lifts on its own.",
        );
      }
      // TWO queries on purpose, and the split is the whole point. The event's own
      // clock is public - anyone can read its end time off the event page - so
      // "the window has closed" is safe to say plainly, and saying it is the only
      // way the surface can explain itself. WHO was at the event is not public, so
      // it must never get its own answer: it collapses into R_NOT_ELIGIBLE with
      // every other receiver-state refusal.
      //
      // Fused into one query (as it was), the two leaked into each other: on an
      // event whose window the sender can see is open, and which they know they
      // attended themselves, a "window closed" reply could only mean the receiver
      // wasn't there - while a blocked/banned/paused receiver replied with the
      // neutral string. Two requests, and attendance falls out of the difference.
      const windowResult = await client.query<{ id: string; event_end: string }>(
        `
          select e.id::text, coalesce(e.ends_at, e.starts_at)::text as event_end
          from events e
          where e.slug = $1
            and coalesce(e.ends_at, e.starts_at) <= now()
            and coalesce(e.ends_at, e.starts_at) + interval '${POST_EVENT_CLICK_WINDOW_HOURS} hours' > now()
          order by coalesce(e.ends_at, e.starts_at) desc
          limit 1
        `,
        [input.sourceEventId],
      );
      const eligible = windowResult.rows[0];
      if (!eligible) {
        const error = new Error(
          "The window to click people from this event has closed - it opens when the event ends and stays open 48 hours.",
        );
        error.name = "ValidationError";
        throw error;
      }

      // Both sides were actually there, and the receiver hasn't hidden themselves
      // from that event's attendee list. event_participants_v, not event_attendees:
      // someone who claimed a guest +1 has no attendee row of their own (their seat
      // lives on the purchaser's booking), so gating on event_attendees made them
      // unclickable AND unable to click - they attended, but the mechanic could not
      // see them in either direction. See migration 056.
      //
      // A hidden receiver refuses byte-identically to one who wasn't there: the
      // opt-out is worthless if the send endpoint can distinguish the two.
      const pairResult = await client.query<{ ok: boolean }>(
        `
          select true as ok
          from event_participants_v a1
          join event_participants_v a2
            on a2.event_id = a1.event_id and a2.profile_id = $3::uuid
          where a1.event_id = $1::uuid and a1.profile_id = $2::uuid
          limit 1
        `,
        [eligible.id, profile.id, clickedProfile.id],
      );
      if (!pairResult.rows[0]?.ok || !clickedProfile.default_attend_visibility) {
        throw notEligibleError();
      }
      eventId = eligible.id;
      expiresAt = new Date(
        new Date(eligible.event_end).getTime() + POST_EVENT_CLICK_WINDOW_HOURS * 3600_000,
      );
    } else {
      surface = "discovery";
      expiresAt = new Date(Date.now() + DISCOVERY_CLICK_WINDOW_DAYS * 86400_000);
    }

    // A still-pending click to this person on this surface = a duplicate send: quiet
    // success, budget not re-spent (§6.1 P4). Detected before the cap check so a
    // re-click never trips "you're at your cap".
    const surfaceMatch = surface === "discovery" ? "event_id is null" : "event_id = $3::uuid";
    const matchParams =
      surface === "discovery"
        ? [profile.id, clickedProfile.id]
        : [profile.id, clickedProfile.id, eventId];
    const existing = await client.query(
      `select 1 from clicks
        where sender_id = $1::uuid and receiver_id = $2::uuid
          and status = 'pending' and ${surfaceMatch}
        limit 1`,
      matchParams,
    );
    const isDuplicate = existing.rows.length > 0;

    // §6.9 the post-event swap. "Within the 48h window the user may release one of
    // their own still-pending post-event clicks for this event and re-spend it" -
    // clicked the wrong person, or met someone better later in the window. Hard
    // rules, in order:
    //   (a) only a PENDING post-event click is releasable; a mutual never is
    //   (b) exactly one swap per sender per event (click_swaps' primary key)
    //   (c) the released receiver is never notified - nothing below writes to them
    //   (d) R_OK either way, at the same timing floor (the wrapper owns that)
    let releasedClickId: string | null = null;
    if (input.releaseReceiverId) {
      if (surface !== "who_was_there") {
        // Discovery has a rolling cap, not an event budget - nothing to swap.
        throw validationError("Swapping only applies to clicks from an event.");
      }
      if (input.releaseReceiverId === clickedProfile.id) {
        throw validationError("Pick a different person to swap out.");
      }
      if (isDuplicate) {
        // Nothing to swap INTO - they already hold a click at this person here.
        throw validationError("You've already clicked with them at this event.");
      }
      const priorSwap = await client.query(
        `select 1 from click_swaps where sender_id = $1::uuid and event_id = $2::uuid limit 1`,
        [profile.id, eventId],
      );
      if (priorSwap.rows.length > 0) {
        throw validationError("You've already swapped a click for this event.");
      }
      // Naming this refusal is safe. A click that is no longer 'pending' has either
      // gone mutual - which both sides were already told about, and which the roster
      // itself renders as "you two clicked" - or lapsed with the window. So the
      // sender learns nothing here they do not already hold.
      const released = await client.query<{ id: string }>(
        `update clicks set status = 'invalidated', updated_at = now()
          where sender_id = $1::uuid and receiver_id = $2::uuid
            and event_id = $3::uuid and status = 'pending'
          returning id::text`,
        [profile.id, input.releaseReceiverId, eventId],
      );
      releasedClickId = released.rows[0]?.id ?? null;
      if (!releasedClickId) {
        throw validationError("That click can't be swapped any more.");
      }
    }

    if (!isDuplicate) {
      // Cap check inside the transaction, by process (§2 rule 5). Invalidated rows
      // refund budget (they're excluded from the post-event count).
      const capResult =
        surface === "who_was_there"
          ? await client.query<{ n: number }>(
              `select count(*)::int as n from clicks
                where sender_id = $1::uuid and event_id = $2::uuid and status <> 'invalidated'`,
              [profile.id, eventId],
            )
          : await client.query<{ n: number }>(
              `select count(*)::int as n from clicks
                where sender_id = $1::uuid and event_id is null
                  and status = 'pending' and expires_at > now()`,
              [profile.id],
            );
      const used = Number(capResult.rows[0]?.n ?? 0);
      const cap = surface === "who_was_there" ? POST_EVENT_CLICK_CAP : DISCOVERY_CLICK_CAP;
      if (used >= cap) {
        const error = new Error(
          surface === "who_was_there"
            ? `You've used your ${POST_EVENT_CLICK_CAP} clicks for this event already.`
            : "You've reached your live-click limit for now - see how a few play out first.",
        );
        error.name = "ValidationError";
        throw error;
      }
    }

    const inserted = await client.query<{ id: string }>(
      `
        insert into clicks (sender_id, receiver_id, event_id, intent_mode, surface, status, expires_at)
        values ($1::uuid, $2::uuid, $3::uuid, $4, $5, 'pending', $6::timestamptz)
        on conflict do nothing
        returning id::text
      `,
      [profile.id, clickedProfile.id, eventId, senderIntent, surface, expiresAt.toISOString()],
    );

    // §6.9(b): one swap per sender per event, which is click_swaps' primary key -
    // recorded only once the replacement click actually exists, so a swap can never
    // be spent on a send that did not land. The duplicate guard above means the
    // insert cannot have conflicted on this path.
    if (releasedClickId) {
      const newClickId = inserted.rows[0]?.id;
      if (!newClickId) {
        throw validationError("That click can't be swapped any more.");
      }
      await client.query(
        `insert into click_swaps (sender_id, event_id, released_click_id, new_click_id)
         values ($1::uuid, $2::uuid, $3::uuid, $4::uuid)`,
        [profile.id, eventId, releasedClickId, newClickId],
      );
    }

    // §4 mutual detection - lock the reciprocal pending row FOR UPDATE, matching WITHIN
    // the same process (discovery↔discovery, or post-event on the SAME event). Two
    // concurrent reciprocal clicks each block on the other's row → exactly one mutual.
    const reciprocalResult = await client.query<{ id: string; intent_mode: string }>(
      `
        select id::text, intent_mode
        from clicks
        where sender_id = $1::uuid
          and receiver_id = $2::uuid
          and status = 'pending'
          and expires_at > now()
          and ${surfaceMatch}
        order by created_at
        limit 1
        for update
      `,
      matchParams.length === 3
        ? [clickedProfile.id, profile.id, eventId]
        : [clickedProfile.id, profile.id],
    );

    const reciprocalClick = reciprocalResult.rows[0] ?? null;
    // Set only when THIS send is the one that formed the mutual. Declared out here
    // so the post-commit notification work can be gated on it: a reciprocal click
    // arriving while a mutual is already live is a no-op (§2 rule 6), and gating
    // that work on `reciprocalClick` instead sent the "it's mutual" email again
    // every time - to a pair who had already had it.
    let freshMutualId: string | null = null;
    let suggestedEvent:
      | {
          id: string;
          slug: string;
          title: string;
        }
      | null = null;

    if (reciprocalClick) {
      // The post-event source event is always in the past (you click after it ends), so
      // the preferred-event reuse below almost always falls through to the shared-interest
      // future-event query - kept only for the rare still-future case.
      const preferredEventId = eventId;
      if (preferredEventId) {
        // The "preferred" event is the one they both attended that unlocked the
        // Click - which is ALWAYS in the past (clicking is gated to 12h after an
        // event ends). Only reuse it as the suggestion if it somehow still lies
        // in the future and is bookable; otherwise fall through to the
        // shared-interest future-event query below so we never suggest an event
        // that has already happened.
        const preferredResult = await client.query<{
          id: string;
          slug: string;
          title: string;
        }>(
          `
            select id::text, slug, title
            from events event
            where id = $1::uuid
              and status in ('live', 'featured')
              and starts_at > now()
              -- §B3.4 / CAP-1/2/4: a suggested PAIR plan needs room for BOTH. Read the
              -- canonical seat count (guest +1s + live holds netted) from event_capacity_v
              -- and require two free seats; full/waitlist events are excluded by status.
              and exists (
                select 1 from event_capacity_v cap
                where cap.event_id = event.id and cap.available >= 2
              )
            limit 1
          `,
          [preferredEventId],
        );
        suggestedEvent = preferredResult.rows[0] ?? null;
      }

      if (!suggestedEvent) {
        const suggestedResult = await client.query<{
          id: string;
          slug: string;
          title: string;
        }>(
          `
            select event.id::text, event.slug, event.title
            from events event
            -- INNER joins: only suggest events that share at least one INTEREST
            -- tag with one of the two members (per bug report: "only suggest
            -- future events with similar interest tags").
            join event_tags event_tag on event_tag.event_id = event.id
            join tags tag on tag.id = event_tag.tag_id and tag.tag_type = 'interest'
            join user_tags user_tag
              on user_tag.tag_id = tag.id
             and user_tag.profile_id in ($1::uuid, $2::uuid)
            where event.status in ('live', 'featured')
              -- §B3.2 lead-time floor. A bare starts_at > now() handed a pair who
              -- had just clicked a plan for an event starting in forty minutes -
              -- two seats they would have to agree on, book and travel to before
              -- the doors shut. The floor only binds what the SYSTEM offers
              -- unprompted; either of them can still propose tonight's thing by
              -- hand through the catalogue picker.
              and event.starts_at > now() + interval '${SUGGESTION_LEADTIME_FLOOR_HOURS} hours'
              -- ...and the §B3.2 ceiling that closes the same window. Not inert
              -- despite the starts_at-asc tiebreak: the sort puts BOTH-members'-tags
              -- above soonest, so an event six months out that matches them both
              -- outranked a fortnight-away one that matched only one. B7.2 leans on
              -- this window ("8 plans over 30 days is a full but human social
              -- calendar") - a suggestion outside it isn't a plan, it's a someday.
              and event.starts_at < now() + interval '${SUGGESTION_WINDOW_DAYS} days'
              -- §B3.4 / CAP-1/2/4: two free seats for the pair (guest +1s + live holds
              -- netted via event_capacity_v); full/waitlist excluded by status.
              and exists (
                select 1 from event_capacity_v cap
                where cap.event_id = event.id and cap.available >= 2
              )
            group by event.id
            order by
              -- Prefer a genuinely new shared plan: rank events that neither of
              -- them has already RSVP'd to ahead of ones one of them is on, then
              -- events that align with BOTH members' interests (bug board: a
              -- mutual-click suggestion should hit shared interests where it
              -- can - falls back to a single-member match when none align with
              -- both), then by interest overlap, then soonest.
              (exists (
                 select 1 from event_attendees ea
                 where ea.event_id = event.id
                   and ea.profile_id in ($1::uuid, $2::uuid)
                   and ea.status in ('confirmed', 'waitlisted', 'pending_payment')
               )) asc,
              (count(distinct user_tag.profile_id) = 2) desc,
              count(distinct user_tag.tag_id) desc,
              event.starts_at asc
            limit 1
          `,
          [profile.id, clickedProfile.id],
        );
        suggestedEvent = suggestedResult.rows[0] ?? null;
      }

      // Intent snapshot, ordered to match user_a = least(pair), user_b = greatest(pair)
      // (§8 - immutable for the life of the mutual).
      const intentA =
        profile.id < clickedProfile.id ? senderIntent : reciprocalClick.intent_mode;
      const intentB =
        profile.id < clickedProfile.id ? reciprocalClick.intent_mode : senderIntent;
      const mutualResult = await client.query<{ id: string }>(
        `
          insert into mutual_clicks
            (user_a_id, user_b_id, intent_a, intent_b, status, coord_state, mutual_at, expires_at)
          values (
            least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid),
            $3, $4, 'active', 'open', now(), now() + interval '${MUTUAL_CLOCK_DAYS} days'
          )
          on conflict (user_a_id, user_b_id) where status = 'active' do nothing
          returning id::text
        `,
        [profile.id, clickedProfile.id, intentA, intentB],
      );

      // No row back from the partial-unique conflict ⇒ a live mutual already exists for
      // this pair; reciprocal-while-active is a no-op (§2 rule 6) - leave everything be.
      const mutualClickId = mutualResult.rows[0]?.id ?? null;
      freshMutualId = mutualClickId;
      if (mutualClickId) {
        // Attach the system's first suggested event as the live coordination attempt so
        // /proposals keeps working against the new schema. The fuller propose/decline/
        // counter handshake (§B4) + read-time multi-suggestion generation land in 2.5.
        //
        // ONLY when something was actually suggestable. The catalogue routinely
        // has no upcoming event with 2+ free seats matching either person's tags
        // (the normal state at launch), and this used to insert the proposal
        // anyway with suggested_event_id = null, then advance coord_state to
        // 'proposed'. That projects as the "proposed" step: the receiver is asked
        // "{name}'s keen for the event - you in?" with no Confirm button to press,
        // because there is no event to confirm, while the sender is told "You're
        // in - waiting on {name}" having proposed nothing. Leaving the mutual at
        // 'open' renders the suggest picker instead, which is both honest and
        // actionable.
        if (suggestedEvent) {
          await client.query(
            `
              insert into click_proposals
                (mutual_click_id, suggested_event_id, proposed_by, status, expires_at)
              values (
                -- proposed_by stays NULL: nobody picked this, the catalogue did.
                -- Binding it to profile.id credited whoever happened to click
                -- second, and the drawer then hid BOTH Confirm and "Not this
                -- one" from them (coordination-drawer.tsx:670, :713) for an
                -- event they never chose, while telling the other side they had.
                $1::uuid, $2::uuid, null, 'pending', now() + interval '${MUTUAL_CLOCK_DAYS} days'
              )
              on conflict (mutual_click_id) where status = 'pending' do update
              set suggested_event_id =
                    coalesce(click_proposals.suggested_event_id, excluded.suggested_event_id),
                  updated_at = now()
            `,
            [mutualClickId, suggestedEvent.id],
          );
          // coord_state stays 'open'. 'proposed' means a PERSON proposed and the
          // other owes them an answer; a system suggestion owes nobody anything.
          // On 'open' the drawer renders the neutral "Here's a plan: {event}"
          // with Confirm live for both sides, which is what this always was.
        }
        // Mark both clicks of THIS process as mutual + link them to the relationship row.
        const updateSurfaceCond =
          surface === "discovery" ? "event_id is null" : "event_id = $4::uuid";
        await client.query(
          `
            update clicks
            set status = 'mutual', mutual_click_id = $3::uuid, updated_at = now()
            where status = 'pending'
              and ((sender_id = $1::uuid and receiver_id = $2::uuid)
                or (sender_id = $2::uuid and receiver_id = $1::uuid))
              and ${updateSurfaceCond}
          `,
          surface === "discovery"
            ? [profile.id, clickedProfile.id, mutualClickId]
            : [profile.id, clickedProfile.id, mutualClickId, eventId],
        );
      }

      // Notify each side of the mutual - only on a freshly-formed one, and only if the
      // recipient hasn't muted the other party. Title is the locked §5 push string.
      if (mutualClickId) {
        await client.query(
          `
            insert into notifications (profile_id, title, body, action_url)
            select $1::uuid, $3, $4, $5
            where not exists (
              select 1 from user_mutes
              where muter_profile_id = $1::uuid and muted_profile_id = $2::uuid
            )
          `,
          [
            profile.id,
            clickedProfile.id,
            // §5 locked mutual push (CLICK_LANGUAGE v14): names the person, drops "you two".
            `It's mutual - you clicked with ${clickedProfile.display_name}. ✨`,
            suggestedEvent
              ? `You and ${clickedProfile.display_name} clicked. ${suggestedEvent.title} could be your thing.`
              : `You and ${clickedProfile.display_name} clicked. Open your proposal to plan something.`,
            `/proposals?open=${mutualClickId}`,
          ],
        );
        await client.query(
          `
            insert into notifications (profile_id, title, body, action_url)
            select $1::uuid, $3, $4, $5
            where not exists (
              select 1 from user_mutes
              where muter_profile_id = $1::uuid and muted_profile_id = $2::uuid
            )
          `,
          [
            clickedProfile.id,
            profile.id,
            // §5 locked mutual push (CLICK_LANGUAGE v14): names the person, drops "you two".
            `It's mutual - you clicked with ${profile.display_name}. ✨`,
            suggestedEvent
              ? `You and ${profile.display_name} clicked. ${suggestedEvent.title} could be your thing.`
              : `You and ${profile.display_name} clicked. Open your proposal to plan something.`,
            `/proposals?open=${mutualClickId}`,
          ],
        );
      }
    }

    await client.query("commit");

    // Mutual click → log the "it's mutual" email for BOTH sides. Fire-and-forget
    // after commit (per the email-events contract) so a render hiccup can't roll
    // back the click. Previously no email was logged here, so the in-app
    // notification's "view email" viewer fell back to an unrelated email_events
    // row matched purely by timestamp - that's the "wrong email" bug.
    //
    // AWAITING this was the timing side-channel the constant-time floor exists to
    // close. logEmailEvent is `Promise<void>` and reads as fire-and-forget, but it
    // isn't: it loads a template off disk, INSERTs email_events, then awaits a
    // Resend fetch with no timeout, then UPDATEs the row - twice, once per side.
    // Only a mutual pays that cost, so the send that formed one took the 350ms
    // floor plus however long Resend felt like taking, and every other outcome took
    // exactly the floor. Response latency answered "did they click me back?" - the
    // one question §6.1 is built to refuse. Hand it to `after` instead: it runs once
    // the response is already on its way out, so the work still completes on the
    // serverless instance but contributes nothing measurable to the reply.
    if (freshMutualId) {
      const origin = emailOrigin();
      const proposalsUrl = `${origin}/proposals`;
      const suggestionLine = suggestedEvent
        ? `We even spotted an event you could go to together: ${suggestedEvent.title}. Open your proposal to lock in a time.`
        : "Open your proposal to pick an upcoming event and plan your first hangout - no awkward back-and-forth.";
      const firstNameOf = (name: string | null) =>
        (name || "").split(/\s+/)[0] || "there";
      const recipients: { email: string; profileId: string; firstName: string; otherName: string }[] =
        [];
      if (profile.email) {
        recipients.push({
          email: profile.email,
          profileId: profile.id,
          firstName: firstNameOf(profile.display_name),
          otherName: clickedProfile.display_name,
        });
      }
      if (clickedProfile.email) {
        recipients.push({
          email: clickedProfile.email,
          profileId: clickedProfile.id,
          firstName: firstNameOf(clickedProfile.display_name),
          otherName: profile.display_name,
        });
      }
      afterResponse(async () => {
        // One read for both sides. Default ON, matching every other sender's
        // coalesce(...,-true) idiom, so a profile that has never touched the
        // settings still hears about a mutual.
        const optedOut = new Set<string>();
        try {
          const prefs = await pool.query<{ id: string; wants: boolean }>(
            `
              select id::text,
                     coalesce((notification_prefs->>'mutualClick')::boolean, true) as wants
              from profiles
              where id = any($1::uuid[])
            `,
            [recipients.map((r) => r.profileId)],
          );
          for (const row of prefs.rows) {
            if (!row.wants) optedOut.add(row.id);
          }
        } catch {
          // A failed preference read must not silence a mutual - default to sending.
        }
        for (const to of recipients) {
          if (optedOut.has(to.profileId)) continue;
          await logEmailEvent({
            template: "mutual-click-attendee",
            toEmail: to.email,
            toProfileId: to.profileId,
            vars: {
              firstName: to.firstName,
              otherName: to.otherName,
              suggestionLine,
              proposalsUrl,
              supportEmail: SUPPORT_EMAIL,
              unsubscribeUrl: `${origin}/account-settings`,
            },
          });
        }
      });
    }

    // B7.4b - the click as a liveness test. Someone who has not opened the app in 30
    // days is quietly slipping out of discovery; a click toward them is the one honest
    // reason to email them, and it says "someone clicked with you" and NEVER who. That
    // anonymity is the whole §6.1 contract, so the template carries no sender variable
    // at all rather than relying on a copy review to keep one out.
    //
    // Skipped when this send formed a mutual: that pair already gets the mutual mail,
    // which is a better nudge and names more, and two emails off one click is noise.
    //
    // In afterResponse for the same reason the mutual mail is - it is a DB write plus a
    // provider call that only ONE outcome pays for, and paying for it inside the
    // response would answer "is the person I just clicked dormant?" by latency alone.
    //
    // The stamp and the eligibility test are one conditional UPDATE, so two concurrent
    // clicks toward the same dormant person cannot both claim the send. Re-armed only
    // by them actually returning (last_active_at overtaking the stamp), which makes it
    // exactly one mail per dormancy spell, however many people click them.
    if (!freshMutualId) {
      const receiverId = clickedProfile.id;
      const origin = emailOrigin();
      afterResponse(async () => {
        try {
          const claimed = await pool.query<{ email: string; display_name: string }>(
            `update profiles
                set reengagement_clicked_at = now()
              where id = $1::uuid
                and email is not null
                and social_visible = true
                and is_banned = false
                and suspended_at is null
                and (paused_until is null or paused_until <= now())
                and coalesce(last_active_at, created_at)
                    <= now() - interval '${INACTIVE_DOWNRANK_DAYS} days'
                and (reengagement_clicked_at is null
                  or reengagement_clicked_at < coalesce(last_active_at, created_at))
              returning email::text, display_name`,
            [receiverId],
          );
          const target = claimed.rows[0];
          if (!target) return;
          await logEmailEvent({
            template: "reengagement-click-attendee",
            toEmail: target.email,
            toProfileId: receiverId,
            vars: {
              firstName: (target.display_name || "").split(/\s+/)[0] || "there",
              peopleUrl: `${origin}/people`,
              supportEmail: SUPPORT_EMAIL,
              unsubscribeUrl: `${origin}/account-settings`,
            },
          });
        } catch {
          // A liveness nudge is never worth surfacing into a click that already landed.
        }
      });
    }

    // §6.1: the synchronous response is identical whether or not a mutual formed - the
    // mutual is revealed only via the async notification + email logged above, never in
    // this response shape. (The constant-time floor that closes the timing side-channel
    // lands with the 21A harness in the 2.2 safety pass.)
    return {
      clickedProfileName: clickedProfile.display_name,
      outcome: "ok" as SendClickOutcome,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// §6.1 / 21A timing floor. Every send-click outcome - mutual formed, eligible-no-mutual,
// duplicate no-op, ineligible (block/ban/opt-out/pause/underage), cap reached, or error -
// must take at least SEND_CLICK_FLOOR_MS of wall-clock, so an attacker can't probe the
// receiver's hidden state (especially "did a mutual just form?") via response latency. The
// floor wraps BOTH the success return and every throw, and the synchronous payload is
// already outcome-uniform (the mutual is revealed only via the async notification/email).
export async function createUserClickForSession(
  input: {
    clickedProfileId: string;
    sourceEventId?: string;
    /** §6.9 swap: release this pending post-event click's budget slot first. */
    releaseReceiverId?: string;
  },
  session: Session | null,
) {
  const startedAt = Date.now();
  try {
    if (!isClickMechanicEnabled()) {
      const error = new Error("Clicking is temporarily paused.");
      error.name = "ValidationError";
      throw error;
    }
    // The hourly ceiling belongs HERE, not on /api/clicks. The route had the only
    // limiter, and the route is the one send path nothing in the product calls -
    // both real surfaces (the /people card, the post-event card) go through server
    // actions, which are every bit as callable as an API route. A byte-identical
    // refusal is worth little if an attacker can issue it ten thousand times an
    // hour and mine the timing, so the limit sits where every caller passes.
    // Inside the floor's try, so a throttled attempt is indistinguishable in
    // latency from an accepted one.
    const identity = getSessionEmail(session);
    if (identity) {
      const limit = await checkRateLimit({
        scope: "send-click",
        identity,
        limit: SEND_CLICK_HOURLY_LIMIT,
        windowSeconds: 60 * 60,
      });
      if (!limit.allowed) {
        const error = new Error("You're clicking a lot right now - give it a few minutes.");
        error.name = "RateLimitedError";
        (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds =
          limit.retryAfterSeconds;
        throw error;
      }
    }
    return await sendClickInner(input, session);
  } finally {
    const elapsed = Date.now() - startedAt;
    if (elapsed < SEND_CLICK_FLOOR_MS) {
      await new Promise((resolve) => setTimeout(resolve, SEND_CLICK_FLOOR_MS - elapsed));
    }
  }
}

/**
 * Notify BOTH people in each of a set of pairs, once. Used by the lifecycle sweep
 * so an ending is announced instead of just vanishing from a query.
 *
 * `title` / `body` / `actionUrl` are SQL expressions, not values - they can read
 * `payload.event_title` and the joined `me` / `them` profile rows. Callers pass
 * literals; nothing user-supplied reaches them.
 *
 * Carries the standard guard set: never a blocked pair, never a banned or
 * suspended account, and honours the recipient's mutualClick preference.
 */
async function notifyPairs(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  pairs: Array<{ user_a_id: string; user_b_id: string; event_title: string | null }>,
  title: string,
  body: string,
  actionUrl: string,
): Promise<void> {
  await client.query(
    `
      insert into notifications (profile_id, title, body, action_url)
      select me.id, ${title}, ${body}, ${actionUrl}
        from unnest($1::uuid[], $2::uuid[], $3::text[]) as payload(a, b, event_title)
        cross join lateral (values (payload.a, payload.b), (payload.b, payload.a)) as side(mine, theirs)
        join profiles me on me.id = side.mine
        join profiles them on them.id = side.theirs
       where not me.is_banned and me.suspended_at is null
         and not them.is_banned and them.suspended_at is null
         and coalesce((me.notification_prefs->>'mutualClick')::boolean, true)
         and not exists (
           select 1 from user_blocks ub
           where (ub.blocker_profile_id = payload.a and ub.blocked_profile_id = payload.b)
              or (ub.blocker_profile_id = payload.b and ub.blocked_profile_id = payload.a)
         )
    `,
    [
      pairs.map((r) => r.user_a_id),
      pairs.map((r) => r.user_b_id),
      pairs.map((r) => r.event_title),
    ],
  );
}

export async function expireClickLifecycles() {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const client = await pool.connect();
  try {
    await client.query("begin");
    const clicks = await client.query(
      `update clicks set status = 'expired', updated_at = now()
       where status = 'pending' and expires_at <= now()`,
    );

    // A pair who are both holding a seat on the same UPCOMING event have not run
    // out of time - they have a night in the diary. confirmProposal already
    // extends the mutual's clock exactly this way, but only for a plan agreed
    // inside the drawer; a pair who simply both RSVP'd to the same event never
    // touch that path. Their 7-day discovery clock therefore expired them while
    // the shared night was still weeks out: the "You're both going to X" card
    // vanished from /people and /proposals, and the sweep below told both of them
    // that nothing came of it. Same greatest() + POST_EVENT_CLICK_WINDOW_HOURS
    // tail confirmProposal uses, so this only ever extends, and the tail keeps the
    // pair's who-was-there click window inside the mutual's life.
    //
    // event_participants_v, not event_attendees (migration 056): a claimed guest
    // +1 is a real seat with no attendee row of its own, and getMutualClicksForSession's
    // "both going" celebration already counts it - the two must agree or the card
    // says they're going while the sweep says they're done.
    const sharedSeat = (arm: "a" | "b") =>
      `exists (select 1 from event_participants_v pv
                 where pv.event_id = e.id and pv.profile_id = m.user_${arm}_id)`;
    await client.query(
      `update mutual_clicks m
          set expires_at = greatest(
                m.expires_at,
                (
                  select max(coalesce(e.ends_at, e.starts_at))
                  from events e
                  where e.starts_at > now() and e.status <> 'cancelled'
                    and ${sharedSeat("a")} and ${sharedSeat("b")}
                ) + interval '${POST_EVENT_CLICK_WINDOW_HOURS} hours'
              ),
              updated_at = now()
        where m.status = 'active' and m.expires_at <= now()
          and exists (
            select 1 from events e
            where e.starts_at > now() and e.status <> 'cancelled'
              and ${sharedSeat("a")} and ${sharedSeat("b")}
          )`,
    );

    // Snapshot the lapsing plans BEFORE flipping them, so we still know who they
    // belonged to and what they were for. A plan that runs out of clock is an
    // ENDING, and until now it was a deletion: the card simply reverted to
    // "suggest a plan" and nobody was told the last one had gone unanswered.
    // Skipped when the whole mutual is expiring in this same sweep - that gets
    // its own, bigger notice below, and two is one too many.
    const lapsingPlans = await client.query<{
      user_a_id: string;
      user_b_id: string;
      event_title: string | null;
    }>(
      `select m.user_a_id, m.user_b_id, e.title as event_title
         from click_proposals p
         join mutual_clicks m on m.id = p.mutual_click_id
         left join events e on e.id = p.suggested_event_id
        where p.status = 'pending' and p.expires_at <= now()
          and m.status = 'active' and m.expires_at > now()`,
    );
    const proposals = await client.query(
      `update click_proposals set status = 'expired', updated_at = now()
       where status = 'pending' and expires_at <= now()`,
    );
    if (lapsingPlans.rowCount) {
      await notifyPairs(
        client,
        lapsingPlans.rows,
        `coalesce(payload.event_title, 'That plan') || ' lapsed'`,
        `'Neither of you locked it in before the window closed. Pick something else together whenever you like.'`,
        "'/proposals'",
      );
    }
    await client.query(
      `update mutual_clicks m
       set coord_state = 'dormant', updated_at = now()
       where m.status = 'active' and m.coord_state = 'proposed'
         and not exists (
           select 1 from click_proposals p
           where p.mutual_click_id = m.id and p.status in ('pending', 'accepted')
         )`,
    );
    // Before the wind-down: a mutual whose clock has run out but who ALREADY WENT
    // to something together ends as a success, not a lapse. mutual_status has had
    // 'connected' (+ connected_reason / connected_event_id) since migration 049 and
    // nothing has ever written it, so every one of these pairs was landing on
    // 'expired' and being told "nothing came of it before the clock ran out" -
    // about a night they had both been at. Runs first so the wound-down snapshot
    // below, which selects on status = 'active', can never pick them up too.
    const connected = await client.query<{
      user_a_id: string;
      user_b_id: string;
      event_title: string | null;
    }>(
      `with due as (
         select m.id, shared.id as event_id, shared.title as event_title
         from mutual_clicks m
         cross join lateral (
           select e.id, e.title
           from events e
           where coalesce(e.ends_at, e.starts_at) <= now() and e.status <> 'cancelled'
             -- Only a night they went to DURING this mutual counts. A post-event
             -- mutual is formed FROM a shared night that is already over, so
             -- without this every one of those would end as 'connected' on the
             -- strength of the event that introduced them - while what actually
             -- happened is that nothing came of it, which is what the wind-down
             -- below says.
             and coalesce(e.ends_at, e.starts_at) >= m.mutual_at
             and exists (select 1 from event_participants_v pv
                          where pv.event_id = e.id and pv.profile_id = m.user_a_id)
             and exists (select 1 from event_participants_v pv
                          where pv.event_id = e.id and pv.profile_id = m.user_b_id)
           order by coalesce(e.ends_at, e.starts_at) desc
           limit 1
         ) shared
         where m.status = 'active' and m.expires_at <= now()
       )
       update mutual_clicks m
          set status = 'connected',
              connected_reason = 'co_attended',
              connected_event_id = due.event_id,
              coord_state = 'dormant',
              ended_at = now(),
              updated_at = now()
         from due
        where m.id = due.id
       returning m.user_a_id, m.user_b_id, due.event_title`,
    );
    if (connected.rowCount) {
      await notifyPairs(
        client,
        connected.rows,
        `'You and ' || them.display_name || ' made it out'`,
        `coalesce(payload.event_title, 'That night') || ' has been and gone, so this click is wrapped up. Cross paths again and you can pick it back up.'`,
        "'/proposals'",
      );
    }

    // Same again for the mutual itself - and this is the one that mattered. A
    // releasing mutual took the person, the plan and the whole card off /proposals
    // with no word at all. A pair who locked a plan in is excluded: their mutual
    // ending is a night that already happened, not a release.
    const softReleased = await client.query<{
      user_a_id: string;
      user_b_id: string;
      event_title: string | null;
    }>(
      `select user_a_id, user_b_id, null::text as event_title
         from mutual_clicks
        where status = 'active' and expires_at <= now()
          and coord_state <> 'confirmed_together'
        for update`,
    );
    // B7.6 "Day 7, silent release": seven days of silence is a SOFT release, and the
    // status it lands on is 'released' - re-clickable after the B7.9 30-day cooldown.
    // This wrote 'expired', which B7.9 defines as the one permanent door ("blocked /
    // deleted ... NEVER resurfaces"). Nothing read the difference until the cooldown
    // and the past-clicks shelf did, at which point every fizzled pair would have been
    // walled off from each other for good on the strength of a clock.
    const mutuals = await client.query(
      `update mutual_clicks
       set status = 'released', coord_state = 'dormant', ended_at = now(), updated_at = now()
       where status = 'active' and expires_at <= now()`,
    );
    if (softReleased.rowCount) {
      // B7.6 bans the loss frame by name - "winding down", "about to expire" - and
      // CLICK_LANGUAGE §5's shelf line is the neutral replacement. The old copy broke
      // both: "wound down" is the banned phrase verbatim, and "nothing came of it
      // before the clock ran out" is a verdict on a pair who were told nothing was
      // running out. No loss, no verdict, no funeral - it just rests where they can
      // find it. (B7.6 asks for full silence here plus a day-5 opportunity nudge;
      // neither is built, so this stays as the one word they get.)
      await notifyPairs(
        client,
        softReleased.rows,
        `'You and ' || them.display_name || ' - still out there'`,
        `'This one is resting on your past clicks now. Cross paths again and you can pick it back up.'`,
        "'/proposals'",
      );
    }
    // §B7.3 no-show handling. Two or more FREE spots booked and not turned up to in
    // the last 90 days costs the post-event click surface for 30 days. Paid no-shows
    // are excluded on purpose - payment was the commitment, and it was already made.
    //
    // The door-list guard is the load-bearing part: checked_in_at is only ever written
    // when a merchant runs the optional door list, so on an event where nobody was
    // checked in, an attendee and a no-show are indistinguishable. Requiring at least
    // one check-in on the event means we never invent a no-show out of a merchant's
    // paperwork. 21 §6.4 accepts that this makes the guard silently absent wherever
    // check-in is skipped, rather than make check-in load-bearing.
    //
    // Only sets on someone not already suppressed, so a standing suppression is never
    // rolled forward hour after hour by the same two rows.
    await client.query(
      `update profiles p
          set post_event_click_suppressed_until = now() + interval '${NO_SHOW_SUPPRESSION_DAYS} days',
              updated_at = now()
        where (p.post_event_click_suppressed_until is null
            or p.post_event_click_suppressed_until <= now())
          and (
            select count(*) from event_attendees a
            join events e on e.id = a.event_id
            where a.profile_id = p.id
              and a.status = 'confirmed'
              and a.checked_in_at is null
              and e.price_cents = 0
              and coalesce(e.ends_at, e.starts_at)
                  between now() - interval '${NO_SHOW_LOOKBACK_DAYS} days' and now()
              and exists (
                select 1 from event_attendees door
                where door.event_id = e.id and door.checked_in_at is not null
              )
          ) >= ${NO_SHOW_SUPPRESSION_THRESHOLD}`,
    );
    const suppressions = await client.query(
      `delete from pair_suppressions where expires_at <= now()`,
    );
    await client.query(`delete from api_rate_limits where expires_at <= now()`);
    await client.query("commit");
    return {
      clicksExpired: clicks.rowCount ?? 0,
      proposalsExpired: proposals.rowCount ?? 0,
      mutualsExpired: mutuals.rowCount ?? 0,
      suppressionsReleased: suppressions.rowCount ?? 0,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

type WaitlistPromotion = {
  profileId: string;
  email: string;
  displayName: string;
  eventTitle: string;
  eventSlug: string;
  offeredUntil: Date;
  /** notification_prefs.waitlistOffers - gates the email, never the offer. */
  wantsOfferEmail: boolean;
};

// How long a freed seat is held for the next person in the queue before it
// rolls on (spec §3.2). Kept as a const so the notification/email copy and the
// expiry cron all agree on the window.
const WAITLIST_OFFER_MINUTES = 30;

/**
 * Offer a freed seat to the next eligible waitlister - oldest first, skipping
 * anyone who already holds a live or accepted offer. Sets a 30-minute hold +
 * an in-app notification. Returns the promotion (for the email) or null when
 * the queue is empty. MUST run inside an open transaction (`client`).
 */
async function promoteNextWaitlister(
  client: PoolClient,
  eventId: string,
  eventTitle: string,
  eventSlug: string,
): Promise<WaitlistPromotion | null> {
  // A seat can only roll to the waitlist if the event can still take someone:
  // still bookable, not yet over, and genuinely below capacity. Every caller
  // routes through here, so this one guard covers the cancel, hold-expiry and
  // lapsed-offer paths alike.
  //
  // Without it, `expireWaitlistOffers` loops forever on past events: it nulls a
  // lapsed `offered_until`, immediately re-offers the same seat, and emails
  // "a spot opened for <event>" - every sweep, for an event that already
  // happened. `available` already nets off the offer we just released, because
  // event_capacity_v counts only offers with `offered_until > now()`.
  //
  // The two gates deliberately mirror the booking layer rather than being
  // tighter than it. Offering a seat that registerForEvent would refuse is
  // useless; refusing to offer one it would still accept hands the queue's seat
  // to whoever walks up next. So: the same bookable-status set (isBookableEventStatus,
  // :573) and the same has_ended test (`coalesce(ends_at, starts_at) <= now()`,
  // :3169) - an event mid-session is still claimable, so its queue still gets served.
  const roomResult = await client.query(
    `
      select 1
      from events e
      join event_capacity_v cap on cap.event_id = e.id
      where e.id = $1::uuid
        and e.status::text = any($2::text[])
        and coalesce(e.ends_at, e.starts_at) > now()
        and cap.available > 0
    `,
    [eventId, [...BOOKABLE_EVENT_STATUSES]],
  );
  if (roomResult.rows.length === 0) return null;

  const waitlistResult = await client.query<{
    waitlist_id: string;
    profile_id: string;
    display_name: string;
    email: string;
    wants_offer_email: boolean;
  }>(
    `
      select
        waitlist.id::text as waitlist_id,
        waitlist.profile_id::text,
        waitlist_profile.display_name,
        waitlist_profile.email::text as email,
        -- The "Waitlist offers" toggle in /account-settings wrote this key and
        -- nothing ever read it, so turning it off changed nothing. It gates the
        -- EMAIL only: the in-app notification below is always written, because a
        -- 30-minute offer nobody is told about is a seat silently lost, which is
        -- a worse outcome than the mail they asked us not to send.
        coalesce((waitlist_profile.notification_prefs->>'waitlistOffers')::boolean, true)
          as wants_offer_email
      from event_waitlists waitlist
      join profiles waitlist_profile on waitlist_profile.id = waitlist.profile_id
      join event_attendees attendee
        on attendee.event_id = waitlist.event_id
       and attendee.profile_id = waitlist.profile_id
       and attendee.status = 'waitlisted'
      where waitlist.event_id = $1::uuid
        and waitlist.accepted_at is null
        and (waitlist.offered_until is null or waitlist.offered_until <= now())
        -- Never offer a freed seat to someone who already holds a confirmed seat
        -- (or a live payment hold) for this event. Test/edge data can leave a
        -- person with BOTH a confirmed and a waitlisted attendee row; without
        -- this guard the offer is wasted on someone already in, and the genuine
        -- next-in-line waitlister is starved.
        and not exists (
          select 1 from event_attendees confirmed_seat
          where confirmed_seat.event_id = waitlist.event_id
            and confirmed_seat.profile_id = waitlist.profile_id
            and (
              confirmed_seat.status = 'confirmed'
              or (confirmed_seat.status = 'pending_payment' and confirmed_seat.hold_expires_at > now())
            )
        )
      order by (waitlist.last_offer_expired_at is not null) asc, waitlist.created_at asc
      limit 1
      for update of waitlist skip locked
    `,
    [eventId],
  );

  const nextInLine = waitlistResult.rows[0];
  if (!nextInLine) return null;

  const offerResult = await client.query<{ offered_until: Date }>(
    `
      update event_waitlists
      set offered_until = now() + ($2 || ' minutes')::interval
      where id = $1::uuid
      returning offered_until
    `,
    [nextInLine.waitlist_id, String(WAITLIST_OFFER_MINUTES)],
  );

  await client.query(
    `
      insert into notifications (profile_id, title, body, action_url)
      values ($1::uuid, $2, $3, $4)
    `,
    [
      nextInLine.profile_id,
      "Spot available",
      `A spot opened for ${eventTitle}. Confirm within ${WAITLIST_OFFER_MINUTES} minutes.`,
      `/events/${eventSlug}`,
    ],
  );

  return {
    profileId: nextInLine.profile_id,
    email: nextInLine.email,
    displayName: nextInLine.display_name,
    eventTitle,
    eventSlug,
    offeredUntil: offerResult.rows[0].offered_until,
    wantsOfferEmail: nextInLine.wants_offer_email,
  };
}

function formatAud(cents: number, currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Renders the "Events you might enjoy" block injected into the cancellation
// email via the {{suggestedEvents}} placeholder. Returns a full <tr> (the
// placeholder sits between table rows) or "" when there are no suggestions.
function renderSuggestedEventsBlock(
  items: { url: string; title: string; line: string }[],
): string {
  if (items.length === 0) return "";
  const rows = items
    .map(
      (it) => `
      <p class="sans" style="margin:0 0 10px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.4;">
        <a href="${escapeHtml(it.url)}" style="color:#340068;text-decoration:none;font-weight:600;">${escapeHtml(it.title)}</a><br>
        <span style="color:#6D435A;">${escapeHtml(it.line)}</span>
      </p>`,
    )
    .join("");
  return `<tr><td class="px-gutter" style="padding:24px 40px 0 40px;">
    <p class="sans" style="margin:0 0 12px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6D435A;">Events you might enjoy</p>
    ${rows}
  </td></tr>`;
}

export async function cancelRegistration(eventId: string, session: Session | null) {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const client = await pool.connect();

  let promotion: WaitlistPromotion | null = null;
  // Every seat this cancellation frees gets its own offer - see the loop below.
  const promotions: WaitlistPromotion[] = [];
  let freedGuestSeats = 0;
  // Refund to actually initiate after commit (paid confirmed cancels with a
  // non-zero policy refund). Stripe + ledger work happens via issueRefund.
  let refundPlan:
    | { paymentTransactionId: string; refundCents: number; tier: RefundTier; currency: string }
    | null = null;
  // True when the booking was paid but the policy gives $0 back (< 24h) - drives
  // the "no refund" copy without initiating a Stripe call.
  let paidZeroRefund = false;
  let cancelledEventId = "";
  let cancelledTitle = "";
  // Hoisted for the post-commit booking_events refund log (spec 22 §2).
  let cancelledBookingId = "";
  let cancelledMerchantId: string | null = null;

  try {
    await client.query("begin");

    const result = await client.query<{
      attendee_id: string;
      previous_status: string;
      event_id: string;
      title: string;
      slug: string;
      starts_at: Date;
      price_cents: number;
      merchant_profile_id: string | null;
      offered_until: Date | null;
      txn_id: string | null;
      txn_amount_cents: number | null;
      txn_refunded_amount_cents: number | null;
      txn_currency: string | null;
      txn_status: string | null;
    }>(
      `
        select
          attendee.id::text as attendee_id,
          attendee.status::text as previous_status,
          event.id::text as event_id,
          event.title,
          event.slug,
          event.starts_at,
          event.price_cents,
          event.merchant_profile_id::text,
          waitlist.offered_until,
          pt.id::text as txn_id,
          pt.amount_cents as txn_amount_cents,
          coalesce(pt.refunded_amount_cents, 0) as txn_refunded_amount_cents,
          pt.currency::text as txn_currency,
          pt.status::text as txn_status
        from event_attendees attendee
        join events event on event.id = attendee.event_id
        left join event_waitlists waitlist
          on waitlist.event_id = attendee.event_id
         and waitlist.profile_id = attendee.profile_id
        left join payment_transactions pt
          on pt.id = attendee.payment_transaction_id
        where event.slug = $1
          and attendee.profile_id = $2::uuid
          and attendee.status in ('confirmed', 'waitlisted', 'pending_payment')
        for update of attendee
      `,
      [eventId, profile.id],
    );

    const row = result.rows[0];
    if (!row) {
      const error = new Error("You are not currently registered for that event.");
      error.name = "NotFoundError";
      throw error;
    }

    cancelledEventId = row.event_id;
    cancelledTitle = row.title;
    cancelledBookingId = row.attendee_id;
    cancelledMerchantId = row.merchant_profile_id;

    await client.query(
      `update event_attendees set status = 'cancelled', updated_at = now() where id = $1::uuid`,
      [row.attendee_id],
    );

    // Lifecycle log (spec 22 §2): a confirmed seat being cancelled by its
    // attendee. Waitlist drops aren't booking financial events. The refund leg
    // (refunded_full/partial/refund_denied) is logged post-commit below, once
    // the Stripe call resolves. In-txn so the cancellation + its log are atomic.
    if (row.previous_status === "confirmed") {
      await logBookingEvent(client, {
        bookingId: row.attendee_id,
        eventId: row.event_id,
        merchantId: row.merchant_profile_id,
        userId: profile.id,
        eventType: "cancelled_by_attendee",
        actor: "attendee",
      });
      // Whole-booking cancel (spec 19 §10.3): the purchaser's guest seats cancel
      // together with their own. The refund computed below is on the full
      // payment_transactions.amount_cents (all seats), so the money reconciles.
      if (row.txn_id) {
        freedGuestSeats = await cancelGuestSeatsForTransaction(client, row.txn_id);
      }
    }

    // Releasing a live checkout hold: no money has moved (the transaction is
    // still 'pending'), so there is nothing to refund - just free the seats,
    // drop the guest spots riding on the same hold, and retire the orphaned
    // transaction so it doesn't sit pending forever. Mirrors expirePaymentHolds.
    if (row.previous_status === "pending_payment") {
      await client.query(
        `update event_attendees set hold_expires_at = null where id = $1::uuid`,
        [row.attendee_id],
      );
      await logBookingEvent(client, {
        bookingId: row.attendee_id,
        eventId: row.event_id,
        merchantId: row.merchant_profile_id,
        userId: profile.id,
        eventType: "reservation_expired",
        actor: "attendee",
      });
      if (row.txn_id) {
        await cancelGuestSeatsForTransaction(client, row.txn_id);
        await client.query(
          `update payment_transactions set status = 'failed', updated_at = now()
             where id = $1::uuid and status = 'pending'`,
          [row.txn_id],
        );
      }
    }

    if (row.previous_status === "waitlisted") {
      // Drop them off the waitlist. If they were holding a LIVE promotion offer,
      // the seat they were sitting on rolls to the next person (spec §3.5).
      const hadLiveOffer = !!row.offered_until && row.offered_until.getTime() > Date.now();
      await client.query(
        `delete from event_waitlists where event_id = $1::uuid and profile_id = $2::uuid`,
        [row.event_id, profile.id],
      );
      if (hadLiveOffer) {
        promotion = await promoteNextWaitlister(client, row.event_id, row.title, row.slug);
      }
    } else {
      // Seats just freed - offer EVERY one of them to the queue (spec §3
      // Principle 3). A 4-seat booking cancelling on a full event freed four
      // seats and notified exactly one waitlister, because promoteNextWaitlister
      // is `limit 1` and was called once. It re-checks capacity on each pass, so
      // it simply returns null once the event is no longer below capacity.
      const seatsFreed = 1 + freedGuestSeats;
      for (let i = 0; i < seatsFreed; i += 1) {
        const promoted = await promoteNextWaitlister(client, row.event_id, row.title, row.slug);
        if (!promoted) break;
        promotions.push(promoted);
      }
      promotion = promotions[0] ?? null;

      // Paid booking → compute the tiered policy refund. Only refundable txns
      // (paid / partially_refunded) qualify; the actual Stripe call runs after
      // commit so a network hiccup can't roll back the cancellation.
      if (
        row.price_cents > 0 &&
        row.txn_id &&
        row.txn_amount_cents != null &&
        (row.txn_status === "paid" || row.txn_status === "partially_refunded")
      ) {
        // Quote against what is still HELD, not the original charge. A per-seat
        // guest refund already handed some of this transaction back, and
        // issueRefund hard-rejects (throws) any request above the remaining
        // balance - which cancelled the seat and told the buyer their refund was
        // on the way while nothing had been sent.
        const remainingCents = Math.max(
          row.txn_amount_cents - (row.txn_refunded_amount_cents ?? 0),
          0,
        );
        const quote = quoteCancellationRefund(remainingCents, row.starts_at);
        if (quote.refundCents > 0) {
          refundPlan = {
            paymentTransactionId: row.txn_id,
            refundCents: quote.refundCents,
            tier: quote.tier,
            currency: row.txn_currency || "AUD",
          };
        } else {
          paidZeroRefund = true;
        }
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  // ---------- post-commit side effects (fire-and-forget) ----------
  let refund: { refundCents: number; tier: RefundTier; failed: boolean } | null = null;
  let refundLine = "";

  if (refundPlan) {
    const dollars = formatAud(refundPlan.refundCents, refundPlan.currency);
    try {
      // Lazy import avoids a static cycle (stripe-sync imports from this module).
      const { issueRefund } = await import("./stripe-sync");
      const refundResult = await issueRefund({
        paymentTransactionId: refundPlan.paymentTransactionId,
        amountCents: refundPlan.refundCents,
        reason: "requested_by_customer",
        adminProfileId: null,
      });
      refund = { refundCents: refundPlan.refundCents, tier: refundPlan.tier, failed: false };
      refundLine = `A refund of ${dollars} will appear on your statement in 3 - 5 business days.`;
      // Lifecycle log: full tier → refunded_full, half tier → refunded_partial.
      // Amount is signed negative. Best-effort, idempotent on the Stripe refund id.
      await logBookingEvent(pool, {
        bookingId: cancelledBookingId,
        eventId: cancelledEventId,
        merchantId: cancelledMerchantId,
        userId: profile.id,
        eventType: refundPlan.tier === "full" ? "refunded_full" : "refunded_partial",
        amountCents: -refundPlan.refundCents,
        currency: refundPlan.currency,
        refundTier: refundBandFromTier(refundPlan.tier),
        stripeObjectId: refundResult.stripeRefundId,
        actor: "attendee",
      }).catch(() => {});
      await pool
        .query(
          `insert into notifications (profile_id, title, body, action_url) values ($1::uuid, $2, $3, $4)`,
          [
            profile.id,
            "Refund on the way",
            `Your ${dollars} refund for ${cancelledTitle} is processing (3 - 5 business days).`,
            "/dashboard",
          ],
        )
        .catch(() => {});
    } catch (err) {
      // Cancellation stands; the refund just didn't initiate. Log to the admin
      // queue and tell the user we're on it (spec §5 "refund fails").
      refund = { refundCents: refundPlan.refundCents, tier: refundPlan.tier, failed: true };
      refundLine =
        `We're processing your refund - if you don't see it within 7 days, contact ${SUPPORT_EMAIL}.`;
      await pool
        .query(
          `insert into refund_failures (payment_transaction_id, event_id, profile_id, amount_cents, currency, error_message)
           values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)`,
          [
            refundPlan.paymentTransactionId,
            cancelledEventId,
            profile.id,
            refundPlan.refundCents,
            refundPlan.currency,
            err instanceof Error ? err.message : String(err),
          ],
        )
        .catch(() => {});
    }
  } else if (paidZeroRefund) {
    refundLine =
      "No refund - you cancelled within 24 hours of the event, per our cancellation policy.";
    // Lifecycle log: a paid booking cancelled inside the no-refund window.
    void logBookingEvent(pool, {
      bookingId: cancelledBookingId,
      eventId: cancelledEventId,
      merchantId: cancelledMerchantId,
      userId: profile.id,
      eventType: "refund_denied",
      refundTier: "within_24h",
      actor: "system",
    }).catch(() => {});
  }

  // Log rsvp-cancelled-attendee (+ rsvp-cancelled-merchant). Post-commit +
  // fire-and-forget so a template hiccup can't roll back the cancellation.
  void logRsvpCancelledEmails(pool, cancelledEventId, profile.id, refundLine);

  for (const promoted of promotions) {
    await logWaitlistPromotedEmail(pool, promoted);
  }

  return {
    eventTitle: cancelledTitle,
    promotedWaitlist: !!promotion,
    refund,
  };
}

// A +1 seat the viewer purchased on an event, for the purchaser-facing "Your +1s"
// manager (spec 19 §10.1). Excludes cancelled seats. `claimed` drives the "your
// friend will be told" confirmation copy.
export type MyGuestSeat = {
  guestSpotId: string;
  firstName: string | null;
  status: "unnamed" | "invited" | "claimed" | "released" | "removed";
  claimed: boolean;
};

export async function getMyGuestSeatsForEvent(
  eventSlug: string,
  session: Session | null,
): Promise<MyGuestSeat[]> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!email || !pool) return [];

  const profile = await ensureProfileForSession(session);
  const result = await pool.query<{
    guest_spot_id: string;
    guest_first_name: string | null;
    status: string;
    claimed: boolean;
  }>(
    `
      select
        gs.id::text as guest_spot_id,
        gs.guest_first_name,
        gs.status::text,
        (gs.claimed_profile_id is not null) as claimed
      from guest_spots gs
      join events event on event.id = gs.event_id
      where event.slug = $1
        and gs.purchaser_profile_id = $2::uuid
        and gs.status <> 'cancelled'
      order by gs.created_at asc
    `,
    [eventSlug, profile.id],
  );

  return result.rows.map((r) => ({
    guestSpotId: r.guest_spot_id,
    firstName: r.guest_first_name,
    status: r.status as MyGuestSeat["status"],
    claimed: r.claimed,
  }));
}

// Purchaser cancels ONE +1 seat without cancelling their whole booking (spec 19
// §10.1). Money belongs to the purchaser: the refund follows the standard policy
// window on the per-seat amount they paid (ticket + booking fee), uses
// reverse_transfer + refund_application_fee for merchant events (via issueRefund),
// frees the seat (guest_spots -> 'cancelled', which capacity counts as freed),
// promotes the next waitlister, and - if the seat was claimed - tells that friend.
export async function cancelGuestSeatForPurchaser(
  guestSpotId: string,
  session: Session | null,
): Promise<{
  refund: { refundCents: number; tier: RefundTier; failed: boolean } | null;
  promotedWaitlist: boolean;
  wasClaimed: boolean;
  eventTitle: string;
}> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();
  if (!isUuid(guestSpotId)) {
    const error = new Error("Invalid guest seat.");
    error.name = "ValidationError";
    throw error;
  }

  const profile = await ensureProfileForSession(session);
  const client = await pool.connect();

  let promotion: WaitlistPromotion | null = null;
  let refundPlan:
    | { paymentTransactionId: string; refundCents: number; tier: RefundTier; currency: string }
    | null = null;
  let paidZeroRefund = false;
  let eventId = "";
  let eventSlug = "";
  let eventTitle = "";
  let eventStartsAt = new Date(0);
  let purchaserBookingId = "";
  let merchantId: string | null = null;
  let claimed: { profileId: string; email: string | null; firstName: string | null } | null = null;

  try {
    await client.query("begin");

    const result = await client.query<{
      guest_spot_id: string;
      claimed_profile_id: string | null;
      claimed_email: string | null;
      claimed_name: string | null;
      guest_first_name: string | null;
      event_id: string;
      slug: string;
      title: string;
      starts_at: Date;
      price_cents: number;
      merchant_profile_id: string | null;
      purchaser_booking_id: string;
      txn_id: string;
      txn_amount_cents: number | null;
      txn_refunded_amount_cents: number | null;
      txn_seat_count: string | number | null;
      txn_currency: string | null;
      txn_status: string | null;
    }>(
      `
        select
          gs.id::text as guest_spot_id,
          gs.claimed_profile_id::text,
          claimer.email::text as claimed_email,
          claimer.display_name as claimed_name,
          gs.guest_first_name,
          event.id::text as event_id,
          event.slug,
          event.title,
          event.starts_at,
          event.price_cents,
          event.merchant_profile_id::text,
          purchaser_attendee.id::text as purchaser_booking_id,
          pt.id::text as txn_id,
          pt.amount_cents as txn_amount_cents,
          coalesce(pt.refunded_amount_cents, 0) as txn_refunded_amount_cents,
          -- Seats this transaction actually paid for: the purchaser plus every
          -- guest spot bought on it, cancelled ones included (they were paid).
          (1 + (
            select count(*) from guest_spots g2 where g2.payment_transaction_id = pt.id
          )) as txn_seat_count,
          pt.currency::text as txn_currency,
          pt.status::text as txn_status
        from guest_spots gs
        join events event on event.id = gs.event_id
        join payment_transactions pt on pt.id = gs.payment_transaction_id
        join event_attendees purchaser_attendee
          on purchaser_attendee.payment_transaction_id = gs.payment_transaction_id
         and purchaser_attendee.profile_id = gs.purchaser_profile_id
         and purchaser_attendee.status = 'confirmed'
        left join profiles claimer on claimer.id = gs.claimed_profile_id
        where gs.id = $1::uuid
          and gs.purchaser_profile_id = $2::uuid
          and gs.status <> 'cancelled'
        for update of gs
      `,
      [guestSpotId, profile.id],
    );

    const row = result.rows[0];
    if (!row) {
      const error = new Error("That guest seat can't be cancelled.");
      error.name = "NotFoundError";
      throw error;
    }

    eventId = row.event_id;
    eventSlug = row.slug;
    eventTitle = row.title;
    eventStartsAt = row.starts_at;
    purchaserBookingId = row.purchaser_booking_id;
    merchantId = row.merchant_profile_id;
    if (row.claimed_profile_id) {
      claimed = {
        profileId: row.claimed_profile_id,
        email: row.claimed_email,
        firstName: row.claimed_name?.split(/\s+/)[0] ?? row.guest_first_name,
      };
    }

    // Free the seat. Capacity counts non-cancelled guest_spots, so this opens it.
    await client.query(
      `update guest_spots set status = 'cancelled', updated_at = now() where id = $1::uuid`,
      [row.guest_spot_id],
    );

    // One seat freed → offer it to the next person in line (spec §10.1).
    promotion = await promoteNextWaitlister(client, row.event_id, row.title, row.slug);

    // Per-seat policy refund. The unit is what the buyer ACTUALLY paid per seat,
    // divided out of the transaction itself - recomputing it from the current
    // booking_fee_bps paid against a fee the buyer may never have been charged,
    // because the fee is snapshotted into amount_cents at hold time and an admin
    // can move the rate in between. The plan is then clamped to the balance still
    // outstanding, so repeated per-seat cancels cannot ask issueRefund for more
    // than remains (it throws rather than clamps, which failed the whole refund).
    if (
      row.price_cents > 0 &&
      row.txn_amount_cents != null &&
      (row.txn_status === "paid" || row.txn_status === "partially_refunded")
    ) {
      const seatCount = Math.max(Number(row.txn_seat_count ?? 1) || 1, 1);
      const perSeatPaidCents = Math.round(row.txn_amount_cents / seatCount);
      const remainingCents = Math.max(
        row.txn_amount_cents - (row.txn_refunded_amount_cents ?? 0),
        0,
      );
      const quote = quoteCancellationRefund(perSeatPaidCents, row.starts_at);
      const refundCents = Math.min(quote.refundCents, remainingCents);
      if (refundCents > 0) {
        refundPlan = {
          paymentTransactionId: row.txn_id,
          refundCents,
          tier: quote.tier,
          currency: row.txn_currency || "AUD",
        };
      } else {
        paidZeroRefund = true;
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  // ---------- post-commit side effects (the seat is already freed) ----------
  let refund: { refundCents: number; tier: RefundTier; failed: boolean } | null = null;

  if (refundPlan) {
    try {
      const { issueRefund } = await import("./stripe-sync");
      const refundResult = await issueRefund({
        paymentTransactionId: refundPlan.paymentTransactionId,
        amountCents: refundPlan.refundCents,
        reason: "requested_by_customer",
        adminProfileId: null,
      });
      refund = { refundCents: refundPlan.refundCents, tier: refundPlan.tier, failed: false };
      await logBookingEvent(pool, {
        bookingId: purchaserBookingId,
        eventId,
        merchantId,
        userId: profile.id,
        eventType: refundPlan.tier === "full" ? "refunded_full" : "refunded_partial",
        amountCents: -refundPlan.refundCents,
        currency: refundPlan.currency,
        refundTier: refundBandFromTier(refundPlan.tier),
        stripeObjectId: refundResult.stripeRefundId,
        actor: "attendee",
      }).catch(() => {});
      await pool
        .query(
          `insert into notifications (profile_id, title, body, action_url) values ($1::uuid, $2, $3, $4)`,
          [
            profile.id,
            "Refund on the way",
            `Your ${formatAud(refundPlan.refundCents, refundPlan.currency)} refund for a cancelled +1 at ${eventTitle} is processing (3 - 5 business days).`,
            "/dashboard",
          ],
        )
        .catch(() => {});
    } catch (err) {
      // The seat stays cancelled; the refund just didn't initiate. Queue it for
      // the admin refund-failures sweep and surface "processing" to the user.
      refund = { refundCents: refundPlan.refundCents, tier: refundPlan.tier, failed: true };
      await pool
        .query(
          `insert into refund_failures (payment_transaction_id, event_id, profile_id, amount_cents, currency, error_message)
           values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)`,
          [
            refundPlan.paymentTransactionId,
            eventId,
            profile.id,
            refundPlan.refundCents,
            refundPlan.currency,
            err instanceof Error ? err.message : String(err),
          ],
        )
        .catch(() => {});
    }
  } else if (paidZeroRefund) {
    void logBookingEvent(pool, {
      bookingId: purchaserBookingId,
      eventId,
      merchantId,
      userId: profile.id,
      eventType: "refund_denied",
      refundTier: "within_24h",
      actor: "system",
    }).catch(() => {});
  }

  // If the seat was claimed, the friend thought they were going - tell them
  // (spec §10.1 + §8.6). In-app notification + an email_events row (CLAUDE.md:
  // every notification flow logs one). The friend is never told why or by whom.
  if (claimed) {
    await pool
      .query(
        `insert into notifications (profile_id, title, body, action_url) values ($1::uuid, $2, $3, $4)`,
        [
          claimed.profileId,
          "A spot changed",
          `Your spot at ${eventTitle} is no longer held - no charge, nothing needed.`,
          `/events/${eventSlug}`,
        ],
      )
      .catch(() => {});
    if (claimed.email && claimed.email !== "[removed]") {
      const dateClause = ` on ${new Intl.DateTimeFormat("en-AU", {
        weekday: "long",
        month: "short",
        day: "numeric",
        timeZone: "Australia/Sydney",
      }).format(eventStartsAt)}`;
      await logEmailEvent({
        template: "guest-spot-cancelled",
        toEmail: claimed.email,
        toProfileId: claimed.profileId,
        vars: {
          guestFirstName: claimed.firstName || "there",
          eventTitle,
          eventLongDateClause: dateClause,
          eventUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/events/${eventSlug}`,
        },
      });
    }
  }

  if (promotion) {
    await logWaitlistPromotedEmail(pool, promotion);
  }

  return {
    refund,
    promotedWaitlist: !!promotion,
    wasClaimed: !!claimed,
    eventTitle,
  };
}

/**
 * Sweep lapsed waitlist promotion offers (the 30-minute window passed without
 * the user confirming). For each: stamp `last_offer_expired_at`, tell the user
 * they're back on the list at their position, and roll the freed seat to the
 * next eligible person (spec §3.4). Idempotent + safe to run concurrently -
 * each row is re-locked and re-checked. Driven by /api/cron/waitlist-expiry.
 */
export async function expireWaitlistOffers(): Promise<{ expired: number; reoffered: number }> {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const lapsed = await pool.query<{
    waitlist_id: string;
    event_id: string;
    profile_id: string;
    title: string;
    slug: string;
  }>(
    `
      select
        w.id::text as waitlist_id,
        w.event_id::text,
        w.profile_id::text,
        e.title,
        e.slug
      from event_waitlists w
      join events e on e.id = w.event_id
      join event_attendees a
        on a.event_id = w.event_id and a.profile_id = w.profile_id and a.status = 'waitlisted'
      where w.accepted_at is null
        and w.offered_until is not null
        and w.offered_until <= now()
      order by w.offered_until asc
    `,
  );

  let expired = 0;
  let reoffered = 0;
  const promotions: WaitlistPromotion[] = [];

  for (const row of lapsed.rows) {
    const client = await pool.connect();
    try {
      await client.query("begin");

      // Re-lock + re-check - an accept or another sweep may have moved it.
      const recheck = await client.query(
        `
          select created_at from event_waitlists
          where id = $1::uuid and accepted_at is null
            and offered_until is not null and offered_until <= now()
          for update
        `,
        [row.waitlist_id],
      );
      if (recheck.rows.length === 0) {
        await client.query("rollback");
        continue;
      }

      await client.query(
        `
          update event_waitlists
          set last_offer_expired_at = offered_until, offered_until = null
          where id = $1::uuid
        `,
        [row.waitlist_id],
      );

      // Position they fall back to. This row has just been stamped
      // last_offer_expired_at, so under the promoter's ordering EVERY row that
      // has not lapsed now sits ahead of it - counting by created_at alone told
      // them they were still near the front.
      const posResult = await client.query<{ pos: string }>(
        `
          select (count(*) + 1)::text as pos
          from event_waitlists ahead
          join event_attendees a
            on a.event_id = ahead.event_id and a.profile_id = ahead.profile_id
           and a.status = 'waitlisted'
          where ahead.event_id = $1::uuid
            and ahead.accepted_at is null
            and ahead.id <> $2::uuid
            and (ahead.last_offer_expired_at is not null, ahead.created_at)
                < (true, $3::timestamptz)
        `,
        [row.event_id, row.waitlist_id, recheck.rows[0].created_at],
      );
      const pos = Number(posResult.rows[0]?.pos ?? 1);

      await client.query(
        `
          insert into notifications (profile_id, title, body, action_url)
          values ($1::uuid, $2, $3, $4)
        `,
        [
          row.profile_id,
          "Offer expired",
          `Your spot offer for ${row.title} expired. You're back at #${pos} on the waitlist.`,
          `/events/${row.slug}`,
        ],
      );

      // Roll the seat on - the just-expired user is now deprioritised.
      const promo = await promoteNextWaitlister(client, row.event_id, row.title, row.slug);
      await client.query("commit");

      expired += 1;
      if (promo) {
        reoffered += 1;
        promotions.push(promo);
      }
    } catch {
      await client.query("rollback").catch(() => {});
    } finally {
      client.release();
    }
  }

  // Email the newly-offered users outside any transaction.
  for (const promo of promotions) {
    await logWaitlistPromotedEmail(pool, promo);
  }

  return { expired, reoffered };
}

/**
 * Sweep abandoned checkout holds. A `pending_payment` attendee row that's past
 * its `hold_expires_at` is a checkout that was started but never paid (the
 * person closed the Stripe tab, etc.). The seat-count predicates already stop
 * counting an expired hold (`hold_expires_at > now()`), so the seat *displays*
 * as free - but the row lingers as `pending_payment` forever and, crucially,
 * the freed seat is never re-offered to the waitlist. This converts each lapsed
 * hold to `cancelled` and, when that drops a full event below capacity, rolls
 * the seat to the next waitlister (offer + notification + email), mirroring
 * what `cancelRegistration` does for a real cancellation.
 */
export async function expirePaymentHolds(): Promise<{ expired: number; reoffered: number }> {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const lapsed = await pool.query<{
    attendee_id: string;
    event_id: string;
    profile_id: string;
    title: string;
    slug: string;
    merchant_profile_id: string | null;
    txn_id: string | null;
    checkout_session_id: string | null;
  }>(
    `
      select
        a.id::text as attendee_id,
        a.event_id::text,
        a.profile_id::text,
        e.title,
        e.slug,
        e.merchant_profile_id::text,
        a.payment_transaction_id::text as txn_id,
        pt.stripe_checkout_session_id as checkout_session_id
      from event_attendees a
      join events e on e.id = a.event_id
      left join payment_transactions pt on pt.id = a.payment_transaction_id
      where a.status = 'pending_payment'
        and a.hold_expires_at is not null
        and a.hold_expires_at <= now()
      order by a.hold_expires_at asc
    `,
  );

  let expired = 0;
  let reoffered = 0;
  const promotions: WaitlistPromotion[] = [];

  for (const row of lapsed.rows) {
    // Before releasing the seat, double-check Stripe: the buyer may have paid
    // but the confirmation never landed (missed webhook AND a closed tab that
    // skipped the success-URL reconcile). Cancelling such a hold is the
    // "I paid but it says join the waitlist" bug - so reconcile first and, if
    // Stripe reports the session paid, markPaymentSucceeded promotes the seat.
    // The recheck below then finds it no longer 'pending_payment' and skips it.
    if (row.checkout_session_id) {
      try {
        const { reconcileCheckoutSession } = await import("./stripe-sync");
        await reconcileCheckoutSession(row.checkout_session_id);
      } catch (error) {
        if (process.env.CLICK_DB_DEBUG === "true") {
          console.warn(`hold reconcile failed for txn ${row.txn_id}`, error);
        }
      }
    }

    const client = await pool.connect();
    try {
      await client.query("begin");

      // Re-lock + re-check - a webhook/return reconcile may have just confirmed
      // it, or another sweep may have grabbed it.
      const recheck = await client.query(
        `
          select id from event_attendees
          where id = $1::uuid and status = 'pending_payment'
            and hold_expires_at is not null and hold_expires_at <= now()
          for update
        `,
        [row.attendee_id],
      );
      if (recheck.rows.length === 0) {
        await client.query("rollback");
        continue;
      }

      await client.query(
        `update event_attendees set status = 'cancelled', hold_expires_at = null, updated_at = now() where id = $1::uuid`,
        [row.attendee_id],
      );

      // Lifecycle log (spec 22 §2): the reservation lapsed without payment. The
      // reserved seat (and its 'reserved' log) gives the model the negative -
      // a hold that never converted. In-txn with the seat release.
      await logBookingEvent(client, {
        bookingId: row.attendee_id,
        eventId: row.event_id,
        merchantId: row.merchant_profile_id,
        userId: row.profile_id,
        eventType: "reservation_expired",
        actor: "system",
      });

      // Release any guest seats reserved on this lapsed hold (spec 19) so they
      // stop holding capacity and don't linger as 'unnamed' orphans.
      if (row.txn_id) {
        await cancelGuestSeatsForTransaction(client, row.txn_id);
      }

      // Tidy the orphaned checkout transaction so it doesn't sit "pending" forever.
      if (row.txn_id) {
        await client.query(
          `update payment_transactions set status = 'failed', updated_at = now()
             where id = $1::uuid and status = 'pending'`,
          [row.txn_id],
        );
      }

      // Notify the lapsed holder so they understand the seat was released.
      await client.query(
        `
          insert into notifications (profile_id, title, body, action_url)
          values ($1::uuid, $2, $3, $4)
        `,
        [
          row.profile_id,
          "Checkout expired",
          `Your checkout for ${row.title} expired and the seat was released. You can reserve again any time.`,
          `/events/${row.slug}`,
        ],
      );

      // Re-offer the freed seat only if the event is genuinely full once you
      // account for live offers already reserving a slot - otherwise we'd
      // over-offer beyond capacity.
      const roomResult = await client.query<{ available: string }>(
        `
          -- count(distinct …) on both joined tables: the two left joins form a
          -- cartesian product, so a plain count would multiply attendees by the
          -- number of waitlist rows (and vice-versa).
          select (
            e.capacity
            - count(distinct a.id) filter (
                where a.status = 'confirmed'
                   or (a.status = 'pending_payment' and a.hold_expires_at > now())
              )
            - count(distinct w.id) filter (
                where w.accepted_at is null and w.offered_until is not null and w.offered_until > now()
              )
          )::text as available
          from events e
          left join event_attendees a on a.event_id = e.id
          left join event_waitlists w on w.event_id = e.id
          where e.id = $1::uuid
          group by e.capacity
        `,
        [row.event_id],
      );
      const available = Number(roomResult.rows[0]?.available ?? 0);

      let promo: WaitlistPromotion | null = null;
      if (available > 0) {
        promo = await promoteNextWaitlister(client, row.event_id, row.title, row.slug);
      }
      await client.query("commit");

      expired += 1;
      if (promo) {
        reoffered += 1;
        promotions.push(promo);
      }
    } catch {
      await client.query("rollback").catch(() => {});
    } finally {
      client.release();
    }
  }

  // Email the newly-offered users outside any transaction.
  for (const promo of promotions) {
    await logWaitlistPromotedEmail(pool, promo);
  }

  return { expired, reoffered };
}

export async function cancelMerchantEvent(eventId: string, session: Session | null) {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const merchant = await getMerchantProfile(pool, profile.id);

  if (!merchant) {
    const error = new Error("Merchant profile is required.");
    error.name = "ForbiddenError";
    throw error;
  }

  return cancelEvent(eventId, {
    kind: "merchant",
    actorProfileId: profile.id,
    merchantId: merchant.id,
    reason: "",
  });
}

export async function cancelEventForAdmin(
  eventId: string,
  reason: string,
  session: Session | null,
) {
  if (!getPostgresPool()) throw databaseUnavailableError();
  const profile = await requireAdminProfile(session);
  const cancellationReason = reason.trim().slice(0, 1000);

  if (cancellationReason.length < 5) {
    const error = new Error("Add a short cancellation reason (at least 5 characters).");
    error.name = "ValidationError";
    throw error;
  }

  return cancelEvent(eventId, {
    kind: "admin",
    actorProfileId: profile.id,
    reason: cancellationReason,
  });
}

type EventCancellationActor =
  | {
      kind: "merchant";
      actorProfileId: string;
      merchantId: string;
      reason: string;
    }
  | {
      kind: "admin";
      actorProfileId: string;
      reason: string;
    };

async function cancelEvent(eventId: string, actor: EventCancellationActor) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const client = await pool.connect();
  // Everything after the commit - Stripe refunds, the attendee fan-out, the
  // host notice - runs OUTSIDE the transaction. The single catch below used to
  // treat a failure there exactly like a failure before it: rollback (a no-op
  // on a committed transaction) and rethrow, which surfaced to the host as
  // "Could not cancel this event. Nothing has changed." while the event was in
  // fact cancelled, every seat released, and some refunds already issued.
  let committed = false;
  let affectedProfiles: {
    bookingId: string;
    isBooking: boolean;
    needsCancellationNotice: boolean;
    profileId: string;
    email: string;
    displayName: string;
    // Refundable balance (cents) on this attendee's paid booking; 0 for free /
    // waitlisted / unpaid. The actual Stripe refund runs post-commit.
    paymentTransactionId: string | null;
    refundableCents: number;
    currency: string;
  }[] = [];

  try {
    await client.query("begin");

    const eventResult = await client.query<{
      id: string;
      slug: string;
      title: string;
      status: string;
      merchant_profile_id: string | null;
      host_profile_id: string | null;
      host_email: string | null;
      host_display_name: string | null;
      starts_at: Date;
      ends_at: Date | null;
      timezone: string;
      host_name: string;
    }>(
      `
        select
          event.id::text,
          event.slug,
          event.title,
          event.status::text,
          event.merchant_profile_id::text,
          event.host_profile_id::text,
          host.email::text as host_email,
          host.display_name as host_display_name,
          event.starts_at,
          event.ends_at,
          event.timezone,
          event.host_name
        from events event
        left join profiles host on host.id = event.host_profile_id
        where event.slug = $1
          ${
            actor.kind === "merchant"
              ? "and event.merchant_profile_id = $2::uuid"
              : "and event.status in ('live', 'featured', 'waitlist', 'locked', 'cancelled')"
          }
        for update of event
      `,
      actor.kind === "merchant" ? [eventId, actor.merchantId] : [eventId],
    );

    const event = eventResult.rows[0];
    if (!event) {
      const error = new Error(
        actor.kind === "admin" ? "Published event not found." : "Merchant event not found.",
      );
      error.name = "NotFoundError";
      throw error;
    }

    const alreadyCancelled = event.status === "cancelled";

    // Cancelling refunds every paid booking in full, so a merchant cancelling
    // an event that has ALREADY RUN would hand back a night's takings for a
    // night that actually happened - real money, no undo. The events list has
    // always refused to offer it (merchant-events-panel.tsx isPast); the
    // detail page did not, so the rule now lives where it can be enforced
    // rather than on one of the two surfaces that link here.
    //
    // `alreadyCancelled` is exempt on purpose: a cancellation commits before
    // its Stripe calls, so a retry that resumes an unfinished refund run must
    // still be allowed through even once the event's own date has passed.
    // Admins keep the ability deliberately - refunding a past event is a
    // support action, and cancelEventForAdmin carries a reason.
    if (actor.kind === "merchant" && !alreadyCancelled) {
      const endedAt = event.ends_at ?? event.starts_at;
      if (endedAt.getTime() < Date.now()) {
        const error = new Error(
          "This event has already ended, so it can no longer be cancelled. Contact support if you need to refund attendees.",
        );
        error.name = "ForbiddenError";
        throw error;
      }
    }

    const attendeeResult = await client.query<{
      attendee_id: string;
      attendee_status: string;
      profile_id: string;
      display_name: string;
      email: string;
      txn_id: string | null;
      txn_amount_cents: number | null;
      refunded_amount_cents: number | null;
      txn_currency: string | null;
      txn_status: string | null;
    }>(
      `
        select
          attendee.id::text as attendee_id,
          attendee.status::text as attendee_status,
          attendee.profile_id::text,
          attendee_profile.display_name,
          attendee_profile.email::text as email,
          pt.id::text as txn_id,
          pt.amount_cents as txn_amount_cents,
          pt.refunded_amount_cents,
          pt.currency::text as txn_currency,
          pt.status::text as txn_status
        from event_attendees attendee
        join profiles attendee_profile on attendee_profile.id = attendee.profile_id
        left join payment_transactions pt on pt.id = attendee.payment_transaction_id
        where attendee.event_id = $1::uuid
          and (
            attendee.status in ('confirmed', 'waitlisted', 'pending_payment')
            -- A cancellation commits before its Stripe calls. If the process
            -- stops in that gap, a retry must resume any remaining refund even
            -- though the attendee row is already cancelled.
            or (
              attendee.status = 'cancelled'
              and pt.status in ('paid', 'partially_refunded')
              and pt.amount_cents > coalesce(pt.refunded_amount_cents, 0)
            )
          )
      `,
      [event.id],
    );

    affectedProfiles = attendeeResult.rows.map((row) => {
      const refundable =
        (row.txn_status === "paid" || row.txn_status === "partially_refunded") &&
        row.txn_amount_cents != null
          ? row.txn_amount_cents - (row.refunded_amount_cents ?? 0)
          : 0;
      return {
        bookingId: row.attendee_id,
        // Waitlisted rows aren't bookings - exclude from the lifecycle log.
        isBooking: row.attendee_status !== "waitlisted",
        needsCancellationNotice: row.attendee_status !== "cancelled",
        profileId: row.profile_id,
        email: row.email,
        displayName: row.display_name,
        paymentTransactionId: row.txn_id,
        refundableCents: Math.max(0, refundable),
        currency: row.txn_currency || "AUD",
      };
    });

    if (!alreadyCancelled) {
      await client.query(
        `
          update events
          set status = 'cancelled',
              cancellation_reason = $2,
              cancelled_at = now(),
              cancelled_by_profile_id = $3::uuid,
              updated_at = now()
          where id = $1::uuid
        `,
        [event.id, actor.reason || null, actor.actorProfileId],
      );
    }

    await client.query(
      `
        update event_attendees
        set status = 'cancelled', updated_at = now()
        where event_id = $1::uuid
          and status in ('confirmed', 'waitlisted', 'pending_payment')
      `,
      [event.id],
    );

    // Lifecycle log (spec 22 §2): one cancelled_by_merchant per real booking
    // (not waitlist rows). In-txn so the cancellation + logs commit atomically.
    // The refunded_full leg is logged post-commit per attendee below.
    for (const a of affectedProfiles) {
      if (!a.isBooking || !a.needsCancellationNotice) continue;
      await logBookingEvent(client, {
        bookingId: a.bookingId,
        eventId: event.id,
        merchantId: event.merchant_profile_id,
        userId: a.profileId,
        eventType: "cancelled_by_merchant",
        actor: actor.kind,
        metadata:
          actor.kind === "admin" ? { cancellationReason: actor.reason } : undefined,
      });
    }

    // Cancel every guest seat for this event (spec 19 §10.5) so claim links
    // dead-end and the seats stop holding capacity. The purchasers' full-amount
    // refunds (which already cover the guest seats they paid for) run below.
    await client.query(
      `update guest_spots set status = 'cancelled', updated_at = now()
        where event_id = $1::uuid and status <> 'cancelled'`,
      [event.id],
    );

    const profilesNeedingNotice = affectedProfiles.filter(
      (profile) => profile.needsCancellationNotice,
    );
    if (profilesNeedingNotice.length > 0) {
      await client.query(
        `
          insert into notifications (profile_id, title, body, action_url)
          select profile_id::uuid, $2, $3, $4
          from unnest($1::uuid[]) as profile_id
        `,
        [
          profilesNeedingNotice.map((profile) => profile.profileId),
          "Event cancelled",
          actor.kind === "admin"
            ? `${event.title} has been cancelled by Click. Reason: ${actor.reason}`
            : `${event.title} has been cancelled by the host.`,
          `/events/${event.slug}`,
        ],
      );
    }

    if (actor.kind === "admin" && !alreadyCancelled && event.host_profile_id) {
      await client.query(
        `
          insert into notifications (profile_id, title, body, action_url)
          values ($1::uuid, 'Event cancelled by Click', $2, $3)
        `,
        [
          event.host_profile_id,
          `${event.title} was taken offline. Reason: ${actor.reason}`,
          `/merchant/events/${event.slug}`,
        ],
      );
    }

    if (actor.kind === "admin" && !alreadyCancelled) {
      await client.query(
        `
          insert into audit_logs (actor_profile_id, action, entity_table, entity_id, metadata)
          values ($1::uuid, 'admin_cancel_event', 'events', $2::uuid, $3::jsonb)
        `,
        [
          actor.actorProfileId,
          event.id,
          JSON.stringify({
            slug: event.slug,
            title: event.title,
            previousStatus: event.status,
            reason: actor.reason,
            affectedBookings: affectedProfiles.filter((profile) => profile.isBooking).length,
          }),
        ],
      );
    }

    await client.query("commit");
    committed = true;

    // Up to 3 upcoming, still-bookable alternatives to soften the cancellation.
    // A user whose event was just cancelled is primed to book something else
    // (spec §5). Shared across all recipients - generic (not per-user) for now.
    const suggestedResult = await client.query<{
      slug: string;
      title: string;
      starts_at: Date;
      timezone: string;
      suburb: string | null;
    }>(
      `
        select e.slug, e.title, e.starts_at, e.timezone, e.suburb
        from events e
        where e.status in ('live', 'featured')
          and e.starts_at > now()
          and e.id <> $1::uuid
          and (
            select count(*) from event_attendees a
            where a.event_id = e.id and a.status = 'confirmed'
          ) < e.capacity
        order by e.starts_at asc
        limit 3
      `,
      [event.id],
    );

    const origin = emailOrigin();
    const dates = formatEmailDates(event.starts_at, event.ends_at, event.timezone);
    const suggestions = suggestedResult.rows.map((s) => {
      const d = formatEmailDates(s.starts_at, null, s.timezone);
      return {
        url: `${origin}/events/${s.slug}`,
        title: s.title,
        line: [d.eventLongDate, s.suburb].filter(Boolean).join(" · "),
      };
    });
    const suggestedEventsHtml = renderSuggestedEventsBlock(suggestions);

    // Per attendee: issue the 100% refund (full remaining balance), then email.
    // Each refund is isolated - a Stripe failure logs to refund_failures and the
    // cancellation/notice still goes out (spec §5 "refund fails during bulk").
    let refundedCount = 0;
    await Promise.all(
      affectedProfiles.map(async (attendee) => {
        let refundLabel = "You were not charged.";

        if (attendee.refundableCents > 0 && attendee.paymentTransactionId) {
          const dollars = formatAud(attendee.refundableCents, attendee.currency);
          try {
            const { issueRefund } = await import("./stripe-sync");
            const refundResult = await issueRefund({
              paymentTransactionId: attendee.paymentTransactionId,
              reason: "requested_by_customer",
              adminProfileId: actor.kind === "admin" ? actor.actorProfileId : null,
            });
            refundedCount += 1;
            refundLabel = `A full refund of ${dollars} is on the way (3 - 5 business days).`;
            // Lifecycle log: merchant cancel always refunds 100% regardless of
            // tier, so refund_tier is null. Best-effort; idempotent on refund id.
            await logBookingEvent(pool, {
              bookingId: attendee.bookingId,
              eventId: event.id,
              merchantId: event.merchant_profile_id,
              userId: attendee.profileId,
              eventType: "refunded_full",
              amountCents: -attendee.refundableCents,
              currency: attendee.currency,
              stripeObjectId: refundResult.stripeRefundId,
              actor: actor.kind,
            }).catch(() => {});
          } catch (err) {
            refundLabel =
              `We're processing your full refund - if it hasn't arrived within 7 days, contact ${SUPPORT_EMAIL}.`;
            await pool
              .query(
                `insert into refund_failures (payment_transaction_id, event_id, profile_id, amount_cents, currency, error_message)
                 values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)`,
                [
                  attendee.paymentTransactionId,
                  event.id,
                  attendee.profileId,
                  attendee.refundableCents,
                  attendee.currency,
                  err instanceof Error ? err.message : String(err),
                ],
              )
              .catch(() => {});
          }
        }

        // Persist and deliver the cancellation with the real refund label and
        // suggestions. Awaiting it prevents serverless shutdown mid-send.
        await logEmailEvent({
          template: "event-cancelled-attendee",
          toEmail: attendee.email,
          toProfileId: attendee.profileId,
          vars: {
            firstName: (attendee.displayName || "").split(/\s+/)[0] || "there",
            eventTitle: event.title,
            eventLongDate: dates.eventLongDate,
            eventStartTime: dates.eventStartTime,
            eventHostName: actor.kind === "admin" ? "Click" : event.host_name,
            cancellationReason: actor.reason,
            refundLabel,
            suggestedEvents: suggestedEventsHtml,
            discoverUrl: `${origin}/discover`,
            supportEmail: SUPPORT_EMAIL,
            unsubscribeUrl: `${origin}/account-settings`,
          },
        });
      }),
    );

    if (
      actor.kind === "admin" &&
      !alreadyCancelled &&
      event.host_email &&
      event.host_profile_id
    ) {
      await logEmailEvent({
        template: "event-cancelled-merchant",
        toEmail: event.host_email,
        toProfileId: event.host_profile_id,
        vars: {
          merchantFirstName:
            (event.host_display_name || event.host_name || "there").split(/\s+/)[0] || "there",
          eventTitle: event.title,
          cancellationReason: actor.reason,
          attendeeCount: String(affectedProfiles.length),
          refundCount: String(refundedCount),
          eventDashboardUrl: `${origin}/merchant/events/${event.slug}`,
          supportEmail: "hello@letsclick.app",
        },
      });
    }

    return {
      eventTitle: event.title,
      notified: profilesNeedingNotice.length,
      refunded: refundedCount,
      alreadyCancelled,
    };
  } catch (error) {
    if (!committed) {
      await client.query("rollback");
      throw error;
    }
    // Past the commit there is nothing to roll back and nothing to retry: the
    // event IS cancelled, the seats ARE released, and an unknown number of
    // refunds have already gone out. Telling the host it failed would invite a
    // second cancel; telling them it succeeded would hide real money that never
    // moved. Say exactly what happened instead. Individual refund failures do
    // not reach here - those are isolated per attendee and recorded in
    // refund_failures - so this is the rarer "the fan-out itself broke" case.
    console.error("cancelEvent failed AFTER commit", { eventId, actor: actor.kind, error });
    const partial = new Error(
      "This event is cancelled and seats are released, but we hit a problem finishing the refunds and notifications. Do not cancel again - contact " +
        SUPPORT_EMAIL +
        " and we'll complete it.",
    );
    partial.name = "PartialCancellationError";
    throw partial;
  } finally {
    client.release();
  }
}

export type PaymentHold = {
  paymentTransactionId: string;
  eventUuid: string;
  eventSlug: string;
  eventTitle: string;
  // Base ticket price (the merchant's listed price).
  priceCents: number;
  // Platform booking fee added on top of the ticket (system_settings.booking_fee_bps,
  // snapshotted at hold time). 0 when the fee is disabled.
  bookingFeeCents: number;
  // Total Stripe application fee across all seats, snapshotted from the same
  // settings used for transaction reporting.
  applicationFeeCents: number | null;
  // What the buyer actually pays = (priceCents + bookingFeeCents) × seatCount.
  // Persisted as payment_transactions.amount_cents so receipts/refunds reconcile.
  totalCents: number;
  // Total seats on this booking: the purchaser + their named/unnamed guests
  // (1–4). priceCents / bookingFeeCents above are PER SEAT.
  seatCount: number;
  // Validated, normalized guest details to carry in Stripe session metadata so
  // the webhook can name the reserved seats. Empty for a solo booking.
  guests: NormalizedGuest[];
  currency: string;
  profileEmail: string;
  // Connected merchant's Stripe account id when present + payouts ready.
  // Null for legacy platform-managed events where the platform itself is the
  // merchant - those keep the existing single-charge behaviour.
  merchantStripeAccountId: string | null;
  // One deterministic expiry is shared by the DB hold and Stripe Session so
  // concurrent retries send byte-for-byte identical creation parameters.
  holdExpiresAt: Date;
  stripeCheckoutSessionId: string | null;
  reused: boolean;
};

export async function createPaymentHold(
  eventSlug: string,
  session: Session | null,
  options?: { seatCount?: number; guests?: GuestDetailInput[] },
): Promise<PaymentHold> {
  // Total seats = purchaser (1) + up to GUEST_MAX guests. Named guests can't
  // exceed the extra seats. seatCount is clamped/validated against capacity below.
  const requestedGuests = options?.guests ?? [];
  const seatCount = Math.max(1, Math.min(1 + GUEST_MAX, Math.trunc(options?.seatCount ?? 1)));
  if (requestedGuests.length > seatCount - 1) {
    const error = new Error("You've named more friends than the seats you're buying.");
    error.name = "ValidationError";
    throw error;
  }
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  await assertBookingEligible(pool, profile.id);
  const client = await pool.connect();

  try {
    await client.query("begin");

    const eventResult = await client.query<{
      id: string;
      title: string;
      slug: string;
      capacity: number;
      status: string;
      price_cents: number;
      currency: string;
      starts_at: Date;
      merchant_profile_id: string | null;
      merchant_stripe_account_id: string | null;
      merchant_charges_enabled: boolean | null;
      merchant_verification_status: string | null;
      confirmed_attendees: string;
      has_ended: boolean;
      has_live_waitlist_offer: boolean;
    }>(
      `
        select
          event.id::text,
          event.title,
          event.slug,
          event.capacity,
          event.status::text,
          event.price_cents,
          event.currency,
          event.starts_at,
          event.merchant_profile_id::text,
          merchant.stripe_connect_account_id as merchant_stripe_account_id,
          merchant.charges_enabled as merchant_charges_enabled,
          merchant.verification_status as merchant_verification_status,
          (coalesce(event.ends_at, event.starts_at) <= now()) as has_ended,
          exists (
            select 1
            from event_waitlists own_offer
            join event_attendees own_attendee
              on own_attendee.event_id = own_offer.event_id
             and own_attendee.profile_id = own_offer.profile_id
             and own_attendee.status = 'waitlisted'
            where own_offer.event_id = event.id
              and own_offer.profile_id = $2::uuid
              and own_offer.accepted_at is null
              and own_offer.offered_until > now()
          ) as has_live_waitlist_offer,
          (
            (
              select count(*)
              from event_attendees attendee
              where attendee.event_id = event.id
                -- Exclude THIS buyer's own seat: a returning buyer who already
                -- holds a pending_payment seat (a failed/abandoned first attempt)
                -- must not be counted against capacity by their own hold, or the
                -- retry throws "Event is full" about a seat that is theirs. The
                -- hold is reused via the on-conflict upsert below.
                and attendee.profile_id <> $2::uuid
                and (attendee.status = 'confirmed' or (attendee.status = 'pending_payment' and attendee.hold_expires_at > now()))
            )
            +
            -- Guest seats (spec 19): each non-cancelled guest_spots row is a held
            -- seat. Count it only while its purchaser's booking is live (confirmed
            -- or an unexpired hold), mirroring the attendee rule above, and exclude
            -- THIS buyer's own reserved guest seats so a retry isn't blocked by them.
            (
              select count(*)
              from guest_spots gs
              join event_attendees ga
                on ga.payment_transaction_id = gs.payment_transaction_id
              where gs.event_id = event.id
                and gs.status <> 'cancelled'
                and gs.purchaser_profile_id <> $2::uuid
                and (ga.status = 'confirmed' or (ga.status = 'pending_payment' and ga.hold_expires_at > now()))
            )
            +
            -- A live waitlist offer held by SOMEONE ELSE reserves their seat for
            -- the 30-min window, so a stranger can't pay for a seat that was just
            -- offered to the next person in line (bug board #114). The buyer's own
            -- offer is excluded so the offered person can actually claim + pay.
            (
              select count(*)
              from event_waitlists w
              join event_attendees wa
                on wa.event_id = w.event_id
               and wa.profile_id = w.profile_id
               and wa.status = 'waitlisted'
              where w.event_id = event.id
                and w.accepted_at is null
                and w.offered_until > now()
                and w.profile_id <> $2::uuid
            )
          ) as confirmed_attendees
        from events event
        left join merchant_profiles merchant on merchant.id = event.merchant_profile_id
        where event.slug = $1
        for update of event
      `,
      [eventSlug, profile.id],
    );

    const event = eventResult.rows[0];
    if (!event) {
      const error = new Error("Event not found.");
      error.name = "NotFoundError";
      throw error;
    }
    if (event.price_cents <= 0) {
      const error = new Error("This event is free - use the Register button instead.");
      error.name = "ValidationError";
      throw error;
    }
    // Past events are closed: no new checkout holds once the event has ended.
    if (event.has_ended) {
      const error = new Error("This event has already ended.");
      error.name = "ValidationError";
      throw error;
    }
    if (!isBookableEventStatus(event.status)) {
      const error = new Error("This event is not accepting bookings.");
      error.name = "ValidationError";
      throw error;
    }

    // Merchant-hosted paid events must route the charge to the merchant's
    // connected account via destination charge. Platform-managed events
    // (merchant_profile_id IS NULL) skip this and bill into the platform.
    if (event.merchant_profile_id) {
      // Suspending a host hid their events from Discover and revoked event
      // auto-approval, but never closed the direct event URL - so an admin who
      // had just suspended a host for cause could still watch that host take
      // live money from anyone holding the link.
      if (event.merchant_verification_status === "suspended") {
        const error = new Error("This event isn't accepting bookings right now.");
        error.name = "ValidationError";
        throw error;
      }
      // isRealConnectAccountId, not a truthiness check. merchant_profiles can
      // legitimately hold a PLACEHOLDER id - `acct_seed_*` from
      // database/002_seed.sql, or the QA persona's FAKE_CONNECT_ACCOUNT - and a
      // placeholder is truthy. Paired with a seeded charges_enabled=true it
      // sailed through this gate, and checkout then sent the placeholder to
      // Stripe as transfer_data.destination, which 403s ("does not have access
      // to account ..."). The buyer got a raw Stripe message in a 500 instead of
      // the "host is finishing payout setup" 409 this branch exists to give
      // them. Same predicate the onboarding route uses to decide whether to mint
      // a real account, so the two can't disagree about what counts as set up.
      if (
        !isRealConnectAccountId(event.merchant_stripe_account_id) ||
        !event.merchant_charges_enabled
      ) {
        const error = new Error(
          "This event isn't accepting payments yet - the host is finishing payout setup.",
        );
        error.name = "PayoutsNotReadyError";
        throw error;
      }
    }

    // The one value that leaves this module and becomes a Stripe API argument
    // (transfer_data.destination / on_behalf_of in the checkout route). The gate
    // above already refused a placeholder on a merchant-hosted event, so this is
    // belt-and-braces - but it puts the "real account id or nothing" guarantee
    // at the point of use rather than 200 lines away, and it covers the
    // platform-owned path (merchant_profile_id NULL) that skips the gate.
    const merchantStripeAccountId = isRealConnectAccountId(
      event.merchant_stripe_account_id,
    )
      ? event.merchant_stripe_account_id
      : null;

    const confirmedCount = Number(event.confirmed_attendees);
    const available = event.capacity - confirmedCount;
    if ((event.status === "waitlist" && !event.has_live_waitlist_offer) || available <= 0) {
      const error = new Error("Event is full - join the waitlist instead.");
      error.name = "ConflictError";
      throw error;
    }
    // Multi-seat (guest) bookings need the whole party to fit. The purchaser's
    // own seat is excluded from confirmedCount above, so the party of `seatCount`
    // must fit within `available`. We don't partial-fill a group.
    if (seatCount > available) {
      const error = new Error(
        available === 1
          ? "Only one seat is left - you can't bring guests on this one."
          : `Only ${available} seats are left - reduce your party size.`,
      );
      error.name = "ConflictError";
      throw error;
    }

    // Validate named guests under the lock (spec §13): shape + 18+ at the event
    // date, then DB checks - suppressed emails and emails that already hold a
    // live spot at this event are rejected here (the webhook re-checks as the
    // final guard). Purchaser's own email is rejected by validateGuestDetails.
    const normalizedGuests = validateGuestDetails(requestedGuests, {
      purchaserEmail: profile.email,
      eventDate: event.starts_at,
    });
    if (normalizedGuests.length > 0) {
      const emails = normalizedGuests.map((g) => g.email);
      const suppressed = await filterSuppressedEmails(client, emails);
      const live = await liveGuestEmailsForEvent(client, event.id, emails);
      const blocked = normalizedGuests.find(
        (g) => suppressed.has(g.email) || live.has(g.email),
      );
      if (blocked) {
        const reason = suppressed.has(blocked.email)
          ? `${blocked.firstName} asked not to be invited to Click events.`
          : `${blocked.firstName} already has a spot at this event.`;
        const error = new Error(reason);
        error.name = "ValidationError";
        throw error;
      }
    }

    // Application-level checkout idempotency. The event row lock serialises
    // repeated requests for the same buyer/event, and an active hold is reused
    // instead of inserting a second payment ledger row. Stripe is keyed by the
    // returned transaction id, so retries also resolve to the same Checkout
    // Session even if the client request is duplicated or its response is lost.
    const activeHoldResult = await client.query<{
      id: string;
      amount_cents: number;
      application_fee_cents: number | null;
      seat_count: string;
      hold_expires_at: Date;
      stripe_checkout_session_id: string | null;
    }>(
      `
        select
          payment.id::text,
          payment.amount_cents,
          payment.application_fee_cents,
          attendee.hold_expires_at,
          payment.stripe_checkout_session_id,
          (
            1 + (
              select count(*)
              from guest_spots guest
              where guest.payment_transaction_id = payment.id
                and guest.status <> 'cancelled'
            )
          )::text as seat_count
        from event_attendees attendee
        join payment_transactions payment on payment.id = attendee.payment_transaction_id
        where attendee.event_id = $1::uuid
          and attendee.profile_id = $2::uuid
          and attendee.status = 'pending_payment'
          and attendee.hold_expires_at > now()
          and payment.status = 'pending'
        limit 1
        for update of attendee, payment
      `,
      [event.id, profile.id],
    );
    const activeHold = activeHoldResult.rows[0];
    if (activeHold) {
      const heldSeatCount = Number(activeHold.seat_count);
      if (heldSeatCount !== seatCount) {
        const error = new Error(
          `You already have a checkout open for ${heldSeatCount} seat${heldSeatCount === 1 ? "" : "s"}. Complete or wait for it to expire before changing the party size.`,
        );
        error.name = "ConflictError";
        throw error;
      }
      const heldPerSeatCents = Math.trunc(activeHold.amount_cents / heldSeatCount);
      await client.query("commit");
      return {
        paymentTransactionId: activeHold.id,
        eventUuid: event.id,
        eventSlug: event.slug,
        eventTitle: event.title,
        priceCents: event.price_cents,
        bookingFeeCents: Math.max(0, heldPerSeatCents - event.price_cents),
        applicationFeeCents: activeHold.application_fee_cents,
        totalCents: activeHold.amount_cents,
        seatCount: heldSeatCount,
        guests: normalizedGuests,
        currency: event.currency,
        profileEmail: profile.email,
        merchantStripeAccountId,
        holdExpiresAt: activeHold.hold_expires_at,
        stripeCheckoutSessionId: activeHold.stripe_checkout_session_id,
        reused: true,
      };
    }

    const existing = await client.query<{ status: string }>(
      `
        select status::text
        from event_attendees
        where event_id = $1::uuid and profile_id = $2::uuid
        limit 1
      `,
      [event.id, profile.id],
    );
    if (existing.rows[0]?.status === "confirmed") {
      const error = new Error("You're already registered for this event.");
      error.name = "ConflictError";
      throw error;
    }

    // Self-heal the "I paid but it says pay again" case (bug board #135): the
    // buyer's first checkout succeeded at Stripe, but the webhook / return
    // reconciliation never flipped their seat to confirmed (a crash mid-flow,
    // a dropped webhook). They land back here and we'd otherwise charge them a
    // SECOND time. If ANY of their transactions for this event is already
    // 'paid', the money is in - promote the seat in place and stop, rather than
    // opening a new checkout. markPaymentSucceeded stays the primary path; this
    // is the backstop that prevents a double charge.
    // Only a transaction that still backs a LIVE seat counts. A booking cancelled
    // inside the no-refund window (or whose refund failed) keeps its ledger row at
    // 'paid' forever - cancelRegistration never writes payment_transactions - so an
    // unscoped lookup here permanently blocks that buyer from ever re-booking.
    // Mirrors the same guard markPaymentSucceeded already applies.
    const paidTxn = await client.query<{ id: string }>(
      `
        select pt.id::text
        from payment_transactions pt
        join event_attendees a
          on a.event_id = pt.event_id and a.profile_id = pt.profile_id
        where pt.event_id = $1::uuid
          and pt.profile_id = $2::uuid
          and pt.status = 'paid'
          and a.status <> 'cancelled'
        limit 1
      `,
      [event.id, profile.id],
    );
    if (paidTxn.rows[0]) {
      await client.query(
        `
          update event_attendees
          set status = 'confirmed', hold_expires_at = null, updated_at = now()
          where event_id = $1::uuid and profile_id = $2::uuid and status = 'pending_payment'
        `,
        [event.id, profile.id],
      );
      await client.query("commit");
      const error = new Error(
        "You've already paid for this event - your spot is confirmed. Refresh the page to see your booking.",
      );
      error.name = "ConflictError";
      throw error;
    }

    // Booking fee is charged on top of the ticket and kept by the platform.
    // Snapshot it at hold time so a later admin change to the rate can't alter an
    // in-flight checkout. Per-seat figures; amount_cents stores the FULL buyer
    // charge across all seats (ticket + fee) × seatCount.
    const { bookingFeeBps, commissionRateBps } = await getSystemSettings();
    const bookingFeeCents = Math.round((event.price_cents * bookingFeeBps) / 10_000);
    const perSeatCents = event.price_cents + bookingFeeCents;
    const totalCents = perSeatCents * seatCount;

    // Stamp the platform's cut (commission) at hold time so platform-revenue
    // reporting has a value the moment the booking confirms - not NULL until a
    // later Stripe sync backfills `charge.application_fee_amount`. This must
    // equal exactly what checkout sends as `application_fee_amount` (the
    // platform fee on the ticket PLUS the whole booking fee), across all seats,
    // so syncing the real charge later is a no-op reconciliation. Only
    // merchant-hosted events are destination charges with an application fee;
    // platform-owned events have no connected account, so leave it NULL.
    const applicationFeeCents = event.merchant_stripe_account_id
      ? (calculateApplicationFee(event.price_cents, commissionRateBps) + bookingFeeCents) * seatCount
      : null;

    const paymentResult = await client.query<{ id: string }>(
      `
        insert into payment_transactions (event_id, profile_id, merchant_profile_id, amount_cents, application_fee_cents, currency, status)
        values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, 'pending')
        returning id::text
      `,
      [event.id, profile.id, event.merchant_profile_id, totalCents, applicationFeeCents, event.currency],
    );
    const paymentTransactionId = paymentResult.rows[0].id;

    const attendeeRow = await client.query<{ id: string; hold_expires_at: Date }>(
      `
        insert into event_attendees (event_id, profile_id, status, payment_transaction_id, hold_expires_at)
        values ($1::uuid, $2::uuid, 'pending_payment', $3::uuid, now() + interval '31 minutes')
        on conflict (event_id, profile_id) do update
        set status = 'pending_payment', payment_transaction_id = excluded.payment_transaction_id, hold_expires_at = now() + interval '31 minutes', updated_at = now()
        returning id::text, hold_expires_at
      `,
      [event.id, profile.id, paymentTransactionId],
    );

    // Reserve the friends' seats now, as unnamed placeholders (zero PII) tied to
    // this pending booking, so a concurrent buyer can't take them while the
    // purchaser is in Stripe Checkout. They get names at webhook time. First
    // cancel any guest seats left over from this buyer's own earlier abandoned
    // hold on this event so they don't accumulate as orphans.
    if (seatCount > 1) {
      await client.query(
        `
          update guest_spots gs
          set status = 'cancelled', updated_at = now()
          from payment_transactions pt
          where gs.payment_transaction_id = pt.id
            and gs.event_id = $1::uuid
            and gs.purchaser_profile_id = $2::uuid
            and gs.status <> 'cancelled'
            and pt.status <> 'paid'
            and pt.id <> $3::uuid
        `,
        [event.id, profile.id, paymentTransactionId],
      );
      await reserveUnnamedGuestSeats(client, {
        paymentTransactionId,
        eventId: event.id,
        purchaserProfileId: profile.id,
        count: seatCount - 1,
      });
    }

    // Append-only lifecycle log (spec 22 §2): the seat is reserved pending
    // payment. In-txn so the reservation and its log commit atomically.
    await logBookingEvent(client, {
      bookingId: attendeeRow.rows[0].id,
      eventId: event.id,
      merchantId: event.merchant_profile_id,
      userId: profile.id,
      eventType: "reserved",
      amountCents: totalCents,
      currency: event.currency,
      actor: "attendee",
      metadata: seatCount > 1 ? { seat_count: seatCount } : undefined,
    });

    await client.query("commit");

    return {
      paymentTransactionId,
      eventUuid: event.id,
      eventSlug: event.slug,
      eventTitle: event.title,
      priceCents: event.price_cents,
      bookingFeeCents,
      applicationFeeCents,
      totalCents,
      seatCount,
      guests: normalizedGuests,
      currency: event.currency,
      profileEmail: profile.email,
      merchantStripeAccountId,
      holdExpiresAt: attendeeRow.rows[0].hold_expires_at,
      stripeCheckoutSessionId: null,
      reused: false,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// Names the reserved guest seats from the Stripe session's `guest_details`
// metadata once payment is confirmed (spec 19 §5). Called from the webhook and
// from reconcileCheckoutSession (the return/cron fallback), both of which hold
// the session metadata. Best-effort + idempotent: re-runs skip already-named
// guests and only fire side effects for seats named in THIS pass, so webhook
// replays don't double-invite. Never throws into the caller.
export async function processGuestSpotsForSession(args: {
  paymentTransactionId: string;
  guestDetailsJson: string | null | undefined;
}): Promise<void> {
  const pool = getPostgresPool();
  if (!pool || !args.guestDetailsJson) return;

  let parsed: NormalizedGuest[];
  try {
    const raw = JSON.parse(args.guestDetailsJson);
    if (!Array.isArray(raw)) return;
    parsed = raw
      .map((g) => ({
        firstName: String(g?.firstName ?? ""),
        email: String(g?.email ?? "").toLowerCase(),
        dob: String(g?.dob ?? ""),
      }))
      .filter((g) => g.firstName && g.email);
  } catch {
    return;
  }
  if (parsed.length === 0) return;

  try {
    // Only name guests for a confirmed (paid) booking.
    const ctx = await pool.query<{
      event_id: string;
      purchaser_profile_id: string;
      purchaser_name: string;
      title: string;
      slug: string;
      starts_at: Date;
      timezone: string;
      suburb: string | null;
    }>(
      `
        select pt.event_id::text,
               pt.profile_id::text as purchaser_profile_id,
               p.display_name as purchaser_name,
               e.title, e.slug, e.starts_at, e.timezone, e.suburb
        from payment_transactions pt
        join profiles p on p.id = pt.profile_id
        join events e on e.id = pt.event_id
        where pt.id = $1::uuid and pt.status = 'paid'
      `,
      [args.paymentTransactionId],
    );
    const booking = ctx.rows[0];
    if (!booking) return;

    const client = await pool.connect();
    let outcomes: Awaited<ReturnType<typeof nameReservedGuestSeats>> = [];
    try {
      await client.query("begin");
      outcomes = await nameReservedGuestSeats(client, {
        paymentTransactionId: args.paymentTransactionId,
        eventId: booking.event_id,
        guests: parsed,
      });
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => {});
      console.warn("processGuestSpotsForSession naming failed", error);
      return;
    } finally {
      client.release();
    }

    const origin = emailOrigin();
    const purchaserFirst = (booking.purchaser_name || "").split(/\s+/)[0] || "A friend";
    const dates = formatEmailDates(booking.starts_at, null, booking.timezone);
    const suburb = booking.suburb ?? "";
    const named: string[] = [];

    for (const o of outcomes) {
      if (o.kind === "invited") {
        named.push(o.firstName);
        await logEmailEvent({
          template: "guest-invite",
          toEmail: o.email,
          vars: {
            guestFirstName: o.firstName,
            purchaserFirstName: purchaserFirst,
            eventTitle: booking.title,
            eventLongDate: dates.eventLongDate,
            suburb,
            claimUrl: `${origin}/claim/${o.claimToken}`,
            releaseUrl: `${origin}/claim/${o.claimToken}?action=release`,
            removeUrl: `${origin}/claim/${o.claimToken}?action=remove`,
          },
        });
      } else if (o.kind === "claimed") {
        named.push(o.firstName);
        void pool
          .query(
            `insert into notifications (profile_id, title, body, action_url) values ($1::uuid, $2, $3, $4)`,
            [
              o.claimedProfileId,
              `${purchaserFirst} saved you a spot`,
              `${purchaserFirst} saved you a spot at ${booking.title} - it's in your Upcoming Events.`,
              `/events/${booking.slug}`,
            ],
          )
          .catch(() => {});
        await logEmailEvent({
          template: "guest-spot-existing-user",
          toEmail: o.email,
          toProfileId: o.claimedProfileId,
          vars: {
            purchaserFirstName: purchaserFirst,
            eventTitle: booking.title,
            eventLongDate: dates.eventLongDate,
            suburb,
            eventUrl: `${origin}/events/${booking.slug}`,
            releaseUrl: `${origin}/events/${booking.slug}`,
          },
        });
      } else {
        // Skipped (suppressed / already-has-a-spot / no-seat): tell the
        // purchaser the seat stays theirs as a +1 (spec §5 partial-failure rule).
        const why =
          o.kind === "skipped_conflict"
            ? `${o.firstName} already has a spot at this event`
            : `We couldn't save a named spot for ${o.firstName}`;
        void pool
          .query(
            `insert into notifications (profile_id, title, body, action_url) values ($1::uuid, $2, $3, $4)`,
            [
              booking.purchaser_profile_id,
              "A guest spot stayed unnamed",
              `${why} - the seat is still yours to bring a +1.`,
              `/events/${booking.slug}`,
            ],
          )
          .catch(() => {});
      }
    }

    if (named.length > 0) {
      void pool
        .query(
          `insert into notifications (profile_id, title, body, action_url) values ($1::uuid, $2, $3, $4)`,
          [
            booking.purchaser_profile_id,
            "Spots saved for your guests",
            `Spots saved for: ${named.join(", ")}. They'll get an invite from Click.`,
            `/events/${booking.slug}`,
          ],
        )
        .catch(() => {});
    }
  } catch (error) {
    console.warn("processGuestSpotsForSession failed", error);
  }
}

// ---------------------------------------------------------------------------
// Guest claim flow (spec 19 §7, §10.2, §10.4)
// ---------------------------------------------------------------------------

export type GuestSpotView = {
  state: "valid" | "not_found" | "expired" | "claimed" | "gone";
  guestFirstName: string | null;
  purchaserName: string | null;
  eventTitle: string | null;
  eventSlug: string | null;
  eventLongDate: string | null;
  suburb: string | null;
  guestEmail: string | null;
};

// Read-only lookup for the /claim/[token] page. Mirrors the spec's state table:
// not_found / expired / claimed / gone (released|removed|cancelled or booking
// not confirmed) / valid.
export async function getGuestSpotByToken(token: string): Promise<GuestSpotView> {
  const empty: GuestSpotView = {
    state: "not_found",
    guestFirstName: null,
    purchaserName: null,
    eventTitle: null,
    eventSlug: null,
    eventLongDate: null,
    suburb: null,
    guestEmail: null,
  };
  const pool = getPostgresPool();
  if (!pool || !isUuid(token)) return empty;

  const res = await pool.query<{
    status: string;
    expired: boolean;
    booking_confirmed: boolean;
    guest_first_name: string | null;
    guest_email: string | null;
    purchaser_name: string | null;
    title: string;
    slug: string;
    starts_at: Date;
    timezone: string;
    suburb: string | null;
  }>(
    `
      select
        gs.status::text,
        (gs.claim_token_expires_at <= now()) as expired,
        (att.id is not null) as booking_confirmed,
        gs.guest_first_name,
        gs.guest_email,
        p.display_name as purchaser_name,
        e.title, e.slug, e.starts_at, e.timezone, e.suburb
      from guest_spots gs
      join events e on e.id = gs.event_id
      join profiles p on p.id = gs.purchaser_profile_id
      left join event_attendees att
        on att.payment_transaction_id = gs.payment_transaction_id
       and att.profile_id = gs.purchaser_profile_id
       and att.status = 'confirmed'
      where gs.claim_token = $1::uuid
      limit 1
    `,
    [token],
  );
  const row = res.rows[0];
  if (!row) return empty;

  const dates = formatEmailDates(row.starts_at, null, row.timezone);
  const base: GuestSpotView = {
    state: "valid",
    guestFirstName: row.guest_first_name,
    purchaserName: row.purchaser_name,
    eventTitle: row.title,
    eventSlug: row.slug,
    eventLongDate: dates.eventLongDate,
    suburb: row.suburb,
    guestEmail: row.guest_email,
  };

  if (row.status === "claimed") return { ...base, state: "claimed" };
  if (row.status === "released" || row.status === "removed" || row.status === "cancelled" || !row.booking_confirmed) {
    return { ...base, state: "gone" };
  }
  if (row.expired) return { ...base, state: "expired" };
  return base; // 'invited' + live + booking confirmed
}

export type ClaimResult =
  | { ok: true; eventSlug: string }
  | { ok: false; reason: "unavailable" }
  | { ok: false; reason: "email-mismatch"; invitedEmailMasked: string };

// The claim token is a bearer credential that travels - the page's own comment
// says so, because release/remove genuinely have to work for a friend with no
// account. Claiming is different: it binds a PAID seat to an identity. Without
// this check, a forwarded link let whoever opened it take the seat, and the
// purchaser was still told the invited guest had claimed it.
function maskEmailForClaim(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return "the invited address";
  const head = local.slice(0, 1) || "?";
  return `${head}${"•".repeat(Math.max(local.length - 1, 1))}@${domain}`;
}

// Atomic claim (spec §7). Links the token's seat to the signed-in profile. The
// WHERE clause is the race guard: a second tab / a release in between yields 0
// rows. Notifies the purchaser (8.4) on success.
export async function claimGuestSpotForProfile(
  token: string,
  profileId: string,
  opts?: { allowDifferentEmail?: boolean },
): Promise<ClaimResult> {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  if (!isUuid(token)) return { ok: false, reason: "unavailable" };

  // Who is claiming, and who was this seat saved for? Compared before the
  // update so a mismatch can be explained rather than silently bound.
  const who = await pool.query<{
    guest_email: string | null;
    claimer_email: string | null;
    claimer_name: string | null;
    is_banned: boolean;
    suspended_at: Date | null;
  }>(
    `
      select gs.guest_email::text,
             p.email::text as claimer_email,
             p.display_name as claimer_name,
             p.is_banned,
             p.suspended_at
      from guest_spots gs
      cross join profiles p
      where gs.claim_token = $1::uuid and p.id = $2::uuid
      limit 1
    `,
    [token, profileId],
  );
  // A claimed +1 is a seat in the same room, taken for free - so the ban that
  // stops the RSVP, the paid hold and the waitlist has to stop this too, or a
  // forwarded invite is the way straight past all three. Checked before the
  // mismatch branch below so a refusal can't be used to probe who was invited.
  assertNotBannedFromSeats(who.rows[0]);

  const invitedEmail = who.rows[0]?.guest_email?.trim().toLowerCase() ?? "";
  const claimerEmail = who.rows[0]?.claimer_email?.trim().toLowerCase() ?? "";
  const claimerName = who.rows[0]?.claimer_name?.trim() || null;
  const differentPerson = Boolean(invitedEmail) && invitedEmail !== claimerEmail;

  if (differentPerson && !opts?.allowDifferentEmail) {
    return {
      ok: false,
      reason: "email-mismatch",
      invitedEmailMasked: maskEmailForClaim(invitedEmail),
    };
  }

  const res = await pool.query<{
    id: string;
    event_slug: string;
    event_title: string;
    guest_first_name: string | null;
    purchaser_profile_id: string;
  }>(
    `
      update guest_spots gs
      set status = 'claimed', claimed_at = now(), claimed_profile_id = $2::uuid, updated_at = now()
      from events e
      where gs.claim_token = $1::uuid
        and gs.status = 'invited'
        and gs.claim_token_expires_at > now()
        and e.id = gs.event_id
        -- The address is re-checked here, not just above, so a claim confirmed
        -- for one identity cannot be raced onto another.
        and ($3::text is null or lower(gs.guest_email) = $3::text)
        -- only claimable while the purchaser's booking is actually confirmed
        and exists (
          select 1 from event_attendees att
          where att.payment_transaction_id = gs.payment_transaction_id
            and att.profile_id = gs.purchaser_profile_id
            and att.status = 'confirmed'
        )
      returning gs.id::text, e.slug as event_slug, e.title as event_title,
                gs.guest_first_name, gs.purchaser_profile_id::text
    `,
    [token, profileId, differentPerson ? null : invitedEmail || null],
  );
  const row = res.rows[0];
  if (!row) return { ok: false, reason: "unavailable" };

  // Notify the purchaser their guest joined (spec §8.4). Best-effort. When
  // somebody other than the invited address claimed it, the purchaser is told
  // who actually did - the old copy named the invited guest either way, so a
  // forwarded link reported the wrong person as being in.
  const invitedName = row.guest_first_name || "Your guest";
  const claimedBy = differentPerson ? claimerName || claimerEmail || "Someone else" : invitedName;
  void pool
    .query(
      `insert into notifications (profile_id, title, body, action_url) values ($1::uuid, $2, $3, $4)`,
      [
        row.purchaser_profile_id,
        `${claimedBy} is in ✨`,
        differentPerson
          ? `${claimedBy} claimed the spot you saved for ${invitedName} at ${row.event_title}.`
          : `${invitedName} joined Click and claimed their spot at ${row.event_title}.`,
        `/events/${row.event_slug}`,
      ],
    )
    .catch(() => {});

  return { ok: true, eventSlug: row.event_slug };
}

export type GuestTokenActionResult = { ok: boolean };

// Friend releases their seat (spec §10.2). Token-authenticated, no account.
// Seat reverts to the purchaser's held +1 (still paid - capacity unchanged);
// identity is unlinked; the purchaser is notified (8.5). Never refunds.
export async function releaseGuestSpotByToken(token: string): Promise<GuestTokenActionResult> {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  if (!isUuid(token)) return { ok: false };

  const res = await pool.query<{
    event_slug: string;
    event_title: string;
    guest_first_name: string | null;
    purchaser_profile_id: string;
  }>(
    `
      update guest_spots gs
      set status = 'released', claimed_profile_id = null, updated_at = now()
      from events e
      where gs.claim_token = $1::uuid
        and gs.status in ('invited', 'claimed')
        and e.id = gs.event_id
      returning e.slug as event_slug, e.title as event_title,
                gs.guest_first_name, gs.purchaser_profile_id::text
    `,
    [token],
  );
  const row = res.rows[0];
  if (!row) return { ok: false };

  void pool
    .query(
      `insert into notifications (profile_id, title, body, action_url) values ($1::uuid, $2, $3, $4)`,
      [
        row.purchaser_profile_id,
        `${row.guest_first_name || "A guest"} can't make it`,
        `${row.guest_first_name || "A guest"}'s seat at ${row.event_title} is back with you as a +1 - keep it or cancel it for a refund per the policy.`,
        `/events/${row.event_slug}`,
      ],
    )
    .catch(() => {});

  return { ok: true };
}

// "Remove my details" (spec §10.4). Token-authenticated, instant, no account.
// Nulls PII, suppresses the email so nobody can re-invite it, leaves the seat
// held as an anonymous +1. Idempotent.
export async function removeGuestDetailsByToken(token: string): Promise<GuestTokenActionResult> {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  if (!isUuid(token)) return { ok: false };

  const client = await pool.connect();
  try {
    await client.query("begin");
    const found = await client.query<{
      id: string;
      guest_email: string | null;
      event_slug: string;
      purchaser_profile_id: string;
    }>(
      `
        select gs.id::text, gs.guest_email, e.slug as event_slug, gs.purchaser_profile_id::text
        from guest_spots gs
        join events e on e.id = gs.event_id
        where gs.claim_token = $1::uuid
          -- 'cancelled' is terminal: the seat was refunded and its capacity
          -- returned. Without this guard the update below flipped it back to
          -- 'removed', and because every seat count treats any non-cancelled
          -- row as occupied, a refunded seat silently re-consumed capacity. The
          -- two sibling token actions already guard their statuses (claim
          -- requires 'invited', release requires 'invited'/'claimed'); this was
          -- the only one matching on the token alone. Still idempotent for a
          -- seat that is already 'removed'.
          and gs.status <> 'cancelled'
        for update of gs
      `,
      [token],
    );
    const row = found.rows[0];
    if (!row) {
      await client.query("rollback");
      return { ok: false };
    }
    // Already removed → idempotent success.
    if (row.guest_email && row.guest_email !== "[removed]") {
      await client.query(
        `insert into guest_email_suppression (email_hash, reason)
         values ($1, 'removed_by_guest') on conflict (email_hash) do nothing`,
        [hashGuestEmail(row.guest_email)],
      );
    }
    await client.query(
      `
        update guest_spots
        set status = 'removed', guest_first_name = 'Guest', guest_email = '[removed]',
            guest_dob = null, claimed_profile_id = null, updated_at = now()
        where id = $1::uuid
      `,
      [row.id],
    );
    await client.query(
      `insert into notifications (profile_id, title, body, action_url) values ($1::uuid, $2, $3, $4)`,
      [
        row.purchaser_profile_id,
        "A guest seat is now unnamed",
        "One of your guests removed their details. The seat is still yours to bring a +1.",
        `/events/${row.event_slug}`,
      ],
    );
    await client.query("commit");
    return { ok: true };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function attachPaymentIntent(
  paymentTransactionId: string,
  stripePaymentIntentId: string | null,
) {
  const pool = getPostgresPool();
  if (!pool || !stripePaymentIntentId) return;

  // Only set the PI once - don't clobber an id a later sync already wrote.
  await pool.query(
    `
      update payment_transactions
      set stripe_payment_intent_id = $2, updated_at = now()
      where id = $1::uuid and stripe_payment_intent_id is null
    `,
    [paymentTransactionId, stripePaymentIntentId],
  );
}

// Persists the Stripe Checkout Session id captured at session creation. Unlike
// the PaymentIntent (null until the buyer pays), the session id is available
// immediately, so this is the durable Stripe handle we reconcile pending rows
// against later - see reconcilePendingTransactions in stripe-sync.ts.
export async function attachCheckoutSession(
  paymentTransactionId: string,
  stripeCheckoutSessionId: string | null,
) {
  const pool = getPostgresPool();
  if (!pool || !stripeCheckoutSessionId) return;

  // `is null` alone made the corrected-guest rebuild a silent no-op: the row kept
  // pointing at the Session we just expired, so every reconcile path judged the
  // transaction by a Session the buyer had abandoned. Writing whenever the id
  // DIFFERS keeps the race this guard was for - two concurrent creates share an
  // idempotency key, so Stripe hands back the same Session id and the second
  // write is a no-op - while letting a deliberate replacement land.
  await pool.query(
    `
      update payment_transactions
      set stripe_checkout_session_id = $2, updated_at = now()
      where id = $1::uuid
        and (stripe_checkout_session_id is null or stripe_checkout_session_id <> $2)
    `,
    [paymentTransactionId, stripeCheckoutSessionId],
  );
}

export async function markPaymentSucceeded(paymentTransactionId: string): Promise<boolean> {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const client = await pool.connect();
  try {
    await client.query("begin");

    // Load + lock the payment row. We deliberately do NOT gate the lookup on
    // `status <> 'paid'`: another path (a missed-webhook backstop, or
    // syncTransactionFromStripe enriching the ledger) may have already flipped
    // the txn to 'paid' while leaving the seat stuck on 'pending_payment'. The
    // `for update` lock serialises concurrent webhook/reconcile/sync callers so
    // the side effects below fire exactly once.
    const paymentResult = await client.query<{
      id: string;
      event_id: string;
      profile_id: string;
      status: string;
      amount_cents: number;
      currency: string;
      event_title: string;
      event_slug: string;
      event_status: string;
      merchant_profile_id: string | null;
      display_name: string;
      profile_email: string;
      attendee_status: string | null;
      attendee_hold_expires_at: Date | null;
    }>(
      `
        select
          id::text,
          event_id::text,
          profile_id::text,
          status::text,
          amount_cents,
          currency::text as currency,
          merchant_profile_id::text,
          (select title from events where id = payment_transactions.event_id) as event_title,
          (select slug from events where id = payment_transactions.event_id) as event_slug,
          (select status::text from events where id = payment_transactions.event_id) as event_status,
          (select display_name from profiles where id = payment_transactions.profile_id) as display_name,
          (select email::text from profiles where id = payment_transactions.profile_id) as profile_email
          ,(select status::text
              from event_attendees
             where event_id = payment_transactions.event_id
               and profile_id = payment_transactions.profile_id
             limit 1) as attendee_status
          ,(select hold_expires_at
              from event_attendees
             where event_id = payment_transactions.event_id
               and profile_id = payment_transactions.profile_id
             limit 1) as attendee_hold_expires_at
        from payment_transactions
        where id = $1::uuid
        for update
      `,
      [paymentTransactionId],
    );
    const payment = paymentResult.rows[0];
    if (!payment) {
      // Unknown txn id (foreign Stripe session / dev data) - exit cleanly.
      await client.query("rollback");
      return false;
    }

    // A Checkout Session remains `payment_status=paid` in Stripe after its
    // charge has been refunded. Success URLs, webhook retries and reconciliation
    // sweeps can therefore replay long after the attendee cancelled. Refunded
    // ledger states are terminal: never move the money back to `paid`, never
    // restore the seat, and never resend confirmation side effects.
    if (payment.status === "refunded" || payment.status === "partially_refunded") {
      await client.query("rollback");
      return false;
    }

    const activePaymentHold =
      payment.attendee_status === "pending_payment" &&
      payment.attendee_hold_expires_at instanceof Date &&
      payment.attendee_hold_expires_at.getTime() > Date.now();
    const alreadyConfirmed = payment.attendee_status === "confirmed";

    // A charge can settle after an event was unpublished, after the buyer
    // cancelled an unpaid hold, or after that hold expired. In all three cases
    // the money is real but the booking is not: never restore the seat or send
    // a confirmation. Instead, persist the capture and issue a full refund.
    //
    // A transaction that was already `paid` and whose attendee later cancelled
    // is intentionally excluded for a live event: it may be a legitimate
    // no-refund-window cancellation and replaying the success URL must be a
    // complete no-op rather than changing the agreed refund outcome.
    const eventCannotFulfil = !isBookableEventStatus(payment.event_status);
    const newSettlementHasNoSeat =
      payment.status !== "paid" && !activePaymentHold && !alreadyConfirmed;
    const paidHoldExpiredBeforeFulfilment =
      payment.status === "paid" && payment.attendee_status === "pending_payment" && !activePaymentHold;
    if (eventCannotFulfil || newSettlementHasNoSeat || paidHoldExpiredBeforeFulfilment) {
      if (payment.status !== "paid") {
        await client.query(
          `update payment_transactions set status = 'paid', updated_at = now() where id = $1::uuid`,
          [paymentTransactionId],
        );
      }
      const cancelledSeat = await client.query<{ id: string }>(
        `
          update event_attendees
          set status = 'cancelled', hold_expires_at = null, updated_at = now()
          where event_id = $1::uuid and profile_id = $2::uuid and status <> 'cancelled'
          returning id::text
        `,
        [payment.event_id, payment.profile_id],
      );
      // The seat row always exists (a hold created it); fall back to a lookup if
      // it was already cancelled so the lifecycle log still has a real booking id.
      let cancelledBookingId = cancelledSeat.rows[0]?.id ?? null;
      if (!cancelledBookingId) {
        const seat = await client.query<{ id: string }>(
          `select id::text from event_attendees where event_id = $1::uuid and profile_id = $2::uuid limit 1`,
          [payment.event_id, payment.profile_id],
        );
        cancelledBookingId = seat.rows[0]?.id ?? null;
      }
      const firstInvalidSettlement =
        payment.status !== "paid" || (cancelledSeat.rowCount ?? 0) > 0;
      if (firstInvalidSettlement) {
        await client.query(
          `
            insert into notifications (profile_id, title, body, action_url)
            values ($1::uuid, $2, $3, $4)
          `,
          [
            payment.profile_id,
            "Booking unavailable - refund on the way",
            eventCannotFulfil
              ? `${payment.event_title} is no longer available. A full refund is on the way.`
              : `Your booking hold for ${payment.event_title} ended before payment cleared. A full refund is on the way.`,
            `/events/${payment.event_slug}`,
          ],
        );
      }
      await client.query("commit");

      // Refund the captured charge in full, out-of-band (its own txn + Stripe
      // call). On failure, record it for the operator queue - same pattern as
      // the bulk cancellation path.
      try {
        const { issueRefund } = await import("./stripe-sync");
        const refundResult = await issueRefund({
          paymentTransactionId: payment.id,
          reason: "requested_by_customer",
          adminProfileId: null,
        });
        // Lifecycle log: full refund of a payment that settled post-cancellation.
        // Post-commit + best-effort; idempotent on the Stripe refund id.
        await logBookingEvent(pool, {
          bookingId: cancelledBookingId ?? payment.id,
          eventId: payment.event_id,
          merchantId: payment.merchant_profile_id,
          userId: payment.profile_id,
          eventType: "refunded_full",
          amountCents: -refundResult.amountCents,
          currency: payment.currency,
          stripeObjectId: refundResult.stripeRefundId,
          actor: "system",
          metadata: {
            reason: eventCannotFulfil
              ? "payment_settled_after_event_unpublished"
              : "payment_settled_after_booking_hold_ended",
          },
        }).catch(() => {});
        // The in-app notification above is not enough on its own. Someone who
        // paid on their phone and closed the app got no signal at all that the
        // booking had failed or that money was coming back. releaseSeat is false
        // - the seat was already cancelled in the transaction above.
        await settleRefundedBooking({
          paymentTransactionId: payment.id,
          refundedAmountCents: refundResult.amountCents,
          releaseSeat: false,
          notify: true,
        });
      } catch {
        await pool
          .query(
            `insert into refund_failures (payment_transaction_id, event_id, profile_id, amount_cents, currency, error_message)
             values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)`,
            [
              payment.id,
              payment.event_id,
              payment.profile_id,
              payment.amount_cents,
              payment.currency,
              eventCannotFulfil
                ? "Auto-refund failed: payment settled after event was unpublished"
                : "Auto-refund failed: payment settled after booking hold ended",
            ],
          )
          .catch(() => null);
      }
      return false;
    }

    // Flip the ledger forward. Track whether THIS call did it so a retry that
    // finds it already 'paid' doesn't re-send the receipt.
    const txnFlipped = payment.status !== "paid";
    if (txnFlipped) {
      await client.query(
        `update payment_transactions set status = 'paid', updated_at = now() where id = $1::uuid`,
        [paymentTransactionId],
      );
    }

    // Promote only a live payment hold. A paid booking cancelled inside the
    // no-refund window legitimately keeps the transaction `paid` while its seat
    // is `cancelled`; replaying the old success URL must not resurrect it. The
    // pending-only predicate still self-heals the intended missed-webhook case.
    const attendeeUpdate = await client.query<{ id: string }>(
      `
        update event_attendees
        set status = 'confirmed', hold_expires_at = null, updated_at = now()
        where event_id = $1::uuid
          and profile_id = $2::uuid
          and status = 'pending_payment'
          and hold_expires_at > now()
        returning id::text
      `,
      [payment.event_id, payment.profile_id],
    );
    const attendeeFlipped = (attendeeUpdate.rowCount ?? 0) > 0;

    // Lifecycle log (spec 22 §2): record 'confirmed' exactly when the seat
    // actually transitions to confirmed. The FOR UPDATE lock on the payment row
    // serialises webhook/reconcile/return callers, so this fires once. In-txn so
    // the confirmation and its log commit together.
    if (attendeeFlipped) {
      await logBookingEvent(client, {
        bookingId: attendeeUpdate.rows[0].id,
        eventId: payment.event_id,
        merchantId: payment.merchant_profile_id,
        userId: payment.profile_id,
        eventType: "confirmed",
        amountCents: payment.amount_cents,
        currency: payment.currency,
        actor: "stripe_webhook",
      });
    }

    // Notify/email only on a genuine first transition (ledger OR seat just
    // flipped). Webhook retries and backstop re-runs are no-ops past this point.
    const firstTransition = txnFlipped || attendeeFlipped;
    if (firstTransition) {
      await client.query(
        `
          insert into notifications (profile_id, title, body, action_url)
          values ($1::uuid, $2, $3, $4)
        `,
        [
          payment.profile_id,
          "Payment confirmed",
          `${payment.event_title} is booked for ${payment.display_name}.`,
          "/dashboard/calendar",
        ],
      );
    }

    await client.query("commit");

    if (firstTransition) {
      // Use the same templated rsvp-attendee / rsvp-merchant flow that free
      // RSVPs already trigger via registerForEvent, passing the receipt so the
      // price slot shows "$25 · Paid" instead of the event's listed price.
      // Fire-and-forget - failures inside logRsvpEmails warn-log and never
      // throw, so a template/email hiccup can't roll back the booking.
      void logRsvpEmails(pool, payment.event_id, payment.profile_id, {
        amountPaidCents: payment.amount_cents,
        currency: payment.currency,
      });

      // Plus the GST tax receipt for the charged amount. Fire-and-forget.
      void logPaymentReceiptEmail(pool, payment.id);

      // Paid RSVP can also be a proposal's suggested event - nudge the mutual.
      void notifyProposalPartnerOfRsvp(pool, payment.event_id, payment.profile_id);
    }
    return attendeeFlipped || payment.attendee_status === "confirmed";
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export type ConfirmedEvents = {
  upcoming: EventItem[];
  past: EventItem[];
};

export async function getBookmarkedEvents(session: Session | null): Promise<EventItem[]> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!pool || !email) return [];

  try {
    const profile = await ensureProfileForSession(session);
    const result = await pool.query<EventRow>(
      `
        select ${eventSelectColumns}
        from bookmarks bookmark
        join events event on event.id = bookmark.event_id
        left join event_attendees attendee_count on attendee_count.event_id = event.id
        left join event_tags event_tag on event_tag.event_id = event.id
        left join tags tag on tag.id = event_tag.tag_id
        where bookmark.profile_id = $1::uuid
          and event.status <> 'cancelled'
          and coalesce(event.ends_at, event.starts_at) > now()
        group by event.id, bookmark.created_at
        order by bookmark.created_at desc
      `,
      [profile.id],
    );
    return result.rows.map(eventFromRow);
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("getBookmarkedEvents fallback", error);
    }
    return [];
  }
}

export async function getConfirmedEvents(session: Session | null): Promise<ConfirmedEvents> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!pool || !email) return { upcoming: [], past: [] };

  try {
    const profile = await ensureProfileForSession(session);
    const [upcomingResult, pastResult] = await Promise.all([
      pool.query<EventRow>(
        `
          select ${eventSelectColumns}
          from ${seatRowsSql} own_attendee
          join events event on event.id = own_attendee.event_id
          left join event_attendees attendee_count on attendee_count.event_id = event.id
          left join event_tags event_tag on event_tag.event_id = event.id
          left join tags tag on tag.id = event_tag.tag_id
          where own_attendee.profile_id = $1::uuid
            and own_attendee.status in ('confirmed', 'waitlisted')
            -- Split on when the event ENDS, not when it starts, so a booking
            -- being attended right now is still "upcoming" here. Splitting on
            -- starts_at filed a 7-10pm event under Past at 7:05pm while the
            -- dashboard and the calendar chip both still called it upcoming.
            and coalesce(event.ends_at, event.starts_at) >= now()
          group by event.id
          order by event.starts_at asc
        `,
        [profile.id],
      ),
      pool.query<EventRow>(
        `
          select ${eventSelectColumns}
          from ${seatRowsSql} own_attendee
          join events event on event.id = own_attendee.event_id
          left join event_attendees attendee_count on attendee_count.event_id = event.id
          left join event_tags event_tag on event_tag.event_id = event.id
          left join tags tag on tag.id = event_tag.tag_id
          where own_attendee.profile_id = $1::uuid
            -- Past = nights you actually had a seat for. A waitlist spot that
            -- never converted was being filed here as a plan, and the card then
            -- rendered it as "You're going" in the past tense.
            and own_attendee.status = 'confirmed'
            and coalesce(event.ends_at, event.starts_at) < now()
          group by event.id
          order by event.starts_at desc
          limit 50
        `,
        [profile.id],
      ),
    ]);

    return {
      upcoming: upcomingResult.rows.map(eventFromRow),
      past: pastResult.rows.map(eventFromRow),
    };
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("getConfirmedEvents fallback", error);
    }
    return { upcoming: [], past: [] };
  }
}

export type PublicProfile = {
  id: string;
  displayName: string;
  city: string;
  suburb: string | null;
  bio: string | null;
  photoUrl: string | null;
  age: number | null;
  intents: string[];
  // The owner's dating-mode visibility (migration 005). Gates the "dating"
  // intent chip: it renders only on mutual dating opt-in (owner on AND the
  // viewer open to dating) - a friends-only viewer never sees a dating label.
  datingVisible: boolean;
  interests: { slug: string; label: string }[];
  /** null when the member has hidden it - render nothing, not zero. */
  attendedCount: number | null;
  // Up to 5 extra photos (migration 042), public `avatars` bucket gallery/ prefix.
  galleryPhotos: string[];
  // Answered profile prompts with labels resolved from the curated catalogue.
  prompts: { id: string; label: string; answer: string }[];
  // The "tick" - true once an admin has stamped photo_verified_at.
  verified: boolean;
};

export type OwnProfile = PublicProfile & {
  email: string;
  role: string;
  // Curated tag slugs split by type so the edit form can pre-check the right
  // chips. `interests` (on PublicProfile) stays the full label list for display.
  interestSlugs: string[];
  musicSlugs: string[];
  // Discovery/privacy switches (migration 005). Owner-only, so they live here
  // rather than on PublicProfile.
  datingVisible: boolean;
  flexibleDiscovery: boolean;
  // True once the user has saved Life Quiz answers (any user_tags row with
  // source='quiz'). Drives the "Take" vs "Retake" copy on /profile/edit.
  lifeQuizCompleted: boolean;
  // Persisted notification + privacy preferences (migration 040). Drive the
  // /account-settings toggles and the public-profile visibility gates.
  settings: AccountSettings;
};

export type NotificationPrefs = {
  eventReminders: boolean;
  waitlistOffers: boolean;
  mutualClick: boolean;
  weeklyRecap: boolean;
  productUpdates: boolean;
};

export type AccountSettings = {
  notifications: NotificationPrefs;
  showSuburb: boolean;
  showAttendanceCount: boolean;
  /**
   * profiles.default_attend_visibility - the attendee-list opt-out. Off takes the
   * owner's face off the "who's going" preview on every event card and off the
   * post-event roster, which also makes them unclickable from an event they chose
   * not to be listed at. The column shipped in migration 049 and nothing read or
   * wrote it, so the opt-out existed only in the schema.
   */
  showOnAttendeeLists: boolean;
  allowMerchantMessages: boolean;
};

function coerceNotificationPrefs(value: unknown): NotificationPrefs {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    eventReminders: raw.eventReminders !== false,
    waitlistOffers: raw.waitlistOffers !== false,
    mutualClick: raw.mutualClick !== false,
    weeklyRecap: raw.weeklyRecap === true,
    productUpdates: raw.productUpdates === true,
  };
}

export async function getOwnProfile(session: Session | null): Promise<OwnProfile | null> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!pool || !email) return null;

  try {
    const profile = await ensureProfileForSession(session);
    const [profileResult, tagsResult, attendedResult] = await Promise.all([
      pool.query<{
        id: string;
        display_name: string;
        email: string;
        role: string;
        city: string;
        suburb: string | null;
        bio: string | null;
        photo_url: string | null;
        age: number | null;
        connection_intents: string[];
        dating_visible: boolean;
        flexible_discovery: boolean;
        notification_prefs: unknown;
        show_suburb: boolean;
        show_attendance_count: boolean;
        default_attend_visibility: boolean;
        allow_merchant_messages: boolean;
        gallery_photos: string[];
        prompts: unknown;
        photo_verified_at: Date | null;
      }>(
        `
          select id::text, display_name, email::text, role::text, city, suburb, bio, photo_url, age,
                 connection_intents::text[] as connection_intents,
                 dating_visible, flexible_discovery,
                 notification_prefs, show_suburb, show_attendance_count, allow_merchant_messages,
                 default_attend_visibility,
                 gallery_photos, prompts, photo_verified_at
          from profiles
          where id = $1::uuid
        `,
        [profile.id],
      ),
      pool.query<{ slug: string; label: string; tag_type: string; source: string | null }>(
        `
          select tag.slug, tag.label, tag.tag_type, ut.source
          from user_tags ut
          join tags tag on tag.id = ut.tag_id
          where ut.profile_id = $1::uuid
          order by tag.label asc
        `,
        [profile.id],
      ),
      pool.query<{ count: string }>(
        `
          select count(*)::text as count
          from event_attendees
          where profile_id = $1::uuid and status = 'confirmed'
        `,
        [profile.id],
      ),
    ]);

    const row = profileResult.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      role: row.role,
      city: row.city,
      suburb: row.suburb,
      bio: row.bio,
      photoUrl: row.photo_url,
      age: row.age,
      intents: row.connection_intents ?? [],
      // Only interest-type tags surface as "Interests" on /profile so the chips
      // line up exactly with the editable Interest section on /profile/edit.
      // (Life/vibe quiz tags + music are separate signals, edited elsewhere.)
      interests: tagsResult.rows
        .filter((t) => t.tag_type === "interest")
        .map((t) => ({ slug: t.slug, label: t.label })),
      interestSlugs: tagsResult.rows.filter((t) => t.tag_type === "interest").map((t) => t.slug),
      musicSlugs: tagsResult.rows.filter((t) => t.tag_type === "music").map((t) => t.slug),
      galleryPhotos: row.gallery_photos ?? [],
      prompts: resolveProfilePrompts(row.prompts),
      verified: !!row.photo_verified_at,
      datingVisible: row.dating_visible,
      flexibleDiscovery: row.flexible_discovery,
      lifeQuizCompleted: tagsResult.rows.some((t) => t.source === "quiz"),
      settings: {
        notifications: coerceNotificationPrefs(row.notification_prefs),
        showSuburb: row.show_suburb,
        showAttendanceCount: row.show_attendance_count,
        showOnAttendeeLists: row.default_attend_visibility,
        allowMerchantMessages: row.allow_merchant_messages,
      },
      attendedCount: Number(attendedResult.rows[0]?.count ?? 0),
    };
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("getOwnProfile fallback", error);
    }
    return null;
  }
}

export async function getPublicProfileById(profileId: string): Promise<PublicProfile | null> {
  const pool = getPostgresPool();
  if (!pool) return null;

  try {
    const [profileResult, tagsResult, attendedResult] = await Promise.all([
      pool.query<{
        id: string;
        display_name: string;
        city: string;
        suburb: string | null;
        bio: string | null;
        photo_url: string | null;
        age: number | null;
        connection_intents: string[];
        dating_visible: boolean;
        show_suburb: boolean;
        show_attendance_count: boolean;
        gallery_photos: string[];
        prompts: unknown;
        photo_verified_at: Date | null;
      }>(
        `
          select id::text, display_name, city, suburb, bio, photo_url, age,
                 connection_intents::text[] as connection_intents,
                 dating_visible,
                 show_suburb, show_attendance_count,
                 gallery_photos, prompts, photo_verified_at
          from profiles
          where id = $1::uuid
            -- This IS the public projection, so the removal has to bite here.
            -- Banning or suspending an account severs its coordination and takes
            -- it out of discovery and every roster, but its /profile/<uuid> page
            -- kept rendering to anyone holding the link - name, face, suburb, age,
            -- gallery, prompts - which is most of what a ban is meant to remove.
            -- Returning null instead lands the caller on the same not-found page a
            -- made-up id gets, so the page is not an account-state oracle either.
            and is_banned = false
            and suspended_at is null
            -- Same reasoning, one step further: an account de-identified at the
            -- member's own request must not keep serving a profile page at all.
            -- The scrub leaves the row intact so bookings and payments stay
            -- linked, so without this the page still renders - "Deleted member"
            -- with an empty shell, at a URL someone may still hold. A deletion
            -- that leaves a page behind has not deleted the page.
            and deleted_at is null
        `,
        [profileId],
      ),
      // Interest tags ONLY. Life-quiz answers ride in user_tags too, as
      // tag_type 'life' ("Recently single", "New parent", "Career pivot"), and
      // this query used to return them - so answers collected to tune
      // suggestions rendered as public chips under "Into" to anyone with the
      // URL, signed out included. getOwnProfile filters the same way, which
      // meant the owner never saw them on their own profile and had no way to
      // discover the disclosure. Keep the filter here, not in the caller: this
      // function IS the public projection.
      pool.query<{ slug: string; label: string }>(
        `
          select tag.slug, tag.label
          from user_tags ut
          join tags tag on tag.id = ut.tag_id
          where ut.profile_id = $1::uuid
            and tag.tag_type = 'interest'
          order by tag.label asc
        `,
        [profileId],
      ),
      pool.query<{ count: string }>(
        `
          select count(*)::text as count
          from event_attendees
          where profile_id = $1::uuid and status = 'confirmed'
        `,
        [profileId],
      ),
    ]);

    const row = profileResult.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      displayName: row.display_name,
      city: row.city,
      // Suburb + attendance count are privacy-gated (migration 040): when the
      // owner has hidden them, other viewers see them as withheld.
      suburb: row.show_suburb ? row.suburb : null,
      bio: row.bio,
      photoUrl: row.photo_url,
      age: row.age,
      intents: row.connection_intents ?? [],
      datingVisible: Boolean(row.dating_visible),
      interests: tagsResult.rows.map((t) => ({ slug: t.slug, label: t.label })),
      // null = hidden. Returning 0 published "been to 0 events" on the profile
      // of everyone who turned the toggle off - untrue, and the deficit framing
      // the language rules forbid.
      attendedCount: row.show_attendance_count
        ? Number(attendedResult.rows[0]?.count ?? 0)
        : null,
      galleryPhotos: row.gallery_photos ?? [],
      prompts: resolveProfilePrompts(row.prompts),
      verified: !!row.photo_verified_at,
    };
  } catch {
    return null;
  }
}

export type ProfileUpdateInput = {
  displayName?: string;
  suburb?: string;
  bio?: string;
  photoUrl?: string;
  age?: number | null;
  intents?: string[];
  // Curated tag slugs. When provided, the user's tags of that type are fully
  // replaced (delete + re-attach matched). Pass `[]` to clear. Only `interest`
  // and `music` rows are touched - quiz-sourced `life`/`vibe` tags are left
  // alone. Slugs must already exist in `tags`; unknown ones are dropped.
  interestTags?: string[];
  musicTags?: string[];
  // Discovery/privacy switches (migration 005). Undefined = leave unchanged.
  datingVisible?: boolean;
  flexibleDiscovery?: boolean;
  // Answered profile prompts (migration 042). When provided, the stored set is
  // fully replaced - pass `[]` to clear. Re-sanitised here so the invariants
  // (known ids, ≤3, answer length) hold no matter the caller.
  prompts?: ProfilePromptAnswer[];
};

// Replaces every `user_tags` row of one tag_type for a profile with the given
// curated slugs (matched against existing admin tags). Runs inside the caller's
// transaction client. Tags are "click tags" - unknown slugs are silently
// dropped rather than minting new rows.
async function syncUserTagsOfType(
  client: import("pg").PoolClient,
  profileId: string,
  tagType: "interest" | "music",
  slugs: string[],
  source: "user" | "music",
) {
  await client.query(
    `
      delete from user_tags ut
      using tags tag
      where ut.profile_id = $1::uuid
        and ut.tag_id = tag.id
        and tag.tag_type = $2
    `,
    [profileId, tagType],
  );

  const cleaned = Array.from(
    new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean)),
  ).slice(0, 32);

  if (cleaned.length === 0) return;

  await client.query(
    `
      insert into user_tags (profile_id, tag_id, source)
      select $1::uuid, tag.id, $4
      from tags tag
      where tag.tag_type = $2
        and tag.slug = any($3::text[])
      on conflict do nothing
    `,
    [profileId, tagType, cleaned, source],
  );
}

export async function updateOwnProfile(
  session: Session | null,
  input: ProfileUpdateInput,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const email = getSessionEmail(session);
  if (!email) throw authError();

  const profile = await ensureProfileForSession(session);

  const updates: string[] = [];
  const params: unknown[] = [profile.id];
  let i = 2;

  if (input.displayName !== undefined && input.displayName.trim()) {
    updates.push(`display_name = $${i++}`);
    params.push(input.displayName.trim());
  }
  if (input.suburb !== undefined) {
    updates.push(`suburb = $${i++}`);
    params.push(input.suburb.trim() || null);
  }
  if (input.bio !== undefined) {
    updates.push(`bio = $${i++}`);
    params.push(input.bio.trim() || null);
  }
  if (input.photoUrl !== undefined) {
    updates.push(`photo_url = $${i++}`);
    params.push(input.photoUrl.trim() || null);
  }
  if (input.age !== undefined) {
    updates.push(`age = $${i++}`);
    params.push(input.age);
  }
  // An explicitly EMPTY array is a real instruction - "I want no intents" - and
  // must write, not be skipped. The old `&& length > 0` guard made deselecting
  // every intent card a silent no-op that still redirected as though it saved.
  // Absent (undefined) still means "leave unchanged", which is what the avatar
  // route relies on: api/upload/avatar passes only photoUrl.
  if (input.intents !== undefined) {
    updates.push(`connection_intents = $${i++}::connection_intent[]`);
    params.push(input.intents);
  }
  if (input.datingVisible !== undefined) {
    updates.push(`dating_visible = $${i++}`);
    params.push(input.datingVisible);
  }
  if (input.flexibleDiscovery !== undefined) {
    updates.push(`flexible_discovery = $${i++}`);
    params.push(input.flexibleDiscovery);
  }
  if (input.prompts !== undefined) {
    updates.push(`prompts = $${i++}::jsonb`);
    params.push(JSON.stringify(sanitizeProfilePrompts(input.prompts)));
  }

  const syncsInterests = input.interestTags !== undefined;
  const syncsMusic = input.musicTags !== undefined;

  // Nothing to do - bail before opening a connection.
  if (updates.length === 0 && !syncsInterests && !syncsMusic) return;

  const client = await pool.connect();
  try {
    await client.query("begin");

    if (updates.length > 0) {
      await client.query(
        `update profiles set ${updates.join(", ")}, updated_at = now() where id = $1::uuid`,
        params,
      );
    }
    if (syncsInterests) {
      await syncUserTagsOfType(client, profile.id, "interest", input.interestTags ?? [], "user");
    }
    if (syncsMusic) {
      await syncUserTagsOfType(client, profile.id, "music", input.musicTags ?? [], "music");
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// Persist a single account-settings toggle. `key` is a stable identifier from
// the settings UI; each maps to either a column or a field inside the
// notification_prefs jsonb. Returns the new boolean so the client can confirm.
export type AccountSettingKey =
  | "notify.eventReminders"
  | "notify.waitlistOffers"
  | "notify.mutualClick"
  | "notify.weeklyRecap"
  | "notify.productUpdates"
  | "showSuburb"
  | "showAttendanceCount"
  | "showOnAttendeeLists"
  | "allowMerchantMessages";

export async function updateAccountSetting(
  session: Session | null,
  key: AccountSettingKey,
  value: boolean,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const email = getSessionEmail(session);
  if (!email) throw authError();

  const profile = await ensureProfileForSession(session);

  const columnByKey: Partial<Record<AccountSettingKey, string>> = {
    showSuburb: "show_suburb",
    showAttendanceCount: "show_attendance_count",
    showOnAttendeeLists: "default_attend_visibility",
    allowMerchantMessages: "allow_merchant_messages",
  };

  if (key in columnByKey) {
    const column = columnByKey[key]!;
    await pool.query(
      `update profiles set ${column} = $2, updated_at = now() where id = $1::uuid`,
      [profile.id, value],
    );
    return value;
  }

  if (key.startsWith("notify.")) {
    const field = key.slice("notify.".length);
    // jsonb_set merges the single field, leaving the rest of the blob intact.
    await pool.query(
      `update profiles
         set notification_prefs = jsonb_set(coalesce(notification_prefs, '{}'::jsonb), $2::text[], $3::jsonb, true),
             updated_at = now()
       where id = $1::uuid`,
      [profile.id, `{${field}}`, JSON.stringify(value)],
    );
    return value;
  }

  const error = new Error("Unknown setting.");
  error.name = "ValidationError";
  throw error;
}

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  actionUrl: string | null;
  channel: string;
  readAt: string | null;
  createdAt: string;
};

export async function getNotificationsForSession(session: Session | null): Promise<NotificationRow[]> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!pool || !email) return [];

  try {
    const profile = await ensureProfileForSession(session);
    const result = await pool.query<{
      id: string;
      title: string;
      body: string;
      action_url: string | null;
      channel: string;
      read_at: Date | null;
      created_at: Date;
    }>(
      `
        select id::text, title, body, action_url, channel::text,
               read_at, created_at
        from notifications
        where profile_id = $1::uuid
        order by read_at is not null, created_at desc
        limit 50
      `,
      [profile.id],
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      actionUrl: row.action_url,
      channel: row.channel,
      readAt: row.read_at ? row.read_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
    }));
  } catch {
    return [];
  }
}

export function getUnreadNotificationCount(session: Session | null): Promise<number> {
  return memoizeBySessionEmail("unreadNotifications", session, () =>
    getUnreadNotificationCountUncached(session),
  );
}

async function getUnreadNotificationCountUncached(session: Session | null): Promise<number> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!pool || !email) return 0;

  try {
    const profile = await ensureProfileForSession(session);
    const result = await pool.query<{ count: string }>(
      `select count(*)::text as count from notifications
       where profile_id = $1::uuid and read_at is null`,
      [profile.id],
    );
    return Number(result.rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function markNotificationRead(
  session: Session | null,
  notificationId: string,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const email = getSessionEmail(session);
  if (!email) throw authError();

  const profile = await ensureProfileForSession(session);
  await pool.query(
    `
      update notifications
      set read_at = now()
      where id = $1::uuid and profile_id = $2::uuid and read_at is null
    `,
    [notificationId, profile.id],
  );
}

export async function markAllNotificationsRead(session: Session | null) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const email = getSessionEmail(session);
  if (!email) throw authError();

  const profile = await ensureProfileForSession(session);
  await pool.query(
    `update notifications set read_at = now() where profile_id = $1::uuid and read_at is null`,
    [profile.id],
  );
}

export type NotificationEmailView = {
  notification: NotificationRow;
  email: {
    id: string;
    template: string;
    subject: string;
    html: string;
    toEmail: string;
    createdAt: string;
  } | null;
};

// Resolve the email that was logged for a given notification. There's no FK
// between `notifications` and `email_events` today - every wired trigger
// inserts both rows in the same handler, so we pick the closest `email_events`
// row for the recipient within a small time window. Returns the notification
// itself even when no matching email row exists (older notifications, or
// templates whose handler hasn't been wired to `logEmailEvent` yet).
export async function getNotificationEmailForSession(
  session: Session | null,
  notificationId: string,
): Promise<NotificationEmailView | null> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!pool || !email) return null;

  const profile = await ensureProfileForSession(session);

  const notifResult = await pool.query<{
    id: string;
    title: string;
    body: string;
    action_url: string | null;
    channel: string;
    read_at: Date | null;
    created_at: Date;
  }>(
    `
      select id::text, title, body, action_url, channel::text,
             read_at, created_at
      from notifications
      where id = $1::uuid and profile_id = $2::uuid
      limit 1
    `,
    [notificationId, profile.id],
  );

  const notif = notifResult.rows[0];
  if (!notif) return null;

  // Match the email by the TEMPLATE that corresponds to this notification, not
  // just "nearest email in time" - otherwise a waitlist "Spot available" or
  // mutual-click notification grabbed whatever unrelated email happened to be
  // logged closest to it (e.g. the canceller's cancellation receipt), showing
  // the wrong email. We derive template patterns from the notification's title
  // + body and only surface an email whose template actually matches.
  const haystack = `${notif.title} ${notif.body}`.toLowerCase();
  const templatePatterns: string[] = [];
  if (haystack.includes("mutual") || haystack.includes("clicked")) {
    templatePatterns.push("%mutual-click%");
  }
  if (haystack.includes("spot") || haystack.includes("waitlist")) {
    templatePatterns.push("%waitlist%");
  }
  if (haystack.includes("payment") || haystack.includes("receipt") || haystack.includes("paid")) {
    templatePatterns.push("%payment%");
  }
  if (haystack.includes("cancel")) {
    templatePatterns.push("%cancelled%");
  }
  if (haystack.includes("rsvp") || haystack.includes("confirmed") || haystack.includes("you're in")) {
    templatePatterns.push("%rsvp%");
  }
  if (haystack.includes("approved") || haystack.includes("review")) {
    templatePatterns.push("%event-approved%", "%event-rejected%");
  }

  // No recognised template for this notification → show the notification alone
  // rather than risk surfacing an unrelated email.
  const emailResult =
    templatePatterns.length === 0
      ? { rows: [] as Array<{
          id: string;
          template: string;
          subject: string;
          html: string;
          to_email: string;
          created_at: Date;
        }> }
      : await pool.query<{
          id: string;
          template: string;
          subject: string;
          html: string;
          to_email: string;
          created_at: Date;
        }>(
          `
            select id::text, template, subject, html, to_email::text as to_email,
                   created_at
            from email_events
            where to_profile_id = $1::uuid
              and template ilike any($3::text[])
              and created_at between $2::timestamptz - interval '30 minutes'
                                and $2::timestamptz + interval '30 minutes'
            order by abs(extract(epoch from (created_at - $2::timestamptz))) asc
            limit 1
          `,
          [profile.id, notif.created_at, templatePatterns],
        );

  const emailRow = emailResult.rows[0];

  return {
    notification: {
      id: notif.id,
      title: notif.title,
      body: notif.body,
      actionUrl: notif.action_url,
      channel: notif.channel,
      readAt: notif.read_at ? notif.read_at.toISOString() : null,
      createdAt: notif.created_at.toISOString(),
    },
    email: emailRow
      ? {
          id: emailRow.id,
          template: emailRow.template,
          subject: emailRow.subject,
          html: emailRow.html,
          toEmail: emailRow.to_email,
          createdAt: emailRow.created_at.toISOString(),
        }
      : null,
  };
}

export type SuggestedPerson = {
  id: string;
  displayName: string;
  suburb: string | null;
  photoUrl: string | null;
  age: number | null;
  sharedInterests: string[];
  // Inputs for the People Card's commonality line - deliberately NON-interest
  // axes, so the line can never duplicate the interest tags rendered beneath it.
  // Both are optional: when neither resolves, the card omits the line cleanly.
  sharedEvent: string | null;
  nearby: boolean;
  intents: string[];
  // True when the viewer has already sent this person a (still-active) Click
  // that hasn't gone mutual yet. Lets the card show a persistent "Click sent -
  // waiting" state instead of resetting to "Click privately" on every reload.
  alreadyClicked: boolean;
};

export async function getSuggestedPeople(session: Session | null): Promise<SuggestedPerson[]> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!pool || !email || !isClickMechanicEnabled()) return [];

  try {
    const profile = await ensureProfileForSession(session);
    const result = await pool.query<{
      id: string;
      display_name: string;
      suburb: string | null;
      photo_url: string | null;
      age: number | null;
      shared: string[];
      shared_event: string | null;
      nearby: boolean;
      intents: string[];
      already_clicked: boolean;
      actionable_mutuals: number;
      inactive: boolean;
    }>(
      `
        select p.id::text, p.display_name, p.suburb, p.photo_url, p.age,
               coalesce(
                 array_agg(distinct shared_tag.label)
                   filter (where shared_tag.label is not null),
                 '{}'
               ) as shared,
               -- The People Card's commonality line needs a NON-interest axis,
               -- so it can never just restate the interest tags under it. Axis 1
               -- is a past event you both actually attended; axis 2 (fallback) is
               -- proximity, expressed as a range ("you're both nearby") and never
               -- as a named suburb, so it stays city-agnostic.
               (
                 select e.title
                 from event_attendees a_me
                 join event_attendees a_them
                   on a_them.event_id = a_me.event_id
                  and a_them.profile_id = p.id
                  and a_them.status = 'confirmed'
                 join events e on e.id = a_me.event_id
                 where a_me.profile_id = $1::uuid
                   and a_me.status = 'confirmed'
                   and e.starts_at < now()
                 order by e.starts_at desc
                 limit 1
               ) as shared_event,
               (p.suburb is not distinct from (select suburb from profiles where id = $1::uuid)) as nearby,
               p.connection_intents::text[] as intents,
               exists (
                 select 1 from clicks uc
                 where uc.sender_id = $1::uuid
                   and uc.receiver_id = p.id
                   and uc.expires_at > now()
                   -- Only a still-pending one-way click means "waiting on them".
                   -- Once it goes mutual the row stays (status='mutual', same
                   -- 30-day expiry), so without this guard the card kept showing
                   -- "pending their Click" after a match (bug board #214/#215).
                   and uc.status = 'pending'
                   -- ...and only a DISCOVERY one. Rule 3: the two processes never
                   -- cross-match, so a post-event click at this person is not a
                   -- click waiting on them HERE. Unscoped, it dropped them out of
                   -- the daily set for the whole 48h post-event window, and the
                   -- discovery click that would have paired with theirs could not
                   -- be sent. Same correction the post-event roster already carries
                   -- in the other direction (it scopes to THIS event on purpose).
                   and uc.event_id is null
               ) as already_clicked,
               -- B7.2 coordination load. Counts ACTIONABLE mutuals only - active and
               -- open/proposed. 'dormant' is resting and auto-revived, so it demands
               -- nothing; 'confirmed_together' is a plan already locked; every other
               -- status is history. So this is precisely "how many people are waiting
               -- on this person to plan something right now".
               (
                 select count(*)::int from mutual_clicks am
                 where am.status = 'active'
                   and am.coord_state in ('open', 'proposed')
                   and (am.user_a_id = p.id or am.user_b_id = p.id)
               ) as actionable_mutuals,
               (coalesce(p.last_active_at, p.created_at) < now() - interval '${INACTIVE_DOWNRANK_DAYS} days')
                 as inactive
        from profiles p
        left join user_tags shared_user_tag on shared_user_tag.profile_id = p.id
        left join tags shared_tag on shared_tag.id = shared_user_tag.tag_id
          and shared_tag.id in (
            select tag_id from user_tags where profile_id = $1::uuid
          )
        where p.id <> $1::uuid
          and p.role = 'attendee'
          and p.suspended_at is null
          -- SAFE-07: independent ≥18 age gate (§6.7b) - never surface someone we can't
          -- confirm is an adult into the click pool. NULL age is excluded (can't verify),
          -- matching the send-path gate that would refuse them anyway.
          and p.age >= ${MIN_CLICK_AGE}
          -- §6.7a / §B7.4: a banned, socially-opted-out, or paused profile is not in the
          -- social graph - keep them out of discovery (the send path already refuses them).
          and p.is_banned = false
          and p.social_visible = true
          and (p.paused_until is null or p.paused_until <= now())
          -- Only surface people who've actually set up an attendee profile.
          -- Merchant accounts (and half-finished signups) shouldn't appear in
          -- "click with someone" until they've completed a real profile.
          and p.suburb is not null
          and p.bio is not null
          -- Only include people who have a profile photo: clicking is a
          -- face-first decision, so a photoless profile shouldn't enter the
          -- "click with someone" pool (bug board #190). Guard the empty string
          -- too: a blank photo_url is photoless and "is not null" alone lets it
          -- slip through.
          and p.photo_url is not null
          and p.photo_url <> ''
          and not exists (
            select 1 from user_blocks b
            where (b.blocker_profile_id = $1::uuid and b.blocked_profile_id = p.id)
               or (b.blocker_profile_id = p.id and b.blocked_profile_id = $1::uuid)
          )
          -- Already matched? They live in the "You both tapped" banner, so drop
          -- them from Suggested entirely instead of showing a stale pending card
          -- (bug board #214/#215). mutual_clicks stores the pair as least/greatest.
          and not exists (
            select 1 from mutual_clicks mc
            where mc.status = 'active' and mc.expires_at > now()
              and ((mc.user_a_id = $1::uuid and mc.user_b_id = p.id)
                or (mc.user_a_id = p.id and mc.user_b_id = $1::uuid))
          )
          and not exists (
            select 1 from pair_suppressions ps
            where ps.expires_at > now()
              and ((ps.user_a_id = $1::uuid and ps.user_b_id = p.id)
                or (ps.user_a_id = p.id and ps.user_b_id = $1::uuid))
          )
          -- B7.9 rediscovery cooldown. A mutual that softly released after seven
          -- days of silence is NOT gone - the pair re-enters each other's pool and
          -- can click again. But not tomorrow: "a just-released pair re-appearing
          -- next day feels broken". Thirty days of distance, then they are simply a
          -- candidate again, and neither is ever told it is a re-match.
          --
          -- Only 'released' is on a clock here. 'suppressed' ("not feeling it") is
          -- held for 90 days by pair_suppressions above - a deliberate soft-no earns
          -- more distance than a passive fizzle. 'expired' (block / deletion) never
          -- resurfaces and is already carried by the user_blocks and is_banned gates.
          -- B7.4b row 24: mailed "someone clicked with you" as a liveness test, and
          -- still gone 14 days later - fully hidden from discovery until they return.
          -- "Return" is last_active_at overtaking the nudge, so this un-hides itself
          -- the moment they open the app; nothing has to remember to clear it.
          and not (
            p.reengagement_clicked_at is not null
            and p.reengagement_clicked_at <= now() - interval '${REENGAGEMENT_GRACE_DAYS} days'
            and coalesce(p.last_active_at, p.created_at) < p.reengagement_clicked_at
          )
          and not exists (
            select 1 from mutual_clicks rc
            where rc.status = 'released'
              and rc.ended_at > now() - interval '${REDISCOVERY_COOLDOWN_DAYS} days'
              and ((rc.user_a_id = $1::uuid and rc.user_b_id = p.id)
                or (rc.user_a_id = p.id and rc.user_b_id = $1::uuid))
          )
        group by p.id
        order by
          -- B7.4b row 23: quiet for 30 days is a DOWN-RANK, never a removal - events
          -- are episodic, and someone who has not opened the app in a month may well
          -- be back next weekend. First key, because a dormant account is a worse
          -- thing to spend one of three daily slots on than a busy one.
          (coalesce(p.last_active_at, p.created_at) < now() - interval '${INACTIVE_DOWNRANK_DAYS} days') asc,
          -- B7.2: at or over the soft cap, DOWN-RANK - never hard-block. Someone
          -- already over their actionable ceiling does not need more discovery, they
          -- need to act on what they have; surfacing them to new people just
          -- manufactures more stranded partners. They still appear, just last, so
          -- they are never invisible and the keen person clicking them is never
          -- punished for their overload.
          (
            (select count(*) from mutual_clicks am
              where am.status = 'active' and am.coord_state in ('open', 'proposed')
                and (am.user_a_id = p.id or am.user_b_id = p.id))
            >= ${ACTIVE_MUTUAL_SOFT_CAP}
          ) asc,
          array_length(
            coalesce(
              array_agg(distinct shared_tag.label) filter (where shared_tag.label is not null),
              '{}'
            ), 1
          ) desc nulls last,
          -- "The further over 8, the harder the down-rank" - as a tiebreak only, so it
          -- orders within the over-cap block without reranking everyone by popularity.
          (select count(*) from mutual_clicks am
            where am.status = 'active' and am.coord_state in ('open', 'proposed')
              and (am.user_a_id = p.id or am.user_b_id = p.id)) asc
        limit 24
      `,
      [profile.id],
    );

    // "Has a photo" must mean the SAME thing here as it does at render time
    // (bug board #190, reopened twice). The SQL guard above only proves the
    // column is non-blank; resolveAvatarImage additionally rejects URLs on a
    // dead storage host and unparseable bare keys, which is what the Avatar
    // component actually falls back on. Without this the pool kept offering
    // people who render as a faceless placeholder.
    let rows = result.rows.filter((row) => resolveAvatarImage(row.photo_url));

    // Matching v2 (flagged): keep this surface's candidate selection + profile-
    // completeness rules, but re-rank by the cohort-aware pair model instead of
    // raw shared-tag count. Falls back to the original order when the viewer or
    // candidates aren't in the feature store yet.
    const { matchingV2Enabled } = await getSystemSettings();
    if (matchingV2Enabled) {
      const viewer = await loadUserFeatures(pool, profile.id);
      if (viewer) {
        const features = await loadManyUserFeatures(pool, rows.map((r) => r.id));
        rows = [...rows]
          .map((row) => {
            const cand = features.get(row.id);
            return { row, score: cand ? scorePair(viewer, cand).score : -1 };
          })
          .sort((a, b) => b.score - a.score)
          .map((s) => s.row);
      }
    }

    // B7.2 down-rank, re-applied AFTER the v2 re-rank rather than only in the SQL
    // ORDER BY - v2 re-sorts the whole list by pair score, which threw the SQL
    // ordering away entirely, so the cap would have held only while the flag was off.
    // A stable partition: filter preserves order, so within each half whatever ranked
    // them (v2 score or shared tags) still decides. Down-rank, never remove.
    const downRanked = (row: { actionable_mutuals: number; inactive: boolean }) =>
      Number(row.actionable_mutuals ?? 0) >= ACTIVE_MUTUAL_SOFT_CAP || Boolean(row.inactive);
    rows = [...rows.filter((r) => !downRanked(r)), ...rows.filter(downRanked)];

    return rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      suburb: row.suburb,
      photoUrl: row.photo_url,
      age: row.age,
      sharedInterests: row.shared ?? [],
      sharedEvent: row.shared_event ?? null,
      nearby: Boolean(row.nearby),
      intents: row.intents ?? [],
      alreadyClicked: Boolean(row.already_clicked),
    }));
  } catch {
    return [];
  }
}

export type MutualClickEntry = {
  otherProfileId: string;
  otherDisplayName: string;
  otherPhotoUrl: string | null;
  suggestedEventSlug: string | null;
  suggestedEventTitle: string | null;
  // Can a seat still be taken on it? Separate from the slug, which only names the
  // event - a plan you can no longer join is still a plan you made.
  suggestedEventJoinable: boolean;
  // The pair have AGREED on this plan; what's left is each of them taking a seat.
  // Without this the dashboard read an agreed plan as no plan at all.
  planAccepted: boolean;
  // True when the surfaced suggestion was last proposed by the OTHER person
  // (they picked an alternative in /proposals) - lets the UI attribute it as
  // "Janey suggested:" instead of the generic "Suggested for you both:".
  suggestedByOther: boolean;
  // False when nothing was ever proposed BY a person - the catalogue surfaced it.
  // Without this the generic case is indistinguishable from "you proposed it",
  // and both sides get told they are waiting on the other.
  suggestedBySomeone: boolean;
  // When the pair are BOTH already confirmed for the same upcoming event, the UI
  // skips the "suggested plan" copy and celebrates "You're both going to X!"
  // instead (bug board #186).
  bothGoingEventSlug: string | null;
  bothGoingEventTitle: string | null;
  createdAt: string;
};

export async function getMutualClicksForSession(session: Session | null): Promise<MutualClickEntry[]> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!pool || !email) return [];

  try {
    const profile = await ensureProfileForSession(session);
    const result = await pool.query<{
      other_id: string;
      other_name: string;
      other_photo: string | null;
      event_slug: string | null;
      event_title: string | null;
      event_joinable: boolean;
      plan_accepted: boolean;
      proposed_by: string | null;
      both_going_slug: string | null;
      both_going_title: string | null;
      created_at: Date;
    }>(
      `
        select
          case when m.user_a_id = $1::uuid then m.user_b_id::text else m.user_a_id::text end as other_id,
          other.display_name as other_name,
          other.photo_url as other_photo,
          event.slug as event_slug,
          event.title as event_title,
          -- Joinable is an ACTION gate, never an existence test - see the note on the
          -- events join below.
          (
            event.id is not null
            and event.starts_at > now()
            and event.status in ('live', 'featured')
            and exists (
              select 1 from event_capacity_v cap
              where cap.event_id = event.id and cap.available >= 1
            )
          ) as event_joinable,
          (p.status = 'accepted') as plan_accepted,
          p.proposed_by::text as proposed_by,
          both_going.slug as both_going_slug,
          both_going.title as both_going_title,
          m.created_at
        from mutual_clicks m
        join profiles other on other.id = (
          case when m.user_a_id = $1::uuid then m.user_b_id else m.user_a_id end
        )
        -- The live proposal (one per mutual click) holds the CURRENT suggestion,
        -- which either side can replace via "suggest alternative" in /proposals.
        -- ACCEPTED counts: pending-only meant an agreed plan vanished from the
        -- dashboard the moment it was agreed, so the banner reverted to "suggest a
        -- plan" at exactly the point the pair had one. Lateral + limit 1 so a mutual
        -- can never fan out on dirty data.
        left join lateral (
          select cp.*
          from click_proposals cp
          where cp.mutual_click_id = m.id and cp.status in ('pending', 'accepted')
          order by cp.updated_at desc
          limit 1
        ) p on true
        -- ALWAYS attach the suggested event: which event the plan is about is a fact,
        -- and folding the bookability filters in here made a dead plan indistinguishable
        -- from no plan at all - the card reverted to "suggest a plan" with no hint that
        -- one had been made and lost. event_joinable above carries the bookability.
        left join events event on event.id = p.suggested_event_id
        -- If the pair are BOTH going to the same upcoming event, celebrate that
        -- directly instead of suggesting a new plan (#186). "Going" means a
        -- confirmed event_attendees row OR a claimed guest_spot - i.e. a +1 seat
        -- a friend bought and they then claimed (spec 19). Without the guest_spots
        -- arm, a guest-RSVP'd attendee has no event_attendees row and the
        -- celebration silently never fires. Picks the soonest such shared event.
        left join lateral (
          select e2.slug, e2.title
          from events e2
          where e2.starts_at > now()
            and exists (
              select 1 from event_attendees a
              where a.event_id = e2.id and a.profile_id = $1::uuid and a.status = 'confirmed'
              union all
              select 1 from guest_spots g
              where g.event_id = e2.id and g.claimed_profile_id = $1::uuid and g.status = 'claimed'
            )
            and exists (
              select 1 from event_attendees a
              where a.event_id = e2.id and a.status = 'confirmed'
                and a.profile_id = (
                  case when m.user_a_id = $1::uuid then m.user_b_id else m.user_a_id end
                )
              union all
              select 1 from guest_spots g
              where g.event_id = e2.id and g.status = 'claimed'
                and g.claimed_profile_id = (
                  case when m.user_a_id = $1::uuid then m.user_b_id else m.user_a_id end
                )
            )
          order by e2.starts_at asc
          limit 1
        ) both_going on true
        where (m.user_a_id = $1::uuid or m.user_b_id = $1::uuid)
          -- Only LIVE mutuals render as cards. The mutual's lifecycle lives on its own
          -- status column now (§B2) - an event-level failure (proposal declined/expired/
          -- full) returns the mutual to open/dormant but never ends it, so we filter on
          -- the mutual's status, not the proposal's. Terminal rows (connected/released/
          -- suppressed/expired) belong on the future "Past clicks" shelf, not here.
          and m.status = 'active' and m.expires_at > now()
          -- SAFE-05: defence-in-depth - a block tears the mutual down (→ suppressed) so
          -- this filter rarely bites, but anti-join blocks directly so a blocked pair can
          -- never render a live card even if a teardown ever failed to run.
          and not exists (
            select 1 from user_blocks b
            where (b.blocker_profile_id = m.user_a_id and b.blocked_profile_id = m.user_b_id)
               or (b.blocker_profile_id = m.user_b_id and b.blocked_profile_id = m.user_a_id)
          )
        order by m.created_at desc
        limit 12
      `,
      [profile.id],
    );

    return result.rows.map((row) => ({
      otherProfileId: row.other_id,
      otherDisplayName: row.other_name,
      otherPhotoUrl: row.other_photo,
      suggestedEventSlug: row.event_slug,
      suggestedEventTitle: row.event_title,
      suggestedEventJoinable: Boolean(row.event_joinable),
      planAccepted: Boolean(row.plan_accepted),
      suggestedByOther: row.proposed_by != null && row.proposed_by === row.other_id,
      suggestedBySomeone: row.proposed_by != null,
      bothGoingEventSlug: row.both_going_slug,
      bothGoingEventTitle: row.both_going_title,
      createdAt: row.created_at.toISOString(),
    }));
  } catch {
    return [];
  }
}

// Conversation / messaging helpers were removed when /messages was retired -
// the platform's no-chat principle is enforced by deleting the surface, not
// by hiding it. Mutual Click coordination uses the Proposal UI (no free text).

// ---------------------------------------------------------------------------
// Safety: block / mute / report (migration 018_safety.sql)
// ---------------------------------------------------------------------------

export const REPORT_REASONS = [
  "harassment",
  "inappropriate_messages",
  "spam_or_scam",
  "fake_profile",
  "safety_concern",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type SafetyState = {
  isBlocked: boolean; // viewer has blocked the target
  isMuted: boolean; // viewer has muted the target
  hasReported: boolean; // viewer has an open report against the target
};

export async function blockUser(session: Session | null, targetProfileId: string) {
  const pool = getPostgresPool();
  if (!getSessionEmail(session)) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  if (profile.id === targetProfileId) throw validationError("You can't block yourself.");

  // SAFE-01: a block is a full coordination teardown (§6.5), not just a click delete.
  // Insert the block AND sever every shared state - pending clicks (→ invalidated),
  // the active mutual (→ suppressed), and any live proposal (→ withdrawn) - in one
  // transaction, so the non-blocked party can no longer confirm a plan, counter-
  // propose, or keep a stale "both going" card after they've been blocked.
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `
        insert into user_blocks (blocker_profile_id, blocked_profile_id)
        values ($1::uuid, $2::uuid)
        on conflict do nothing
      `,
      [profile.id, targetProfileId],
    );
    await severPairCoordination(client, profile.id, targetProfileId);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function unblockUser(session: Session | null, targetProfileId: string) {
  const pool = getPostgresPool();
  if (!getSessionEmail(session)) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  await pool.query(
    `delete from user_blocks where blocker_profile_id = $1::uuid and blocked_profile_id = $2::uuid`,
    [profile.id, targetProfileId],
  );
}

export async function muteUser(session: Session | null, targetProfileId: string) {
  const pool = getPostgresPool();
  if (!getSessionEmail(session)) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  if (profile.id === targetProfileId) throw validationError("You can't mute yourself.");

  await pool.query(
    `
      insert into user_mutes (muter_profile_id, muted_profile_id)
      values ($1::uuid, $2::uuid)
      on conflict do nothing
    `,
    [profile.id, targetProfileId],
  );
}

export async function unmuteUser(session: Session | null, targetProfileId: string) {
  const pool = getPostgresPool();
  if (!getSessionEmail(session)) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  await pool.query(
    `delete from user_mutes where muter_profile_id = $1::uuid and muted_profile_id = $2::uuid`,
    [profile.id, targetProfileId],
  );
}

export async function reportUser(
  session: Session | null,
  input: { reportedProfileId: string; reason: ReportReason; details?: string; sourceEventSlug?: string },
) {
  const pool = getPostgresPool();
  if (!getSessionEmail(session)) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  if (profile.id === input.reportedProfileId) throw validationError("You can't report yourself.");
  if (!REPORT_REASONS.includes(input.reason)) throw validationError("Pick a valid report reason.");

  const sourceEvent = input.sourceEventSlug
    ? await pool.query<{ id: string }>(`select id::text from events where slug = $1 limit 1`, [
        input.sourceEventSlug,
      ])
    : null;
  const sourceEventId = sourceEvent?.rows[0]?.id ?? null;

  const inserted = await pool.query<{ id: string }>(
    `
      insert into user_reports (reporter_profile_id, reported_profile_id, source_event_id, reason, details)
      values ($1::uuid, $2::uuid, $3::uuid, $4::report_reason, $5)
      on conflict (reporter_profile_id, reported_profile_id) where status = 'open'
        do update set reason = excluded.reason, details = excluded.details,
                      source_event_id = excluded.source_event_id, created_at = now()
      returning id::text
    `,
    [profile.id, input.reportedProfileId, sourceEventId, input.reason, input.details?.slice(0, 2000) ?? null],
  );

  // Auto-mute the reported user for the reporter so they get immediate relief
  // while the admin queue works through the 24hr SLA.
  await pool.query(
    `
      insert into user_mutes (muter_profile_id, muted_profile_id)
      values ($1::uuid, $2::uuid)
      on conflict do nothing
    `,
    [profile.id, input.reportedProfileId],
  );

  const reportId = inserted.rows[0]?.id ?? null;

  // Admin audit trail + alert (CLAUDE.md: every notify-able flow logs an email).
  await writeAuditLog({
    actorProfileId: profile.id,
    action: "user.reported",
    entityTable: "user_reports",
    entityId: reportId,
    metadata: { reportedProfileId: input.reportedProfileId, reason: input.reason },
  });

  await logEmailEvent({
    template: "report-received-admin",
    toEmail: process.env.SAFETY_INBOX_EMAIL || "safety@click.local",
    vars: {
      reportId: reportId ?? "n/a",
      reason: input.reason,
      details: input.details?.slice(0, 500) ?? "(none)",
      reporterName: profile.display_name,
    },
  });

  return { id: reportId };
}

export type ViewerClickState = {
  /** The viewer has a live one-way click out to this person, waiting on them. */
  alreadyClicked: boolean;
  /** It's already mutual - the click control gives way to the coordination link. */
  isMutual: boolean;
};

/**
 * The viewer's own click state toward one profile. Deliberately says nothing
 * about the OTHER person's state: whether they have clicked you is not knowable
 * from here unless it went mutual, which is the one moment both sides learn it
 * at once. Keeps /profile/[userId] off the probing surface the send path is so
 * careful to stay off.
 */
export async function getViewerClickState(
  session: Session | null,
  targetProfileId: string,
): Promise<ViewerClickState> {
  const pool = getPostgresPool();
  if (!getSessionEmail(session) || !pool) return { alreadyClicked: false, isMutual: false };

  try {
    const profile = await ensureProfileForSession(session);
    const result = await pool.query<{ clicked: boolean; mutual: boolean }>(
      `
        select
          exists (
            select 1 from clicks c
            where c.sender_id = $1::uuid and c.receiver_id = $2::uuid
              and c.status = 'pending' and c.expires_at > now()
              -- Discovery only. This button sends a Process-1 click, and rule 3 is
              -- that the two processes NEVER cross-match: a post-event click at this
              -- person cannot pair with their discovery click at you. Counting it
              -- here greyed the button out to "clicked" for the 48h post-event
              -- window, which hid the only control that could form the discovery
              -- mutual - and this page is deliberately the one surface that always
              -- offers the send.
              and c.event_id is null
          ) as clicked,
          exists (
            select 1 from mutual_clicks m
            where m.user_a_id = least($1::uuid, $2::uuid)
              and m.user_b_id = greatest($1::uuid, $2::uuid)
              and m.status = 'active' and m.expires_at > now()
          ) as mutual
      `,
      [profile.id, targetProfileId],
    );
    const row = result.rows[0];
    return { alreadyClicked: Boolean(row?.clicked), isMutual: Boolean(row?.mutual) };
  } catch {
    return { alreadyClicked: false, isMutual: false };
  }
}

export async function getSafetyState(
  session: Session | null,
  targetProfileId: string,
): Promise<SafetyState> {
  const pool = getPostgresPool();
  if (!getSessionEmail(session) || !pool) {
    return { isBlocked: false, isMuted: false, hasReported: false };
  }

  try {
    const profile = await ensureProfileForSession(session);
    const result = await pool.query<{ blocked: boolean; muted: boolean; reported: boolean }>(
      `
        select
          exists(select 1 from user_blocks where blocker_profile_id = $1::uuid and blocked_profile_id = $2::uuid) as blocked,
          exists(select 1 from user_mutes where muter_profile_id = $1::uuid and muted_profile_id = $2::uuid) as muted,
          exists(select 1 from user_reports where reporter_profile_id = $1::uuid and reported_profile_id = $2::uuid and status = 'open') as reported
      `,
      [profile.id, targetProfileId],
    );
    const row = result.rows[0];
    return {
      isBlocked: Boolean(row?.blocked),
      isMuted: Boolean(row?.muted),
      hasReported: Boolean(row?.reported),
    };
  } catch {
    return { isBlocked: false, isMuted: false, hasReported: false };
  }
}

// --- Admin moderation queue ---

export type AdminReportRow = {
  id: string;
  reason: ReportReason;
  details: string | null;
  status: "open" | "actioned" | "dismissed";
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  reporterId: string;
  reporterName: string;
  reportedId: string;
  reportedName: string;
  reportedSuspendedAt: string | null;
  sourceEventTitle: string | null;
};

export async function getAdminReports(session: Session | null): Promise<AdminReportRow[]> {
  const pool = getPostgresPool();
  if (!pool) return [];
  await requireAdminProfile(session);

  const result = await pool.query<{
    id: string;
    reason: ReportReason;
    details: string | null;
    status: "open" | "actioned" | "dismissed";
    created_at: Date;
    resolved_at: Date | null;
    resolution_note: string | null;
    reporter_id: string;
    reporter_name: string;
    reported_id: string;
    reported_name: string;
    reported_suspended_at: Date | null;
    source_event_title: string | null;
  }>(
    `
      select r.id::text, r.reason, r.details, r.status, r.created_at, r.resolved_at,
             r.resolution_note,
             reporter.id::text as reporter_id, reporter.display_name as reporter_name,
             reported.id::text as reported_id, reported.display_name as reported_name,
             reported.suspended_at as reported_suspended_at,
             event.title as source_event_title
      from user_reports r
      join profiles reporter on reporter.id = r.reporter_profile_id
      join profiles reported on reported.id = r.reported_profile_id
      left join events event on event.id = r.source_event_id
      order by (r.status = 'open') desc, r.created_at desc
      limit 200
    `,
  );

  return result.rows.map((row) => ({
    id: row.id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
    resolutionNote: row.resolution_note,
    reporterId: row.reporter_id,
    reporterName: row.reporter_name,
    reportedId: row.reported_id,
    reportedName: row.reported_name,
    reportedSuspendedAt: row.reported_suspended_at ? row.reported_suspended_at.toISOString() : null,
    sourceEventTitle: row.source_event_title,
  }));
}

export async function resolveReport(
  session: Session | null,
  reportId: string,
  resolution: "actioned" | "dismissed",
  note?: string,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const admin = await requireAdminProfile(session);

  await pool.query(
    `
      update user_reports
      set status = $2::report_status, resolution_note = $3, resolved_at = now(), resolved_by = $4::uuid
      where id = $1::uuid and status = 'open'
    `,
    [reportId, resolution, note?.slice(0, 1000) ?? null, admin.id],
  );

  await writeAuditLog({
    actorProfileId: admin.id,
    action: `report.${resolution}`,
    entityTable: "user_reports",
    entityId: reportId,
    metadata: { note: note ?? null },
  });
}

// ---------------------------------------------------------------------------
// Post-event click prompt + Proposal UI (migration 019_proposals.sql)
// ---------------------------------------------------------------------------

export type PostEventCoAttendee = {
  id: string;
  displayName: string;
  photoUrl: string | null;
  suburb: string | null;
  alreadyClicked: boolean;
  /** §6.9(a): this click is still pending, so its budget slot can be swapped away. */
  swappable: boolean;
};

export type PostEventClickPrompt = {
  eventSlug: string;
  eventTitle: string;
  endedAt: string;
  coAttendees: PostEventCoAttendee[];
  /** Post-event clicks spent here (invalidated ones refunded), so the card can show
   *  the remaining budget up front rather than only refusing the fourth tap (§6.9.1). */
  clicksUsed: number;
  /** §6.9(b): the one swap for this event is already spent. */
  swapUsed: boolean;
};

// Events the viewer attended that ended between 12 hours and 14 days ago, with
// the co-attendees they can still Click. Powers the dashboard "who did you
// click with?" card (business plan §4.3). Blocked pairs are excluded.
export async function getPostEventClickPrompts(
  session: Session | null,
): Promise<PostEventClickPrompt[]> {
  const pool = getPostgresPool();
  if (!getSessionEmail(session) || !pool) return [];

  try {
    const profile = await ensureProfileForSession(session);
    const result = await pool.query<{
      event_slug: string;
      event_title: string;
      ended_at: Date;
      other_id: string;
      other_name: string;
      other_photo_url: string | null;
      other_suburb: string | null;
      already_clicked: boolean;
      swappable: boolean;
      clicks_used: number;
      swap_used: boolean;
    }>(
      `
        select
          e.slug as event_slug,
          e.title as event_title,
          coalesce(e.ends_at, e.starts_at) as ended_at,
          other.id::text as other_id,
          other.display_name as other_name,
          -- Clicking is a face-first decision (the same reason the discovery
          -- pool hard-requires a photo), so the roster carries the face too.
          other.photo_url as other_photo_url,
          other.suburb as other_suburb,
          -- Scoped to THIS event on purpose: the constraint this mirrors is
          -- uq_click_post_event (sender_id, receiver_id, event_id), so a click
          -- sent at some other event must not hide the person here. Unscoped,
          -- one long-expired discovery click removed someone from every future
          -- roster permanently - and because mutual detection only pairs clicks
          -- on the same surface, the hidden send was the one that would have
          -- formed the mutual. No status filter: the unique index ignores
          -- status, so any existing row (even invalidated) still blocks a
          -- re-send, and showing them as clickable would just 500 on insert.
          exists (
            select 1 from clicks c
            where c.sender_id = $1::uuid
              and c.receiver_id = other.id
              and c.event_id = e.id
          ) as already_clicked,
          -- §6.9(a): only a still-PENDING post-event click is releasable. One that
          -- went mutual never is, and one that lapsed with the window has no budget
          -- left to give back.
          exists (
            select 1 from clicks c
            where c.sender_id = $1::uuid
              and c.receiver_id = other.id
              and c.event_id = e.id
              and c.status = 'pending'
          ) as swappable,
          -- The budget, so the surface can say what is left BEFORE the viewer spends
          -- attention on it (§6.9.1) instead of only refusing the fourth tap.
          -- Invalidated rows are excluded, matching the cap count in the send path -
          -- which is exactly what makes a swap give a slot back.
          (
            select count(*)::int from clicks c
            where c.sender_id = $1::uuid and c.event_id = e.id and c.status <> 'invalidated'
          ) as clicks_used,
          -- §6.9(b): one swap per sender per event, ever.
          exists (
            select 1 from click_swaps sw
            where sw.sender_id = $1::uuid and sw.event_id = e.id
          ) as swap_used
        from events e
        -- Roster = event_participants_v (confirmed attendees + claimed guest
        -- +1s), so someone who came on a friend's booking both sees this prompt
        -- and appears on everyone else's. See migration 056.
        join event_participants_v mine on mine.event_id = e.id
          and mine.profile_id = $1::uuid
        join event_participants_v theirs on theirs.event_id = e.id
          and theirs.profile_id <> $1::uuid
        join profiles other on other.id = theirs.profile_id
          -- One definition of "still in the social graph", shared with the send
          -- path (sendClickInner) so this roster can never offer someone the send
          -- will then refuse - a roster that lists people you cannot click is both
          -- a dead button and a disclosure, since the refusal confirms their state.
          -- default_attend_visibility is the attendee-list opt-out from migration
          -- 049: opting out takes you off this roster, so nobody can click you from
          -- an event you chose not to be listed at.
          and other.role = 'attendee' and other.suspended_at is null and other.is_banned = false
          and other.social_visible = true
          and (other.paused_until is null or other.paused_until <= now())
          and other.default_attend_visibility
        where coalesce(e.ends_at, e.starts_at) + interval '${POST_EVENT_PROMPT_DELAY_HOURS} hours' <= now()
          and coalesce(e.ends_at, e.starts_at) + interval '${POST_EVENT_CLICK_WINDOW_HOURS} hours' > now()
          and not exists (
            select 1 from user_blocks b
            where (b.blocker_profile_id = $1::uuid and b.blocked_profile_id = other.id)
               or (b.blocker_profile_id = other.id and b.blocked_profile_id = $1::uuid)
          )
          -- §B7.3: a suppressed viewer loses the post-event surface itself, not just
          -- the send. Leaving the roster up and refusing at the button would be a
          -- picker that cannot pick.
          and not exists (
            select 1 from profiles me
            where me.id = $1::uuid and me.post_event_click_suppressed_until > now()
          )
        order by coalesce(e.ends_at, e.starts_at) desc, other.display_name asc
      `,
      [profile.id],
    );

    const byEvent = new Map<string, PostEventClickPrompt>();
    for (const row of result.rows) {
      let entry = byEvent.get(row.event_slug);
      if (!entry) {
        entry = {
          eventSlug: row.event_slug,
          eventTitle: row.event_title,
          endedAt: row.ended_at.toISOString(),
          coAttendees: [],
          clicksUsed: row.clicks_used,
          swapUsed: row.swap_used,
        };
        byEvent.set(row.event_slug, entry);
      }
      entry.coAttendees.push({
        id: row.other_id,
        displayName: row.other_name,
        photoUrl: row.other_photo_url,
        suburb: row.other_suburb,
        alreadyClicked: row.already_clicked,
        swappable: row.swappable,
      });
    }
    return Array.from(byEvent.values());
  } catch {
    return [];
  }
}

// Post-event click prompt for ONE event, shown on the event detail page during
// the same single window as the dashboard rail and the push cron (TW-4 collapse):
// event_end + 2h until event_end + 48h - i.e. exactly the who-was-there click
// surface's live window (§6.8 / §B3.2). Returns null when the viewer didn't
// attend, the window isn't open, or there are no clickable co-attendees.
export async function getPostEventClickPromptForEvent(
  slug: string,
  session: Session | null,
): Promise<PostEventClickPrompt | null> {
  const pool = getPostgresPool();
  if (!getSessionEmail(session) || !pool) return null;

  try {
    const profile = await ensureProfileForSession(session);
    const result = await pool.query<{
      event_slug: string;
      event_title: string;
      ended_at: Date;
      other_id: string;
      other_name: string;
      other_photo_url: string | null;
      other_suburb: string | null;
      already_clicked: boolean;
      swappable: boolean;
      clicks_used: number;
      swap_used: boolean;
    }>(
      `
        select
          e.slug as event_slug,
          e.title as event_title,
          coalesce(e.ends_at, e.starts_at) as ended_at,
          other.id::text as other_id,
          other.display_name as other_name,
          -- Clicking is a face-first decision (the same reason the discovery
          -- pool hard-requires a photo), so the roster carries the face too.
          other.photo_url as other_photo_url,
          other.suburb as other_suburb,
          -- Scoped to THIS event on purpose: the constraint this mirrors is
          -- uq_click_post_event (sender_id, receiver_id, event_id), so a click
          -- sent at some other event must not hide the person here. Unscoped,
          -- one long-expired discovery click removed someone from every future
          -- roster permanently - and because mutual detection only pairs clicks
          -- on the same surface, the hidden send was the one that would have
          -- formed the mutual. No status filter: the unique index ignores
          -- status, so any existing row (even invalidated) still blocks a
          -- re-send, and showing them as clickable would just 500 on insert.
          exists (
            select 1 from clicks c
            where c.sender_id = $1::uuid
              and c.receiver_id = other.id
              and c.event_id = e.id
          ) as already_clicked,
          -- §6.9(a): only a still-PENDING post-event click is releasable. One that
          -- went mutual never is, and one that lapsed with the window has no budget
          -- left to give back.
          exists (
            select 1 from clicks c
            where c.sender_id = $1::uuid
              and c.receiver_id = other.id
              and c.event_id = e.id
              and c.status = 'pending'
          ) as swappable,
          -- The budget, so the surface can say what is left BEFORE the viewer spends
          -- attention on it (§6.9.1) instead of only refusing the fourth tap.
          -- Invalidated rows are excluded, matching the cap count in the send path -
          -- which is exactly what makes a swap give a slot back.
          (
            select count(*)::int from clicks c
            where c.sender_id = $1::uuid and c.event_id = e.id and c.status <> 'invalidated'
          ) as clicks_used,
          -- §6.9(b): one swap per sender per event, ever.
          exists (
            select 1 from click_swaps sw
            where sw.sender_id = $1::uuid and sw.event_id = e.id
          ) as swap_used
        from events e
        -- Roster = event_participants_v (confirmed attendees + claimed guest
        -- +1s), so someone who came on a friend's booking both sees this prompt
        -- and appears on everyone else's. See migration 056.
        join event_participants_v mine on mine.event_id = e.id
          and mine.profile_id = $1::uuid
        join event_participants_v theirs on theirs.event_id = e.id
          and theirs.profile_id <> $1::uuid
        join profiles other on other.id = theirs.profile_id
          -- One definition of "still in the social graph", shared with the send
          -- path (sendClickInner) so this roster can never offer someone the send
          -- will then refuse - a roster that lists people you cannot click is both
          -- a dead button and a disclosure, since the refusal confirms their state.
          -- default_attend_visibility is the attendee-list opt-out from migration
          -- 049: opting out takes you off this roster, so nobody can click you from
          -- an event you chose not to be listed at.
          and other.role = 'attendee' and other.suspended_at is null and other.is_banned = false
          and other.social_visible = true
          and (other.paused_until is null or other.paused_until <= now())
          and other.default_attend_visibility
        where e.slug = $2
          and coalesce(e.ends_at, e.starts_at) + interval '${POST_EVENT_PROMPT_DELAY_HOURS} hours' <= now()
          and coalesce(e.ends_at, e.starts_at) + interval '${POST_EVENT_CLICK_WINDOW_HOURS} hours' > now()
          and not exists (
            select 1 from user_blocks b
            where (b.blocker_profile_id = $1::uuid and b.blocked_profile_id = other.id)
               or (b.blocker_profile_id = other.id and b.blocked_profile_id = $1::uuid)
          )
          -- §B7.3: a suppressed viewer loses the post-event surface itself, not just
          -- the send. Leaving the roster up and refusing at the button would be a
          -- picker that cannot pick.
          and not exists (
            select 1 from profiles me
            where me.id = $1::uuid and me.post_event_click_suppressed_until > now()
          )
        order by other.display_name asc
      `,
      [profile.id, slug],
    );

    if (result.rows.length === 0) return null;

    const first = result.rows[0];
    return {
      eventSlug: first.event_slug,
      eventTitle: first.event_title,
      endedAt: first.ended_at.toISOString(),
      clicksUsed: first.clicks_used,
      swapUsed: first.swap_used,
      coAttendees: result.rows.map((row) => ({
        id: row.other_id,
        displayName: row.other_name,
        photoUrl: row.other_photo_url,
        suburb: row.other_suburb,
        alreadyClicked: row.already_clicked,
        swappable: row.swappable,
      })),
    };
  } catch {
    return null;
  }
}

// Push the post-event "did you click with anyone?" prompt as a notification,
// once per (attendee, event), inside the single collapsed window (TW-3/TW-4):
// event_end + 2h until event_end + 48h, and only when "now" is outside 22:00–
// 09:00 event-local (§6.8 quiet-hours deferral). A prompt whose +2h lands in the
// quiet band simply stays eligible until the next run past 09:00 - no second job.
// Idempotent: the action_url marker doubles as the dedupe key, so running the
// cron every few minutes (and re-firing a deferred row) never double-notifies.
// Returns the count of notifications created. (Bug board #85 - the pull-based
// card already exists on the dashboard + event page; this is the missing push.)
export async function notifyPostEventClickPrompts(): Promise<number> {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const result = await pool.query(
    `
      insert into notifications (profile_id, title, body, action_url)
      select
        mine.profile_id,
        'Did you click with anyone?',
        'You went to ' || e.title || '. Tap anyone you''d like to see again - it''s completely private.',
        '/events/' || e.slug || '?from=post-event-click'
      from events e
      -- Same roster as the two pull-based queries (migration 056), so a claimed
      -- guest gets the push prompt too rather than silently never being asked.
      join event_participants_v mine on mine.event_id = e.id
      -- §B7.3: never push "did you click with anyone?" at someone whose post-event
      -- surface is withheld - the prompt would open onto nothing.
      join profiles me on me.id = mine.profile_id
        and (me.post_event_click_suppressed_until is null
          or me.post_event_click_suppressed_until <= now())
      where coalesce(e.ends_at, e.starts_at) + interval '${POST_EVENT_PROMPT_DELAY_HOURS} hours' <= now()
        and coalesce(e.ends_at, e.starts_at) + interval '${POST_EVENT_CLICK_WINDOW_HOURS} hours' > now()
        and extract(hour from now() at time zone e.timezone) >= 9
        and extract(hour from now() at time zone e.timezone) < 22
        and exists (
          select 1
          from event_participants_v theirs
          join profiles other on other.id = theirs.profile_id
            and other.role = 'attendee' and other.suspended_at is null and other.is_banned = false
            -- Same social-graph definition as the two pull-based rosters and the
            -- send path: never push "did you click with anyone?" on the strength of
            -- a co-attendee who has opted out, paused, or hidden their attendance.
            and other.social_visible = true
            and (other.paused_until is null or other.paused_until <= now())
            and other.default_attend_visibility
          where theirs.event_id = e.id
            and theirs.profile_id <> mine.profile_id
            -- Same event scoping as the two roster queries above: without it a
            -- click sent at any other event suppresses this event's prompt.
            and not exists (
              select 1 from clicks c
              where c.sender_id = mine.profile_id
                and c.receiver_id = other.id
                and c.event_id = e.id
            )
            and not exists (
              select 1 from user_blocks b
              where (b.blocker_profile_id = mine.profile_id and b.blocked_profile_id = other.id)
                 or (b.blocker_profile_id = other.id and b.blocked_profile_id = mine.profile_id)
            )
        )
        and not exists (
          select 1 from notifications n
          where n.profile_id = mine.profile_id
            and n.action_url = '/events/' || e.slug || '?from=post-event-click'
        )
    `,
  );
  return result.rowCount ?? 0;
}

export type ProposalEntry = {
  id: string;
  status: "pending" | "confirmed" | "expired";
  isExpired: boolean;
  otherId: string;
  otherName: string;
  suggestedEventSlug: string | null;
  suggestedEventTitle: string | null;
  suggestedEventStartsAt: string | null;
  // True when a suggestion was made but the event is no longer joinable (it sold
  // out, was cancelled, or has started) - distinct from "no suggestion picked yet"
  // so the card can explain why the plan vanished and prompt a fresh pick.
  suggestionUnavailable: boolean;
  // Can a seat still be taken on the suggested event? Gates every RSVP/Confirm
  // control. Deliberately separate from suggestedEventSlug, which only ever says
  // WHICH event the plan is about - a plan you can no longer join is still a plan
  // you agreed to, and the UI has to be able to name it.
  suggestedEventJoinable: boolean;
  // Why it stopped being joinable, when it did. Cancelled = it genuinely fell
  // through. Started = the night has begun, which is a success, not a failure.
  suggestedEventCancelled: boolean;
  suggestedEventStarted: boolean;
  alternativesRemaining: number;
  expiresAt: string;
  confirmedAt: string | null;
  // True when the VIEWER is the one who tapped "Confirm this plan" - lets the
  // card say "you confirmed, now RSVP" vs "they confirmed, RSVP to lock in"
  // instead of a blanket "Plan confirmed" that confuses the person who never
  // acted (bug board #199).
  confirmedByMe: boolean;
  // C11 (§B4.1 step 7): whether each side already holds a confirmed seat on the
  // suggested event. The already-booked side shows "I'm in", never a live RSVP
  // button or a pair-computed "RSVP needed" badge; both booked = "both going".
  viewerHasSeat: boolean;
  otherHasSeat: boolean;
  // --- Coordination drawer (2.5b) ---------------------------------------------
  // The drawer is a pure projection of these. `mutualId` keys markMutualSeen +
  // suggestPlanForMutual; `coordState` picks the step; the reveal fields drive the
  // one-time §4 reveal; `proposedByMe` splits the `proposed` copy (waiting vs "you in?").
  mutualId: string;
  coordState: "open" | "proposed" | "confirmed_together" | "dormant" | "released";
  revealSeen: boolean;
  sharedIntent: string;
  bothDating: boolean;
  proposedByMe: boolean;
};

// The reveal's intent line (§4): a desire, never a status. Shared only when both
// named the same intent at click time (intent_a/intent_b snapshot, §8 immutable);
// otherwise a neutral common ground. Dating gets its own opt-in line, not this one.
function intentPhrase(a: string | null, b: string | null): string {
  const map: Record<string, string> = {
    dating: "meeting someone new",
    friendship: "making new friends",
    networking: "meeting new people",
    exploring: "trying new things",
    activities: "doing things together",
  };
  return a && b && a === b ? (map[a] ?? "meeting new people") : "meeting new people";
}

export async function getProposalsForSession(session: Session | null): Promise<ProposalEntry[]> {
  const pool = getPostgresPool();
  if (!getSessionEmail(session) || !pool) return [];

  try {
    const profile = await ensureProfileForSession(session);
    const result = await pool.query<{
      // Nullable now the read is mutual-centric: an `open` mutual with no live plan
      // (e.g. its only proposal was declined) has no proposal row.
      id: string | null;
      // Raw DB enum, or null when no live proposal; mapped to the UI's
      // pending/confirmed/expired contract below.
      status: "pending" | "accepted" | "expired" | null;
      expired: boolean;
      other_id: string;
      other_name: string;
      event_slug: string | null;
      event_title: string | null;
      event_starts_at: Date | null;
      had_suggestion: boolean;
      event_joinable: boolean;
      event_cancelled: boolean;
      event_started: boolean;
      alternatives_count: number;
      expires_at: Date;
      confirmed_at: Date | null;
      confirmed_by_me: boolean;
      viewer_has_seat: boolean;
      other_has_seat: boolean;
      mutual_id: string;
      coord_state: "open" | "proposed" | "confirmed_together" | "dormant" | "released";
      reveal_seen: boolean;
      intent_a: string | null;
      intent_b: string | null;
      both_dating: boolean;
      proposed_by_me: boolean;
    }>(
      `
        select
          p.id::text,
          p.status,
          -- "Expired" = the window closed without a confirm: persisted ('expired'),
          -- or any non-accepted plan (incl. an open mutual with no proposal) past
          -- the coalesced deadline. An accepted plan is never clock-expired - it's a
          -- Plan, not a lapse. Keeps live Confirm/Suggest off a past date (bug #199).
          (
            m.status <> 'active'
            or p.status = 'expired'
            or (p.status is distinct from 'accepted' and coalesce(p.expires_at, m.expires_at) <= now())
          ) as expired,
          case when m.user_a_id = $1::uuid then m.user_b_id::text else m.user_a_id::text end as other_id,
          other.display_name as other_name,
          e.slug as event_slug,
          e.title as event_title,
          e.starts_at as event_starts_at,
          (p.suggested_event_id is not null) as had_suggestion,
          coalesce(p.alternatives_count, 0) as alternatives_count,
          coalesce(p.expires_at, m.expires_at) as expires_at,
          p.confirmed_at,
          (p.confirmed_by = $1::uuid) as confirmed_by_me,
          -- Can this event still be RSVP'd to? Upcoming, live, and at least one seat
          -- left (net guest +1s + live holds via event_capacity_v). A mid-progress
          -- plan where one side has already RSVP'd only needs the one seat. This is
          -- an ACTION gate - it decides whether a Confirm/RSVP control renders. It
          -- must never decide whether the plan is shown to exist.
          (
            e.id is not null
            and e.starts_at > now()
            and e.status in ('live', 'featured')
            and exists (
              select 1 from event_capacity_v cap
              where cap.event_id = e.id and cap.available >= 1
            )
          ) as event_joinable,
          -- The two ways a plan stops being joinable, kept apart from each other and
          -- from "sold out" so the drawer can say WHICH - a cancelled event really
          -- did fall through, a started one did not.
          (e.status = 'cancelled') as event_cancelled,
          (e.starts_at <= now()) as event_started,
          -- C11: does each side already hold a confirmed seat? Computed against the
          -- event itself, so a sold-out or already-started event still reports the
          -- seats people are actually holding.
          --
          -- event_participants_v, not event_attendees - the same correction
          -- migration 056 made to the click surfaces, which this pair of flags was
          -- missed by. A claimed guest +1 has no attendee row of their own (the
          -- seat hangs off the purchaser's booking), so event_attendees reported
          -- "no seat" for someone who is definitely going: the drawer told them to
          -- RSVP to an event they already had a seat at, and "Both going" could
          -- never appear for a pair where either side came on a friend's booking.
          exists (
            select 1 from event_participants_v pv
            where pv.event_id = e.id and pv.profile_id = $1::uuid
          ) as viewer_has_seat,
          exists (
            select 1 from event_participants_v pv
            where pv.event_id = e.id and pv.profile_id = other.id
          ) as other_has_seat,
          -- Coordination drawer (2.5b): the mutual it belongs to + its live step,
          -- the viewer's one-time reveal flag, the intent snapshot for the reveal
          -- line, the both-opted-in dating flag, and which side owns the pending plan.
          m.id::text as mutual_id,
          m.coord_state,
          case when m.user_a_id = $1::uuid then m.seen_at_a is not null else m.seen_at_b is not null end as reveal_seen,
          m.intent_a,
          m.intent_b,
          (m.intent_a = 'dating' and m.intent_b = 'dating') as both_dating,
          (p.proposed_by = $1::uuid) as proposed_by_me
        -- Mutual-centric (2.5b-iv): every ACTIVE mutual for the viewer, its live
        -- plan LEFT-joined. An open mutual whose only proposal was declined has no
        -- plan row (p.* null) and still shows - the drawer's suggest step re-fills it.
        -- The lateral picks the single pending/accepted plan (at most one exists, but
        -- lateral + limit 1 stays correct even on dirty data - no mutual fans out).
        from mutual_clicks m
        join profiles other on other.id = (
          case when m.user_a_id = $1::uuid then m.user_b_id else m.user_a_id end
        )
        left join lateral (
          select cp.*
          from click_proposals cp
          where cp.mutual_click_id = m.id and cp.status in ('pending', 'accepted')
          order by cp.updated_at desc
          limit 1
        ) p on true
        -- ALWAYS attach the suggested event. This join answers "what plan is this",
        -- never "can it still be joined" - the joinability filters used to live here
        -- and the plan lost its event the moment the night started, taking both seat
        -- flags with it. Two people holding paid seats were then told, from inside
        -- the venue, that the plan had fallen through. Joinability is a flag now.
        left join events e on e.id = p.suggested_event_id
        where (m.user_a_id = $1::uuid or m.user_b_id = $1::uuid)
          and (
            (m.status = 'active' and m.expires_at > now())
            -- The "past clicks" shelf (B7.6 / B7.9), readable for a month so the
            -- ending's notification opens something. They project as isExpired,
            -- which renders the read-only step - no controls, nothing to act on.
            --
            -- Exactly the two endings that rest there: 'released' (seven days of
            -- silence - "Still out there, if you cross paths again you can pick it
            -- back up") and 'connected' (the success terminal). NOT 'suppressed':
            -- "not feeling it" is a deliberate dismissal, and parking it on a shelf
            -- the dismisser keeps seeing is the drama B7.1 promises it won't be.
            -- NOT 'expired' either: that is block / account deletion, which must
            -- leave nothing behind at all.
            or (m.status in ('released', 'connected') and m.ended_at > now() - interval '30 days')
          )
          -- SAFE-05: hide a blocked pair (belt-and-suspenders to the teardown).
          and not exists (
            select 1 from user_blocks b
            where (b.blocker_profile_id = m.user_a_id and b.blocked_profile_id = m.user_b_id)
               or (b.blocker_profile_id = m.user_b_id and b.blocked_profile_id = m.user_a_id)
          )
        -- Plans (both going) first, then live/actionable, newest activity first.
        order by
          (m.coord_state = 'confirmed_together') desc,
          (coalesce(p.expires_at, m.expires_at) > now()) desc,
          coalesce(p.updated_at, m.updated_at) desc
        limit 50
      `,
      [profile.id],
    );

    return result.rows.map((row) => ({
      // "" when the mutual has no live plan (open, e.g. post-decline) - the drawer
      // keys those on mutualId (suggestPlanForMutual), never on a proposal id.
      id: row.id ?? "",
      // The new enum uses 'accepted'; the proposal UI still keys on 'confirmed'. Null
      // (no live plan) maps to 'pending' so an open mutual reads as live, not lapsed.
      status:
        row.status === "accepted" ? "confirmed" : row.status === "expired" ? "expired" : "pending",
      isExpired: Boolean(row.expired),
      otherId: row.other_id,
      otherName: row.other_name,
      suggestedEventSlug: row.event_slug,
      suggestedEventTitle: row.event_title,
      suggestedEventStartsAt: row.event_starts_at ? row.event_starts_at.toISOString() : null,
      // A suggestion exists but can no longer be RSVP'd to - it sold out, was
      // cancelled, or has started. Only meaningful while still pending.
      suggestionUnavailable:
        row.had_suggestion && !row.event_joinable && row.status === "pending",
      suggestedEventJoinable: Boolean(row.event_joinable),
      suggestedEventCancelled: Boolean(row.event_cancelled),
      suggestedEventStarted: Boolean(row.event_started),
      alternativesRemaining: Math.max(0, PROPOSAL_ALTERNATIVES_CAP - row.alternatives_count),
      expiresAt: row.expires_at.toISOString(),
      confirmedAt: row.confirmed_at ? row.confirmed_at.toISOString() : null,
      confirmedByMe: Boolean(row.confirmed_by_me),
      viewerHasSeat: Boolean(row.viewer_has_seat),
      otherHasSeat: Boolean(row.other_has_seat),
      mutualId: row.mutual_id,
      coordState: row.coord_state,
      revealSeen: Boolean(row.reveal_seen),
      sharedIntent: intentPhrase(row.intent_a, row.intent_b),
      bothDating: Boolean(row.both_dating),
      proposedByMe: Boolean(row.proposed_by_me),
    }));
  } catch {
    return [];
  }
}

// §4 (COORDINATION_MODAL_SYSTEM): the mutual reveal fires exactly ONCE per user,
// per mutual. Persisted on mutual_clicks.seen_at_a/b (user_a = least(pair)), so
// every later re-entry (bell, dashboard, Your clicks) skips the reveal and opens
// the drawer straight at its current coord_state step - the exact regression the
// live render had (re-firing on every notification tap). Migration-free: the
// columns ship unused in 049.
export async function getMutualRevealState(
  session: Session | null,
  mutualId: string,
): Promise<{ seen: boolean } | null> {
  const pool = getPostgresPool();
  if (!getSessionEmail(session) || !pool) return null;
  try {
    const profile = await ensureProfileForSession(session);
    const result = await pool.query<{ seen: boolean }>(
      `
        select case
          when user_a_id = $2::uuid then seen_at_a is not null
          else seen_at_b is not null
        end as seen
        from mutual_clicks
        where id = $1::uuid
          and status = 'active'
          and (user_a_id = $2::uuid or user_b_id = $2::uuid)
        limit 1
      `,
      [mutualId, profile.id],
    );
    const row = result.rows[0];
    return row ? { seen: Boolean(row.seen) } : null;
  } catch {
    return null;
  }
}

// Stamps the viewer's side seen_at (idempotent - the WHERE only matches while the
// viewer's column is still null, so a re-open is a no-op). Returns true only on
// the FIRST view, which is what tells the drawer to play the one-time reveal.
export async function markMutualSeen(
  session: Session | null,
  mutualId: string,
): Promise<boolean> {
  const pool = getPostgresPool();
  if (!getSessionEmail(session)) throw authError();
  if (!pool) throw databaseUnavailableError();
  const profile = await ensureProfileForSession(session);
  const result = await pool.query<{ id: string }>(
    `
      update mutual_clicks
      set seen_at_a = case when user_a_id = $2::uuid then now() else seen_at_a end,
          seen_at_b = case when user_b_id = $2::uuid then now() else seen_at_b end
      where id = $1::uuid
        and status = 'active'
        and (
          (user_a_id = $2::uuid and seen_at_a is null)
          or (user_b_id = $2::uuid and seen_at_b is null)
        )
      returning id::text
    `,
    [mutualId, profile.id],
  );
  return result.rows.length > 0;
}

// Verifies the session profile participates in the proposal's mutual click.
// Returns { proposalId, otherId } or throws.
async function assertProposalParticipant(
  client: import("pg").PoolClient,
  proposalId: string,
  profileId: string,
) {
  const result = await client.query<{
    other_id: string;
    status: string;
    expires_at: Date;
    proposed_by: string | null;
  }>(
    `
      select
        case when m.user_a_id = $2::uuid then m.user_b_id::text else m.user_a_id::text end as other_id,
        p.status::text,
        p.expires_at,
        p.proposed_by::text
      from click_proposals p
      join mutual_clicks m on m.id = p.mutual_click_id
      where p.id = $1::uuid
        and (m.user_a_id = $2::uuid or m.user_b_id = $2::uuid)
      limit 1
    `,
    [proposalId, profileId],
  );
  const row = result.rows[0];
  if (!row) {
    const error = new Error("Proposal not found.");
    error.name = "NotFoundError";
    throw error;
  }
  return row;
}

export async function confirmProposal(session: Session | null, proposalId: string) {
  const pool = getPostgresPool();
  if (!getSessionEmail(session)) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const row = await assertProposalParticipant(client, proposalId, profile.id);
    if (row.status !== "pending") {
      await client.query("rollback");
      return;
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await client.query(
        `update click_proposals set status = 'expired', updated_at = now() where id = $1::uuid`,
        [proposalId],
      );
      await client.query("commit");
      throw validationError("This proposal has expired.");
    }

    // SAFE-02: re-check block/ban/suspend at mutation time. Membership + status/expiry
    // alone let a since-blocked (or banned/suspended) party still confirm the plan and
    // stay "both going". Neutral refusal - never discloses which side blocked.
    if (!(await pairCoordinationAllowed(client, profile.id, row.other_id))) {
      await client.query("rollback");
      throw validationError("This plan is no longer available.");
    }

    // CAP-5 / §B5.1: accept-time capacity re-check. The proposed event may have filled
    // since it was suggested (a contended fill). Re-read the canonical seat count; if it's
    // sold out, refuse the confirm but leave the proposal PENDING - the display join then
    // resolves the full event to null and the card shows its "that event filled up -
    // suggest alternative" state, so the pair can re-pick without being stranded. (The
    // terminal event_full status + the read-time re-propose handshake land in 2.5.)
    const capRow = await client.query<{ unavailable: boolean }>(
      `
        select (
          e.status not in ('live', 'featured')
          or e.starts_at <= now()
          or cap.available < (
            select count(*)
            from unnest(array[m.user_a_id, m.user_b_id]) participant(profile_id)
            where not exists (
              select 1 from event_attendees attendee
              where attendee.event_id = e.id
                and attendee.profile_id = participant.profile_id
                and attendee.status in ('confirmed', 'pending_payment')
                and (attendee.status <> 'pending_payment' or attendee.hold_expires_at > now())
            )
          )
        ) as unavailable
        from click_proposals cp
        join mutual_clicks m on m.id = cp.mutual_click_id
        join events e on e.id = cp.suggested_event_id
        join event_capacity_v cap on cap.event_id = e.id
        where cp.id = $1::uuid
      `,
      [proposalId],
    );
    if (!capRow.rows[0]) {
      // No suggested event attached (null / since-deleted) - nothing bookable to confirm.
      await client.query("rollback");
      throw validationError("Pick an event for this plan before confirming.");
    }
    if (capRow.rows[0].unavailable) {
      // Sold out, waitlisting (full), cancelled, or now in the past - mirrors the
      // propose-time + display gates so confirm can't lock an unjoinable plan.
      await client.query("rollback");
      throw validationError("That event just filled up - suggest another plan together.");
    }

    await client.query(
      `
        update click_proposals
        set status = 'accepted', confirmed_by = $2::uuid, confirmed_at = now(), updated_at = now()
        where id = $1::uuid and status = 'pending'
      `,
      [proposalId, profile.id],
    );

    // The plan is locked - advance the mutual to confirmed_together (§B5.3). The fuller
    // both-or-neither booking coordination (§B5) lands in the 2.5 surfaces pass.
    //
    // Extending expires_at is not optional here. The 7-day clock stamped at
    // formation is a *discovery* timer for pairs where nothing happened; once a
    // plan is locked it must outlive that clock. expireClickLifecycles expires
    // any active mutual past expires_at regardless of coord_state, and
    // getProposalsForSession filters on `status = 'active' and expires_at >
    // now()` - so a plan confirmed on day 0 for an event on day 20 silently
    // vanished from /proposals on day 7, partner and calendar link included,
    // with no notification. greatest() so this only ever extends.
    await client.query(
      `
        update mutual_clicks m
        set coord_state = 'confirmed_together',
            expires_at = greatest(
              m.expires_at,
              coalesce(e.ends_at, e.starts_at) + interval '${POST_EVENT_CLICK_WINDOW_HOURS} hours'
            ),
            updated_at = now()
        from click_proposals cp
        join events e on e.id = cp.suggested_event_id
        where cp.id = $1::uuid
          and m.id = cp.mutual_click_id
          and m.status = 'active'
      `,
      [proposalId],
    );

    await client.query(
      `
        insert into notifications (profile_id, title, body, action_url)
        select $1::uuid, 'Plan confirmed', $2,
          '/proposals?open=' || (select mutual_click_id::text from click_proposals where id = $4::uuid)
        where not exists (
          select 1 from user_mutes
          where muter_profile_id = $1::uuid and muted_profile_id = $3::uuid
        )
      `,
      [row.other_id, `${profile.display_name} confirmed your shared plan.`, profile.id, proposalId],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function proposeAlternativeForProposal(
  session: Session | null,
  proposalId: string,
  eventSlug: string,
) {
  const pool = getPostgresPool();
  if (!getSessionEmail(session)) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const row = await assertProposalParticipant(client, proposalId, profile.id);

    // Is the plan currently on the table still something either of them could join?
    // One question, two jobs below: it decides whether an ACCEPTED plan is settled
    // (leave a live agreement alone), and whether re-pointing is recovery rather
    // than a counter-proposal. No suggested event at all reads as "not live", which
    // is right - an empty proposal is not a plan being countered.
    const stillLive = await client.query<{ ok: boolean }>(
      `
        select true as ok
        from click_proposals cp
        join events e on e.id = cp.suggested_event_id
        join event_capacity_v cap on cap.event_id = e.id
        where cp.id = $1::uuid
          and e.status in ('live', 'featured')
          and e.starts_at > now()
          and cap.available >= 1
      `,
      [proposalId],
    );
    const planStillLive = Boolean(stillLive.rows[0]?.ok);

    // A live (pending) proposal can always be re-pointed. C12 (§B0/§B6): a CONFIRMED
    // (accepted) plan whose agreed event has since died (cancelled / sold out / past)
    // is a failed attempt, NOT a terminal - allow re-suggesting so the pair re-picks
    // instead of being stranded on a dead "Wrapped" card. A confirmed plan whose event
    // is still joinable stays settled (no silent re-open of a live agreement).
    if (row.status !== "pending") {
      if (row.status !== "accepted" || planStillLive) {
        await client.query("rollback");
        throw validationError("This plan is already settled.");
      }
      // else: accepted + dead event → fall through and reopen it below.
    }

    // The three-alternative budget exists to stop a pair re-pointing a LIVE plan at
    // each other forever. A plan that died under them - the venue cancelled it, it
    // sold out, the night has been and gone - is not a counter-proposal, so
    // recovering from one neither spends the budget nor is blocked by it. Without
    // this, a pair who used their three alternatives and then lost the event were
    // stranded for good: the drawer's own "Suggest another plan" recovery button
    // posted straight into "You've reached the limit of 3 alternative suggestions",
    // and the mutual then sat there until its clock ran out.
    const recovering = !planStillLive;

    // SAFE-03: re-check block/ban/suspend before mutating the shared proposal, so a
    // since-blocked party can't keep re-proposing into the other person's surface.
    if (!(await pairCoordinationAllowed(client, profile.id, row.other_id))) {
      await client.query("rollback");
      throw validationError("This plan is no longer available.");
    }

    const countResult = await client.query<{ alternatives_count: number }>(
      `select alternatives_count from click_proposals where id = $1::uuid for update`,
      [proposalId],
    );
    if (
      !recovering &&
      (countResult.rows[0]?.alternatives_count ?? 0) >= PROPOSAL_ALTERNATIVES_CAP
    ) {
      await client.query("rollback");
      throw validationError(
        `You've reached the limit of ${PROPOSAL_ALTERNATIVES_CAP} alternative suggestions.`,
      );
    }

    // Alternative must be a real, bookable upcoming event from the catalogue - no free
    // text. CAP-5 / §B4.1: propose-time capacity re-check - the alternative must have room
    // for BOTH (>= 2 free seats via event_capacity_v), and full/waitlist events are
    // excluded by status, so a sold-out event can never be set as the live plan.
    const eventResult = await client.query<{ id: string; title: string }>(
      `
        select e.id::text, e.title
        from events e
        join event_capacity_v cap on cap.event_id = e.id
        where e.slug = $1
          and e.status in ('live', 'featured')
          and e.starts_at > now()
          and cap.available >= 2
        limit 1
      `,
      [eventSlug],
    );
    const event = eventResult.rows[0];
    if (!event) {
      await client.query("rollback");
      throw validationError("Pick an upcoming event with room for two from the catalogue.");
    }

    // Re-point the suggestion. `status='pending', confirmed_* = null` is a no-op for a
    // pending row but reopens an accepted-dead one (C12); coord_state → 'proposed' below
    // mirrors it so a re-suggested plan is live again for both.
    //
    // expires_at MUST be reset with it. getProposalsForSession treats a row as
    // expired when `status is distinct from 'accepted' and expires_at <= now()`;
    // an accepted plan is exempt, so its deadline is routinely already in the
    // past by the time the agreed event dies. Flipping status back to 'pending'
    // without moving the clock therefore re-projected the pair straight to "This
    // plan wound down" the instant they re-suggested - the recovery step handed
    // them a dead card. Same window a fresh suggestion gets, so re-suggesting
    // and suggesting behave identically.
    await client.query(
      `
        update click_proposals
        set suggested_event_id = $2::uuid, proposed_by = $3::uuid,
            status = 'pending', confirmed_by = null, confirmed_at = null,
            expires_at = now() + interval '${MUTUAL_CLOCK_DAYS} days',
            alternatives_count = alternatives_count + ${recovering ? 0 : 1},
            updated_at = now()
        where id = $1::uuid
      `,
      [proposalId, event.id, profile.id],
    );

    await client.query(
      `
        update mutual_clicks
        set coord_state = 'proposed', updated_at = now()
        where id = (select mutual_click_id from click_proposals where id = $1::uuid)
          and status = 'active'
      `,
      [proposalId],
    );

    await client.query(
      `
        insert into notifications (profile_id, title, body, action_url)
        select $1::uuid, 'New plan suggested', $2,
          '/proposals?open=' || (select mutual_click_id::text from click_proposals where id = $4::uuid)
        where not exists (
          select 1 from user_mutes
          where muter_profile_id = $1::uuid and muted_profile_id = $3::uuid
        )
      `,
      [row.other_id, `${profile.display_name} suggested ${event.title}.`, profile.id, proposalId],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// §B6 / COORDINATION §2: declining a plan is a first-class, no-blame exit that
// returns the mutual to `open` (NOT one of the four active-ENDING exits - the
// mutual stays active, the pair can suggest again). The proposer is never told
// "declined" (§4/§9: no blame, no rejection signal); their drawer simply shows the
// suggest step again. Pairs with suggestPlanForMutual, which re-fills `open`.
export async function declineProposalForSession(session: Session | null, proposalId: string) {
  const pool = getPostgresPool();
  if (!getSessionEmail(session)) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const row = await assertProposalParticipant(client, proposalId, profile.id);
    // Only a live (pending) plan is declinable; accepted/expired/already-declined
    // rows are settled. No block re-check: declining only REMOVES shared state, so
    // it's always safe for a participant (a blocked pair must still be able to clear it).
    if (row.status !== "pending") {
      await client.query("rollback");
      throw validationError("This plan is already settled.");
    }
    // Declining is the RECIPIENT's move, which is the rule the drawer has always
    // followed - it renders "Not this one" only on a plan the viewer did not propose.
    // The server did not, and a server action is every bit as callable as an API
    // route. That gap was a loop: propose (which notifies the other person), decline
    // your own proposal, propose again. Decline returns the mutual to `open` and
    // hands the pair a fresh alternatives budget - which is the deliberate escape
    // hatch the cap copy promises the RECIPIENT ("pass and you two can start fresh"),
    // and in the proposer's hands was instead an unbounded ping into someone else's
    // notification tray for the mutual's whole seven days.
    //
    // proposed_by is NULL on a system suggestion (nobody picked it, the catalogue
    // did), so that case stays declinable by both - which is right, it is no one's
    // plan to withdraw.
    if (row.proposed_by && row.proposed_by === profile.id) {
      await client.query("rollback");
      throw validationError("This is your suggestion - suggest a different one instead.");
    }
    await client.query(
      `update click_proposals set status = 'declined', updated_at = now() where id = $1::uuid and status = 'pending'`,
      [proposalId],
    );
    await client.query(
      `
        update mutual_clicks set coord_state = 'open', updated_at = now()
        where id = (select mutual_click_id from click_proposals where id = $1::uuid)
          and status = 'active'
      `,
      [proposalId],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// "Not feeling it" (B7.1) - the graceful no, silent, no drama. The pair is kept out
// of discovery for 90 days, after which the lifecycle cron removes the suppression
// and they may naturally encounter one another again (B7.5).
//
// The status is 'suppressed', per the B2 enum's own comment: "'Not feeling it'
// (B7.5): hidden from each other 90d, then lapses." It wrote 'released', which is the
// 7-day-silence terminal on a 30-day cooldown - so a deliberate soft-no was recorded
// as a passive fizzle, and the pair sat on the past-clicks shelf the user had just
// dismissed. B7.9: "a deliberate soft-no gets more distance than a passive fizzle."
export async function releaseMutualForSession(session: Session | null, mutualId: string) {
  const pool = getPostgresPool();
  if (!getSessionEmail(session)) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ user_a_id: string; user_b_id: string }>(
      `select user_a_id::text, user_b_id::text
       from mutual_clicks
       where id = $1::uuid and status = 'active'
         and (user_a_id = $2::uuid or user_b_id = $2::uuid)
       for update`,
      [mutualId, profile.id],
    );
    const mutual = result.rows[0];
    if (!mutual) throw validationError("This connection is already settled.");

    await client.query(
      `update click_proposals set status = 'withdrawn', updated_at = now()
       where mutual_click_id = $1::uuid and status in ('pending', 'accepted')`,
      [mutualId],
    );
    await client.query(
      `update clicks set status = 'invalidated', updated_at = now()
       where status = 'pending'
         and ((sender_id = $1::uuid and receiver_id = $2::uuid)
           or (sender_id = $2::uuid and receiver_id = $1::uuid))`,
      [mutual.user_a_id, mutual.user_b_id],
    );
    await client.query(
      `update mutual_clicks
       set status = 'suppressed', coord_state = 'dormant', ended_at = now(), updated_at = now()
       where id = $1::uuid`,
      [mutualId],
    );
    await client.query(
      `insert into pair_suppressions (user_a_id, user_b_id, reason, expires_at)
       values ($1::uuid, $2::uuid, 'not_feeling_it', now() + interval '${PAIR_SUPPRESSION_DAYS} days')
       on conflict (user_a_id, user_b_id)
       do update set reason = excluded.reason, expires_at = excluded.expires_at, created_at = now()`,
      [mutual.user_a_id, mutual.user_b_id],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// §B4 / COORDINATION §2 (`open` step): create a FRESH plan for a mutual that has
// none pending - a brand-new mutual, or one a decline returned to `open`. This is
// the create-path the send-click auto-suggest comment defers to 2.5. Re-pointing
// an EXISTING pending plan goes through proposeAlternativeForProposal (which owns
// the 3-alt cap); this fires only from `open`, and a concurrent pending insert is
// a no-op (never a cap bypass). Advances coord_state → 'proposed'.
export async function suggestPlanForMutual(
  session: Session | null,
  mutualId: string,
  eventSlug: string,
) {
  const pool = getPostgresPool();
  if (!getSessionEmail(session)) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const mutualResult = await client.query<{ other_id: string; coord_state: string }>(
      `
        select
          case when user_a_id = $2::uuid then user_b_id::text else user_a_id::text end as other_id,
          coord_state
        from mutual_clicks
        where id = $1::uuid and status = 'active'
          and (user_a_id = $2::uuid or user_b_id = $2::uuid)
        for update
      `,
      [mutualId, profile.id],
    );
    const mutual = mutualResult.rows[0];
    if (!mutual) {
      await client.query("rollback");
      throw validationError("This connection is no longer available.");
    }
    // 'dormant' belongs here with 'open'. expireClickLifecycles parks a still-
    // ACTIVE mutual at coord_state='dormant' once its only proposal lapses
    // (:8034-8042), and that pair keeps showing on /proposals: the lateral join
    // only picks pending/accepted plans, so the row comes back with no plan
    // attached and projectStep renders it as the "open" suggest step, picker and
    // all. Rejecting 'dormant' here meant every suggestion that step invited
    // failed with "suggest an alternative instead" - pointing at an alternative
    // that cannot exist, since the drawer holds no proposal id for these rows.
    // 'proposed' (a live plan) and 'confirmed_together' / 'released' stay out.
    if (mutual.coord_state !== "open" && mutual.coord_state !== "dormant") {
      // A plan is already on the table - re-point it, don't stack a second one.
      await client.query("rollback");
      throw validationError("There's already a plan here - suggest an alternative instead.");
    }

    // SAFE: suggesting creates shared coordination state, so re-check block/ban/suspend.
    if (!(await pairCoordinationAllowed(client, profile.id, mutual.other_id))) {
      await client.query("rollback");
      throw validationError("This connection is no longer available.");
    }

    // Same bookable-for-two gate as proposeAlternative: catalogue only (no free text),
    // upcoming, live/featured, room for BOTH (>= 2 free seats via event_capacity_v).
    const eventResult = await client.query<{ id: string; title: string }>(
      `
        select e.id::text, e.title
        from events e
        join event_capacity_v cap on cap.event_id = e.id
        where e.slug = $1 and e.status in ('live', 'featured')
          and e.starts_at > now() and cap.available >= 2
        limit 1
      `,
      [eventSlug],
    );
    const event = eventResult.rows[0];
    if (!event) {
      await client.query("rollback");
      throw validationError("Pick an upcoming event with room for two from the catalogue.");
    }

    // open ⇒ no pending row; do-nothing on the partial-unique guards a concurrent insert.
    await client.query(
      `
        insert into click_proposals (mutual_click_id, suggested_event_id, proposed_by, status, expires_at)
        values ($1::uuid, $2::uuid, $3::uuid, 'pending', now() + interval '${MUTUAL_CLOCK_DAYS} days')
        on conflict (mutual_click_id) where status = 'pending' do nothing
      `,
      [mutualId, event.id, profile.id],
    );
    await client.query(
      `update mutual_clicks set coord_state = 'proposed', updated_at = now() where id = $1::uuid and status = 'active'`,
      [mutualId],
    );
    await client.query(
      `
        insert into notifications (profile_id, title, body, action_url)
        select $1::uuid, 'New plan suggested', $2, $4
        where not exists (
          select 1 from user_mutes where muter_profile_id = $1::uuid and muted_profile_id = $3::uuid
        )
      `,
      [
        mutual.other_id,
        `${profile.display_name} suggested ${event.title}.`,
        profile.id,
        `/proposals?open=${mutualId}`,
      ],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export type ProposalCatalogueEvent = {
  slug: string;
  title: string;
  startsAt: string;
  suburb: string;
};

// Upcoming, bookable events offered when suggesting an alternative.
export async function getProposalCatalogue(): Promise<ProposalCatalogueEvent[]> {
  const pool = getPostgresPool();
  if (!pool) return [];
  try {
    const result = await pool.query<{
      slug: string;
      title: string;
      starts_at: Date;
      suburb: string;
    }>(
      `
        select event.slug, event.title, event.starts_at, event.suburb
        from events event
        join event_capacity_v cap on cap.event_id = event.id
        where event.status in ('live', 'featured')
          and event.starts_at > now()
          -- CAP-2/4: only offer alternatives that fit the PAIR (>= 2 free seats, guests +
          -- holds netted) so picking one never gets rejected by proposeAlternative's gate.
          and cap.available >= 2
        order by event.starts_at asc
        limit 60
      `,
    );
    return result.rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      startsAt: row.starts_at.toISOString(),
      suburb: row.suburb,
    }));
  } catch {
    return [];
  }
}

export type PersonalityQuizInput = {
  personaName: string;
  socialEnergy: "introvert" | "ambivert" | "extrovert";
  pace: "relaxed" | "balanced" | "fast_moving";
  openness: "cautious" | "curious" | "ready";
  engagementFrequency: "occasional" | "active" | "enthusiastic";
  intentMix: Record<string, number>;
};

export async function savePersonalityQuiz(
  session: Session | null,
  input: PersonalityQuizInput,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const email = getSessionEmail(session);
  if (!email) throw authError();

  const profile = await ensureProfileForSession(session);
  await pool.query(
    `
      insert into click_personas
        (profile_id, persona_name, social_energy, pace, openness, engagement_frequency, intent_mix)
      values ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      profile.id,
      input.personaName,
      input.socialEnergy,
      input.pace,
      input.openness,
      input.engagementFrequency,
      JSON.stringify(input.intentMix),
    ],
  );
}

export async function getLatestPersonaForSession(
  session: Session | null,
): Promise<{
  personaName: string;
  socialEnergy: string;
  pace: string;
  openness: string;
  engagementFrequency: string;
  generatedAt: string;
} | null> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!pool || !email) return null;

  try {
    const profile = await ensureProfileForSession(session);
    const result = await pool.query<{
      persona_name: string;
      social_energy: string;
      pace: string;
      openness: string;
      engagement_frequency: string;
      generated_at: Date;
    }>(
      `
        select persona_name, social_energy, pace, openness, engagement_frequency, generated_at
        from click_personas
        where profile_id = $1::uuid
        order by generated_at desc
        limit 1
      `,
      [profile.id],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      personaName: row.persona_name,
      socialEnergy: row.social_energy,
      pace: row.pace,
      openness: row.openness,
      engagementFrequency: row.engagement_frequency,
      generatedAt: row.generated_at.toISOString(),
    };
  } catch {
    return null;
  }
}

// The Life Quiz taxonomy - which option slugs each section owns, and therefore
// the entire blast radius of the retake DELETE below.
//
// Imported from src/lib/life-quiz-sections.ts, which the wizard imports too. It
// used to be a hand-synced copy of SECTIONS in life-quiz-wizard.tsx, because a
// server module cannot import an array out of a "use client" file - it gets a
// client-reference proxy. Moving the taxonomy into a JSX-free lib module both
// sides import removes that hazard: adding a wizard option without updating the
// server copy used to silently make that answer impossible to deselect, since a
// slug this map does not know is never deletable.

// The slugs this profile currently carries FROM the Life Quiz, so a retake can
// pre-populate instead of opening on an empty board. This getter is what makes
// the authoritative save below honest: the user sees the answers they already
// have and deselects the ones they no longer identify with, rather than the
// server quietly deciding on their behalf.
//
// Read-only, and returns [] rather than throwing so a quiz page still renders
// when the pool is down or the visitor is signed out.
export async function getLifeQuizSelections(
  session: Session | null,
): Promise<string[]> {
  const pool = getPostgresPool();
  if (!pool || !getSessionEmail(session)) return [];

  try {
    const profile = await ensureProfileForSession(session);
    const result = await pool.query<{ slug: string }>(
      `
        select t.slug
        from user_tags ut
        join tags t on t.id = ut.tag_id
        where ut.profile_id = $1::uuid
          and ut.source = 'quiz'
          and t.tag_type = 'life'
      `,
      [profile.id],
    );
    return result.rows.map((r) => r.slug);
  } catch {
    return [];
  }
}

export async function saveLifeQuizTags(
  session: Session | null,
  tagSlugs: string[],
  // Section slugs (keys of LIFE_QUIZ_SECTION_OPTIONS) the user was actually
  // shown this sitting. Omitted, we infer them from the submitted slugs, which
  // is strictly narrower and provably safe: a slug can only reach here if its
  // section was on screen and tapped. Pass it explicitly to let someone clear a
  // section outright - under inference alone, deselecting every option in a
  // section leaves that section's old tags in place, because nothing in the
  // payload proves the section was ever visited.
  shownSections?: string[],
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const email = getSessionEmail(session);
  if (!email) throw authError();

  const slugs = Array.from(
    new Set(tagSlugs.map((s) => s.trim().toLowerCase()).filter(Boolean)),
  ).slice(0, 64);

  // The delete's blast radius, resolved before any SQL runs: only sections this
  // map knows AND that we can show the user was shown, expanded to exactly the
  // option slugs those sections own. An unknown section slug is dropped here.
  const sections = (
    shownSections ??
    Object.keys(LIFE_QUIZ_SECTION_OPTIONS).filter((section) =>
      LIFE_QUIZ_SECTION_OPTIONS[section].some((option) => slugs.includes(option)),
    )
  ).filter((section) => section in LIFE_QUIZ_SECTION_OPTIONS);
  const deletable = sections.flatMap((section) => LIFE_QUIZ_SECTION_OPTIONS[section]);

  // Nothing to write and nothing we are allowed to clear - leave the profile be.
  if (slugs.length === 0 && deletable.length === 0) return;

  const profile = await ensureProfileForSession(session);

  // One transaction end to end: a partial apply here would be a profile with
  // neither the old answers nor the new ones.
  const client = await pool.connect();
  try {
    await client.query("begin");

    // The Life Quiz defines its own taxonomy (life-stage / availability /
    // event-style / energy). Historically those slugs were NOT seeded into
    // `tags`, so the old "link by existing slug" insert matched nothing and the
    // quiz never registered as completed. Create any missing slugs first (as
    // 'life' tags, label titleised from the slug), then link - so every answer
    // persists and `lifeQuizCompleted` flips true. Separate statements because a
    // data-modifying CTE's inserts aren't visible to a SELECT in the same query.
    if (slugs.length > 0) {
      await client.query(
        `
          insert into tags (label, slug, tag_type, admin_managed)
          select initcap(replace(slug, '-', ' ')), slug, 'life', false
          from unnest($1::text[]) as slug
          on conflict (slug) do nothing
        `,
        [slugs],
      );
    }

    // Retaking the quiz is authoritative, so a life stage you no longer identify
    // with can actually come off - it used to be permanent, since this function
    // only ever inserted. Four independent guards keep that from reaching one row
    // more than the user just decided about:
    //   source = 'quiz'        - never an onboarding, admin or music-picker tag
    //   tag_type = 'life'      - never an interest or vibe tag that shares a slug
    //   slug = any($2)         - only options of a section they were shown
    //   not slug = any($3)     - and never something still selected
    // An empty $3 is not null-ish here: `slug = any('{}')` is false, so a section
    // deliberately cleared clears, which is the whole point.
    if (deletable.length > 0) {
      await client.query(
        `
          delete from user_tags ut
          using tags t
          where ut.tag_id = t.id
            and ut.profile_id = $1::uuid
            and ut.source = 'quiz'
            and t.tag_type = 'life'
            and t.slug = any($2::text[])
            and not (t.slug = any($3::text[]))
        `,
        [profile.id, deletable, slugs],
      );
    }

    if (slugs.length > 0) {
      await client.query(
        `
          insert into user_tags (profile_id, tag_id, source)
          select $1::uuid, t.id, 'quiz'
          from tags t
          where t.slug = any($2::text[])
          on conflict (profile_id, tag_id) do update set source = 'quiz'
        `,
        [profile.id, slugs],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * How many seats the Bookings tab loads. It is a real cap, and a silently
 * truncated door list is worse than a slow one: a host with more than this many
 * seats across their events gets a list that is short and says nothing, then
 * exports it to CSV and takes it to a door. The panel compares its row count
 * against this and says so when it bites, which is why the number is exported
 * rather than inlined in the query.
 */
export const MERCHANT_DOOR_LIST_CAP = 500;

export type MerchantAllAttendeesRow = {
  attendeeId: string;
  eventSlug: string;
  eventTitle: string;
  eventStartsAt: string;
  // The owning event's publish status (live/pending/rejected/cancelled/…), so
  // the Bookings tab can flag an event that was rejected or pulled (#193).
  eventStatus: string;
  displayName: string;
  email: string;
  status: string;
  rsvpAt: string;
  checkedInAt: string | null;
  // Which kind of seat this row is. The Bookings tab bills itself as "the full
  // door list", and it used to read event_attendees only - so every paid +1 was
  // missing from the list, from its per-event counts and from the CSV, while
  // the event detail page listed them and the Events tab counted their seats.
  // A host running the door off this tab was short by every guest in the room.
  //
  // The two kinds check in against different columns
  // (event_attendees.checked_in_at vs guest_spots.attended), so the row has to
  // say which, and `attendeeId` carries the id for whichever table it is.
  kind: "ticket" | "guest";
};

export async function getMerchantAllAttendees(
  session: Session | null,
): Promise<MerchantAllAttendeesRow[]> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!pool || !email) return [];

  try {
    const profile = await ensureProfileForSession(session);
    const merchant = await getMerchantProfile(pool, profile.id);
    if (!merchant) return [];

    const result = await pool.query<{
      attendee_id: string;
      event_slug: string;
      event_title: string;
      event_starts_at: Date;
      event_status: string;
      display_name: string;
      email: string;
      status: string;
      rsvp_at: Date;
      checked_in_at: Date | null;
      kind: string;
    }>(
      // Two seat kinds, one door list. The guest half comes from the same
      // merchant_event_guests_v the event page's door list uses, so the two
      // surfaces cannot disagree about who is expected.
      //
      // A guest seat has NO email and NO date of birth by design (spec 19 §11 -
      // the guest's whole merchant-visible footprint is a first name, who
      // brought them, and whether they turned up), so `email` is empty rather
      // than null: the panel searches and CSV-escapes it as a plain string.
      //
      // The limit is applied to the merged set, and it is ordered before it is
      // cut, so a truncated list is still the 500 nearest-first rows rather than
      // 500 ticket-holders and no guests.
      `
        with seats as (
          select
            attendee.id::text as attendee_id,
            event.slug as event_slug,
            event.title as event_title,
            event.starts_at as event_starts_at,
            event.status::text as event_status,
            guest.display_name,
            guest.email::text as email,
            attendee.status::text as status,
            attendee.created_at as rsvp_at,
            attendee.checked_in_at,
            'ticket' as kind
          from event_attendees attendee
          join events event on event.id = attendee.event_id
          join profiles guest on guest.id = attendee.profile_id
          where event.merchant_profile_id = $1::uuid

          union all

          select
            g.guest_id::text as attendee_id,
            event.slug as event_slug,
            event.title as event_title,
            event.starts_at as event_starts_at,
            event.status::text as event_status,
            coalesce(g.first_name, 'Guest') || ' (+1 of ' || g.purchased_by || ')'
              as display_name,
            '' as email,
            -- A +1 seat on a confirmed booking IS a confirmed seat: the view
            -- already requires the paying attendee row to be 'confirmed'. Say
            -- so, so the status filter and the check-in gate treat it the same.
            'confirmed' as status,
            g.created_at as rsvp_at,
            case when g.attended then g.created_at else null end as checked_in_at,
            'guest' as kind
          from merchant_event_guests_v g
          join events event on event.id = g.event_id
          where g.merchant_profile_id = $1::uuid
        )
        select * from seats
        order by event_starts_at desc, rsvp_at desc
        limit ${MERCHANT_DOOR_LIST_CAP}
      `,
      [merchant.id],
    );

    return result.rows.map((row) => ({
      attendeeId: row.attendee_id,
      eventSlug: row.event_slug,
      eventTitle: row.event_title,
      eventStartsAt: row.event_starts_at.toISOString(),
      eventStatus: row.event_status,
      displayName: row.display_name,
      email: row.email,
      status: row.status,
      rsvpAt: row.rsvp_at.toISOString(),
      checkedInAt: row.checked_in_at ? row.checked_in_at.toISOString() : null,
      kind: row.kind === "guest" ? "guest" : "ticket",
    }));
  } catch (error) {
    // Deliberately NOT an empty array. This is the door list: swallowing a read
    // failure rendered the Bookings tab's "No one's booked in yet." empty state
    // at a host standing on the door of a sold-out event. "Nobody is coming"
    // and "we could not load who is coming" must never look identical.
    // src/app/merchant/error.tsx is the boundary that catches this.
    throw error instanceof Error ? error : new Error("Could not load your bookings.");
  }
}

export async function toggleAttendeeCheckIn(
  session: Session | null,
  attendeeId: string,
  checkIn: boolean,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const email = getSessionEmail(session);
  if (!email) throw authError();

  const profile = await ensureProfileForSession(session);
  const merchant = await getMerchantProfile(pool, profile.id);
  if (!merchant) throw authError("Only merchants can check in attendees.");

  await pool.query(
    `
      update event_attendees attendee
      set checked_in_at = case when $3::boolean then now() else null end,
          updated_at = now()
      from events event
      where attendee.event_id = event.id
        and event.merchant_profile_id = $1::uuid
        and attendee.id = $2::uuid
    `,
    [merchant.id, attendeeId, checkIn],
  );
}

// Day-of check-in for a named +1 (spec 19 §9/§11): writes guest_spots.attended,
// the guest-seat equivalent of event_attendees.checked_in_at. Ownership-scoped to
// the merchant's own event, and limited to named seats (invited/claimed) - an
// unnamed/released/removed +1 isn't on the door list, so there's no one to mark.
export async function toggleGuestCheckIn(
  session: Session | null,
  guestId: string,
  attended: boolean,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const email = getSessionEmail(session);
  if (!email) throw authError();

  const profile = await ensureProfileForSession(session);
  const merchant = await getMerchantProfile(pool, profile.id);
  if (!merchant) throw authError("Only merchants can check in guests.");

  await pool.query(
    `
      update guest_spots gs
      set attended = $3::boolean,
          updated_at = now()
      from events event
      where gs.event_id = event.id
        and event.merchant_profile_id = $1::uuid
        and gs.id = $2::uuid
        and gs.status in ('invited', 'claimed')
    `,
    [merchant.id, guestId, attended],
  );
}

export type MerchantFinancesSummary = {
  // The four numbers reconcile: collected = platformFee + net (to the cent,
  // modulo rounding). Deliberately renamed off "total/paid/pending revenue",
  // which is what let the tab label a gross buyer charge "Paid out - to your
  // bank" and sum abandoned checkouts into an all-time revenue figure.
  //
  // collected  - what buyers were actually charged, less anything refunded
  // platformFee- Click's commission + booking fee, taken as the Stripe
  //              application fee, so it never reaches the host's balance
  // net        - what actually lands in the connected account
  // refunded   - handed back to buyers, all time
  collectedCents: number;
  platformFeeCents: number;
  netCents: number;
  refundedCents: number;
  recentTransactions: {
    id: string;
    eventTitle: string;
    amountCents: number;
    status: string;
    createdAt: string;
  }[];
  // Cached Connect capability flags, kept in sync by the `account.updated`
  // webhook. Drives the payout-status badge + the gate on the
  // "Open Stripe dashboard" button in the Finances tab.
  connect: {
    hasAccount: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  };
  // Recent Stripe payouts, populated by the `payout.*` webhook handler via
  // upsertPayoutFromEvent. Empty until the merchant earns enough to trigger a
  // Stripe payout on the monthly schedule.
  recentPayouts: {
    id: string;
    amountCents: number;
    currency: string;
    status: string;
    arrivalDate: string | null;
    bankLast4: string | null;
  }[];
  // Paid + gross revenue grouped by calendar month (Australia/Sydney), most
  // recent ~12 months. Feeds the Finances tab revenue bar chart.
  monthlyRevenue: {
    month: string; // "YYYY-MM"
    paidCents: number;
    grossCents: number;
  }[];
};

export async function getMerchantFinancesSummary(
  session: Session | null,
): Promise<MerchantFinancesSummary> {
  const empty: MerchantFinancesSummary = {
    collectedCents: 0,
    platformFeeCents: 0,
    netCents: 0,
    refundedCents: 0,
    recentTransactions: [],
    connect: {
      hasAccount: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    },
    recentPayouts: [],
    monthlyRevenue: [],
  };

  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!pool || !email) return empty;

  try {
    const profile = await ensureProfileForSession(session);
    const merchant = await getMerchantProfile(pool, profile.id);
    if (!merchant) return empty;

    const [aggResult, recentResult, payoutsResult, monthlyResult] = await Promise.all([
      pool.query<{
        collected: string;
        platform_fee: string;
        net: string;
        refunded: string;
      }>(
        // Only SETTLED money counts as revenue. 'pending' rows are checkout
        // attempts still in flight and 'failed' rows are abandoned ones - the
        // old query summed every row regardless of status, so every abandoned
        // checkout inflated the host's all-time total permanently.
        //
        // A refund reverses the transfer and the application fee
        // PROPORTIONALLY (issueRefund in src/lib/stripe-sync.ts sets
        // reverse_transfer + refund_application_fee), but the charge-time
        // columns are never rewritten - only refunded_amount_cents moves. So
        // the surviving share of each has to be derived rather than summed.
        `
          with settled as (
            select
              amount_cents,
              refunded_amount_cents,
              coalesce(application_fee_cents, 0) as application_fee_cents,
              coalesce(transfer_amount_cents, 0) as transfer_amount_cents,
              case
                when amount_cents > 0
                  then (amount_cents - refunded_amount_cents)::numeric / amount_cents
                else 0
              end as kept_share
            from payment_transactions
            where merchant_profile_id = $1::uuid
              and status in ('paid', 'partially_refunded')
          )
          select
            coalesce((select sum(amount_cents - refunded_amount_cents) from settled), 0)::text
              as collected,
            coalesce((select round(sum(application_fee_cents * kept_share)) from settled), 0)::text
              as platform_fee,
            coalesce((select round(sum(transfer_amount_cents * kept_share)) from settled), 0)::text
              as net,
            -- Refunds are counted across every row, including the fully
            -- refunded ones the settled CTE deliberately excludes.
            coalesce((
              select sum(refunded_amount_cents)
              from payment_transactions
              where merchant_profile_id = $1::uuid
            ), 0)::text as refunded
        `,
        [merchant.id],
      ),
      pool.query<{
        id: string;
        title: string;
        amount_cents: number;
        status: string;
        created_at: Date;
      }>(
        `
          select pt.id::text, event.title, pt.amount_cents, pt.status::text, pt.created_at
          from payment_transactions pt
          join events event on event.id = pt.event_id
          where pt.merchant_profile_id = $1::uuid
          order by pt.created_at desc
          limit 20
        `,
        [merchant.id],
      ),
      // Recent Stripe payouts on this merchant's connected account. Populated
      // by the `payout.*` webhook in src/lib/stripe-sync.ts. Cap at 6 so the
      // Finances tab stays scannable; older history lives in the Express
      // dashboard, linked from the same tab.
      pool.query<{
        id: string;
        amount_cents: number;
        currency: string;
        status: string;
        arrival_date: Date | null;
        bank_last4: string | null;
      }>(
        `
          select id::text, amount_cents, currency, status, arrival_date, bank_last4
          from merchant_payouts
          where merchant_profile_id = $1::uuid
          order by coalesce(arrival_date, created_at) desc
          limit 6
        `,
        [merchant.id],
      ),
      // Revenue grouped by calendar month (Sydney), last ~12 months, for the
      // Finances revenue chart.
      pool.query<{ month: string; paid: string; gross: string }>(
        `
          select
            to_char(date_trunc('month', created_at at time zone 'Australia/Sydney'), 'YYYY-MM') as month,
            coalesce(sum(amount_cents) filter (where status = 'paid'), 0)::text as paid,
            coalesce(sum(amount_cents), 0)::text as gross
          from payment_transactions
          where merchant_profile_id = $1::uuid
            and created_at >= now() - interval '12 months'
          group by 1
          order by 1
        `,
        [merchant.id],
      ),
    ]);

    const row = aggResult.rows[0];
    return {
      collectedCents: Number(row?.collected ?? 0),
      platformFeeCents: Number(row?.platform_fee ?? 0),
      netCents: Number(row?.net ?? 0),
      refundedCents: Number(row?.refunded ?? 0),
      recentTransactions: recentResult.rows.map((r) => ({
        id: r.id,
        eventTitle: r.title,
        amountCents: r.amount_cents,
        status: r.status,
        createdAt: r.created_at.toISOString(),
      })),
      connect: {
        hasAccount: Boolean(merchant.stripe_connect_account_id),
        chargesEnabled: merchant.charges_enabled,
        payoutsEnabled: merchant.payouts_enabled,
        detailsSubmitted: merchant.details_submitted,
      },
      recentPayouts: payoutsResult.rows.map((p) => ({
        id: p.id,
        amountCents: p.amount_cents,
        currency: p.currency,
        status: p.status,
        arrivalDate: p.arrival_date ? p.arrival_date.toISOString() : null,
        bankLast4: p.bank_last4,
      })),
      monthlyRevenue: monthlyResult.rows.map((m) => ({
        month: m.month,
        paidCents: Number(m.paid),
        grossCents: Number(m.gross),
      })),
    };
  } catch (error) {
    // Deliberately NOT the `empty` summary. `empty` also carries
    // connect.hasAccount = false, so a transient read failure rendered the
    // Finances tab of an earning, fully-connected host as $0 across every tile
    // with a "Connect Stripe" call to action - it told them their money was
    // gone AND that they had never set up payouts. `empty` stays for the
    // genuinely-signed-out / no-merchant cases above, where it is true.
    throw error instanceof Error ? error : new Error("Could not load your finances.");
  }
}

export type MerchantTransactionExportRow = {
  eventTitle: string;
  createdAt: string;
  status: string;
  amountCents: number;
};

// Full transaction list for CSV export, optionally narrowed to a calendar year
// or a specific month (Australia/Sydney). Unlike the dashboard summary's
// 20-row preview, this returns every matching transaction so the exported CSV
// is complete. Returns [] when signed out / not a merchant.
export async function getMerchantTransactionsForExport(
  session: Session | null,
  opts: { year?: number; month?: number } = {},
): Promise<MerchantTransactionExportRow[]> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!pool || !email) return [];

  try {
    const profile = await ensureProfileForSession(session);
    const merchant = await getMerchantProfile(pool, profile.id);
    if (!merchant) return [];

    const conditions = ["pt.merchant_profile_id = $1::uuid"];
    const params: unknown[] = [merchant.id];
    if (opts.year && Number.isFinite(opts.year)) {
      params.push(opts.year);
      conditions.push(
        `extract(year from pt.created_at at time zone 'Australia/Sydney') = $${params.length}`,
      );
    }
    if (opts.month && opts.month >= 1 && opts.month <= 12) {
      params.push(opts.month);
      conditions.push(
        `extract(month from pt.created_at at time zone 'Australia/Sydney') = $${params.length}`,
      );
    }

    const result = await pool.query<{
      title: string;
      created_at: Date;
      status: string;
      amount_cents: number;
    }>(
      `
        select event.title, pt.created_at, pt.status::text, pt.amount_cents
        from payment_transactions pt
        join events event on event.id = pt.event_id
        where ${conditions.join(" and ")}
        order by pt.created_at desc
      `,
      params,
    );

    return result.rows.map((r) => ({
      eventTitle: r.title,
      createdAt: r.created_at.toISOString(),
      status: r.status,
      amountCents: r.amount_cents,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Merchant monthly email report (cron-driven)
// ---------------------------------------------------------------------------

// Logs a `merchant-monthly-report` email for every approved merchant who hosted
// at least one event in the given month (Australia/Sydney): events hosted,
// confirmed attendees, paid revenue, and their best-attended event. Driven by
// the /api/cron/merchant-monthly-reports cron. Returns how many were sent vs
// skipped (no activity / no contact email). Per the email-events convention,
// this records rows in `email_events`; the real provider send happens in the
// one-time provider migration.
export async function sendMerchantMonthlyReports(opts: {
  year: number;
  month: number; // 1-12, the target calendar month
}): Promise<{ sent: number; skipped: number }> {
  const pool = getPostgresPool();
  if (!pool) return { sent: 0, skipped: 0 };

  // UTC month boundaries. Sydney is +10/+11, so this is a ~10h-shifted window vs
  // a strict Sydney calendar month - acceptable for a monthly summary.
  const start = new Date(Date.UTC(opts.year, opts.month - 1, 1));
  const end = new Date(Date.UTC(opts.year, opts.month, 1));
  const monthLabel = new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(new Date(Date.UTC(opts.year, opts.month - 1, 15, 12)));
  // No local formatAud here on purpose. The shadow this replaced rounded to
  // whole dollars, so a $1,234.50 month reached the host as "$1,235" in the one
  // document they forward to a bookkeeper. The module-level formatAud takes the
  // Intl default of two digits, matching every other money email.
  const origin = emailOrigin();

  try {
    // Scalar subqueries (not joins) so the per-merchant aggregates don't
    // multiply each other into a cartesian product.
    const result = await pool.query<{
      contact_email: string | null;
      business_name: string | null;
      owner_profile_id: string;
      owner_name: string | null;
      events_count: string;
      attendees_count: string;
      paid_cents: string;
      top_event_title: string | null;
      top_event_attendees: string | null;
    }>(
      `
        select
          mp.contact_email::text as contact_email,
          mp.business_name,
          owner.id::text as owner_profile_id,
          owner.display_name as owner_name,
          (select count(*) from events e
             where e.merchant_profile_id = mp.id
               and e.starts_at >= $1 and e.starts_at < $2) as events_count,
          (select count(*) from event_attendees a
             join events e on e.id = a.event_id
             where e.merchant_profile_id = mp.id
               and a.status = 'confirmed'
               and e.starts_at >= $1 and e.starts_at < $2) as attendees_count,
          (select coalesce(sum(amount_cents), 0) from payment_transactions pt
             where pt.merchant_profile_id = mp.id
               and pt.status = 'paid'
               and pt.created_at >= $1 and pt.created_at < $2)::text as paid_cents,
          (select e.title from events e
             where e.merchant_profile_id = mp.id
               and e.starts_at >= $1 and e.starts_at < $2
             order by (select count(*) from event_attendees a
                         where a.event_id = e.id and a.status = 'confirmed') desc,
                      e.starts_at desc
             limit 1) as top_event_title,
          (select count(*) from event_attendees a
             where a.status = 'confirmed' and a.event_id = (
               select e.id from events e
                 where e.merchant_profile_id = mp.id
                   and e.starts_at >= $1 and e.starts_at < $2
                 order by (select count(*) from event_attendees a2
                             where a2.event_id = e.id and a2.status = 'confirmed') desc,
                          e.starts_at desc
                 limit 1
             )) as top_event_attendees
        from merchant_profiles mp
        join profiles owner on owner.id = mp.profile_id
        where mp.verification_status = 'approved'
      `,
      [start, end],
    );

    let sent = 0;
    let skipped = 0;
    for (const row of result.rows) {
      const eventsCount = Number(row.events_count);
      if (eventsCount === 0 || !row.contact_email) {
        skipped += 1;
        continue;
      }
      await logEmailEvent({
        template: "merchant-monthly-report",
        toEmail: row.contact_email,
        toProfileId: row.owner_profile_id,
        vars: {
          businessName: row.business_name ?? "your business",
          merchantFirstName: (row.owner_name ?? "there").trim().split(" ")[0] || "there",
          monthLabel,
          eventsCount: String(eventsCount),
          attendeesCount: String(Number(row.attendees_count)),
          revenueLabel: formatAud(Number(row.paid_cents)),
          topEventTitle: row.top_event_title ?? "Your events",
          topEventAttendees: String(Number(row.top_event_attendees ?? 0)),
          merchantDashboardUrl: `${origin}/merchant?tab=dashboard`,
          unsubscribeUrl: `${origin}/account-settings`,
          supportEmail: SUPPORT_EMAIL,
        },
      });
      sent += 1;
    }
    return { sent, skipped };
  } catch (error) {
    console.warn("sendMerchantMonthlyReports failed", error);
    return { sent: 0, skipped: 0 };
  }
}

// ---------------------------------------------------------------------------
// Merchant location waitlist (Sydney-only pilot gate)
// ---------------------------------------------------------------------------

export type MerchantLocationWaitlistInput = {
  address: string | null;
  suburb: string | null;
  latitude: number | null;
  longitude: number | null;
  note?: string | null;
};

// Records a merchant's interest in a location outside the greater-Sydney pilot
// area. Resolves the merchant server-side from the session, derives the region
// bucket, and inserts a waitlist row. Throws an auth error if the caller isn't
// a merchant. Returns the region it bucketed the location into.
export async function addMerchantLocationWaitlist(
  session: Session | null,
  input: MerchantLocationWaitlistInput,
): Promise<{ region: Region }> {
  const pool = getPostgresPool();
  if (!pool) throw new Error("Database unavailable.");

  const profile = await ensureProfileForSession(session);
  const merchant = await getMerchantProfile(pool, profile.id);
  if (!merchant) throw authError("Only merchants can join the location waitlist.");

  const region = regionForEvent({
    lat: input.latitude,
    lng: input.longitude,
    suburb: input.suburb,
  });

  await pool.query(
    `
      insert into merchant_location_waitlist
        (merchant_profile_id, address, suburb, latitude, longitude, region, note)
      values ($1::uuid, $2, $3, $4, $5, $6, $7)
    `,
    [
      merchant.id,
      input.address,
      input.suburb,
      input.latitude,
      input.longitude,
      region,
      input.note ?? null,
    ],
  );

  return { region };
}

export type AdminLocationWaitlistRow = {
  id: string;
  businessName: string | null;
  contactEmail: string | null;
  address: string | null;
  suburb: string | null;
  region: string | null;
  note: string | null;
  createdAt: string;
};

// Every location-waitlist entry, newest first, joined to the merchant's
// business name + contact email for the admin Location Waitlist page.
export async function getAdminLocationWaitlist(): Promise<AdminLocationWaitlistRow[]> {
  const pool = getPostgresPool();
  if (!pool) return [];

  try {
    const result = await pool.query<{
      id: string;
      business_name: string | null;
      contact_email: string | null;
      address: string | null;
      suburb: string | null;
      region: string | null;
      note: string | null;
      created_at: Date;
    }>(
      `
        select
          w.id::text,
          merchant.business_name,
          merchant.contact_email::text as contact_email,
          w.address,
          w.suburb,
          w.region,
          w.note,
          w.created_at
        from merchant_location_waitlist w
        join merchant_profiles merchant on merchant.id = w.merchant_profile_id
        order by w.created_at desc
      `,
    );

    return result.rows.map((r) => ({
      id: r.id,
      businessName: r.business_name,
      contactEmail: r.contact_email,
      address: r.address,
      suburb: r.suburb,
      region: r.region,
      note: r.note,
      createdAt: r.created_at.toISOString(),
    }));
  } catch {
    return [];
  }
}

export type AdminTrendBucket = {
  week: string;
  members: number;
  events: number;
  rsvps: number;
  revenueCents: number;
};

export async function getAdminWeeklyTrend(): Promise<AdminTrendBucket[]> {
  const pool = getPostgresPool();
  if (!pool) return [];

  try {
    const result = await pool.query<{
      week: Date;
      members: string;
      events: string;
      rsvps: string;
      revenue_cents: string;
    }>(
      `
        with weeks as (
          select generate_series(
            date_trunc('week', now()) - interval '7 weeks',
            date_trunc('week', now()),
            interval '1 week'
          ) as week
        )
        select
          weeks.week,
          (
            select count(*)::text from profiles
            where created_at >= weeks.week and created_at < weeks.week + interval '1 week'
          ) as members,
          (
            select count(*)::text from events
            where created_at >= weeks.week and created_at < weeks.week + interval '1 week'
          ) as events,
          (
            select count(*)::text from event_attendees
            where created_at >= weeks.week and created_at < weeks.week + interval '1 week'
              and status = 'confirmed'
          ) as rsvps,
          (
            select coalesce(sum(amount_cents), 0)::text from payment_transactions
            where created_at >= weeks.week and created_at < weeks.week + interval '1 week'
              and status = 'paid'
          ) as revenue_cents
        from weeks
        order by weeks.week asc
      `,
    );

    return result.rows.map((row) => ({
      week: row.week.toISOString().slice(0, 10),
      members: Number(row.members),
      events: Number(row.events),
      rsvps: Number(row.rsvps),
      revenueCents: Number(row.revenue_cents),
    }));
  } catch {
    return [];
  }
}

export async function suspendMemberAsAdmin(
  session: Session | null,
  targetProfileId: string,
  reason: string,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const actor = await requireAdminProfile(session);

  await pool.query(
    `
      update profiles
      set suspended_at = now(), suspended_reason = $2
      where id = $1::uuid
    `,
    [targetProfileId, reason.trim() || null],
  );

  await writeAuditLog({
    actorProfileId: actor.id,
    action: "suspend_member",
    entityTable: "profiles",
    entityId: targetProfileId,
    metadata: { reason },
  });
}

export async function unsuspendMemberAsAdmin(
  session: Session | null,
  targetProfileId: string,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const actor = await requireAdminProfile(session);

  await pool.query(
    `
      update profiles
      set suspended_at = null, suspended_reason = null
      where id = $1::uuid
    `,
    [targetProfileId],
  );

  await writeAuditLog({
    actorProfileId: actor.id,
    action: "unsuspend_member",
    entityTable: "profiles",
    entityId: targetProfileId,
  });
}

// SAFE-06 / §6.7a - permanent ban. Distinct from suspend (temporary, reversible, no
// teardown - a suspended user is merely frozen out of coordination by the confirm/
// propose/RSVP-cron re-checks). A ban flips the DEDICATED profiles.is_banned column
// (added in migration 049) and PERMANENTLY tears down all coordination - every pending
// click → invalidated, every active mutual → suppressed, every live proposal → withdrawn
// - across all the user's pairs.
//
// We deliberately DON'T overload suspended_at / social_visible: those are an admin's
// temporary-suspend state and the user's own §B7.4 opt-out respectively, and sharing a
// column would make unban silently clear an independent suspension / opt-out. Every
// social-exclusion surface checks is_banned in its own right (getSuggestedPeople, the
// send-path sender+receiver gates, pairCoordinationAllowed, the RSVP-reminder cron, and
// the post-event candidate lists), so is_banned alone fully removes a banned user. The
// reason rides the audit log, the durable trail for a permanent action.
export async function banMemberAsAdmin(
  session: Session | null,
  targetProfileId: string,
  reason: string,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const actor = await requireAdminProfile(session);

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `update profiles set is_banned = true where id = $1::uuid`,
      [targetProfileId],
    );
    await severAllCoordinationForUser(client, targetProfileId);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  await writeAuditLog({
    actorProfileId: actor.id,
    action: "ban_member",
    entityTable: "profiles",
    entityId: targetProfileId,
    metadata: { reason: reason.trim() || "Banned" },
  });
}

/**
 * Honour a deletion request by de-identifying the profile in place.
 *
 * WHY NOT `delete from profiles`. Most child tables cascade, so a hard delete
 * would rewrite historical event headcounts, and payment_transactions.profile_id
 * is ON DELETE SET NULL - the ledger rows we are legally required to keep would
 * survive with no idea who paid. The privacy policy promises deletion AND says
 * financial records are retained; APP 11.2 allows "destroy or de-identify", and
 * de-identifying is the only reading that satisfies both. See
 * database/059_profile_deletion.sql.
 *
 * WHAT GOES. Every identifying field on the profile: name, email, auth subject,
 * photo (the row AND the object in the public bucket), age, birth date, gender,
 * suburb, bio, gallery, prompts. The social graph is torn down exactly as a ban
 * tears it down, so nobody is left holding a mutual click with a ghost. The
 * address and rendered body of every email we sent them is scrubbed too - the
 * email_events row stays as an audit record of "we sent template X on date Y".
 *
 * WHAT STAYS, deliberately: bookings, payments, refunds and their amounts, all
 * still linked to this now-anonymous id. That is the retention obligation.
 *
 * The email is replaced rather than nulled because the column is NOT NULL and
 * UNIQUE. The placeholder is derived from the profile id, so it stays unique and
 * carries no information - and it frees the person's real address, letting them
 * sign up again fresh if they ever want to.
 *
 * NOT REVERSIBLE. There is no undo, which is why the console asks the operator
 * to type the member's email to confirm.
 */
export async function anonymiseMemberAsAdmin(
  session: Session | null,
  targetProfileId: string,
  reason: string,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const actor = await requireAdminProfile(session);

  if (!UUID_RE.test(targetProfileId)) throw validationError("Unknown member.");
  if (targetProfileId === actor.id) {
    throw validationError("You cannot delete the account you are signed in as.");
  }

  const existing = await pool.query<{ email: string; deleted_at: Date | null; role: string }>(
    `select email::text, deleted_at, role::text as role from profiles where id = $1::uuid limit 1`,
    [targetProfileId],
  );
  const target = existing.rows[0];
  if (!target) {
    const error = new Error("Member not found.");
    error.name = "NotFoundError";
    throw error;
  }
  if (target.deleted_at) {
    throw validationError("That account has already been deleted.");
  }
  // A merchant's business records hang off merchant_profiles, which cascades on
  // profile delete and carries its own ABN, contact and Stripe Connect account.
  // Scrubbing the person without unwinding the business would leave a live
  // payout destination attached to an anonymous owner.
  if (target.role === "merchant") {
    throw validationError(
      "This account owns a merchant profile. Close the merchant account and its Stripe Connect payouts first.",
    );
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    await client.query(
      `
        update profiles
        set
          display_name = 'Deleted member',
          email = ('deleted+' || id::text || '@deleted.letsclick.app')::citext,
          auth_subject = null,
          age = null,
          birth_date = null,
          gender = null,
          suburb = null,
          bio = null,
          photo_url = null,
          photo_verified_at = null,
          gallery_photos = '{}',
          prompts = '[]'::jsonb,
          connection_intents = '{friendship}'::connection_intent[],
          -- Nothing should reach them again, and nothing should surface them.
          -- default_attend_visibility is the attendee-list opt-out every
          -- who's-going query already honours, so clearing it here removes the
          -- account from those surfaces without this function having to
          -- enumerate them. Belt; the explicit deleted_at filter on
          -- getEventAttendeePreview, the one surface that renders a name and a
          -- profile link, is the braces.
          default_attend_visibility = false,
          social_visible = false,
          dating_visible = false,
          show_suburb = false,
          show_attendance_count = false,
          allow_merchant_messages = false,
          -- Every flag written out FALSE, not '{}'. The senders read this with
          -- coalesce((notification_prefs->>'eventReminders')::boolean, true),
          -- so an empty object means opted IN - it would have kept queueing
          -- reminders at the placeholder address of a deleted account.
          notification_prefs = '{"eventReminders":false,"waitlistOffers":false,"mutualClick":false,"weeklyRecap":false,"productUpdates":false}'::jsonb,
          deleted_at = now(),
          updated_at = now()
        where id = $1::uuid
      `,
      [targetProfileId],
    );

    // Same teardown a permanent ban performs: pending clicks invalidated,
    // mutuals suppressed, proposals withdrawn. Leaves no live connection
    // pointing at an account that no longer represents a person.
    await severAllCoordinationForUser(client, targetProfileId);

    // The audit trail keeps WHAT we sent and WHEN; the address and the rendered
    // body carried their name and email into a queryable table.
    await client.query(
      `
        update email_events
        set to_email = ('deleted+' || $1::text || '@deleted.letsclick.app'),
            html = null,
            vars = '{}'::jsonb
        where to_profile_id = $1::uuid
      `,
      [targetProfileId],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  // After the commit, and best-effort: the avatar object lives in a PUBLIC
  // bucket keyed by profile id, so clearing photo_url alone leaves the photo
  // fetchable by anyone who kept the URL. A storage failure here must not undo
  // an honoured deletion, so it is recorded rather than thrown.
  const { deleteAvatarObject } = await import("./avatar-storage");
  const avatarRemoved = await deleteAvatarObject(targetProfileId).catch(() => false);

  await writeAuditLog({
    actorProfileId: actor.id,
    action: "delete_member",
    entityTable: "profiles",
    entityId: targetProfileId,
    metadata: {
      reason: reason.trim() || "Deletion requested",
      // The address is kept here on purpose: this row is how you answer "did we
      // action the request from this person" after the profile no longer says.
      previous_email: target.email,
      avatar_object_removed: avatarRemoved,
    },
  });

  return { avatarRemoved };
}

// Lifts the ban flag only - the §6.7a teardown (suppressed mutuals, invalidated clicks,
// withdrawn proposals) is permanent and is NOT restored. Touches nothing but is_banned,
// so an independent suspension or the user's own social opt-out survives the unban.
export async function unbanMemberAsAdmin(
  session: Session | null,
  targetProfileId: string,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const actor = await requireAdminProfile(session);

  await pool.query(
    `update profiles set is_banned = false where id = $1::uuid`,
    [targetProfileId],
  );

  await writeAuditLog({
    actorProfileId: actor.id,
    action: "unban_member",
    entityTable: "profiles",
    entityId: targetProfileId,
  });
}

// Stamp/clear the verification tick (profiles.photo_verified_at). Verified
// members get a "✓" next to their name on profile surfaces; only admins can
// grant it (manual review for now - an automated selfie check can land later
// without changing this write path).
export async function setMemberVerifiedAsAdmin(
  session: Session | null,
  targetProfileId: string,
  verified: boolean,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const actor = await requireAdminProfile(session);

  await pool.query(
    `
      update profiles
      set photo_verified_at = ${verified ? "now()" : "null"}
      where id = $1::uuid
    `,
    [targetProfileId],
  );

  await writeAuditLog({
    actorProfileId: actor.id,
    action: verified ? "verify_member" : "unverify_member",
    entityTable: "profiles",
    entityId: targetProfileId,
  });
}

export type SystemSettings = {
  maintenanceMode: boolean;
  commissionRateBps: number;
  /**
   * Where commissionRateBps actually came from, so the admin form can stop
   * offering an edit that will not take.
   *
   * PLATFORM_FEE_BPS, when set, wins over the stored value - and
   * scripts/release-check.mjs REQUIRES it to be an integer of at least 1 for a
   * production release, so on any valid deployment the answer is always "env".
   * The commission box on /admin/system accepted edits, saved them, said
   * "System settings saved", and changed nothing about what Stripe charged.
   */
  commissionRateSource: "env" | "database";
  bookingFeeBps: number;
  marketingBanner: string;
  matchingWeights: MatchingWeights;
  /**
   * True when the v1 weights below are what discovery actually ranks with.
   *
   * They are not, whenever matching v2 has candidates: getPersonalizedDiscovery
   * returns the v2 ordering before scorePersonalizedEvent is ever called. The
   * /admin/matching sliders save to system_settings and then sit behind that
   * early return, so this is what lets that page say so instead of implying an
   * effect it does not have.
   */
  matchingWeightsInEffect: boolean;
  // Matching v2 kill-switch. When false the people + discovery surfaces rank
  // with the v1 engine; when true (the default) they re-rank with the
  // cohort-aware v2 model (src/lib/matching/). Flip from /admin/system, or from
  // /algo outside production. See 04_MATCHING_ALGORITHM_V2.md.
  matchingV2Enabled: boolean;
};

function parseMatchingWeights(value: unknown): MatchingWeights {
  const raw = (value ?? {}) as Partial<Record<keyof MatchingWeights, unknown>>;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    tagOverlap: num(raw.tagOverlap, DEFAULT_MATCHING_WEIGHTS.tagOverlap),
    intentMatch: num(raw.intentMatch, DEFAULT_MATCHING_WEIGHTS.intentMatch),
    personaBoost: num(raw.personaBoost, DEFAULT_MATCHING_WEIGHTS.personaBoost),
    momentum: num(raw.momentum, DEFAULT_MATCHING_WEIGHTS.momentum),
    featured: num(raw.featured, DEFAULT_MATCHING_WEIGHTS.featured),
    readinessThreshold: num(raw.readinessThreshold, DEFAULT_MATCHING_WEIGHTS.readinessThreshold),
  };
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const commissionRateSource = process.env.PLATFORM_FEE_BPS ? "env" : "database";

  const fallback: SystemSettings = {
    maintenanceMode: false,
    commissionRateBps: getPlatformFeeBps(),
    commissionRateSource,
    bookingFeeBps: 0,
    marketingBanner: "",
    matchingWeights: DEFAULT_MATCHING_WEIGHTS,
    matchingWeightsInEffect: false,
    matchingV2Enabled: true,
  };

  const pool = getPostgresPool();
  if (!pool) return fallback;

  try {
    const result = await pool.query<{ key: string; value: unknown }>(
      `select key, value from system_settings`,
    );
    const map = new Map(result.rows.map((row) => [row.key, row.value]));
    // v2 is the default engine. Only an explicit `false` row reverts to v1;
    // absence of the row means v2.
    const matchingV2Enabled = map.has("matching_v2_enabled")
      ? Boolean(map.get("matching_v2_enabled"))
      : true;

    return {
      maintenanceMode: Boolean(map.get("maintenance_mode")),
      commissionRateBps:
        commissionRateSource === "env"
          ? getPlatformFeeBps()
          : Number(map.get("commission_rate_bps") ?? 0),
      commissionRateSource,
      bookingFeeBps: Number(map.get("booking_fee_bps") ?? 0),
      marketingBanner: String(map.get("marketing_banner") ?? "").trim(),
      matchingWeights: parseMatchingWeights(map.get("matching_weights")),
      // The v1 weights only reach a ranking when v2 is off - see the type.
      matchingWeightsInEffect: !matchingV2Enabled,
      matchingV2Enabled,
    };
  } catch {
    return fallback;
  }
}

export async function updateSystemSettingsAsAdmin(
  session: Session | null,
  input: Partial<SystemSettings>,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const actor = await requireAdminProfile(session);

  const writes: { key: string; value: string }[] = [];
  if (typeof input.maintenanceMode === "boolean") {
    writes.push({ key: "maintenance_mode", value: JSON.stringify(input.maintenanceMode) });
  }
  if (typeof input.matchingV2Enabled === "boolean") {
    writes.push({ key: "matching_v2_enabled", value: JSON.stringify(input.matchingV2Enabled) });
  }
  if (typeof input.commissionRateBps === "number" && Number.isFinite(input.commissionRateBps)) {
    // Refuse rather than write a value nothing will read. getSystemSettings
    // prefers PLATFORM_FEE_BPS over the stored row, so storing one here while
    // the variable is set produces a saved setting with no effect - which is
    // exactly the failure this whole change exists to remove.
    if (process.env.PLATFORM_FEE_BPS) {
      throw validationError(
        "The commission rate is set by the PLATFORM_FEE_BPS environment variable and cannot be changed here.",
      );
    }
    writes.push({
      key: "commission_rate_bps",
      value: JSON.stringify(Math.max(0, Math.min(5000, Math.round(input.commissionRateBps)))),
    });
  }
  if (typeof input.bookingFeeBps === "number" && Number.isFinite(input.bookingFeeBps)) {
    writes.push({
      key: "booking_fee_bps",
      value: JSON.stringify(Math.max(0, Math.min(5000, Math.round(input.bookingFeeBps)))),
    });
  }
  if (typeof input.marketingBanner === "string") {
    writes.push({
      key: "marketing_banner",
      value: JSON.stringify(input.marketingBanner.slice(0, 200)),
    });
  }
  if (input.matchingWeights) {
    const w = input.matchingWeights;
    const clamp = (n: number, max: number) =>
      Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
    writes.push({
      key: "matching_weights",
      value: JSON.stringify({
        tagOverlap: clamp(w.tagOverlap, 50),
        intentMatch: clamp(w.intentMatch, 50),
        personaBoost: clamp(w.personaBoost, 50),
        momentum: clamp(w.momentum, 50),
        featured: clamp(w.featured, 50),
        readinessThreshold: clamp(w.readinessThreshold, 100),
      }),
    });
  }

  if (writes.length === 0) return;

  for (const w of writes) {
    await pool.query(
      `
        insert into system_settings (key, value, updated_at, updated_by_profile_id)
        values ($1, $2::jsonb, now(), $3::uuid)
        on conflict (key) do update set
          value = excluded.value,
          updated_at = now(),
          updated_by_profile_id = excluded.updated_by_profile_id
      `,
      [w.key, w.value, actor.id],
    );
  }

  await writeAuditLog({
    actorProfileId: actor.id,
    action: "update_system_settings",
    entityTable: "system_settings",
    entityId: null,
    metadata: input as Record<string, unknown>,
  });
}

// ===========================================================================
// Matching v2 - Stage 6: cold-start curation + training/eval surface.
// Backs /admin/matching-lab. The curated-labels tool (spec §4) keeps matching
// "active" at zero behavioural data by routing candidate pairs through human
// judgment; those labels + observed mutual clicks become the training set that
// replaces the hand-curated weights (spec §4.3).
// ===========================================================================

export type LabelMember = {
  id: string;
  displayName: string;
  cohort: string | null;
  suburb: string | null;
  age: number | null;
  socialEnergy: string | null;
  interests: number;
  lifeTags: string[];
  intents: string[];
};

export type LabelPair = {
  a: LabelMember; // the viewer (whose cohort scores the pair)
  b: LabelMember;
  score: number;
  features: Record<string, number>;
};

// Find a candidate pair the admin hasn't judged yet. Tries a handful of random
// viewers (so the queue doesn't fixate on one person) and returns the first
// viewer→candidate pair with no existing label. null when nothing is left.
export async function getCuratedPairToLabel(session: Session | null): Promise<LabelPair | null> {
  const pool = getPostgresPool();
  if (!pool) return null;
  await requireAdminProfile(session);

  const viewers = await pool.query<{ id: string }>(
    `select profile_id::text as id from user_features where cohort_id is not null order by random() limit 8`,
  );

  for (const v of viewers.rows) {
    const cands = await generatePeopleCandidates(pool, v.id, 10);
    if (cands.length === 0) continue;

    const labeled = await pool.query<{ other: string }>(
      `select case when profile_a = $1::uuid then profile_b::text else profile_a::text end as other
         from curated_match_labels
        where profile_a = $1::uuid or profile_b = $1::uuid`,
      [v.id],
    );
    const seen = new Set(labeled.rows.map((r) => r.other));
    const pick = cands.find((c) => !seen.has(c.profileId));
    if (!pick) continue;

    const [viewer, cand] = await Promise.all([
      loadUserFeatures(pool, v.id),
      loadUserFeatures(pool, pick.profileId),
    ]);
    if (!viewer || !cand) continue;

    const features = buildPairFeatures(viewer, cand);
    const score = scorePair(viewer, cand).score;
    const names = await pool.query<{ id: string; display_name: string }>(
      `select id::text, display_name from profiles where id = any($1::uuid[])`,
      [[v.id, pick.profileId]],
    );
    const nameMap = new Map(names.rows.map((r) => [r.id, r.display_name]));
    const toMember = (uf: UserFeatures): LabelMember => ({
      id: uf.profileId,
      displayName: nameMap.get(uf.profileId) ?? uf.profileId.slice(0, 8),
      cohort: uf.cohortId,
      suburb: uf.suburb,
      age: uf.age,
      socialEnergy: uf.socialEnergy,
      interests: uf.interestTagIds.length,
      lifeTags: uf.lifeTags,
      intents: uf.intents,
    });
    return { a: toMember(viewer), b: toMember(cand), score, features };
  }
  return null;
}

// Persist one human judgment. features_snapshot captures the pair vector + score
// AT label time so later feature drift can't corrupt the training row (spec §4.1).
export async function saveCuratedMatchLabel(
  session: Session | null,
  input: {
    profileA: string;
    profileB: string;
    judgment: string;
    reason?: string;
    featuresSnapshot: unknown;
    score?: number;
  },
): Promise<void> {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const actor = await requireAdminProfile(session);

  const judgment = ["strong_fit", "maybe", "not_a_fit"].includes(input.judgment)
    ? input.judgment
    : "maybe";

  await pool.query(
    `
      insert into curated_match_labels
        (profile_a, profile_b, judgment, reason, labeler_profile_id, features_snapshot)
      values ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6::jsonb)
    `,
    [
      input.profileA,
      input.profileB,
      judgment,
      input.reason?.slice(0, 500) || null,
      actor.id,
      JSON.stringify({
        features: input.featuresSnapshot,
        score: input.score ?? null,
        model_version: MODEL_VERSION,
      }),
    ],
  );
}

// Undo for the matching lab: drops the calling admin's own most recent curated
// label. The insert above has no upsert key and had no delete path, so a mis-tap
// used to sit in the ML training set permanently.
//
// Scoped deliberately tight - `labeler_profile_id = actor.id` plus `limit 1` in
// a subquery, so it can only ever reach ONE row, always the caller's own. It is
// never a blanket delete and it can never reach another operator's judgment,
// including on the same pair. `created_at desc, id desc` because created_at can
// tie inside a millisecond; the id breaks the tie so "most recent" is a single
// deterministic row rather than an arbitrary one of two.
//
// Returns false when the caller has no labels left to undo, so the UI can say
// "nothing to undo" instead of reporting a success that removed nothing.
export async function deleteLastCuratedMatchLabel(
  session: Session | null,
): Promise<boolean> {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const actor = await requireAdminProfile(session);

  const result = await pool.query(
    `
      delete from curated_match_labels
      where id = (
        select id
        from curated_match_labels
        where labeler_profile_id = $1::uuid
        order by created_at desc, id desc
        limit 1
      )
    `,
    [actor.id],
  );

  return (result.rowCount ?? 0) > 0;
}

export type MatchingLabStats = {
  totalLabels: number;
  strongFit: number;
  maybe: number;
  notFit: number;
  clicksMade: number;
  mutualClicks: number;
  mutualRate: number;
  impressions: number;
  cohorts: { cohort: string; members: number }[];
  labelThreshold: number;
  mutualThreshold: number;
};

// Eval snapshot (spec §7.1) + training readiness (spec §4.3). This stays
// independently admin-gated because an App Router layout is not a security
// boundary for a crafted RSC request.
export async function getMatchingLabStats(
  session: Session | null,
): Promise<MatchingLabStats | null> {
  const pool = getPostgresPool();
  if (!pool) return null;
  await requireAdminProfile(session);

  const row = (
    await pool.query<{
      total_labels: number;
      strong_fit: number;
      maybe: number;
      not_fit: number;
      clicks_made: number;
      mutual_clicks: number;
      impressions: number;
    }>(`
      select
        (select count(*) from curated_match_labels)::int as total_labels,
        (select count(*) from curated_match_labels where judgment='strong_fit')::int as strong_fit,
        (select count(*) from curated_match_labels where judgment='maybe')::int as maybe,
        (select count(*) from curated_match_labels where judgment='not_a_fit')::int as not_fit,
        (select count(*) from clicks)::int as clicks_made,
        (select count(*) from mutual_clicks)::int as mutual_clicks,
        (select count(*) from match_impressions)::int as impressions
    `)
  ).rows[0];

  const cohorts = (
    await pool.query<{ cohort_id: string; n: number }>(
      `select cohort_id, count(*)::int as n from user_features
        where cohort_id is not null group by cohort_id order by n desc`,
    )
  ).rows;

  return {
    totalLabels: row.total_labels,
    strongFit: row.strong_fit,
    maybe: row.maybe,
    notFit: row.not_fit,
    clicksMade: row.clicks_made,
    mutualClicks: row.mutual_clicks,
    mutualRate: row.clicks_made > 0 ? row.mutual_clicks / row.clicks_made : 0,
    impressions: row.impressions,
    cohorts: cohorts.map((c) => ({ cohort: c.cohort_id, members: c.n })),
    labelThreshold: 50,
    mutualThreshold: 50,
  };
}

export type EventAttendeePreviewRow = {
  profileId: string;
  displayName: string;
  photoUrl: string | null;
  suburb: string | null;
  // Interest tags this attendee shares with the viewer (empty for the viewer's
  // own row / anonymous viewers).
  sharedInterests: string[];
  // True when this attendee is dating-minded AND has opted into dating
  // visibility - gated so we never out someone who keeps dating private.
  datingMinded: boolean;
};

export async function sendEventReminders() {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const result = await pool.query<{
    event_id: string;
    event_slug: string;
    event_title: string;
    starts_at: Date;
    ends_at: Date | null;
    timezone: string;
    location_name: string;
    address: string | null;
    city: string;
    category: string;
    host_name: string;
    profile_id: string;
    email: string;
    display_name: string;
    confirmed_count: string;
  }>(
    `
      select e.id::text as event_id,
             e.slug as event_slug,
             e.title as event_title,
             e.starts_at,
             e.ends_at,
             e.timezone,
             e.location_name,
             e.address,
             e.city,
             e.category,
             e.host_name,
             p.id::text as profile_id,
             p.email::text as email,
             p.display_name,
             (
               select count(*)::text
               from event_attendees count_attendee
               where count_attendee.event_id = e.id
                 and count_attendee.status = 'confirmed'
             ) as confirmed_count
      from events e
      join event_attendees attendee
        on attendee.event_id = e.id and attendee.status = 'confirmed'
      join profiles p on p.id = attendee.profile_id
      where e.starts_at >= now() + interval '23 hours'
        and e.starts_at < now() + interval '25 hours'
        and e.status in ('live', 'featured', 'locked', 'waitlist')
        and coalesce((p.notification_prefs->>'eventReminders')::boolean, true)
        and not exists (
          select 1
          from email_events sent
          where sent.template = 'event-reminder-attendee'
            and sent.to_profile_id = p.id
            and sent.vars->>'eventId' = e.id::text
        )
      order by e.starts_at, p.id
    `,
  );

  const origin = emailOrigin();
  await Promise.all(
    result.rows.map(async (row) => {
      const dates = formatEmailDates(row.starts_at, row.ends_at, row.timezone);
      const firstName = row.display_name.split(/\s+/)[0] || "there";
      const directionsQuery = [row.location_name, row.address, row.city]
        .filter(Boolean)
        .join(", ");
      await logEmailEvent({
        template: "event-reminder-attendee",
        toEmail: row.email,
        toProfileId: row.profile_id,
        vars: {
          eventId: row.event_id,
          firstName,
          eventTitle: row.event_title,
          eventLongDate: dates.eventLongDate,
          eventStartTime: dates.eventStartTime,
          eventEndTime: dates.eventEndTime,
          eventVenue: row.location_name,
          eventAddress: row.address ?? "",
          eventCity: row.city,
          eventCategory: row.category,
          eventHostName: row.host_name,
          whoElseLabel:
            Number(row.confirmed_count) > 1
              ? `${Number(row.confirmed_count) - 1} other people are going`
              : "",
          directionsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(directionsQuery)}`,
          eventDetailsUrl: `${origin}/events/${row.event_slug}`,
          cancelRsvpUrl: `${origin}/events/${row.event_slug}`,
          unsubscribeUrl: `${origin}/account-settings`,
          supportEmail: "hello@letsclick.app",
        },
      });
    }),
  );

  return { processed: result.rowCount ?? result.rows.length };
}

export async function getEventAttendeePreview(
  eventSlug: string,
  session: Session | null,
  limit = 8,
): Promise<{ items: EventAttendeePreviewRow[]; totalConfirmed: number }> {
  const pool = getPostgresPool();
  if (!pool) return { items: [], totalConfirmed: 0 };

  // Resolve the viewer so we can highlight interests they share with each
  // attendee. Best-effort: anonymous viewers (or a hiccup) just get no overlap.
  let viewerProfileId: string | null = null;
  if (getSessionEmail(session)) {
    try {
      viewerProfileId = (await ensureProfileForSession(session)).id;
    } catch {
      viewerProfileId = null;
    }
  }

  try {
    const [previewResult, countResult] = await Promise.all([
      pool.query<{
        profile_id: string;
        display_name: string;
        photo_url: string | null;
        suburb: string | null;
        dating_minded: boolean;
        shared: string[];
      }>(
        `
          select profile.id::text as profile_id,
                 profile.display_name,
                 profile.photo_url,
                 profile.suburb,
                 (profile.dating_visible
                    and 'dating' = any(profile.connection_intents::text[])) as dating_minded,
                 coalesce(
                   array_agg(distinct shared_tag.label)
                     filter (where shared_tag.label is not null),
                   '{}'
                 ) as shared
          from event_attendees attendee
          join events event on event.id = attendee.event_id
          join profiles profile on profile.id = attendee.profile_id
          -- Shared-interest overlap with the viewer (skipped for the viewer's own
          -- row so we don't show "you share everything with yourself").
          left join user_tags ut
            on ut.profile_id = profile.id
           and $3::uuid is not null
           and profile.id <> $3::uuid
          left join tags shared_tag
            on shared_tag.id = ut.tag_id
           and shared_tag.id in (select tag_id from user_tags where profile_id = $3::uuid)
          where event.slug = $1
            -- Only paid-and-confirmed attendees are shown by name (bug board
            -- #161/#162: a pending_payment hold - e.g. a failed/abandoned
            -- checkout - must never display a person as "attending"). Live
            -- holds still occupy seats for capacity math elsewhere; they just
            -- don't appear in the who's-going list or its count.
            and attendee.status = 'confirmed'
            -- Same anti-join every other person-surfacing query in this file
            -- carries. Without it this was the one screen that put a blocked
            -- pair back in front of each other, by name, photo and profile link.
            and profile.is_banned = false
            and profile.suspended_at is null
            -- A de-identified account is not a person to show. Its name renders
            -- as "Deleted member" and its profile link now 404s, so without this
            -- the one public surface that lists people BY NAME AND LINK would
            -- carry a dead link next to a tombstone.
            and profile.deleted_at is null
            -- The attendee-list opt-out (migration 049) has to bite on the surface
            -- that names people, or the toggle is a lie: this is the screen that
            -- shows a first name, a face, a suburb and a profile link. The
            -- headline count deliberately still counts them - it says how many are
            -- going, identifies nobody, and shrinking it would misreport the event.
            and profile.default_attend_visibility
            and ($3::uuid is null or profile.id <> $3::uuid)
            and ($3::uuid is null or not exists (
              select 1 from user_blocks b
              where (b.blocker_profile_id = $3::uuid and b.blocked_profile_id = profile.id)
                 or (b.blocker_profile_id = profile.id and b.blocked_profile_id = $3::uuid)
            ))
          group by profile.id
          order by min(attendee.created_at) asc
          limit $2
        `,
        [eventSlug, limit, viewerProfileId],
      ),
      pool.query<{ count: string }>(
        `
          select count(*)::text as count
          from event_attendees attendee
          join events event on event.id = attendee.event_id
          where event.slug = $1
            and attendee.status = 'confirmed'
        `,
        [eventSlug],
      ),
    ]);

    return {
      items: previewResult.rows.map((row) => ({
        profileId: row.profile_id,
        displayName: row.display_name,
        photoUrl: row.photo_url,
        suburb: row.suburb,
        sharedInterests: row.shared ?? [],
        datingMinded: Boolean(row.dating_minded),
      })),
      totalConfirmed: Number(countResult.rows[0]?.count ?? 0),
    };
  } catch {
    return { items: [], totalConfirmed: 0 };
  }
}

export async function markPaymentFailed(
  paymentTransactionId: string,
  // The Checkout Session this failure came from, when it came from one.
  //
  // The corrected-guest path in /api/events/[eventId]/checkout expires a Session
  // and builds a replacement against the SAME transaction, so Stripe fires
  // checkout.session.expired for a Session the buyer has already moved off.
  // Without this guard that stale event fails a live transaction and cancels the
  // seat while the buyer is entering their card on the replacement - they get
  // charged, then force-refunded, and no seat. Callers with no Session in hand
  // (payment_intent.* failures, the checkout route's own cleanup) pass nothing
  // and keep the old unconditional behaviour.
  stripeCheckoutSessionId?: string | null,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const client = await pool.connect();
  try {
    await client.query("begin");

    const paymentResult = await client.query<{
      id: string;
      event_id: string;
      profile_id: string;
    }>(
      `
        update payment_transactions
        set status = 'failed', updated_at = now()
        where id = $1::uuid and status = 'pending'
          and (
            $2::text is null
            or stripe_checkout_session_id is null
            or stripe_checkout_session_id = $2::text
          )
        returning id::text, event_id::text, profile_id::text
      `,
      [paymentTransactionId, stripeCheckoutSessionId ?? null],
    );
    const payment = paymentResult.rows[0];
    if (!payment) {
      await client.query("rollback");
      return;
    }

    // Free the held seat. Only cancel rows that are still in the hold state -
    // never overwrite an already-confirmed attendee row.
    await client.query(
      `
        update event_attendees
        set status = 'cancelled', updated_at = now()
        where event_id = $1::uuid and profile_id = $2::uuid and status = 'pending_payment'
      `,
      [payment.event_id, payment.profile_id],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// /admin/transactions - list + detail
//
// Stripe is the source of truth; these reads come straight from the local
// mirror (payment_transactions + payment_refunds + merchant_payouts). The
// admin "Sync from Stripe" button (POST /api/admin/transactions/sync) and the
// extended webhook keep that mirror current.
// ---------------------------------------------------------------------------

export type AdminTransactionRow = {
  id: string;
  createdAt: string;
  status: string;
  amountCents: number;
  currency: string;
  applicationFeeCents: number | null;
  transferAmountCents: number | null;
  refundedAmountCents: number;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  eventId: string | null;
  eventSlug: string | null;
  eventTitle: string | null;
  attendeeId: string | null;
  attendeeName: string | null;
  attendeeEmail: string | null;
  merchantProfileId: string | null;
  merchantName: string | null;
  lastSyncedAt: string | null;
};

export type AdminTransactionFilter = {
  status?: string;
  merchantId?: string;
  search?: string;
  dateFrom?: string; // ISO date
  dateTo?: string;
  limit?: number;
  offset?: number;
};

export type AdminTransactionRefund = {
  id: string;
  stripeRefundId: string;
  amountCents: number;
  currency: string;
  status: string;
  reason: string | null;
  failureReason: string | null;
  initiatedBy: {
    profileId: string;
    displayName: string;
    email: string;
  } | null;
  createdAt: string;
};

export type AdminTransactionDetail = AdminTransactionRow & {
  refunds: AdminTransactionRefund[];
  refundableAmountCents: number;
};

export type AdminPayoutRow = {
  id: string;
  merchantProfileId: string;
  merchantName: string | null;
  stripeConnectAccountId: string;
  stripePayoutId: string;
  amountCents: number;
  currency: string;
  status: string;
  arrivalDate: string | null;
  bankLast4: string | null;
  failureMessage: string | null;
  createdAt: string;
};

export type AdminConnectAccountRow = {
  merchantProfileId: string;
  businessName: string;
  stripeConnectAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  verificationStatus: string;
};

export async function listAdminTransactions(
  filter: AdminTransactionFilter = {},
): Promise<AdminTransactionRow[]> {
  const pool = getPostgresPool();
  if (!pool) return [];

  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 500);
  const offset = Math.max(filter.offset ?? 0, 0);
  const params: unknown[] = [];
  const where: string[] = [];

  if (filter.status && filter.status !== "all") {
    params.push(filter.status);
    where.push(`pt.status::text = $${params.length}`);
  }
  if (filter.merchantId && UUID_RE.test(filter.merchantId)) {
    params.push(filter.merchantId);
    where.push(`pt.merchant_profile_id = $${params.length}::uuid`);
  }
  if (filter.dateFrom) {
    params.push(filter.dateFrom);
    where.push(`pt.created_at >= $${params.length}::timestamptz`);
  }
  if (filter.dateTo) {
    params.push(filter.dateTo);
    where.push(`pt.created_at < $${params.length}::timestamptz`);
  }
  if (filter.search) {
    params.push(`%${filter.search}%`);
    const i = params.length;
    where.push(
      `(event.title ilike $${i} or attendee.display_name ilike $${i} or attendee.email::text ilike $${i} or merchant.business_name ilike $${i} or pt.stripe_payment_intent_id ilike $${i} or pt.stripe_charge_id ilike $${i})`,
    );
  }

  const whereClause = where.length ? `where ${where.join(" and ")}` : "";
  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  try {
    const result = await pool.query<{
      id: string;
      created_at: Date;
      status: string;
      amount_cents: number;
      currency: string;
      application_fee_cents: number | null;
      transfer_amount_cents: number | null;
      refunded_amount_cents: number;
      stripe_payment_intent_id: string | null;
      stripe_charge_id: string | null;
      event_id: string | null;
      event_slug: string | null;
      event_title: string | null;
      attendee_id: string | null;
      attendee_name: string | null;
      attendee_email: string | null;
      merchant_profile_id: string | null;
      merchant_name: string | null;
      last_synced_at: Date | null;
    }>(
      `
        select
          pt.id::text,
          pt.created_at,
          pt.status::text,
          pt.amount_cents,
          pt.currency::text as currency,
          pt.application_fee_cents,
          pt.transfer_amount_cents,
          pt.refunded_amount_cents,
          pt.stripe_payment_intent_id,
          pt.stripe_charge_id,
          event.id::text as event_id,
          event.slug as event_slug,
          event.title as event_title,
          attendee.id::text as attendee_id,
          attendee.display_name as attendee_name,
          attendee.email::text as attendee_email,
          pt.merchant_profile_id::text,
          merchant.business_name as merchant_name,
          pt.last_synced_at
        from payment_transactions pt
        left join events event on event.id = pt.event_id
        left join profiles attendee on attendee.id = pt.profile_id
        left join merchant_profiles merchant on merchant.id = pt.merchant_profile_id
        ${whereClause}
        order by pt.created_at desc
        limit $${limitIdx} offset $${offsetIdx}
      `,
      params,
    );

    return result.rows.map((row): AdminTransactionRow => ({
      id: row.id,
      createdAt: row.created_at.toISOString(),
      status: row.status,
      amountCents: Number(row.amount_cents),
      currency: row.currency,
      applicationFeeCents:
        row.application_fee_cents == null ? null : Number(row.application_fee_cents),
      transferAmountCents:
        row.transfer_amount_cents == null ? null : Number(row.transfer_amount_cents),
      refundedAmountCents: Number(row.refunded_amount_cents),
      stripePaymentIntentId: row.stripe_payment_intent_id,
      stripeChargeId: row.stripe_charge_id,
      eventId: row.event_id,
      eventSlug: row.event_slug,
      eventTitle: row.event_title,
      attendeeId: row.attendee_id,
      attendeeName: row.attendee_name,
      attendeeEmail: row.attendee_email,
      merchantProfileId: row.merchant_profile_id,
      merchantName: row.merchant_name,
      lastSyncedAt: row.last_synced_at ? row.last_synced_at.toISOString() : null,
    }));
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("listAdminTransactions failed", error);
    }
    return [];
  }
}

export async function getAdminTransactionDetail(
  transactionId: string,
): Promise<AdminTransactionDetail | null> {
  if (!UUID_RE.test(transactionId)) return null;
  const pool = getPostgresPool();
  if (!pool) return null;

  try {
    const txnResult = await pool.query<{
      id: string;
      created_at: Date;
      status: string;
      amount_cents: number;
      currency: string;
      application_fee_cents: number | null;
      transfer_amount_cents: number | null;
      refunded_amount_cents: number;
      stripe_payment_intent_id: string | null;
      stripe_charge_id: string | null;
      event_id: string | null;
      event_slug: string | null;
      event_title: string | null;
      attendee_id: string | null;
      attendee_name: string | null;
      attendee_email: string | null;
      merchant_profile_id: string | null;
      merchant_name: string | null;
      last_synced_at: Date | null;
    }>(
      `
        select
          pt.id::text,
          pt.created_at,
          pt.status::text,
          pt.amount_cents,
          pt.currency::text as currency,
          pt.application_fee_cents,
          pt.transfer_amount_cents,
          pt.refunded_amount_cents,
          pt.stripe_payment_intent_id,
          pt.stripe_charge_id,
          event.id::text as event_id,
          event.slug as event_slug,
          event.title as event_title,
          attendee.id::text as attendee_id,
          attendee.display_name as attendee_name,
          attendee.email::text as attendee_email,
          pt.merchant_profile_id::text,
          merchant.business_name as merchant_name,
          pt.last_synced_at
        from payment_transactions pt
        left join events event on event.id = pt.event_id
        left join profiles attendee on attendee.id = pt.profile_id
        left join merchant_profiles merchant on merchant.id = pt.merchant_profile_id
        where pt.id = $1::uuid
        limit 1
      `,
      [transactionId],
    );
    const r = txnResult.rows[0];
    if (!r) return null;

    const refundsResult = await pool.query<{
      id: string;
      stripe_refund_id: string;
      amount_cents: number;
      currency: string;
      status: string;
      reason: string | null;
      failure_reason: string | null;
      initiated_by_profile_id: string | null;
      initiated_by_display_name: string | null;
      initiated_by_email: string | null;
      created_at: Date;
    }>(
      `
        select pr.id::text,
               pr.stripe_refund_id,
               pr.amount_cents,
               pr.currency,
               pr.status,
               pr.reason,
               pr.failure_reason,
               pr.initiated_by_profile_id::text,
               initiator.display_name as initiated_by_display_name,
               initiator.email::text as initiated_by_email,
               pr.created_at
        from payment_refunds pr
        left join profiles initiator on initiator.id = pr.initiated_by_profile_id
        where pr.payment_transaction_id = $1::uuid
        order by pr.created_at desc
      `,
      [transactionId],
    );

    const refunds = refundsResult.rows.map((row): AdminTransactionRefund => ({
      id: row.id,
      stripeRefundId: row.stripe_refund_id,
      amountCents: Number(row.amount_cents),
      currency: row.currency,
      status: row.status,
      reason: row.reason,
      failureReason: row.failure_reason,
      initiatedBy:
        row.initiated_by_profile_id && row.initiated_by_display_name && row.initiated_by_email
          ? {
              profileId: row.initiated_by_profile_id,
              displayName: row.initiated_by_display_name,
              email: row.initiated_by_email,
            }
          : null,
      createdAt: row.created_at.toISOString(),
    }));

    const amountCents = Number(r.amount_cents);
    const refundedAmountCents = Number(r.refunded_amount_cents);

    return {
      id: r.id,
      createdAt: r.created_at.toISOString(),
      status: r.status,
      amountCents,
      currency: r.currency,
      applicationFeeCents:
        r.application_fee_cents == null ? null : Number(r.application_fee_cents),
      transferAmountCents:
        r.transfer_amount_cents == null ? null : Number(r.transfer_amount_cents),
      refundedAmountCents,
      stripePaymentIntentId: r.stripe_payment_intent_id,
      stripeChargeId: r.stripe_charge_id,
      eventId: r.event_id,
      eventSlug: r.event_slug,
      eventTitle: r.event_title,
      attendeeId: r.attendee_id,
      attendeeName: r.attendee_name,
      attendeeEmail: r.attendee_email,
      merchantProfileId: r.merchant_profile_id,
      merchantName: r.merchant_name,
      lastSyncedAt: r.last_synced_at ? r.last_synced_at.toISOString() : null,
      refunds,
      refundableAmountCents: Math.max(amountCents - refundedAmountCents, 0),
    };
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("getAdminTransactionDetail failed", error);
    }
    return null;
  }
}

export async function listAdminPayouts(
  { merchantId, status, limit = 100 }: {
    merchantId?: string;
    status?: string;
    limit?: number;
  } = {},
): Promise<AdminPayoutRow[]> {
  const pool = getPostgresPool();
  if (!pool) return [];

  const params: unknown[] = [];
  const where: string[] = [];
  if (merchantId && UUID_RE.test(merchantId)) {
    params.push(merchantId);
    where.push(`mp.merchant_profile_id = $${params.length}::uuid`);
  }
  if (status && status !== "all") {
    params.push(status);
    where.push(`mp.status = $${params.length}`);
  }
  const whereClause = where.length ? `where ${where.join(" and ")}` : "";
  params.push(Math.min(Math.max(limit, 1), 500));

  try {
    const result = await pool.query<{
      id: string;
      merchant_profile_id: string;
      merchant_name: string | null;
      stripe_connect_account_id: string;
      stripe_payout_id: string;
      amount_cents: number;
      currency: string;
      status: string;
      arrival_date: Date | null;
      bank_last4: string | null;
      failure_message: string | null;
      created_at: Date;
    }>(
      `
        select mp.id::text,
               mp.merchant_profile_id::text,
               merchant.business_name as merchant_name,
               mp.stripe_connect_account_id,
               mp.stripe_payout_id,
               mp.amount_cents,
               mp.currency,
               mp.status,
               mp.arrival_date,
               mp.bank_last4,
               mp.failure_message,
               mp.created_at
        from merchant_payouts mp
        left join merchant_profiles merchant on merchant.id = mp.merchant_profile_id
        ${whereClause}
        order by mp.created_at desc
        limit $${params.length}
      `,
      params,
    );

    return result.rows.map((row): AdminPayoutRow => ({
      id: row.id,
      merchantProfileId: row.merchant_profile_id,
      merchantName: row.merchant_name,
      stripeConnectAccountId: row.stripe_connect_account_id,
      stripePayoutId: row.stripe_payout_id,
      amountCents: Number(row.amount_cents),
      currency: row.currency,
      status: row.status,
      arrivalDate: row.arrival_date ? row.arrival_date.toISOString() : null,
      bankLast4: row.bank_last4,
      failureMessage: row.failure_message,
      createdAt: row.created_at.toISOString(),
    }));
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("listAdminPayouts failed", error);
    }
    return [];
  }
}

export async function listAdminConnectAccounts(): Promise<AdminConnectAccountRow[]> {
  const pool = getPostgresPool();
  if (!pool) return [];

  try {
    const result = await pool.query<{
      id: string;
      business_name: string;
      stripe_connect_account_id: string;
      charges_enabled: boolean;
      payouts_enabled: boolean;
      details_submitted: boolean;
      verification_status: string;
    }>(
      `
        select id::text,
               business_name,
               stripe_connect_account_id,
               charges_enabled,
               payouts_enabled,
               details_submitted,
               verification_status
        from merchant_profiles
        where stripe_connect_account_id is not null
        order by business_name
      `,
    );

    return result.rows.map((row): AdminConnectAccountRow => ({
      merchantProfileId: row.id,
      businessName: row.business_name,
      stripeConnectAccountId: row.stripe_connect_account_id,
      chargesEnabled: row.charges_enabled,
      payoutsEnabled: row.payouts_enabled,
      detailsSubmitted: row.details_submitted,
      verificationStatus: row.verification_status,
    }));
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("listAdminConnectAccounts failed", error);
    }
    return [];
  }
}

// ---------------------------------------------------------------------------
// Money queues: refunds that never left, and disputes with a clock on them.
//
// Both are things the platform ALREADY knows and, until now, told nobody.
// refund_failures (035) had five writers and no reader; disputes were written
// to audit_logs, which records that something happened but cannot answer "what
// is still open". These are the reads that turn both into work an operator can
// actually finish.
// ---------------------------------------------------------------------------

export type RefundFailureResolution = "pending" | "resolved" | "dismissed";

export type AdminRefundFailureRow = {
  id: string;
  createdAt: string;
  amountCents: number;
  currency: string;
  errorMessage: string | null;
  resolution: RefundFailureResolution;
  resolutionNote: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  paymentTransactionId: string | null;
  /** Current ledger status of the charge, so the UI can say why a retry is impossible. */
  transactionStatus: string | null;
  /**
   * What Stripe would still let us send back (charge total minus everything
   * already refunded). Null when the failure has no transaction attached.
   * A retry asks for min(owed, refundable) - if this is 0 the money already
   * moved by another route and the entry only needs clearing.
   */
  refundableAmountCents: number | null;
  attendeeId: string | null;
  attendeeName: string | null;
  attendeeEmail: string | null;
  eventId: string | null;
  eventTitle: string | null;
  eventSlug: string | null;
};

export async function listAdminRefundFailures(
  { includeResolved = false }: { includeResolved?: boolean } = {},
): Promise<AdminRefundFailureRow[]> {
  const pool = getPostgresPool();
  if (!pool) return [];

  try {
    const result = await pool.query<{
      id: string;
      created_at: Date;
      amount_cents: number;
      currency: string;
      error_message: string | null;
      resolution: string;
      resolution_note: string | null;
      resolved_at: Date | null;
      resolved_by_name: string | null;
      payment_transaction_id: string | null;
      transaction_status: string | null;
      refundable_amount_cents: number | null;
      attendee_id: string | null;
      attendee_name: string | null;
      attendee_email: string | null;
      event_id: string | null;
      event_title: string | null;
      event_slug: string | null;
    }>(
      `
        select
          rf.id::text,
          rf.created_at,
          rf.amount_cents,
          rf.currency::text as currency,
          rf.error_message,
          rf.resolution,
          rf.resolution_note,
          rf.resolved_at,
          resolver.display_name as resolved_by_name,
          rf.payment_transaction_id::text,
          pt.status::text as transaction_status,
          case
            when pt.id is null then null
            else greatest(pt.amount_cents - pt.refunded_amount_cents, 0)
          end as refundable_amount_cents,
          attendee.id::text as attendee_id,
          attendee.display_name as attendee_name,
          attendee.email::text as attendee_email,
          event.id::text as event_id,
          event.title as event_title,
          event.slug as event_slug
        from refund_failures rf
        left join payment_transactions pt on pt.id = rf.payment_transaction_id
        left join profiles attendee on attendee.id = rf.profile_id
        left join profiles resolver on resolver.id = rf.resolved_by_profile_id
        left join events event on event.id = rf.event_id
        ${includeResolved ? "" : "where rf.resolution = 'pending'"}
        order by (rf.resolution = 'pending') desc, rf.created_at desc
        limit 200
      `,
    );

    return result.rows.map((row): AdminRefundFailureRow => ({
      id: row.id,
      createdAt: row.created_at.toISOString(),
      amountCents: Number(row.amount_cents),
      currency: row.currency,
      errorMessage: row.error_message,
      resolution: row.resolution as RefundFailureResolution,
      resolutionNote: row.resolution_note,
      resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
      resolvedByName: row.resolved_by_name,
      paymentTransactionId: row.payment_transaction_id,
      transactionStatus: row.transaction_status,
      refundableAmountCents:
        row.refundable_amount_cents == null ? null : Number(row.refundable_amount_cents),
      attendeeId: row.attendee_id,
      attendeeName: row.attendee_name,
      attendeeEmail: row.attendee_email,
      eventId: row.event_id,
      eventTitle: row.event_title,
      eventSlug: row.event_slug,
    }));
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("listAdminRefundFailures failed", error);
    }
    return [];
  }
}

export type AdminDisputeRow = {
  stripeDisputeId: string;
  paymentTransactionId: string | null;
  stripeChargeId: string;
  amountCents: number;
  currency: string;
  reason: string | null;
  status: string;
  evidenceDueBy: string | null;
  /**
   * Seconds from now until the evidence deadline, negative once it has passed,
   * null when Stripe gave no deadline. Computed in SQL rather than from the
   * browser clock: the queue renders in a client component, and reading
   * Date.now() there would be both impure during render and a hydration
   * mismatch waiting to happen.
   */
  secondsUntilDue: number | null;
  isOpen: boolean;
  firstSeenAt: string;
  updatedAt: string;
  attendeeName: string | null;
  attendeeEmail: string | null;
  eventTitle: string | null;
  merchantName: string | null;
};

export async function listAdminDisputes(
  { includeClosed = false }: { includeClosed?: boolean } = {},
): Promise<AdminDisputeRow[]> {
  const pool = getPostgresPool();
  if (!pool) return [];

  try {
    const result = await pool.query<{
      stripe_dispute_id: string;
      payment_transaction_id: string | null;
      stripe_charge_id: string;
      amount_cents: number;
      currency: string;
      reason: string | null;
      status: string;
      evidence_due_by: Date | null;
      seconds_until_due: string | null;
      is_open: boolean;
      first_seen_at: Date;
      updated_at: Date;
      attendee_name: string | null;
      attendee_email: string | null;
      event_title: string | null;
      merchant_name: string | null;
    }>(
      `
        select
          d.stripe_dispute_id,
          d.payment_transaction_id::text,
          d.stripe_charge_id,
          d.amount_cents,
          d.currency::text as currency,
          d.reason,
          d.status,
          d.evidence_due_by,
          extract(epoch from (d.evidence_due_by - now())) as seconds_until_due,
          d.is_open,
          d.first_seen_at,
          d.updated_at,
          attendee.display_name as attendee_name,
          attendee.email::text as attendee_email,
          event.title as event_title,
          merchant.business_name as merchant_name
        from payment_disputes d
        left join payment_transactions pt on pt.id = d.payment_transaction_id
        left join profiles attendee on attendee.id = pt.profile_id
        left join events event on event.id = pt.event_id
        left join merchant_profiles merchant on merchant.id = pt.merchant_profile_id
        ${includeClosed ? "" : "where d.is_open"}
        order by d.is_open desc, d.evidence_due_by asc nulls last, d.first_seen_at desc
        limit 200
      `,
    );

    return result.rows.map((row): AdminDisputeRow => ({
      stripeDisputeId: row.stripe_dispute_id,
      paymentTransactionId: row.payment_transaction_id,
      stripeChargeId: row.stripe_charge_id,
      amountCents: Number(row.amount_cents),
      currency: row.currency,
      reason: row.reason,
      status: row.status,
      evidenceDueBy: row.evidence_due_by ? row.evidence_due_by.toISOString() : null,
      secondsUntilDue: row.seconds_until_due == null ? null : Number(row.seconds_until_due),
      isOpen: row.is_open,
      firstSeenAt: row.first_seen_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      attendeeName: row.attendee_name,
      attendeeEmail: row.attendee_email,
      eventTitle: row.event_title,
      merchantName: row.merchant_name,
    }));
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("listAdminDisputes failed", error);
    }
    return [];
  }
}

/**
 * How many money items are waiting on a person. Drives the sidebar badge, so
 * the queues are discoverable without opening the page - which is the whole
 * difference between "there is a screen for it" and "someone will notice".
 *
 * Returns zeroes rather than throwing when Postgres is unavailable: a badge is
 * never worth failing the console shell over.
 */
export async function countAdminMoneyAlerts(): Promise<{
  refundFailures: number;
  openDisputes: number;
  total: number;
}> {
  const empty = { refundFailures: 0, openDisputes: 0, total: 0 };
  const pool = getPostgresPool();
  if (!pool) return empty;

  try {
    const result = await pool.query<{ refund_failures: string; open_disputes: string }>(
      `
        select
          (select count(*) from refund_failures where resolution = 'pending') as refund_failures,
          (select count(*) from payment_disputes where is_open) as open_disputes
      `,
    );
    const refundFailures = Number(result.rows[0]?.refund_failures ?? 0);
    const openDisputes = Number(result.rows[0]?.open_disputes ?? 0);
    return { refundFailures, openDisputes, total: refundFailures + openDisputes };
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("countAdminMoneyAlerts failed", error);
    }
    return empty;
  }
}

/**
 * Ask Stripe for the failed refund again.
 *
 * `settleBooking` is deliberately NOT passed. Every writer of a refund_failures
 * row (cancelRegistration, cancelGuestSeatForPurchaser, cancelMerchantEvent,
 * and the settled-after-cancellation branch of markPaymentSucceeded) had
 * already cancelled the seat and told the attendee before the Stripe call it
 * then failed on. Passing settleBooking here would cancel an already-cancelled
 * seat and send a second cancellation email. What those paths never got to do
 * is confirm the money moved - so we send exactly that, with releaseSeat off.
 *
 * The row itself is closed by issueRefund's own `update refund_failures` (see
 * stripe-sync.ts), which is also what closes it when a webhook or the backfill
 * observes the refund first. Passing adminProfileId is what attributes it.
 */
export async function retryRefundFailureAsAdmin(session: Session | null, failureId: string) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const actor = await requireAdminProfile(session);

  if (!UUID_RE.test(failureId)) throw validationError("Unknown refund failure.");

  const found = await pool.query<{
    payment_transaction_id: string | null;
    amount_cents: number;
    resolution: string;
    refundable_amount_cents: number | null;
  }>(
    `
      select rf.payment_transaction_id::text,
             rf.amount_cents,
             rf.resolution,
             case
               when pt.id is null then null
               else greatest(pt.amount_cents - pt.refunded_amount_cents, 0)
             end as refundable_amount_cents
      from refund_failures rf
      left join payment_transactions pt on pt.id = rf.payment_transaction_id
      where rf.id = $1::uuid
      limit 1
    `,
    [failureId],
  );

  const row = found.rows[0];
  if (!row) {
    const error = new Error("Refund failure not found.");
    error.name = "NotFoundError";
    throw error;
  }
  if (row.resolution !== "pending") {
    throw validationError("That refund failure is already resolved.");
  }
  if (!row.payment_transaction_id) {
    throw validationError(
      "This failure has no payment transaction attached - clear it with a note instead.",
    );
  }

  const owed = Number(row.amount_cents);
  const refundable = Number(row.refundable_amount_cents ?? 0);
  if (refundable <= 0) {
    throw validationError(
      "Stripe has nothing left to refund on this charge - the money already moved. Clear it with a note.",
    );
  }

  // Never ask Stripe for more than the charge can still return. A partial
  // refund landing between the failure and this retry makes `owed` stale.
  const amountCents = Math.min(owed, refundable);

  // Lazy import avoids a static cycle (stripe-sync imports from this module).
  const { issueRefund } = await import("./stripe-sync");

  let result;
  try {
    result = await issueRefund({
      paymentTransactionId: row.payment_transaction_id,
      amountCents,
      adminProfileId: actor.id,
    });
  } catch (error) {
    // Keep the entry open and replace the stale error with why it failed THIS
    // time - otherwise the queue keeps showing the original network blip.
    await pool
      .query(
        `update refund_failures
         set error_message = $2
         where id = $1::uuid and resolution = 'pending'`,
        [failureId, `Retry failed: ${error instanceof Error ? error.message : String(error)}`],
      )
      .catch(() => null);
    throw error;
  }

  await writeAuditLog({
    actorProfileId: actor.id,
    action: "retry_refund_failure",
    entityTable: "refund_failures",
    entityId: failureId,
    metadata: {
      payment_transaction_id: row.payment_transaction_id,
      amount_cents: amountCents,
      stripe_refund_id: result.stripeRefundId,
    },
  });

  // The seat is long cancelled; this is the receipt the original failure ate.
  await settleRefundedBooking({
    paymentTransactionId: row.payment_transaction_id,
    refundedAmountCents: result.refundedAmountCents,
    releaseSeat: false,
    notify: true,
  }).catch(() => {});

  return result;
}

/**
 * Close an entry without a Stripe refund - paid back another way, or written
 * off. Resolution is 'dismissed', never 'resolved', so the auto-resolve queries
 * in stripe-sync.ts (which key on 'pending') and anyone later reading the table
 * can still tell a completed refund from a judgement call.
 */
export async function dismissRefundFailureAsAdmin(
  session: Session | null,
  failureId: string,
  note: string,
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const actor = await requireAdminProfile(session);

  if (!UUID_RE.test(failureId)) throw validationError("Unknown refund failure.");

  const trimmed = note.trim();
  if (trimmed.length < 10) {
    throw validationError("Say what happened to the money - at least 10 characters.");
  }

  const updated = await pool.query<{ id: string }>(
    `
      update refund_failures
      set resolution = 'dismissed',
          resolution_note = $2,
          resolved_by_profile_id = $3::uuid,
          resolved_at = now()
      where id = $1::uuid and resolution = 'pending'
      returning id::text
    `,
    [failureId, trimmed.slice(0, 500), actor.id],
  );

  if (updated.rowCount === 0) {
    throw validationError("That refund failure is already resolved.");
  }

  await writeAuditLog({
    actorProfileId: actor.id,
    action: "dismiss_refund_failure",
    entityTable: "refund_failures",
    entityId: failureId,
    metadata: { note: trimmed.slice(0, 500) },
  });
}

// Looks up the admin profile id for an authenticated session, used so refund
// audit rows can attribute who clicked the button. Returns null if the session
// has no email or hasn't matched a profile yet (the refund still goes through;
// the audit row just has actor_profile_id = null).
export async function getAdminProfileIdForSession(
  session: Session | null,
): Promise<string | null> {
  const email = getSessionEmail(session);
  if (!email) return null;
  const pool = getPostgresPool();
  if (!pool) return null;
  const result = await pool.query<{ id: string }>(
    `select id::text from profiles where email = $1::citext limit 1`,
    [email],
  );
  return result.rows[0]?.id ?? null;
}
