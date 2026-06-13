import { cache } from "react";
import type { Session } from "next-auth";
import type { PoolClient } from "pg";
import { mkdir, readFile, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import {
  normalizeAbn,
  normalizeAcn,
  validateOptionalAbn,
  validateOptionalAcn,
} from "./abn";
import {
  clickEvents,
  interestTagCategories,
  musicTags as staticMusicTags,
  type EventItem,
  type EventStatus,
} from "./click-data";
import {
  DEFAULT_MATCHING_WEIGHTS,
  type MatchingWeights,
  type UserMatchContext,
  rankEditorialFallback,
  readinessScore,
  scorePersonalizedEvent,
} from "./personalized-matching";
import { buildEventMediaGallery, type MediaItem } from "./event-media";
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
import {
  resolveProfilePrompts,
  sanitizeProfilePrompts,
  type ProfilePromptAnswer,
} from "./profile-prompts";
import { regionForEvent, type Region } from "./geo";
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
  age: string;
  bio: string;
  intents: string[];
  tags: string[];
  birthDate?: string;
  datingVisible?: boolean;
  flexibleDiscovery?: boolean;
};

export type MerchantSignupInput = {
  businessName: string;
  contactEmail: string;
  websiteUrl: string;
  abn: string;
};

// Full payload from the 4-step wizard. The minimal MerchantSignupInput above
// stays for the legacy short form; this superset is what /api/merchant accepts
// once the wizard ships. Document uploads land separately via
// /api/merchant/documents (matched by profile_id) before this submit.
export type MerchantWizardInput = {
  businessName: string;
  tradingName: string;
  abn: string;
  acn: string;
  // Optional — the signup wizard no longer collects business type. Kept on the
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
};

export type ProfileStatus = {
  exists: boolean;
  role: "attendee" | "merchant" | "admin";
  onboardingComplete: boolean;
  merchantProfile: MerchantProfileRow | null;
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
  // Optional — falls back to venue + suburb when absent.
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
  // stay approvable — extend this predicate then.)
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
  // False for profiles that entered an email but never finished onboarding —
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
  tags: AdminMemberDetailTag[];
  events: AdminMemberDetailEvent[];
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
  // Events the member is waitlisted for — kept separate from confirmed
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

function formatDate(date: Date) {
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

function formatPrice(priceCents: number) {
  if (priceCents === 0) return "Free";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
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

function bookingFromDb(bookingModel: string): EventItem["booking"] {
  return bookingModel === "external" ? "External" : "Click-managed";
}

function eventFromRow(row: EventRow): EventItem {
  const startsAt = row.starts_at;
  const lat = row.latitude ? Number(row.latitude) : sydneyReference.lat;
  const lng = row.longitude ? Number(row.longitude) : sydneyReference.lng;

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
    distanceKm: distanceKmFromSydney(lat, lng),
    lat,
    lng,
    price: formatPrice(row.price_cents),
    attendees: Number(row.confirmed_attendees),
    attendeeAvatars: row.attendee_avatars ?? [],
    capacity: row.capacity,
    // When a merchant hasn't uploaded a cover, fall back to a category-relevant
    // stock image rather than a single generic yoga photo (which read as a
    // "random" unrelated pic on, e.g., a floral or food event).
    image: row.image_url ?? imageForCategory(row.category),
    imageAlt: row.image_alt ?? "Click event",
    description: row.description,
    tags: row.tags ?? [],
    lifeSignals: row.life_signals ?? [],
    fomo: row.fomo ?? "People with overlapping interests are attending.",
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

function imageForCategory(category: string) {
  if (category === "Food") return "/media/networking.jpg";
  if (category === "Fitness") return "/media/yoga.jpg";
  if (category === "Relationships" || category === "Career") return "/media/networking.jpg";
  if (category === "Creative") return "/media/concert.jpg";
  return "/media/open-yoga.jpg";
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

// Shared site-origin lookup for absolute URLs in templated emails. Falls back
// to localhost so dev sessions still produce clickable links in the drawer.
function emailOrigin() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
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

function priceLabel(priceCents: number, currency: string) {
  if (priceCents <= 0) return "Free";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency || "AUD",
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
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
      ? `${priceLabel(receipt.amountPaidCents, receipt.currency)} · Paid`
      : priceLabel(row.price_cents, row.currency);

    void logEmailEvent({
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
        cancelRsvpUrl: `${origin}/confirmed-events`,
        addToCalendarUrl: `${origin}/events/${row.event_slug}`,
        supportEmail: "hello@click.app",
        unsubscribeUrl: `${origin}/account-settings`,
      },
    });

    if (row.merchant_contact_email) {
      void logEmailEvent({
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
          attendeesUrl: `${origin}/merchant/events/${row.event_id}`,
          eventDashboardUrl: `${origin}/merchant/events/${row.event_id}`,
          supportEmail: "hello@click.app",
          unsubscribeUrl: `${origin}/account-settings`,
        },
      });
    }
  } catch (error) {
    console.warn("logRsvpEmails failed", { eventDbId, attendeeProfileId, error });
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
    // Platform-owned events have no merchant to notify — nothing to log.
    if (!row || !row.merchant_contact_email) return;

    const origin = emailOrigin();
    const dates = formatEmailDates(row.starts_at, row.ends_at, row.timezone);
    const merchantFirstName =
      (row.merchant_owner_display_name || row.merchant_business_name || "")
        .split(/\s+/)[0] || "there";

    void logEmailEvent({
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
        supportEmail: "hello@click.app",
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
// notify, so we skip them. Fire-and-forget — never bubbles into the reject
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

    void logEmailEvent({
      template: "event-rejected-merchant",
      toEmail: row.merchant_contact_email,
      toProfileId: row.merchant_owner_profile_id,
      vars: {
        merchantFirstName,
        eventTitle: row.event_title,
        rejectionReason,
        editEventUrl: `${origin}/merchant/events/${eventSlug}`,
        supportEmail: "hello@click.app",
        unsubscribeUrl: `${origin}/account-settings`,
      },
    });
  } catch (error) {
    console.warn("logEventRejectedEmail failed", { eventSlug, error });
  }
}

// Post-commit emailer for a cancelled RSVP. Mirrors logRsvpEmails — one
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

    void logEmailEvent({
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
        supportEmail: "hello@click.app",
        unsubscribeUrl: `${origin}/account-settings`,
      },
    });

    if (row.merchant_contact_email) {
      void logEmailEvent({
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
          supportEmail: "hello@click.app",
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
// Fire-and-forget — never rolls back the booking it's attached to.
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
    const totalCents = row.amount_cents;
    const taxCents = Math.round(totalCents / 11);
    const subtotalCents = totalCents - taxCents;
    const firstName = (row.display_name || "").split(/\s+/)[0] || "there";
    const receiptDate = new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Australia/Sydney",
    }).format(new Date());

    void logEmailEvent({
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
        priceLabel: money(subtotalCents),
        taxLabel: money(taxCents),
        totalLabel: money(totalCents),
        paymentMethodLabel: "Card",
        receiptNumber: `CL-${row.payment_id.slice(0, 8).toUpperCase()}`,
        eventDetailsUrl: `${origin}/events/${row.event_slug}`,
        downloadInvoiceUrl: `${origin}/confirmed-events`,
        refundPolicyUrl: `${origin}/how-it-works`,
        supportEmail: "hello@click.app",
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
// itself would never hit — key on the session email (a string) instead and
// store the in-flight promise so concurrent Promise.all callers share one
// query. Outside a React request scope (route handlers, crons) cache() calls
// straight through uncached, which matches the previous behaviour.
const sessionMemoSlot = cache((_scope: string, _email: string) => ({
  promise: undefined as Promise<unknown> | undefined,
}));

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

function isConfiguredAdminEmail(email: string) {
  return (process.env.ADMIN_EMAILS ?? "admin@click.local")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

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
    price: formatPrice(priceCents),
    attendees: 0,
    capacity,
    image: imageForCategory(category),
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
    fomo: "Declined by admin — needs another pass before it can go live.",
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
        updated_at = now()
      returning id::text, role::text as role, email::text, display_name, photo_url,
        (xmax = 0) as is_new
    `,
    [`auth:${email}`, initialRole, email, displayName],
  );

  const row = result.rows[0];

  // First-time Google sign-in backfill: if the user has no avatar yet but the
  // OAuth provider gave us one, fetch it and rehost to Supabase Storage once
  // so we get a stable URL we control. Fire-and-forget — never blocks the page
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
    const firstName = (row.display_name || "").split(/\s+/)[0] || "there";
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
    void logEmailEvent({
      template: "account-welcome",
      toEmail: row.email,
      toProfileId: row.id,
      vars: {
        firstName,
        quizUrl: `${origin}/quiz/life`,
        discoverUrl: `${origin}/discover`,
        supportEmail: "hello@click.app",
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

export async function getMerchantProfile(pool: ReturnType<typeof getPostgresPool>, profileId: string) {
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
        auto_approve_events
      from merchant_profiles
      where profile_id = $1::uuid
      limit 1
    `,
    [profileId],
  );
  return result.rows[0] ?? null;
}

async function requireAdminProfile(session: Session | null) {
  const profile = await ensureProfileForSession(session);

  if (profile.role !== "admin") {
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
};

export type MerchantEventDetail = MerchantEventSummary & {
  description: string;
  // Full street address (nullable), editable from the merchant edit form.
  address: string | null;
  images: string[];
  imageAlt: string | null;
  attendees: MerchantAttendeeRow[];
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
        count(attendee.id) filter (where attendee.status = 'waitlisted') as waitlisted
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
    confirmed: Number(row.confirmed),
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
    capacity: number;
    price_cents: number;
    category: string;
    image_url: string | null;
    image_urls: string[] | null;
    image_alt: string | null;
    confirmed: string;
    waitlisted: string;
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
        event.capacity,
        event.price_cents,
        event.category,
        event.image_url,
        event.image_urls,
        event.image_alt,
        count(attendee.id) filter (where attendee.status = 'confirmed') as confirmed,
        count(attendee.id) filter (where attendee.status = 'waitlisted') as waitlisted
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
  }>(
    `
      select
        attendee.id::text as attendee_id,
        attendee_profile.display_name,
        attendee_profile.email::text as email,
        attendee_profile.photo_url,
        attendee.status::text,
        attendee.created_at
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
    capacity: row.capacity,
    confirmed: Number(row.confirmed),
    waitlisted: Number(row.waitlisted),
    priceCents: row.price_cents,
    category: row.category,
    images:
      row.image_urls && row.image_urls.length > 0
        ? row.image_urls
        : row.image_url
          ? [row.image_url]
          : [imageForCategory(row.category)],
    imageAlt: row.image_alt,
    attendees: attendeeResult.rows.map((entry) => ({
      attendeeId: entry.attendee_id,
      displayName: entry.display_name,
      email: entry.email,
      photoUrl: entry.photo_url,
      status: entry.status as MerchantAttendeeRow["status"],
      rsvpAt: entry.created_at.toISOString(),
    })),
  };
}

// Merchant self-service edit of an event's SAFE fields: title, description,
// relationship goal, and interest tags. Deliberately excludes price, time,
// location and capacity — those materially change a booking people may have paid
// for, so they stay locked here (the UI directs merchants to request a review).
// Ownership-scoped: only the owning merchant can edit, and only their own event.
export async function updateMerchantEventDetails(
  eventSlug: string,
  input: {
    title: string;
    description: string;
    relationshipGoal?: string;
    tagSlugs: string[];
    // Street address is safe to change after bookings (it doesn't affect price /
    // time / capacity), so merchants can self-edit it. undefined → leave as-is.
    address?: string;
    // Ordered event photo gallery (public URLs, max 5). images[0] becomes the
    // cover (mirrored to image_url). undefined → leave as-is.
    images?: string[];
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

    const eventResult = await client.query<{ id: string }>(
      `select id::text from events where slug = $1 and merchant_profile_id = $2::uuid limit 1`,
      [eventSlug, merchant.id],
    );
    const event = eventResult.rows[0];
    if (!event) {
      await client.query("rollback");
      const error = new Error("Event not found.");
      error.name = "NotFoundError";
      throw error;
    }

    await client.query(
      `
        update events
        set title = $2,
            description = $3,
            relationship_goal = coalesce($4, relationship_goal),
            address = case when $5::boolean then $6 else address end,
            image_urls = case when $7::boolean then $8::text[] else image_urls end,
            image_url = case
              when $7::boolean and array_length($8::text[], 1) >= 1 then ($8::text[])[1]
              else image_url
            end,
            updated_at = now()
        where id = $1::uuid
      `,
      [
        event.id,
        title,
        input.description ?? "",
        input.relationshipGoal?.trim() || null,
        input.address !== undefined,
        input.address?.trim() || null,
        cleanedImages !== undefined,
        cleanedImages && cleanedImages.length > 0 ? cleanedImages : null,
      ],
    );

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

export async function getEventsForExplore() {
  const pool = getPostgresPool();

  if (!pool) return getFallbackEvents();

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
        count(distinct attendee.id) filter (where (attendee.status = 'confirmed' or (attendee.status = 'pending_payment' and attendee.hold_expires_at > now()))) as confirmed_attendees,
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
            order by ea.created_at asc
            limit 3
          ) preview
        ) as attendee_avatars,
        coalesce(
          array_agg(distinct tag.slug)
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

    return result.rows.map(eventFromRow);
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("Falling back to static Click events because Postgres is unavailable.", error);
    }

    return getFallbackEvents();
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
        return {
          events: v2ranked.slice(0, limit),
          readiness,
          fallback: false,
          heading: "Picked for you",
          blurb: "Ranked by the v2 cohort model.",
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
  // ISO timestamp of a live waitlist promotion offer for the viewer — set only
  // when the viewer is waitlisted, has been offered a freed seat, and the
  // 30-minute window is still open (offered_until > now, accepted_at is null).
  // Drives the "Confirm your spot" CTA. Null otherwise.
  waitlistOfferExpiresAt: string | null;
  // 1-based queue position when the viewer is on the waitlist (e.g. "#3"),
  // counting only people still ahead of them. Null when not waitlisted.
  waitlistPosition: number | null;
  media: MediaItem[];
  // Owning merchant (null for platform-owned / fallback events). Used by the
  // detail page to let an owner preview their own not-yet-approved event while
  // keeping pending/rejected events out of public reach.
  merchantProfileId: string | null;
  // Title of another event the viewer is already attending whose time window
  // overlaps this one — drives a non-blocking "schedule clash" warning on the
  // RSVP CTA. Null when there's no clash (or the viewer isn't signed in / is
  // already on this event).
  viewerClashEventTitle: string | null;
};

export async function getEventBySlug(
  slug: string,
  session: Session | null,
): Promise<EventDetail | null> {
  const pool = getPostgresPool();

  if (!pool) {
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
          count(distinct attendee.id) filter (where (attendee.status = 'confirmed' or (attendee.status = 'pending_payment' and attendee.hold_expires_at > now()))) as confirmed_attendees,
          coalesce(
            array_agg(distinct tag.slug)
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
      // Slug connected fine but has no row — e.g. a static seed event that was
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
    // block below — the clash query needs the event's own start/end.
    const eventStartsAt = row.starts_at;
    const eventEndsAt = row.ends_at;
    let viewerRsvpStatus: EventDetail["viewerRsvpStatus"] = null;
    let waitlistOfferExpiresAt: string | null = null;
    let waitlistPosition: number | null = null;
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
                  and ahead.created_at < waitlist.created_at
              )
              else null
            end as waitlist_position
          from event_attendees attendee
          join profiles profile on profile.id = attendee.profile_id
          join events event on event.id = attendee.event_id
          left join event_waitlists waitlist
            on waitlist.event_id = attendee.event_id
           and waitlist.profile_id = attendee.profile_id
          where profile.email = $1 and event.slug = $2
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
      // start. Non-blocking — just surfaces a heads-up on the RSVP CTA.
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
      merchantProfileId: row.merchant_profile_id ?? null,
      media: buildEventMediaGallery({
        // Real uploads only: the image_urls[] array when set, else the single
        // image_url. No synthetic stock fillers.
        images:
          row.image_urls && row.image_urls.length > 0
            ? row.image_urls
            : [base.image],
        primaryAlt: base.imageAlt,
      }),
    };
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
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
            (coalesce(event.ends_at, event.starts_at) <= now()) as has_ended,
            (
              (
                select count(*)
                from event_attendees attendee
                where attendee.event_id = event.id
                  and (attendee.status = 'confirmed' or (attendee.status = 'pending_payment' and attendee.hold_expires_at > now()))
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

      await client.query(
        `
          insert into event_attendees (event_id, profile_id, status)
          values ($1::uuid, $2::uuid, $3::rsvp_status)
          on conflict (event_id, profile_id) do update
          set status = excluded.status, updated_at = now()
        `,
        [event.id, profile.id, status],
      );

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
        await sendWorkflowEmail({
          to: profile.email,
          subject: `You are on the waitlist for ${event.title}`,
          text: [
            `Hi ${profile.display_name},`,
            `You are on the waitlist for ${event.title}.`,
            "If a spot opens, Click will notify you by email and in your dashboard.",
            `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/events/${event.slug}`,
          ].join("\n\n"),
        });
      } else {
        // Confirmed RSVP → log rsvp-attendee + rsvp-merchant to email_events.
        // One supplementary SELECT gathers everything both templates need so
        // we don't pollute the in-txn block above with email-shaped data.
        // Fire-and-forget — failures never bubble into the API response.
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
// suggested event, so they know to RSVP too ("your match RSVP'd — your turn").
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
          case when mc.profile_a_id = $2::uuid then mc.profile_b_id else mc.profile_a_id end,
          'Your match RSVP''d — your turn',
          rsvper.display_name || ' just RSVP''d to ' || e.title ||
            '. RSVP too so your plan is locked in.',
          '/events/' || e.slug || '?from=proposal-partner-rsvp'
        from event_proposals ep
        join mutual_clicks mc on mc.id = ep.mutual_click_id
        join events e on e.id = ep.suggested_event_id
        join profiles rsvper on rsvper.id = $2::uuid
        where ep.suggested_event_id = $1::uuid
          and ep.status <> 'expired'
          and (mc.profile_a_id = $2::uuid or mc.profile_b_id = $2::uuid)
          and not exists (
            select 1 from notifications n
            where n.profile_id = (
                case when mc.profile_a_id = $2::uuid then mc.profile_b_id else mc.profile_a_id end
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
// (Bug board #107 — the 24h RSVP reminder.)
export async function remindProposalRsvps(): Promise<number> {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const result = await pool.query(
    `
      with participants as (
        select ep.id as proposal_id, e.id as event_id, e.slug, e.title,
               mc.profile_a_id as participant
        from event_proposals ep
        join mutual_clicks mc on mc.id = ep.mutual_click_id
        join events e on e.id = ep.suggested_event_id
        where ep.status = 'pending'
          and ep.created_at <= now() - interval '24 hours'
          and coalesce(e.ends_at, e.starts_at) > now()
        union all
        select ep.id, e.id, e.slug, e.title, mc.profile_b_id
        from event_proposals ep
        join mutual_clicks mc on mc.id = ep.mutual_click_id
        join events e on e.id = ep.suggested_event_id
        where ep.status = 'pending'
          and ep.created_at <= now() - interval '24 hours'
          and coalesce(e.ends_at, e.starts_at) > now()
      )
      insert into notifications (profile_id, title, body, action_url)
      select
        p.participant,
        'Don''t forget to RSVP',
        'You matched on a plan for ' || p.title ||
          '. RSVP to lock in your spot before it fills up.',
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
 *    `PaymentRequiredError` carrying the slug — the client routes to the normal
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
  const client = await pool.connect();

  try {
    await client.query("begin");

    const eventResult = await client.query<{
      id: string;
      slug: string;
      title: string;
      capacity: number;
      price_cents: number;
      confirmed_attendees: string;
    }>(
      `
        select
          event.id::text,
          event.slug,
          event.title,
          event.capacity,
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
    // Payments must be connected first: events sell tickets, so block creation
    // until Stripe Connect onboarding is complete (charges_enabled). The wizard
    // gates on this too — this is the server-side backstop.
    if (!merchantProfile.charges_enabled) {
      const error = new Error("Connect Stripe payouts before creating events.");
      error.name = "ValidationError";
      throw error;
    }
    // Trusted merchants (an admin has approved at least one of their events, see
    // approveEventForAdmin) skip the pending queue — their events publish straight
    // to 'live'. New/untrusted merchants still land in 'pending' for manual review.
    // BUT we never push an event live until the merchant has fully finished Stripe
    // Connect (both charges AND payouts enabled). A half-finished payout setup
    // means we can't actually pay them out, so the event stays 'pending' (visible
    // to the merchant, hidden from Discover) until they complete setup — they get
    // the "finish payout setup" banner on /merchant in the meantime.
    const autoApprove = merchantProfile.auto_approve_events === true;
    const stripeReady =
      merchantProfile.charges_enabled === true &&
      merchantProfile.payouts_enabled === true;
    const eventStatus = autoApprove && stripeReady ? "live" : "pending";
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
    // before connecting Stripe — the event sits in 'pending' for admin review,
    // and the admin can reject it (see rejectEventForAdmin). Stripe Connect is
    // still enforced later, at attendee checkout time (the checkout route
    // throws PayoutsNotReadyError if the merchant never finished payout setup),
    // so no one can pay into an account that can't receive funds.
    const priceCents = parsePriceCents(input.price);

    const slug = `${slugFromTitle(title)}-${Date.now().toString(36)}`;
    const durationMinutes =
      input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : 120;
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
    const category = input.category.trim() || "Social";
    const relationshipGoal =
      input.relationshipGoal.trim() || "Help people meet through a shared plan.";

    // Normalise the multi-photo gallery from the Media step. Drop empties,
    // de-dupe (paste-twice is easy to do), and treat the first as the cover
    // — mirrored into image_url so legacy readers keep working. We prefer
    // the gallery over the single imageUrl input so the cover stays in sync
    // with the first card the merchant sees in the UI.
    const galleryUrls = (input.imageUrls ?? [])
      .map((u) => u.trim())
      .filter(Boolean);
    const dedupedGallery = Array.from(new Set(galleryUrls));
    const coverImage =
      dedupedGallery[0] || input.imageUrl?.trim() || imageForCategory(category);
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
        autoApprove
          ? "Now live for members to discover."
          : "Pending admin review before being promoted to members.",
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
      // Tags are "click tags" — never free-form. Attach only tags that already
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
    void logEmailEvent({
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
        supportEmail: "hello@click.app",
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

    return result.rows[0];
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      return createLocalEventForMerchant(input, session);
    }

    throw error;
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
    const eligibility = await pool.query<{ approvable: boolean }>(
      `
        select (coalesce(ends_at, starts_at) >= now()) as approvable
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
    // Admins can revoke this from the merchant detail page. Best-effort — a
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

    // Notify the owning merchant their event is live. Fire-and-forget — never
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
        set status = 'rejected', updated_at = now()
        from (select id from events where slug = $1 and status = 'pending') target
        where events.id = target.id
        returning events.slug, events.title, events.host_profile_id::text as owner_profile_id
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

    // Notify the owning merchant their event was declined. Fire-and-forget —
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
  // Admin's free-text "why" for a rejection — rides through to the merchant
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
          -- freshly-verified merchant's first event still hit the review queue —
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

  await sendWorkflowEmail({
    to: merchant.owner_email,
    subject:
      status === "approved"
        ? `${merchant.business_name} is approved on Click`
        : status === "suspended"
          ? `${merchant.business_name} has been suspended on Click`
          : `${merchant.business_name} merchant status: ${status}`,
    text: [
      `Hi ${merchant.owner_name},`,
      status === "approved"
        ? `${merchant.business_name} is approved to create and manage events on Click. Finish a quick setup to learn the ropes and connect payouts.`
        : status === "suspended"
          ? `${merchant.business_name} has been suspended. Your events are hidden from Discover until an admin reinstates the account.`
          : status === "rejected" && trimmedReason
            ? `${merchant.business_name} needs another look before we can approve it:\n\n${trimmedReason}\n\nReply to this email or update your application and resubmit.`
            : `${merchant.business_name} is now marked ${status}.`,
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}${status === "approved" ? "/merchant/onboarding" : "/merchant"}`,
    ].join("\n\n"),
  });

  // Log the rendered HTML to email_events for the dev drawer. Only approved /
  // rejected have templates in /emails today; suspended + pending fall through
  // until someone drafts those .html files.
  const origin = emailOrigin();
  const merchantFirstName =
    (merchant.owner_name || merchant.business_name || "").split(/\s+/)[0] || "there";
  if (status === "approved") {
    void logEmailEvent({
      template: "merchant-verified-merchant",
      toEmail: merchant.owner_email,
      toProfileId: merchant.owner_profile_id,
      vars: {
        businessName: merchant.business_name,
        merchantFirstName,
        createEventUrl: `${origin}/merchant/events/create`,
        merchantDashboardUrl: `${origin}/merchant`,
        supportEmail: "hello@click.app",
        unsubscribeUrl: `${origin}/account-settings`,
      },
    });
  } else if (status === "rejected") {
    void logEmailEvent({
      template: "merchant-rejected-merchant",
      toEmail: merchant.owner_email,
      toProfileId: merchant.owner_profile_id,
      vars: {
        businessName: merchant.business_name,
        merchantFirstName,
        rejectionReason:
          trimmedReason ||
          "Our reviewer flagged something in your application. Reply to this email and we'll walk you through it.",
        resubmitUrl: `${origin}/merchant/signup/documents`,
        supportEmail: "hello@click.app",
        unsubscribeUrl: `${origin}/account-settings`,
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
    // doesn't multiply the attendee-count aggregation above.
    const tagsResult = await pool.query<{ slug: string; tag_slug: string; tag_label: string }>(`
      select event.slug, tag.slug as tag_slug, tag.label as tag_label
      from events event
      join event_tags et on et.event_id = event.id
      join tags tag on tag.id = et.tag_id and tag.tag_type = 'interest'
      order by tag.label asc
    `);
    const tagsBySlug = new Map<string, { slug: string; label: string }[]>();
    for (const row of tagsResult.rows) {
      const list = tagsBySlug.get(row.slug) ?? [];
      list.push({ slug: row.tag_slug, label: row.tag_label });
      tagsBySlug.set(row.slug, list);
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
      intents: string[] | null;
      bookmarks: string;
      registrations: string;
      events: AdminMemberEventRef[] | null;
      email_verified_at: Date | null;
      photo_verified_at: Date | null;
      created_at: Date;
      suspended_at: Date | null;
      suspended_reason: string | null;
    }>(`
      select
        profile.id::text,
        profile.display_name,
        profile.email::text,
        profile.role::text,
        profile.suburb,
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
        profile.suspended_reason
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
      // Mirrors getProfileStatus's onboardingComplete: suburb is the field
      // saveOnboarding enforces. An email-only signup (bug board #164) is not
      // a countable attendee until they finish onboarding.
      onboardingComplete: !!row.suburb,
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
        }>(
          `
            select id::text, display_name, email::text, role::text,
                   city, suburb, bio, photo_url, age,
                   connection_intents::text[] as intents,
                   email_verified_at, photo_verified_at, created_at,
                   suspended_at, suspended_reason
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
        }>(
          `
            select event.slug, event.title, event.starts_at,
                   attendee.status::text as status,
                   attendee.checked_in_at,
                   attendee.created_at as rsvp_at
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

    const upcomingEvents = allEvents.filter(
      (e) => e.startsAt && new Date(e.startsAt).getTime() >= now,
    );
    const pastEvents = allEvents.filter(
      (e) => !e.startsAt || new Date(e.startsAt).getTime() < now,
    );

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
// by event_tags / user_tags, so we deliberately keep it stable — only the
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
};

export async function getAdminSidebarCounts(): Promise<AdminSidebarCounts> {
  const pool = getPostgresPool();
  if (!pool) {
    return {
      members: fallbackAdminMembers.length,
      events: (await getFallbackAdminEvents()).length,
      merchants: fallbackAdminMerchants.length,
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
    }>(`
      select
        (select count(*) from profiles where suburb is not null) as members,
        (select count(*) from events) as events,
        (select count(*) from merchant_profiles) as merchants,
        (select count(*) from tags) as tags,
        (select count(*) from audit_logs) as audit,
        (select count(*) from user_reports where status = 'open') as reports
    `);

    const row = result.rows[0];
    return {
      members: Number(row?.members ?? 0),
      events: Number(row?.events ?? 0),
      merchants: Number(row?.merchants ?? 0),
      tags: Number(row?.tags ?? 0),
      audit: Number(row?.audit ?? 0),
      reports: Number(row?.reports ?? 0),
    };
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("Falling back to static admin counts.", error);
    }
    return {
      members: fallbackAdminMembers.length,
      events: (await getFallbackAdminEvents()).length,
      merchants: fallbackAdminMerchants.length,
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
        -- email-only signup — including a merchant who never completed the
        -- attendee side — hasn't joined yet. suburb is the field onboarding
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
        count(distinct attendee_count.id) filter (where (attendee_count.status = 'confirmed' or (attendee_count.status = 'pending_payment' and attendee_count.hold_expires_at > now()))) as confirmed_attendees,
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
            order by ea.created_at asc
            limit 3
          ) preview
        ) as attendee_avatars,
        coalesce(
          array_agg(distinct tag.slug)
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
          from event_attendees own_attendee
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
          from event_attendees own_attendee
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
          where profile_a_id = $1::uuid or profile_b_id = $1::uuid
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
    // for a real signed-in user — return an empty dashboard so the UI shows the
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
      onboardingComplete: false,
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
      pool.query<{ suburb: string | null; bio: string | null; photo_url: string | null; dating_visible: boolean; has_gallery: boolean }>(
        `select suburb, bio, photo_url, dating_visible, cardinality(gallery_photos) > 0 as has_gallery from profiles where id = $1::uuid`,
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
          select event.slug, attendee.status::text as status
          from event_attendees attendee
          join events event on event.id = attendee.event_id
          where attendee.profile_id = $1::uuid
            and attendee.status in ('confirmed', 'waitlisted')
        `,
        [profile.id],
      ),
      getMerchantProfile(pool, profile.id),
    ]);

    const row = statusResult.rows[0];
    // Onboarding only requires the fields saveOnboarding enforces (name +
    // suburb). Bio was made an OPTIONAL final step, so gating completion on it
    // bounced anyone who skipped their bio back to /onboarding on every login.
    const onboardingComplete = !!row?.suburb;

    return {
      exists: true,
      role: profile.role,
      onboardingComplete,
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
  } catch {
    return {
      exists: !!email,
      role: "attendee",
      onboardingComplete: false,
      merchantProfile: null,
      bookmarkedEventIds: [],
      registeredEventIds: [],
      waitlistedEventIds: [],
      photoUrl: null,
      hasGalleryPhotos: false,
      datingVisible: false,
    };
  }
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
      { key: "photo", label: "Add a profile photo", done: false, href: "/profile/edit" },
      { key: "suburb", label: "Set your suburb", done: false, href: "/onboarding" },
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
      pool.query<{ photo_url: string | null; suburb: string | null; bio: string | null }>(
        `select photo_url, suburb, bio from profiles where id = $1::uuid`,
        [profile.id],
      ),
      pool.query<{ count: string }>(
        `select count(*)::text as count from user_tags where profile_id = $1::uuid`,
        [profile.id],
      ),
      // The dashboard "Take the Click quiz" card links to the Life Quiz
      // (/quiz/life), which writes tags with source='quiz' via saveLifeQuizTags
      // — it does NOT write to click_personas (that's the separate personality
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
      { key: "photo", label: "Add a profile photo", done: !!row?.photo_url, href: "/profile/edit" },
      { key: "suburb", label: "Set your suburb", done: !!row?.suburb, href: "/onboarding" },
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
// Used by the post-approval Stripe Connect onboarding routes — those actions
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

export async function saveOnboarding(input: OnboardingInput, session: Session | null) {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const displayName = input.displayName.trim();
  const suburb = input.suburb.trim();
  // Bio moved to an optional final onboarding step — accept empty string here.
  const bio = input.bio.trim();

  if (!displayName || !suburb) {
    const error = new Error("Name and suburb are required.");
    error.name = "ValidationError";
    throw error;
  }

  const ageValue = input.age.trim() ? Number.parseInt(input.age.trim(), 10) : null;
  if (ageValue !== null && (!Number.isFinite(ageValue) || ageValue < 18 || ageValue > 120)) {
    const error = new Error("Age must be 18 or older.");
    error.name = "ValidationError";
    throw error;
  }

  let birthDateValue: string | null = null;
  let derivedAge = ageValue;
  if (input.birthDate && input.birthDate.trim()) {
    const parsed = new Date(input.birthDate.trim());
    if (Number.isNaN(parsed.getTime())) {
      const error = new Error("Birth date must be a valid date.");
      error.name = "ValidationError";
      throw error;
    }
    const today = new Date();
    let computedAge = today.getFullYear() - parsed.getFullYear();
    const hasHadBirthday =
      today.getMonth() > parsed.getMonth() ||
      (today.getMonth() === parsed.getMonth() && today.getDate() >= parsed.getDate());
    if (!hasHadBirthday) computedAge -= 1;
    if (computedAge < 18) {
      const error = new Error("You must be 18 or older to use Click.");
      error.name = "ValidationError";
      throw error;
    }
    birthDateValue = parsed.toISOString().slice(0, 10);
    derivedAge = derivedAge ?? computedAge;
  }

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
    // Tags are "click tags" — never free-form. Attach only curated tags that
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

export async function registerMerchantProfile(input: MerchantSignupInput, session: Session | null) {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const businessName = input.businessName.trim();
  const contactEmail = input.contactEmail.trim().toLowerCase();

  if (!businessName || !contactEmail) {
    const error = new Error("Business name and contact email are required.");
    error.name = "ValidationError";
    throw error;
  }

  const abnError = validateOptionalAbn(input.abn);
  if (abnError) {
    const error = new Error(abnError);
    error.name = "ValidationError";
    throw error;
  }
  const abn = normalizeAbn(input.abn);

  const profile = await ensureProfileForSession(session);

  const result = await pool.query<MerchantProfileRow>(
    `
      insert into merchant_profiles (profile_id, business_name, contact_email, website_url, abn)
      values ($1::uuid, $2, $3, nullif($4, ''), nullif($5, ''))
      on conflict (profile_id) do update
      set
        business_name = excluded.business_name,
        contact_email = excluded.contact_email,
        website_url = excluded.website_url,
        abn = excluded.abn,
        updated_at = now()
      returning id::text, business_name, contact_email::text, verification_status,
        business_type, stripe_connect_account_id, charges_enabled, payouts_enabled,
        details_submitted, onboarding_completed_at::text
    `,
    [profile.id, businessName, contactEmail, input.websiteUrl.trim(), abn],
  );

  if (profile.role === "attendee") {
    await pool.query(
      `update profiles set role = 'merchant', updated_at = now() where id = $1::uuid`,
      [profile.id],
    );
  }

  return result.rows[0];
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
// Accepts +61412345678, 0412345678, or with spacing — we strip to digits before checking.
const AU_PHONE_RE = /^(?:\+?61|0)\d{9}$/;

// Launch pilot is Greater Sydney. A merchant whose venue is outside this area
// is parked on the host waitlist (emailed, not auto-rejected) until we open
// their region — see registerMerchantWizardSubmit. Sydney metro postcodes are
// NSW 2000–2234 (city + suburbs) plus the 1xxx business-district PO range.
const PILOT_AREA_LABEL = "Greater Sydney";
function isWithinPilotArea(state: string, postcode: string): boolean {
  if (state !== "NSW") return false;
  const code = Number(postcode);
  if (!Number.isFinite(code)) return false;
  return (code >= 2000 && code <= 2234) || (code >= 1000 && code <= 1999);
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = "ValidationError";
  return error;
}

/**
 * Full merchant signup wizard submit — spec §1 Step 4.
 *
 * Validates every required field server-side (UI validation is not enough —
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
 * list if the DB isn't reachable — the wizard surfaces that as a load error.
 *
 * Filters out `internal_only` categories (e.g. Life, Music) — those are
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
 * Merchants search/pick these as pills — tags are "click tags", never
 * free-form, so this is the ONLY source of selectable event tags. Keeps tag
 * spelling consistent so events match the same tags users hold on their
 * profiles. Returns `interest` + `vibe` tags (the event-relevant types;
 * `life`/`music` are matching signals, not event descriptors), ordered by
 * how widely each tag is already used so the most common options surface
 * first. The submit path (`createEventForMerchant`) only attaches tags that
 * exist here; anything else is dropped. Falls back to an empty list if the DB
 * is down. New tags are created by admins via /api/admin/tags.
 */
export async function getMerchantTagOptions(): Promise<string[]> {
  const pool = getPostgresPool();
  if (!pool) return [];
  const result = await pool.query<{ label: string }>(
    `select tag.label, count(event_tag.tag_id) as usage
       from tags tag
       left join event_tags event_tag on event_tag.tag_id = tag.id
      where tag.tag_type in ('interest', 'vibe')
      group by tag.id, tag.label
      order by usage desc, tag.label asc`,
  );
  return result.rows.map((r) => r.label);
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
 * keep a separate "host names" or "venues" table — instead we derive the lists
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
 * the file has been pushed to Supabase Storage — this function only writes
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
): Promise<MerchantDocumentRow> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const merchant = await getMerchantProfile(pool, profile.id);

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

  return result.rows[0];
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
 * row existed — see the back-fill note above) and mints a short-TTL signed URL
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
    throw validationError("Business name must be 2–100 characters.");
  }

  const tradingName = input.tradingName.trim();
  const contactEmail = input.contactEmail.trim().toLowerCase();
  if (!contactEmail || !contactEmail.includes("@")) {
    throw validationError("A valid contact email is required.");
  }

  // ABN is optional for now — only validate format/checksum when supplied.
  const abnError = validateOptionalAbn(input.abn);
  if (abnError) throw validationError(abnError);
  const abn = normalizeAbn(input.abn);

  const acnError = validateOptionalAcn(input.acn);
  if (acnError) throw validationError(acnError);
  const acn = normalizeAcn(input.acn);

  if (!AU_STATES.includes(input.addressState)) {
    throw validationError("Pick an Australian state.");
  }

  const postcode = input.addressPostcode.trim();
  if (!AU_POSTCODE_RE.test(postcode)) {
    throw validationError("Postcode must be 4 digits.");
  }

  const phoneDigits = input.phone.replace(/\s+/g, "");
  if (!AU_PHONE_RE.test(phoneDigits)) {
    throw validationError("Enter a valid Australian phone number.");
  }

  const street = input.addressStreet.trim();
  const suburb = input.addressSuburb.trim();
  if (!street || !suburb) {
    throw validationError("Street address and suburb are required.");
  }

  // Socials are optional — keep only known platforms that carry a handle.
  const socials: Record<string, string> = {};
  for (const platform of MERCHANT_SOCIAL_PLATFORMS) {
    const handle = (input.socials[platform] ?? "").trim();
    if (handle) socials[platform] = handle;
  }

  const categoryIds = Array.from(new Set(input.eventCategoryIds.filter(Boolean)));
  if (categoryIds.length === 0) {
    throw validationError("Pick at least one event category.");
  }

  const profile = await ensureProfileForSession(session);

  const client = await pool.connect();
  try {
    await client.query("begin");

    const upsert = await client.query<MerchantProfileRow & { is_new: boolean }>(
      `
        insert into merchant_profiles (
          profile_id, business_name, trading_name, abn, acn, business_type,
          phone, contact_email, website_url, socials,
          address_street, address_suburb, address_state, address_postcode,
          submitted_at
        )
        values (
          $1::uuid, $2, nullif($3, ''), $4, nullif($5, ''), $6,
          $7, $8, nullif($9, ''), $10::jsonb,
          $11, $12, $13, $14,
          now()
        )
        on conflict (profile_id) do update set
          business_name = excluded.business_name,
          trading_name = excluded.trading_name,
          abn = excluded.abn,
          acn = excluded.acn,
          business_type = excluded.business_type,
          phone = excluded.phone,
          contact_email = excluded.contact_email,
          website_url = excluded.website_url,
          socials = excluded.socials,
          address_street = excluded.address_street,
          address_suburb = excluded.address_suburb,
          address_state = excluded.address_state,
          address_postcode = excluded.address_postcode,
          submitted_at = coalesce(merchant_profiles.submitted_at, now()),
          updated_at = now()
        returning id::text, business_name, contact_email::text, verification_status,
          business_type, stripe_connect_account_id, charges_enabled, payouts_enabled,
          details_submitted, onboarding_completed_at::text, (xmax = 0) as is_new
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
      ],
    );

    const merchantId = upsert.rows[0].id;

    // Replace categories — small set, simpler than diffing.
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

    // All documents are optional at signup — admins can request follow-ups
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

    // Log the merchant-application-received confirmation on first submission
    // only (xmax = 0). Re-submitting after an edit upserts and must not re-fire
    // the "we've got your application" email. Fire-and-forget, post-commit.
    if (upsert.rows[0].is_new) {
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
        void logEmailEvent({
          template: "merchant-waitlisted-merchant",
          toEmail: contactEmail,
          toProfileId: profile.id,
          vars: {
            merchantFirstName,
            businessName,
            suburb: suburb || input.addressState,
            pilotArea: PILOT_AREA_LABEL,
            supportEmail: "hello@click.app",
            unsubscribeUrl: `${origin}/account-settings`,
          },
        });
      } else {
        void logEmailEvent({
          template: "merchant-application-received",
          toEmail: contactEmail,
          toProfileId: profile.id,
          vars: {
            merchantFirstName,
            businessName,
            submittedDate,
            merchantDashboardUrl: `${origin}/merchant`,
            supportEmail: "hello@click.app",
            unsubscribeUrl: `${origin}/account-settings`,
          },
        });
      }

      // Notify every admin that a new merchant is awaiting verification, so the
      // verification queue surfaces in their bell without polling /admin/merchants.
      // Fire-and-forget, post-commit — a notification hiccup must not fail signup.
      void pool
        .query(
          `
            insert into notifications (profile_id, title, body, action_url)
            select id, $1, $2, $3
            from profiles
            where role = 'admin'
          `,
          [
            withinPilot
              ? "New merchant awaiting verification"
              : "New merchant on the waitlist (outside pilot)",
            withinPilot
              ? `${businessName} just signed up and is waiting for verification.`
              : `${businessName} signed up from ${suburb || input.addressState}, outside the ${PILOT_AREA_LABEL} pilot — parked on the host waitlist.`,
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

export async function createUserClickForSession(
  input: {
    clickedProfileId: string;
    sourceEventId?: string;
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

    const clickedResult = await client.query<{
      id: string;
      display_name: string;
      email: string | null;
    }>(
      `
        select id::text, display_name, email::text
        from profiles
        where id = $1::uuid
        limit 1
      `,
      [input.clickedProfileId],
    );

    const clickedProfile = clickedResult.rows[0];
    if (!clickedProfile) {
      const error = new Error("Clicked profile not found.");
      error.name = "NotFoundError";
      throw error;
    }
    if (clickedProfile.id === profile.id) {
      const error = new Error("You cannot Click yourself.");
      error.name = "ValidationError";
      throw error;
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
      const error = new Error("This person is unavailable.");
      error.name = "ValidationError";
      throw error;
    }

    // Clicks are gated to the post-event window: you can only Click someone you
    // were both confirmed attendees of an event with, and only once that event
    // has ended + 12 hours (business plan §1.2 step 5). If a specific source
    // event slug is supplied (from the dashboard prompt) we verify *that* event
    // qualifies; otherwise we pick the most recent qualifying shared event.
    const eligibilityResult = await client.query<{ id: string }>(
      `
        select e.id::text
        from events e
        join event_attendees a1 on a1.event_id = e.id and a1.profile_id = $1::uuid and a1.status = 'confirmed'
        join event_attendees a2 on a2.event_id = e.id and a2.profile_id = $2::uuid and a2.status = 'confirmed'
        where coalesce(e.ends_at, e.starts_at) + interval '12 hours' <= now()
          ${input.sourceEventId ? "and e.slug = $3" : ""}
        order by coalesce(e.ends_at, e.starts_at) desc
        limit 1
      `,
      input.sourceEventId
        ? [profile.id, clickedProfile.id, input.sourceEventId]
        : [profile.id, clickedProfile.id],
    );
    const sourceEventId = eligibilityResult.rows[0]?.id ?? null;

    if (!sourceEventId) {
      const error = new Error(
        "The Click window opens 12 hours after an event you both attended ends. Once it's been long enough since a shared event, you'll be able to Click the people you met there.",
      );
      error.name = "ValidationError";
      throw error;
    }

    await client.query(
      `
        insert into user_clicks (clicker_profile_id, clicked_profile_id, source_event_id, status, expires_at)
        values ($1::uuid, $2::uuid, $3::uuid, 'pending', now() + interval '30 days')
        on conflict (clicker_profile_id, clicked_profile_id) do update
        set
          source_event_id = excluded.source_event_id,
          status = 'pending',
          expires_at = now() + interval '30 days',
          created_at = now()
      `,
      [profile.id, clickedProfile.id, sourceEventId],
    );

    const reciprocalResult = await client.query<{ source_event_id: string | null }>(
      `
        select source_event_id::text
        from user_clicks
        where clicker_profile_id = $1::uuid
          and clicked_profile_id = $2::uuid
          and expires_at > now()
        limit 1
      `,
      [clickedProfile.id, profile.id],
    );

    const reciprocalClick = reciprocalResult.rows[0];
    let suggestedEvent:
      | {
          id: string;
          slug: string;
          title: string;
        }
      | null = null;

    if (reciprocalClick) {
      const preferredEventId = sourceEventId ?? reciprocalClick.source_event_id;
      if (preferredEventId) {
        // The "preferred" event is the one they both attended that unlocked the
        // Click — which is ALWAYS in the past (clicking is gated to 12h after an
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
              and status in ('live', 'featured', 'waitlist')
              and starts_at > now()
              -- Never reuse a booked-out event as the suggestion (confirmed +
              -- live payment holds count toward capacity).
              and (
                select count(*) from event_attendees full_count
                where full_count.event_id = event.id
                  and (
                    full_count.status = 'confirmed'
                    or (full_count.status = 'pending_payment' and full_count.hold_expires_at > now())
                  )
              ) < event.capacity
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
            where event.status in ('live', 'featured', 'waitlist')
              and event.starts_at > now()
              -- Never suggest a booked-out event (confirmed + live payment holds
              -- count toward capacity).
              and (
                select count(*) from event_attendees full_count
                where full_count.event_id = event.id
                  and (
                    full_count.status = 'confirmed'
                    or (full_count.status = 'pending_payment' and full_count.hold_expires_at > now())
                  )
              ) < event.capacity
            group by event.id
            order by
              -- Prefer a genuinely new shared plan: rank events that neither of
              -- them has already RSVP'd to ahead of ones one of them is on, then
              -- events that align with BOTH members' interests (bug board: a
              -- mutual-click suggestion should hit shared interests where it
              -- can — falls back to a single-member match when none align with
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

      const mutualResult = await client.query<{ id: string }>(
        `
          with pair as (
            select
              least($1::uuid, $2::uuid) as profile_a_id,
              greatest($1::uuid, $2::uuid) as profile_b_id
          )
          insert into mutual_clicks (profile_a_id, profile_b_id, suggested_event_id)
          select pair.profile_a_id, pair.profile_b_id, $3::uuid
          from pair
          on conflict (profile_a_id, profile_b_id) do update
          set suggested_event_id = coalesce(excluded.suggested_event_id, mutual_clicks.suggested_event_id)
          returning id::text
        `,
        [profile.id, clickedProfile.id, suggestedEvent?.id ?? null],
      );

      // Open (or refresh) the Proposal that lets both sides coordinate the
      // shared follow-up event with no free text. 7-day window.
      const mutualClickId = mutualResult.rows[0]?.id;
      if (mutualClickId) {
        await client.query(
          `
            insert into event_proposals (mutual_click_id, suggested_event_id, proposed_by, expires_at)
            values ($1::uuid, $2::uuid, $3::uuid, now() + interval '7 days')
            on conflict (mutual_click_id) do update
            set suggested_event_id = coalesce(event_proposals.suggested_event_id, excluded.suggested_event_id),
                updated_at = now()
          `,
          [mutualClickId, suggestedEvent?.id ?? null, profile.id],
        );
      }

      await client.query(
        `
          update user_clicks
          set status = 'mutual'
          where (
            clicker_profile_id = $1::uuid and clicked_profile_id = $2::uuid
          ) or (
            clicker_profile_id = $2::uuid and clicked_profile_id = $1::uuid
          )
        `,
        [profile.id, clickedProfile.id],
      );

      // Notify each side, unless the recipient has muted the other party
      // (mute = "disable notifications from that user", per the safety spec).
      await client.query(
        `
          insert into notifications (profile_id, title, body, action_url)
          select $1::uuid, 'Mutual Click found', $3, $4
          where not exists (
            select 1 from user_mutes
            where muter_profile_id = $1::uuid and muted_profile_id = $2::uuid
          )
        `,
        [
          profile.id,
          clickedProfile.id,
          suggestedEvent
            ? `You and ${clickedProfile.display_name} both clicked. Try ${suggestedEvent.title}.`
            : `You and ${clickedProfile.display_name} both clicked. Open your proposal to plan.`,
          "/proposals",
        ],
      );
      await client.query(
        `
          insert into notifications (profile_id, title, body, action_url)
          select $1::uuid, 'Mutual Click found', $3, $4
          where not exists (
            select 1 from user_mutes
            where muter_profile_id = $1::uuid and muted_profile_id = $2::uuid
          )
        `,
        [
          clickedProfile.id,
          profile.id,
          suggestedEvent
            ? `You and ${profile.display_name} both clicked. Try ${suggestedEvent.title}.`
            : `You and ${profile.display_name} both clicked. Open your proposal to plan.`,
          "/proposals",
        ],
      );
    }

    await client.query("commit");

    // Mutual click → log the "it's mutual" email for BOTH sides. Fire-and-forget
    // after commit (per the email-events contract) so a render hiccup can't roll
    // back the click. Previously no email was logged here, so the in-app
    // notification's "view email" viewer fell back to an unrelated email_events
    // row matched purely by timestamp — that's the "wrong email" bug.
    if (reciprocalClick) {
      const origin = emailOrigin();
      const proposalsUrl = `${origin}/proposals`;
      const suggestionLine = suggestedEvent
        ? `We even spotted an event you could go to together: ${suggestedEvent.title}. Open your proposal to lock in a time.`
        : "Open your proposal to pick an upcoming event and plan your first hangout — no awkward back-and-forth.";
      const firstNameOf = (name: string | null) =>
        (name || "").split(/\s+/)[0] || "there";
      if (profile.email) {
        void logEmailEvent({
          template: "mutual-click-attendee",
          toEmail: profile.email,
          toProfileId: profile.id,
          vars: {
            firstName: firstNameOf(profile.display_name),
            otherName: clickedProfile.display_name,
            suggestionLine,
            proposalsUrl,
            supportEmail: "hello@click.app",
            unsubscribeUrl: `${origin}/account-settings`,
          },
        });
      }
      if (clickedProfile.email) {
        void logEmailEvent({
          template: "mutual-click-attendee",
          toEmail: clickedProfile.email,
          toProfileId: clickedProfile.id,
          vars: {
            firstName: firstNameOf(clickedProfile.display_name),
            otherName: profile.display_name,
            suggestionLine,
            proposalsUrl,
            supportEmail: "hello@click.app",
            unsubscribeUrl: `${origin}/account-settings`,
          },
        });
      }
    }

    return {
      clickedProfileName: clickedProfile.display_name,
      status: reciprocalClick ? "mutual" : "pending",
      suggestedEvent: suggestedEvent
        ? {
            slug: suggestedEvent.slug,
            title: suggestedEvent.title,
          }
        : null,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

type WaitlistPromotion = {
  email: string;
  displayName: string;
  eventTitle: string;
  eventSlug: string;
  offeredUntil: Date;
};

// How long a freed seat is held for the next person in the queue before it
// rolls on (spec §3.2). Kept as a const so the notification/email copy and the
// expiry cron all agree on the window.
const WAITLIST_OFFER_MINUTES = 30;

/**
 * Offer a freed seat to the next eligible waitlister — oldest first, skipping
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
  const waitlistResult = await client.query<{
    waitlist_id: string;
    profile_id: string;
    display_name: string;
    email: string;
  }>(
    `
      select
        waitlist.id::text as waitlist_id,
        waitlist.profile_id::text,
        waitlist_profile.display_name,
        waitlist_profile.email::text as email
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
    email: nextInLine.email,
    displayName: nextInLine.display_name,
    eventTitle,
    eventSlug,
    offeredUntil: offerResult.rows[0].offered_until,
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
  // Refund to actually initiate after commit (paid confirmed cancels with a
  // non-zero policy refund). Stripe + ledger work happens via issueRefund.
  let refundPlan:
    | { paymentTransactionId: string; refundCents: number; tier: RefundTier; currency: string }
    | null = null;
  // True when the booking was paid but the policy gives $0 back (< 24h) — drives
  // the "no refund" copy without initiating a Stripe call.
  let paidZeroRefund = false;
  let cancelledEventId = "";
  let cancelledTitle = "";

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
      offered_until: Date | null;
      txn_id: string | null;
      txn_amount_cents: number | null;
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
          waitlist.offered_until,
          pt.id::text as txn_id,
          pt.amount_cents as txn_amount_cents,
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
          and attendee.status in ('confirmed', 'waitlisted')
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

    await client.query(
      `update event_attendees set status = 'cancelled', updated_at = now() where id = $1::uuid`,
      [row.attendee_id],
    );

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
      // A confirmed seat just freed — offer it to the queue (spec §3 Principle 3).
      promotion = await promoteNextWaitlister(client, row.event_id, row.title, row.slug);

      // Paid booking → compute the tiered policy refund. Only refundable txns
      // (paid / partially_refunded) qualify; the actual Stripe call runs after
      // commit so a network hiccup can't roll back the cancellation.
      if (
        row.price_cents > 0 &&
        row.txn_id &&
        row.txn_amount_cents != null &&
        (row.txn_status === "paid" || row.txn_status === "partially_refunded")
      ) {
        const quote = quoteCancellationRefund(row.txn_amount_cents, row.starts_at);
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
      await issueRefund({
        paymentTransactionId: refundPlan.paymentTransactionId,
        amountCents: refundPlan.refundCents,
        reason: "requested_by_customer",
        adminProfileId: null,
      });
      refund = { refundCents: refundPlan.refundCents, tier: refundPlan.tier, failed: false };
      refundLine = `A refund of ${dollars} will appear on your statement in 3–5 business days.`;
      await pool
        .query(
          `insert into notifications (profile_id, title, body, action_url) values ($1::uuid, $2, $3, $4)`,
          [
            profile.id,
            "Refund on the way",
            `Your ${dollars} refund for ${cancelledTitle} is processing (3–5 business days).`,
            "/dashboard",
          ],
        )
        .catch(() => {});
    } catch (err) {
      // Cancellation stands; the refund just didn't initiate. Log to the admin
      // queue and tell the user we're on it (spec §5 "refund fails").
      refund = { refundCents: refundPlan.refundCents, tier: refundPlan.tier, failed: true };
      refundLine =
        "We're processing your refund — if you don't see it within 7 days, contact hello@click.app.";
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
      "No refund — you cancelled within 24 hours of the event, per our cancellation policy.";
  }

  // Log rsvp-cancelled-attendee (+ rsvp-cancelled-merchant). Post-commit +
  // fire-and-forget so a template hiccup can't roll back the cancellation.
  void logRsvpCancelledEmails(pool, cancelledEventId, profile.id, refundLine);

  if (promotion) {
    await sendWorkflowEmail({
      to: promotion.email,
      subject: `A spot opened for ${promotion.eventTitle}`,
      text: [
        `Hi ${promotion.displayName},`,
        `A spot opened for ${promotion.eventTitle}.`,
        `Your offer is held until ${promotion.offeredUntil.toLocaleString("en-AU", {
          timeZone: "Australia/Sydney",
        })} (about ${WAITLIST_OFFER_MINUTES} minutes).`,
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/events/${promotion.eventSlug}`,
      ].join("\n\n"),
    });
  }

  return {
    eventTitle: cancelledTitle,
    promotedWaitlist: !!promotion,
    refund,
  };
}

/**
 * Sweep lapsed waitlist promotion offers (the 30-minute window passed without
 * the user confirming). For each: stamp `last_offer_expired_at`, tell the user
 * they're back on the list at their position, and roll the freed seat to the
 * next eligible person (spec §3.4). Idempotent + safe to run concurrently —
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

      // Re-lock + re-check — an accept or another sweep may have moved it.
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

      // Position they fall back to (waitlisters still ahead by created_at).
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
            and ahead.created_at < $3::timestamptz
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

      // Roll the seat on — the just-expired user is now deprioritised.
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
    await sendWorkflowEmail({
      to: promo.email,
      subject: `A spot opened for ${promo.eventTitle}`,
      text: [
        `Hi ${promo.displayName},`,
        `A spot opened for ${promo.eventTitle}.`,
        `Your offer is held until ${promo.offeredUntil.toLocaleString("en-AU", {
          timeZone: "Australia/Sydney",
        })} (about ${WAITLIST_OFFER_MINUTES} minutes).`,
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/events/${promo.eventSlug}`,
      ].join("\n\n"),
    }).catch(() => {});
  }

  return { expired, reoffered };
}

/**
 * Sweep abandoned checkout holds. A `pending_payment` attendee row that's past
 * its `hold_expires_at` is a checkout that was started but never paid (the
 * person closed the Stripe tab, etc.). The seat-count predicates already stop
 * counting an expired hold (`hold_expires_at > now()`), so the seat *displays*
 * as free — but the row lingers as `pending_payment` forever and, crucially,
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
    // "I paid but it says join the waitlist" bug — so reconcile first and, if
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

      // Re-lock + re-check — a webhook/return reconcile may have just confirmed
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
      // account for live offers already reserving a slot — otherwise we'd
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
    await sendWorkflowEmail({
      to: promo.email,
      subject: `A spot opened for ${promo.eventTitle}`,
      text: [
        `Hi ${promo.displayName},`,
        `A spot opened for ${promo.eventTitle}.`,
        `Your offer is held until ${promo.offeredUntil.toLocaleString("en-AU", {
          timeZone: "Australia/Sydney",
        })} (about ${WAITLIST_OFFER_MINUTES} minutes).`,
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/events/${promo.eventSlug}`,
      ].join("\n\n"),
    }).catch(() => {});
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

  const client = await pool.connect();
  let affectedProfiles: {
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
      starts_at: Date;
      ends_at: Date | null;
      timezone: string;
      host_name: string;
    }>(
      `
        select id::text, slug, title, status::text, starts_at, ends_at, timezone, host_name
        from events
        where slug = $1 and merchant_profile_id = $2::uuid
        for update
      `,
      [eventId, merchant.id],
    );

    const event = eventResult.rows[0];
    if (!event) {
      const error = new Error("Merchant event not found.");
      error.name = "NotFoundError";
      throw error;
    }

    if (event.status === "cancelled") {
      await client.query("commit");
      return { eventTitle: event.title, notified: 0, refunded: 0, alreadyCancelled: true };
    }

    const attendeeResult = await client.query<{
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
          and attendee.status in ('confirmed', 'waitlisted', 'pending_payment')
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
        profileId: row.profile_id,
        email: row.email,
        displayName: row.display_name,
        paymentTransactionId: row.txn_id,
        refundableCents: Math.max(0, refundable),
        currency: row.txn_currency || "AUD",
      };
    });

    await client.query(
      `
        update events
        set status = 'cancelled', updated_at = now()
        where id = $1::uuid
      `,
      [event.id],
    );

    await client.query(
      `
        update event_attendees
        set status = 'cancelled', updated_at = now()
        where event_id = $1::uuid
          and status in ('confirmed', 'waitlisted', 'pending_payment')
      `,
      [event.id],
    );

    if (attendeeResult.rows.length > 0) {
      await client.query(
        `
          insert into notifications (profile_id, title, body, action_url)
          select profile_id::uuid, $2, $3, $4
          from unnest($1::uuid[]) as profile_id
        `,
        [
          attendeeResult.rows.map((row) => row.profile_id),
          "Event cancelled",
          `${event.title} has been cancelled by the host.`,
          `/events/${event.slug}`,
        ],
      );
    }

    await client.query("commit");

    // Up to 3 upcoming, still-bookable alternatives to soften the cancellation.
    // A user whose event was just cancelled is primed to book something else
    // (spec §5). Shared across all recipients — generic (not per-user) for now.
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
    const suggestedEventsText = suggestions.length
      ? "Events you might enjoy:\n" +
        suggestions.map((s) => `• ${s.title} — ${s.line}\n  ${s.url}`).join("\n")
      : "";

    // Per attendee: issue the 100% refund (full remaining balance), then email.
    // Each refund is isolated — a Stripe failure logs to refund_failures and the
    // cancellation/notice still goes out (spec §5 "refund fails during bulk").
    let refundedCount = 0;
    await Promise.all(
      affectedProfiles.map(async (attendee) => {
        let refundLabel = "You were not charged.";

        if (attendee.refundableCents > 0 && attendee.paymentTransactionId) {
          const dollars = formatAud(attendee.refundableCents, attendee.currency);
          try {
            const { issueRefund } = await import("./stripe-sync");
            await issueRefund({
              paymentTransactionId: attendee.paymentTransactionId,
              reason: "requested_by_customer",
              adminProfileId: null,
            });
            refundedCount += 1;
            refundLabel = `A full refund of ${dollars} is on the way (3–5 business days).`;
          } catch (err) {
            refundLabel =
              "We're processing your full refund — if it hasn't arrived within 7 days, contact hello@click.app.";
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

        await sendWorkflowEmail({
          to: attendee.email,
          subject: `${event.title} has been cancelled`,
          text: [
            `Hi ${attendee.displayName},`,
            `${event.title} has been cancelled by the host.`,
            refundLabel,
            suggestedEventsText,
          ]
            .filter(Boolean)
            .join("\n\n"),
        });

        // Mirror into email_events (dev log) with the real refund label +
        // suggestions. Fire-and-forget — never blocks the response.
        void logEmailEvent({
          template: "event-cancelled-attendee",
          toEmail: attendee.email,
          toProfileId: attendee.profileId,
          vars: {
            firstName: (attendee.displayName || "").split(/\s+/)[0] || "there",
            eventTitle: event.title,
            eventLongDate: dates.eventLongDate,
            eventStartTime: dates.eventStartTime,
            eventHostName: event.host_name,
            cancellationReason: "",
            refundLabel,
            suggestedEvents: suggestedEventsHtml,
            discoverUrl: `${origin}/discover`,
            supportEmail: "hello@click.app",
            unsubscribeUrl: `${origin}/account-settings`,
          },
        });
      }),
    );

    return {
      eventTitle: event.title,
      notified: affectedProfiles.length,
      refunded: refundedCount,
      alreadyCancelled: false,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
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
  // What the buyer actually pays = priceCents + bookingFeeCents. Persisted as
  // payment_transactions.amount_cents so receipts/refunds reconcile against it.
  totalCents: number;
  currency: string;
  profileEmail: string;
  // Connected merchant's Stripe account id when present + payouts ready.
  // Null for legacy platform-managed events where the platform itself is the
  // merchant — those keep the existing single-charge behaviour.
  merchantStripeAccountId: string | null;
};

export async function createPaymentHold(
  eventSlug: string,
  session: Session | null,
): Promise<PaymentHold> {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
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
      merchant_profile_id: string | null;
      merchant_stripe_account_id: string | null;
      merchant_charges_enabled: boolean | null;
      confirmed_attendees: string;
      has_ended: boolean;
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
          event.merchant_profile_id::text,
          merchant.stripe_connect_account_id as merchant_stripe_account_id,
          merchant.charges_enabled as merchant_charges_enabled,
          (coalesce(event.ends_at, event.starts_at) <= now()) as has_ended,
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
      const error = new Error("This event is free — use the Register button instead.");
      error.name = "ValidationError";
      throw error;
    }
    // Past events are closed: no new checkout holds once the event has ended.
    if (event.has_ended) {
      const error = new Error("This event has already ended.");
      error.name = "ValidationError";
      throw error;
    }

    // Merchant-hosted paid events must route the charge to the merchant's
    // connected account via destination charge. Platform-managed events
    // (merchant_profile_id IS NULL) skip this and bill into the platform.
    if (event.merchant_profile_id) {
      if (!event.merchant_stripe_account_id || !event.merchant_charges_enabled) {
        const error = new Error(
          "This event isn't accepting payments yet — the host is finishing payout setup.",
        );
        error.name = "PayoutsNotReadyError";
        throw error;
      }
    }

    const confirmedCount = Number(event.confirmed_attendees);
    if (event.status === "waitlist" || confirmedCount >= event.capacity) {
      const error = new Error("Event is full — join the waitlist instead.");
      error.name = "ConflictError";
      throw error;
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
    // 'paid', the money is in — promote the seat in place and stop, rather than
    // opening a new checkout. markPaymentSucceeded stays the primary path; this
    // is the backstop that prevents a double charge.
    const paidTxn = await client.query<{ id: string }>(
      `
        select id::text
        from payment_transactions
        where event_id = $1::uuid and profile_id = $2::uuid and status = 'paid'
        limit 1
      `,
      [event.id, profile.id],
    );
    if (paidTxn.rows[0]) {
      await client.query(
        `
          update event_attendees
          set status = 'confirmed', hold_expires_at = null, updated_at = now()
          where event_id = $1::uuid and profile_id = $2::uuid and status <> 'confirmed'
        `,
        [event.id, profile.id],
      );
      await client.query("commit");
      const error = new Error(
        "You've already paid for this event — your spot is confirmed. Refresh the page to see your booking.",
      );
      error.name = "ConflictError";
      throw error;
    }

    // Booking fee is charged on top of the ticket and kept by the platform.
    // Snapshot it at hold time so a later admin change to the rate can't alter an
    // in-flight checkout. amount_cents stores the full buyer charge (ticket + fee).
    const { bookingFeeBps } = await getSystemSettings();
    const bookingFeeCents = Math.round((event.price_cents * bookingFeeBps) / 10_000);
    const totalCents = event.price_cents + bookingFeeCents;

    const paymentResult = await client.query<{ id: string }>(
      `
        insert into payment_transactions (event_id, profile_id, merchant_profile_id, amount_cents, currency, status)
        values ($1::uuid, $2::uuid, $3::uuid, $4, $5, 'pending')
        returning id::text
      `,
      [event.id, profile.id, event.merchant_profile_id, totalCents, event.currency],
    );
    const paymentTransactionId = paymentResult.rows[0].id;

    await client.query(
      `
        insert into event_attendees (event_id, profile_id, status, payment_transaction_id, hold_expires_at)
        values ($1::uuid, $2::uuid, 'pending_payment', $3::uuid, now() + interval '30 minutes')
        on conflict (event_id, profile_id) do update
        set status = 'pending_payment', payment_transaction_id = excluded.payment_transaction_id, hold_expires_at = now() + interval '30 minutes', updated_at = now()
      `,
      [event.id, profile.id, paymentTransactionId],
    );

    await client.query("commit");

    return {
      paymentTransactionId,
      eventUuid: event.id,
      eventSlug: event.slug,
      eventTitle: event.title,
      priceCents: event.price_cents,
      bookingFeeCents,
      totalCents,
      currency: event.currency,
      profileEmail: profile.email,
      merchantStripeAccountId: event.merchant_stripe_account_id,
    };
  } catch (error) {
    await client.query("rollback");
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

  // Only set the PI once — don't clobber an id a later sync already wrote.
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
// against later — see reconcilePendingTransactions in stripe-sync.ts.
export async function attachCheckoutSession(
  paymentTransactionId: string,
  stripeCheckoutSessionId: string | null,
) {
  const pool = getPostgresPool();
  if (!pool || !stripeCheckoutSessionId) return;

  await pool.query(
    `
      update payment_transactions
      set stripe_checkout_session_id = $2, updated_at = now()
      where id = $1::uuid and stripe_checkout_session_id is null
    `,
    [paymentTransactionId, stripeCheckoutSessionId],
  );
}

export async function markPaymentSucceeded(paymentTransactionId: string) {
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
      display_name: string;
      profile_email: string;
    }>(
      `
        select
          id::text,
          event_id::text,
          profile_id::text,
          status::text,
          amount_cents,
          currency::text as currency,
          (select title from events where id = payment_transactions.event_id) as event_title,
          (select slug from events where id = payment_transactions.event_id) as event_slug,
          (select display_name from profiles where id = payment_transactions.profile_id) as display_name,
          (select email::text from profiles where id = payment_transactions.profile_id) as profile_email
        from payment_transactions
        where id = $1::uuid
        for update
      `,
      [paymentTransactionId],
    );
    const payment = paymentResult.rows[0];
    if (!payment) {
      // Unknown txn id (foreign Stripe session / dev data) — exit cleanly.
      await client.query("rollback");
      return;
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

    // Always promote the seat idempotently — independent of the ledger flip —
    // so a row left 'pending_payment' by a ledger-only path still self-heals.
    const attendeeUpdate = await client.query(
      `
        update event_attendees
        set status = 'confirmed', hold_expires_at = null, updated_at = now()
        where event_id = $1::uuid and profile_id = $2::uuid and status <> 'confirmed'
      `,
      [payment.event_id, payment.profile_id],
    );
    const attendeeFlipped = (attendeeUpdate.rowCount ?? 0) > 0;

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
      // Fire-and-forget — failures inside logRsvpEmails warn-log and never
      // throw, so a template/email hiccup can't roll back the booking.
      void logRsvpEmails(pool, payment.event_id, payment.profile_id, {
        amountPaidCents: payment.amount_cents,
        currency: payment.currency,
      });

      // Plus the GST tax receipt for the charged amount. Fire-and-forget.
      void logPaymentReceiptEmail(pool, payment.id);

      // Paid RSVP can also be a proposal's suggested event — nudge the match.
      void notifyProposalPartnerOfRsvp(pool, payment.event_id, payment.profile_id);
    }
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
          from event_attendees own_attendee
          join events event on event.id = own_attendee.event_id
          left join event_attendees attendee_count on attendee_count.event_id = event.id
          left join event_tags event_tag on event_tag.event_id = event.id
          left join tags tag on tag.id = event_tag.tag_id
          where own_attendee.profile_id = $1::uuid
            and own_attendee.status in ('confirmed', 'waitlisted')
            and event.starts_at >= now()
          group by event.id
          order by event.starts_at asc
        `,
        [profile.id],
      ),
      pool.query<EventRow>(
        `
          select ${eventSelectColumns}
          from event_attendees own_attendee
          join events event on event.id = own_attendee.event_id
          left join event_attendees attendee_count on attendee_count.event_id = event.id
          left join event_tags event_tag on event_tag.event_id = event.id
          left join tags tag on tag.id = event_tag.tag_id
          where own_attendee.profile_id = $1::uuid
            and own_attendee.status in ('confirmed', 'waitlisted')
            and event.starts_at < now()
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
  interests: { slug: string; label: string }[];
  attendedCount: number;
  // Up to 5 extra photos (migration 042), public `avatars` bucket gallery/ prefix.
  galleryPhotos: string[];
  // Answered profile prompts with labels resolved from the curated catalogue.
  prompts: { id: string; label: string; answer: string }[];
  // The "tick" — true once an admin has stamped photo_verified_at.
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
        show_suburb: boolean;
        show_attendance_count: boolean;
        gallery_photos: string[];
        prompts: unknown;
        photo_verified_at: Date | null;
      }>(
        `
          select id::text, display_name, city, suburb, bio, photo_url, age,
                 connection_intents::text[] as connection_intents,
                 show_suburb, show_attendance_count,
                 gallery_photos, prompts, photo_verified_at
          from profiles
          where id = $1::uuid
        `,
        [profileId],
      ),
      pool.query<{ slug: string; label: string }>(
        `
          select tag.slug, tag.label
          from user_tags ut
          join tags tag on tag.id = ut.tag_id
          where ut.profile_id = $1::uuid
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
      interests: tagsResult.rows.map((t) => ({ slug: t.slug, label: t.label })),
      attendedCount: row.show_attendance_count
        ? Number(attendedResult.rows[0]?.count ?? 0)
        : 0,
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
  // and `music` rows are touched — quiz-sourced `life`/`vibe` tags are left
  // alone. Slugs must already exist in `tags`; unknown ones are dropped.
  interestTags?: string[];
  musicTags?: string[];
  // Discovery/privacy switches (migration 005). Undefined = leave unchanged.
  datingVisible?: boolean;
  flexibleDiscovery?: boolean;
  // Answered profile prompts (migration 042). When provided, the stored set is
  // fully replaced — pass `[]` to clear. Re-sanitised here so the invariants
  // (known ids, ≤3, answer length) hold no matter the caller.
  prompts?: ProfilePromptAnswer[];
};

// Replaces every `user_tags` row of one tag_type for a profile with the given
// curated slugs (matched against existing admin tags). Runs inside the caller's
// transaction client. Tags are "click tags" — unknown slugs are silently
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
  if (input.intents !== undefined && input.intents.length > 0) {
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

  // Nothing to do — bail before opening a connection.
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
// between `notifications` and `email_events` today — every wired trigger
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
  // just "nearest email in time" — otherwise a waitlist "Spot available" or
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
  intents: string[];
  // True when the viewer has already sent this person a (still-active) Click
  // that hasn't gone mutual yet. Lets the card show a persistent "Click sent —
  // waiting" state instead of resetting to "Click privately" on every reload.
  alreadyClicked: boolean;
};

export async function getSuggestedPeople(session: Session | null): Promise<SuggestedPerson[]> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!pool || !email) return [];

  try {
    const profile = await ensureProfileForSession(session);
    const result = await pool.query<{
      id: string;
      display_name: string;
      suburb: string | null;
      photo_url: string | null;
      age: number | null;
      shared: string[];
      intents: string[];
      already_clicked: boolean;
    }>(
      `
        select p.id::text, p.display_name, p.suburb, p.photo_url, p.age,
               coalesce(
                 array_agg(distinct shared_tag.label)
                   filter (where shared_tag.label is not null),
                 '{}'
               ) as shared,
               p.connection_intents::text[] as intents,
               exists (
                 select 1 from user_clicks uc
                 where uc.clicker_profile_id = $1::uuid
                   and uc.clicked_profile_id = p.id
                   and uc.expires_at > now()
               ) as already_clicked
        from profiles p
        left join user_tags shared_user_tag on shared_user_tag.profile_id = p.id
        left join tags shared_tag on shared_tag.id = shared_user_tag.tag_id
          and shared_tag.id in (
            select tag_id from user_tags where profile_id = $1::uuid
          )
        where p.id <> $1::uuid
          and p.role = 'attendee'
          and p.suspended_at is null
          -- Only surface people who've actually set up an attendee profile.
          -- Merchant accounts (and half-finished signups) shouldn't appear in
          -- "click with someone" until they've completed a real profile.
          and p.suburb is not null
          and p.bio is not null
          and not exists (
            select 1 from user_blocks b
            where (b.blocker_profile_id = $1::uuid and b.blocked_profile_id = p.id)
               or (b.blocker_profile_id = p.id and b.blocked_profile_id = $1::uuid)
          )
        group by p.id
        order by array_length(
          coalesce(
            array_agg(distinct shared_tag.label) filter (where shared_tag.label is not null),
            '{}'
          ), 1
        ) desc nulls last
        limit 24
      `,
      [profile.id],
    );

    let rows = result.rows;

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

    return rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      suburb: row.suburb,
      photoUrl: row.photo_url,
      age: row.age,
      sharedInterests: row.shared ?? [],
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
  // True when the surfaced suggestion was last proposed by the OTHER person
  // (they picked an alternative in /proposals) — lets the UI attribute it as
  // "Janey suggested:" instead of the generic "Suggested for you both:".
  suggestedByOther: boolean;
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
      proposed_by: string | null;
      created_at: Date;
    }>(
      `
        select
          case when m.profile_a_id = $1::uuid then m.profile_b_id::text else m.profile_a_id::text end as other_id,
          other.display_name as other_name,
          other.photo_url as other_photo,
          event.slug as event_slug,
          event.title as event_title,
          p.proposed_by::text as proposed_by,
          m.created_at
        from mutual_clicks m
        join profiles other on other.id = (
          case when m.profile_a_id = $1::uuid then m.profile_b_id else m.profile_a_id end
        )
        -- The live proposal (one per mutual click) holds the CURRENT suggestion,
        -- which either side can replace via "suggest alternative" in /proposals.
        left join event_proposals p on p.mutual_click_id = m.id
        -- Prefer the proposal's event (reflects an alternative someone picked);
        -- fall back to the mutual click's original auto-suggestion. Only surface
        -- it if it's still a bookable future event, otherwise resolve to null so
        -- the UI shows the proposal CTA instead of a dead, in-the-past event.
        left join events event
          on event.id = coalesce(p.suggested_event_id, m.suggested_event_id)
         and event.starts_at > now()
         and event.status in ('live', 'featured', 'waitlist')
        where m.profile_a_id = $1::uuid or m.profile_b_id = $1::uuid
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
      suggestedByOther: row.proposed_by != null && row.proposed_by === row.other_id,
      createdAt: row.created_at.toISOString(),
    }));
  } catch {
    return [];
  }
}

// Conversation / messaging helpers were removed when /messages was retired —
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

  await pool.query(
    `
      insert into user_blocks (blocker_profile_id, blocked_profile_id)
      values ($1::uuid, $2::uuid)
      on conflict do nothing
    `,
    [profile.id, targetProfileId],
  );

  // A block severs any pending Click in either direction so neither resurfaces.
  await pool.query(
    `
      delete from user_clicks
      where (clicker_profile_id = $1::uuid and clicked_profile_id = $2::uuid)
         or (clicker_profile_id = $2::uuid and clicked_profile_id = $1::uuid)
    `,
    [profile.id, targetProfileId],
  );
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

  void logEmailEvent({
    template: "report-received-admin",
    toEmail: process.env.SAFETY_INBOX_EMAIL || "safety@click.local",
    vars: {
      reportId: reportId ?? "—",
      reason: input.reason,
      details: input.details?.slice(0, 500) ?? "(none)",
      reporterName: profile.display_name,
    },
  });

  return { id: reportId };
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
  suburb: string | null;
  alreadyClicked: boolean;
};

export type PostEventClickPrompt = {
  eventSlug: string;
  eventTitle: string;
  endedAt: string;
  coAttendees: PostEventCoAttendee[];
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
      other_suburb: string | null;
      already_clicked: boolean;
    }>(
      `
        select
          e.slug as event_slug,
          e.title as event_title,
          coalesce(e.ends_at, e.starts_at) as ended_at,
          other.id::text as other_id,
          other.display_name as other_name,
          other.suburb as other_suburb,
          exists (
            select 1 from user_clicks c
            where c.clicker_profile_id = $1::uuid and c.clicked_profile_id = other.id
          ) as already_clicked
        from events e
        join event_attendees mine on mine.event_id = e.id
          and mine.profile_id = $1::uuid and mine.status = 'confirmed'
        join event_attendees theirs on theirs.event_id = e.id
          and theirs.status = 'confirmed' and theirs.profile_id <> $1::uuid
        join profiles other on other.id = theirs.profile_id
          and other.role = 'attendee' and other.suspended_at is null
        where coalesce(e.ends_at, e.starts_at) + interval '12 hours' <= now()
          and coalesce(e.ends_at, e.starts_at) >= now() - interval '14 days'
          and not exists (
            select 1 from user_blocks b
            where (b.blocker_profile_id = $1::uuid and b.blocked_profile_id = other.id)
               or (b.blocker_profile_id = other.id and b.blocked_profile_id = $1::uuid)
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
        };
        byEvent.set(row.event_slug, entry);
      }
      entry.coAttendees.push({
        id: row.other_id,
        displayName: row.other_name,
        suburb: row.other_suburb,
        alreadyClicked: row.already_clicked,
      });
    }
    return Array.from(byEvent.values());
  } catch {
    return [];
  }
}

// Post-event click prompt for ONE event, shown on the event detail page once it
// has ended (looser window than the dashboard rail: any time after the event
// ends, up to 30 days). Returns null when the viewer didn't attend, the event
// hasn't ended, or there are no clickable co-attendees.
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
      other_suburb: string | null;
      already_clicked: boolean;
    }>(
      `
        select
          e.slug as event_slug,
          e.title as event_title,
          coalesce(e.ends_at, e.starts_at) as ended_at,
          other.id::text as other_id,
          other.display_name as other_name,
          other.suburb as other_suburb,
          exists (
            select 1 from user_clicks c
            where c.clicker_profile_id = $1::uuid and c.clicked_profile_id = other.id
          ) as already_clicked
        from events e
        join event_attendees mine on mine.event_id = e.id
          and mine.profile_id = $1::uuid and mine.status = 'confirmed'
        join event_attendees theirs on theirs.event_id = e.id
          and theirs.status = 'confirmed' and theirs.profile_id <> $1::uuid
        join profiles other on other.id = theirs.profile_id
          and other.role = 'attendee' and other.suspended_at is null
        where e.slug = $2
          and coalesce(e.ends_at, e.starts_at) <= now()
          and coalesce(e.ends_at, e.starts_at) >= now() - interval '30 days'
          and not exists (
            select 1 from user_blocks b
            where (b.blocker_profile_id = $1::uuid and b.blocked_profile_id = other.id)
               or (b.blocker_profile_id = other.id and b.blocked_profile_id = $1::uuid)
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
      coAttendees: result.rows.map((row) => ({
        id: row.other_id,
        displayName: row.other_name,
        suburb: row.other_suburb,
        alreadyClicked: row.already_clicked,
      })),
    };
  } catch {
    return null;
  }
}

// Push the post-event "did you click with anyone?" prompt as a notification,
// once per (attendee, event), for events that have crossed the 12-hour Click
// window in the last 7 days and where the attendee still has un-clicked
// co-attendees. Idempotent: the action_url marker doubles as the dedupe key, so
// running the cron every few minutes never double-notifies. Returns the count
// of notifications created. (Bug board #85 — the pull-based card already exists
// on the dashboard + event page; this is the missing push.)
export async function notifyPostEventClickPrompts(): Promise<number> {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const result = await pool.query(
    `
      insert into notifications (profile_id, title, body, action_url)
      select
        mine.profile_id,
        'Did you click with anyone?',
        'You went to ' || e.title || '. Tap anyone you''d like to see again — it''s completely private.',
        '/events/' || e.slug || '?from=post-event-click'
      from events e
      join event_attendees mine on mine.event_id = e.id and mine.status = 'confirmed'
      where coalesce(e.ends_at, e.starts_at) + interval '12 hours' <= now()
        and coalesce(e.ends_at, e.starts_at) >= now() - interval '7 days'
        and exists (
          select 1
          from event_attendees theirs
          join profiles other on other.id = theirs.profile_id
            and other.role = 'attendee' and other.suspended_at is null
          where theirs.event_id = e.id
            and theirs.status = 'confirmed'
            and theirs.profile_id <> mine.profile_id
            and not exists (
              select 1 from user_clicks c
              where c.clicker_profile_id = mine.profile_id
                and c.clicked_profile_id = other.id
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
  alternativesRemaining: number;
  expiresAt: string;
  confirmedAt: string | null;
};

export async function getProposalsForSession(session: Session | null): Promise<ProposalEntry[]> {
  const pool = getPostgresPool();
  if (!getSessionEmail(session) || !pool) return [];

  try {
    const profile = await ensureProfileForSession(session);
    const result = await pool.query<{
      id: string;
      status: "pending" | "confirmed" | "expired";
      expired: boolean;
      other_id: string;
      other_name: string;
      event_slug: string | null;
      event_title: string | null;
      event_starts_at: Date | null;
      alternatives_count: number;
      expires_at: Date;
      confirmed_at: Date | null;
    }>(
      `
        select
          p.id::text,
          p.status,
          (p.status = 'pending' and p.expires_at <= now()) as expired,
          case when m.profile_a_id = $1::uuid then m.profile_b_id::text else m.profile_a_id::text end as other_id,
          other.display_name as other_name,
          e.slug as event_slug,
          e.title as event_title,
          e.starts_at as event_starts_at,
          p.alternatives_count,
          p.expires_at,
          p.confirmed_at
        from event_proposals p
        join mutual_clicks m on m.id = p.mutual_click_id
        join profiles other on other.id = (
          case when m.profile_a_id = $1::uuid then m.profile_b_id else m.profile_a_id end
        )
        -- Only attach the suggested event if it's still upcoming + bookable, so a
        -- proposal never surfaces an event that has already happened OR has since
        -- sold out (confirmed RSVPs + live payment holds at/above capacity). A
        -- booked-out event drops to null here and the card shows "find another
        -- plan" instead of pointing both people at an event they can't join.
        left join events e
          on e.id = p.suggested_event_id
         and e.starts_at > now()
         and e.status in ('live', 'featured', 'waitlist')
         and (
           select count(*) from event_attendees seat
           where seat.event_id = e.id
             and (
               seat.status = 'confirmed'
               or (seat.status = 'pending_payment' and seat.hold_expires_at > now())
             )
         ) < e.capacity
        where m.profile_a_id = $1::uuid or m.profile_b_id = $1::uuid
        order by (p.status = 'pending' and p.expires_at > now()) desc, p.updated_at desc
        limit 50
      `,
      [profile.id],
    );

    return result.rows.map((row) => ({
      id: row.id,
      status: row.status,
      isExpired: Boolean(row.expired),
      otherId: row.other_id,
      otherName: row.other_name,
      suggestedEventSlug: row.event_slug,
      suggestedEventTitle: row.event_title,
      suggestedEventStartsAt: row.event_starts_at ? row.event_starts_at.toISOString() : null,
      alternativesRemaining: Math.max(0, 3 - row.alternatives_count),
      expiresAt: row.expires_at.toISOString(),
      confirmedAt: row.confirmed_at ? row.confirmed_at.toISOString() : null,
    }));
  } catch {
    return [];
  }
}

// Verifies the session profile participates in the proposal's mutual click.
// Returns { proposalId, otherId } or throws.
async function assertProposalParticipant(
  client: import("pg").PoolClient,
  proposalId: string,
  profileId: string,
) {
  const result = await client.query<{ other_id: string; status: string; expires_at: Date }>(
    `
      select
        case when m.profile_a_id = $2::uuid then m.profile_b_id::text else m.profile_a_id::text end as other_id,
        p.status::text,
        p.expires_at
      from event_proposals p
      join mutual_clicks m on m.id = p.mutual_click_id
      where p.id = $1::uuid
        and (m.profile_a_id = $2::uuid or m.profile_b_id = $2::uuid)
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
        `update event_proposals set status = 'expired', updated_at = now() where id = $1::uuid`,
        [proposalId],
      );
      await client.query("commit");
      throw validationError("This proposal has expired.");
    }

    await client.query(
      `
        update event_proposals
        set status = 'confirmed', confirmed_by = $2::uuid, confirmed_at = now(), updated_at = now()
        where id = $1::uuid and status = 'pending'
      `,
      [proposalId, profile.id],
    );

    await client.query(
      `
        insert into notifications (profile_id, title, body, action_url)
        select $1::uuid, 'Plan confirmed', $2, '/proposals'
        where not exists (
          select 1 from user_mutes
          where muter_profile_id = $1::uuid and muted_profile_id = $3::uuid
        )
      `,
      [row.other_id, `${profile.display_name} confirmed your shared plan.`, profile.id],
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
    if (row.status !== "pending") {
      await client.query("rollback");
      throw validationError("This plan is already settled.");
    }

    const countResult = await client.query<{ alternatives_count: number }>(
      `select alternatives_count from event_proposals where id = $1::uuid for update`,
      [proposalId],
    );
    if ((countResult.rows[0]?.alternatives_count ?? 0) >= 3) {
      await client.query("rollback");
      throw validationError("You've reached the limit of 3 alternative suggestions.");
    }

    // Alternative must be a real, bookable upcoming event from the catalogue —
    // no free text is ever accepted.
    const eventResult = await client.query<{ id: string; title: string }>(
      `
        select id::text, title from events
        where slug = $1 and status in ('live', 'featured', 'waitlist') and starts_at > now()
        limit 1
      `,
      [eventSlug],
    );
    const event = eventResult.rows[0];
    if (!event) {
      await client.query("rollback");
      throw validationError("Pick an upcoming event from the catalogue.");
    }

    await client.query(
      `
        update event_proposals
        set suggested_event_id = $2::uuid, proposed_by = $3::uuid,
            alternatives_count = alternatives_count + 1, updated_at = now()
        where id = $1::uuid
      `,
      [proposalId, event.id, profile.id],
    );

    await client.query(
      `
        insert into notifications (profile_id, title, body, action_url)
        select $1::uuid, 'New plan suggested', $2, '/proposals'
        where not exists (
          select 1 from user_mutes
          where muter_profile_id = $1::uuid and muted_profile_id = $3::uuid
        )
      `,
      [row.other_id, `${profile.display_name} suggested ${event.title}.`, profile.id],
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
        where event.status in ('live', 'featured', 'waitlist')
          and event.starts_at > now()
          -- Don't offer a sold-out event as an alternative plan (confirmed RSVPs
          -- + live payment holds must be below capacity).
          and (
            select count(*) from event_attendees seat
            where seat.event_id = event.id
              and (
                seat.status = 'confirmed'
                or (seat.status = 'pending_payment' and seat.hold_expires_at > now())
              )
          ) < event.capacity
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

export async function saveLifeQuizTags(
  session: Session | null,
  tagSlugs: string[],
) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const email = getSessionEmail(session);
  if (!email) throw authError();
  if (tagSlugs.length === 0) return;

  const profile = await ensureProfileForSession(session);

  // The Life Quiz defines its own taxonomy (life-stage / availability /
  // event-style / energy). Historically those slugs were NOT seeded into
  // `tags`, so the old "link by existing slug" insert matched nothing and the
  // quiz never registered as completed. Create any missing slugs first (as
  // 'life' tags, label titleised from the slug), then link — so every answer
  // persists and `lifeQuizCompleted` flips true. Two statements because a
  // data-modifying CTE's inserts aren't visible to a SELECT in the same query.
  await pool.query(
    `
      insert into tags (label, slug, tag_type, admin_managed)
      select initcap(replace(slug, '-', ' ')), slug, 'life', false
      from unnest($1::text[]) as slug
      on conflict (slug) do nothing
    `,
    [tagSlugs],
  );
  await pool.query(
    `
      insert into user_tags (profile_id, tag_id, source)
      select $1::uuid, t.id, 'quiz'
      from tags t
      where t.slug = any($2::text[])
      on conflict (profile_id, tag_id) do update set source = 'quiz'
    `,
    [profile.id, tagSlugs],
  );
}

export type MerchantAllAttendeesRow = {
  attendeeId: string;
  eventSlug: string;
  eventTitle: string;
  eventStartsAt: string;
  displayName: string;
  email: string;
  status: string;
  rsvpAt: string;
  checkedInAt: string | null;
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
      display_name: string;
      email: string;
      status: string;
      rsvp_at: Date;
      checked_in_at: Date | null;
    }>(
      `
        select
          attendee.id::text as attendee_id,
          event.slug as event_slug,
          event.title as event_title,
          event.starts_at as event_starts_at,
          guest.display_name,
          guest.email::text as email,
          attendee.status::text,
          attendee.created_at as rsvp_at,
          attendee.checked_in_at
        from event_attendees attendee
        join events event on event.id = attendee.event_id
        join profiles guest on guest.id = attendee.profile_id
        where event.merchant_profile_id = $1::uuid
        order by event.starts_at desc, attendee.created_at desc
        limit 500
      `,
      [merchant.id],
    );

    return result.rows.map((row) => ({
      attendeeId: row.attendee_id,
      eventSlug: row.event_slug,
      eventTitle: row.event_title,
      eventStartsAt: row.event_starts_at.toISOString(),
      displayName: row.display_name,
      email: row.email,
      status: row.status,
      rsvpAt: row.rsvp_at.toISOString(),
      checkedInAt: row.checked_in_at ? row.checked_in_at.toISOString() : null,
    }));
  } catch {
    return [];
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

export type MerchantFinancesSummary = {
  totalRevenueCents: number;
  paidRevenueCents: number;
  pendingRevenueCents: number;
  refundedRevenueCents: number;
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
    totalRevenueCents: 0,
    paidRevenueCents: 0,
    pendingRevenueCents: 0,
    refundedRevenueCents: 0,
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
        total: string;
        paid: string;
        pending: string;
        refunded: string;
      }>(
        `
          select
            coalesce(sum(amount_cents), 0)::text as total,
            coalesce(sum(amount_cents) filter (where status = 'paid'), 0)::text as paid,
            coalesce(sum(amount_cents) filter (where status = 'pending'), 0)::text as pending,
            coalesce(sum(amount_cents) filter (where status = 'refunded'), 0)::text as refunded
          from payment_transactions
          where merchant_profile_id = $1::uuid
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
      totalRevenueCents: Number(row?.total ?? 0),
      paidRevenueCents: Number(row?.paid ?? 0),
      pendingRevenueCents: Number(row?.pending ?? 0),
      refundedRevenueCents: Number(row?.refunded ?? 0),
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
  } catch {
    return empty;
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
  // a strict Sydney calendar month — acceptable for a monthly summary.
  const start = new Date(Date.UTC(opts.year, opts.month - 1, 1));
  const end = new Date(Date.UTC(opts.year, opts.month, 1));
  const monthLabel = new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(new Date(Date.UTC(opts.year, opts.month - 1, 15, 12)));
  const formatAud = (cents: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(cents / 100);
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
          supportEmail: "hello@click.app",
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

// Stamp/clear the verification tick (profiles.photo_verified_at). Verified
// members get a "✓" next to their name on profile surfaces; only admins can
// grant it (manual review for now — an automated selfie check can land later
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
  bookingFeeBps: number;
  marketingBanner: string;
  matchingWeights: MatchingWeights;
  // Matching v2 kill-switch. When false (default) the people + discovery surfaces
  // rank with the v1 engine; when true they re-rank with the cohort-aware v2
  // model (src/lib/matching/). Flip from /algo. See 04_MATCHING_ALGORITHM_V2.md.
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
  const fallback: SystemSettings = {
    maintenanceMode: false,
    commissionRateBps: 290,
    bookingFeeBps: 0,
    marketingBanner: "",
    matchingWeights: DEFAULT_MATCHING_WEIGHTS,
    matchingV2Enabled: true,
  };

  const pool = getPostgresPool();
  if (!pool) return fallback;

  try {
    const result = await pool.query<{ key: string; value: unknown }>(
      `select key, value from system_settings`,
    );
    const map = new Map(result.rows.map((row) => [row.key, row.value]));
    return {
      maintenanceMode: Boolean(map.get("maintenance_mode")),
      commissionRateBps: Number(map.get("commission_rate_bps") ?? 290),
      bookingFeeBps: Number(map.get("booking_fee_bps") ?? 0),
      marketingBanner: String(map.get("marketing_banner") ?? "").trim(),
      matchingWeights: parseMatchingWeights(map.get("matching_weights")),
      // v2 is the default engine. Only an explicit `false` row (set by the /algo
      // toggle) reverts to v1; absence of the row means v2.
      matchingV2Enabled: map.has("matching_v2_enabled")
        ? Boolean(map.get("matching_v2_enabled"))
        : true,
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
// Matching v2 — Stage 6: cold-start curation + training/eval surface.
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

// Eval snapshot (spec §7.1) + training readiness (spec §4.3). Read-only; the
// /admin layout already gates admin access.
export async function getMatchingLabStats(): Promise<MatchingLabStats | null> {
  const pool = getPostgresPool();
  if (!pool) return null;

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
        (select count(*) from user_clicks)::int as clicks_made,
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
  // visibility — gated so we never out someone who keeps dating private.
  datingMinded: boolean;
};

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
            -- #161/#162: a pending_payment hold — e.g. a failed/abandoned
            -- checkout — must never display a person as "attending"). Live
            -- holds still occupy seats for capacity math elsewhere; they just
            -- don't appear in the who's-going list or its count.
            and attendee.status = 'confirmed'
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

export async function markPaymentFailed(paymentTransactionId: string) {
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
        returning id::text, event_id::text, profile_id::text
      `,
      [paymentTransactionId],
    );
    const payment = paymentResult.rows[0];
    if (!payment) {
      await client.query("rollback");
      return;
    }

    // Free the held seat. Only cancel rows that are still in the hold state —
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
// /admin/transactions — list + detail
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
