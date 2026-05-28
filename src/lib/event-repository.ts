import type { Session } from "next-auth";
import { mkdir, readFile, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import {
  normalizeAbn,
  normalizeAcn,
  validateOptionalAbn,
  validateOptionalAcn,
  validateRequiredAbn,
} from "./abn";
import { clickEvents, type EventItem, type EventStatus } from "./click-data";
import { buildEventMediaGallery, type MediaItem } from "./event-media";
import { sendTransactionalEmail } from "./email";
import { regionForEvent, type Region } from "./geo";
import { getPostgresPool } from "./postgres";
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
  businessType: "sole_trader" | "company" | "partnership" | "trust";
  eventCategoryIds: string[];
  contactEmail: string;
  phone: string;
  websiteUrl: string;
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
};

export type ProfileStatus = {
  exists: boolean;
  role: "attendee" | "merchant" | "admin";
  onboardingComplete: boolean;
  merchantProfile: MerchantProfileRow | null;
  bookmarkedEventIds: string[];
  registeredEventIds: string[];
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
  locationName: string;
  suburb: string;
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
  region: Region;
  suburb: string | null;
  locationName: string | null;
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

export type AdminMerchantRow = {
  id: string;
  businessName: string;
  contactEmail: string;
  verificationStatus: "pending" | "approved" | "rejected" | string;
  websiteUrl: string | null;
  abn: string | null;
  ownerName: string;
  ownerEmail: string;
  eventsHosted: number;
  createdAt: string;
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
    location: row.location_name,
    suburb: row.suburb,
    distanceKm: distanceKmFromSydney(lat, lng),
    lat,
    lng,
    price: formatPrice(row.price_cents),
    attendees: Number(row.confirmed_attendees),
    capacity: row.capacity,
    image: row.image_url ?? "/media/open-yoga.jpg",
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

function getSessionEmail(session: Session | null) {
  return session?.user?.email?.trim().toLowerCase() ?? "";
}

function getSessionName(session: Session | null) {
  return session?.user?.name?.trim() || getSessionEmail(session) || "Click member";
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
  const startsAt = new Date(input.startsAt);
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

async function getFallbackAdminEvents(): Promise<AdminEventRow[]> {
  const events = await getFallbackEvents({ includePending: true });

  return events.map((event) => ({
    id: event.id,
    title: event.title,
    category: event.category,
    status: event.status,
    booking: event.booking,
    host: event.host,
    attendees: event.attendees,
    capacity: event.capacity,
    startsAt: event.startsAt,
    region: regionForEvent({ lat: event.lat ?? null, lng: event.lng ?? null, suburb: event.suburb ?? null }),
    suburb: event.suburb ?? null,
    locationName: event.location ?? null,
  }));
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

async function ensureProfileForSession(session: Session | null) {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const displayName = getSessionName(session);
  const initialRole: ProfileRow["role"] = isConfiguredAdminEmail(email) ? "admin" : "attendee";

  const result = await pool.query<ProfileRow>(
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
      returning id::text, role::text as role, email::text, display_name
    `,
    [`auth:${email}`, initialRole, email, displayName],
  );

  return result.rows[0];
}

async function getMerchantProfile(pool: ReturnType<typeof getPostgresPool>, profileId: string) {
  if (!pool) return null;
  const result = await pool.query<MerchantProfileRow>(
    `
      select id::text, business_name, contact_email::text, verification_status
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
  status: "confirmed" | "waitlisted" | "cancelled" | "refunded";
  rsvpAt: string;
};

export type MerchantEventDetail = MerchantEventSummary & {
  description: string;
  attendees: MerchantAttendeeRow[];
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
        count(attendee.id) filter (where attendee.status in ('confirmed', 'pending_payment')) as confirmed,
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
    capacity: number;
    price_cents: number;
    category: string;
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
        event.capacity,
        event.price_cents,
        event.category,
        count(attendee.id) filter (where attendee.status in ('confirmed', 'pending_payment')) as confirmed,
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
    status: string;
    created_at: Date;
  }>(
    `
      select
        attendee.id::text as attendee_id,
        attendee_profile.display_name,
        attendee_profile.email::text as email,
        attendee.status::text,
        attendee.created_at
      from event_attendees attendee
      join profiles attendee_profile on attendee_profile.id = attendee.profile_id
      where attendee.event_id = $1::uuid
        and attendee.status in ('confirmed', 'waitlisted')
      order by
        case attendee.status when 'confirmed' then 0 else 1 end,
        attendee.created_at asc
    `,
    [row.id],
  );

  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
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
    attendees: attendeeResult.rows.map((entry) => ({
      attendeeId: entry.attendee_id,
      displayName: entry.display_name,
      email: entry.email,
      status: entry.status as MerchantAttendeeRow["status"],
      rsvpAt: entry.created_at.toISOString(),
    })),
  };
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
        count(distinct attendee.id) filter (where attendee.status in ('confirmed', 'pending_payment')) as confirmed_attendees,
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
      where event.status in ('live', 'featured', 'locked', 'waitlist')
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
        select category, count(*)::int as event_count
        from events
        where status in ('live', 'featured', 'locked', 'waitlist')
        group by category
      ) event_counts on event_counts.category = category.name
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
  endsAt: string | null;
  viewerRsvpStatus: "confirmed" | "waitlisted" | "pending_payment" | "cancelled" | null;
  media: MediaItem[];
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
      endsAt: null,
      viewerRsvpStatus: null,
      media: buildEventMediaGallery({
        slug,
        primaryImage: fallback.image,
        primaryAlt: fallback.imageAlt,
      }),
    };
  }

  try {
    const result = await pool.query<EventRow & { price_cents: number; address: string | null; ends_at: Date | null }>(
      `
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
          event.address,
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
          count(distinct attendee.id) filter (where attendee.status in ('confirmed', 'pending_payment')) as confirmed_attendees,
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
        endsAt: null,
        viewerRsvpStatus: null,
        media: buildEventMediaGallery({
          slug,
          primaryImage: fallback.image,
          primaryAlt: fallback.imageAlt,
        }),
      };
    }

    const base = eventFromRow(row);
    let viewerRsvpStatus: EventDetail["viewerRsvpStatus"] = null;
    const email = getSessionEmail(session);

    if (email) {
      const rsvpResult = await pool.query<{ status: string }>(
        `
          select attendee.status::text
          from event_attendees attendee
          join profiles profile on profile.id = attendee.profile_id
          join events event on event.id = attendee.event_id
          where profile.email = $1 and event.slug = $2
          limit 1
        `,
        [email, slug],
      );
      const status = rsvpResult.rows[0]?.status;
      if (
        status === "confirmed" ||
        status === "waitlisted" ||
        status === "pending_payment" ||
        status === "cancelled"
      ) {
        viewerRsvpStatus = status;
      }
    }

    return {
      ...base,
      priceCents: row.price_cents,
      address: row.address,
      endsAt: row.ends_at ? row.ends_at.toISOString() : null,
      viewerRsvpStatus,
      media: buildEventMediaGallery({
        slug,
        primaryImage: base.image,
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
        endsAt: null,
        viewerRsvpStatus: null,
        media: buildEventMediaGallery({
          slug,
          primaryImage: fallback.image,
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
                and attendee.status in ('confirmed', 'pending_payment')
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
    const title = input.title.trim();
    const description = input.description.trim();
    const startsAt = new Date(input.startsAt);
    const capacity = Math.max(input.capacity, 1);

    if (!title || !description || Number.isNaN(startsAt.getTime())) {
      const error = new Error("Title, description, and valid start date are required.");
      error.name = "ValidationError";
      throw error;
    }

    const slug = `${slugFromTitle(title)}-${Date.now().toString(36)}`;
    const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
    const category = input.category.trim() || "Social";
    const relationshipGoal =
      input.relationshipGoal.trim() || "Help people meet through a shared plan.";

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
          image_alt,
          relationship_goal,
          fomo
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
          'pending',
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
          $20
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
        parsePriceCents(input.price),
        capacity,
        input.imageUrl?.trim() || imageForCategory(category),
        input.imageAlt?.trim() || "Community event listing",
        relationshipGoal,
        "Pending admin review before being promoted to members.",
      ],
    );

    const rawTags = input.tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);

    if (rawTags.length > 0) {
      await pool.query(
        `
          with target_event as (
            select id from events where slug = $1
          ),
          inserted_tags as (
            insert into tags (label, slug, tag_type, admin_managed)
            select initcap(tag), regexp_replace(tag, '[^a-z0-9]+', '-', 'g'), 'interest', false
            from unnest($2::text[]) as tag
            on conflict (slug) do update set label = excluded.label
            returning id
          )
          insert into event_tags (event_id, tag_id)
          select target_event.id, inserted_tags.id
          from target_event, inserted_tags
          on conflict do nothing
        `,
        [slug, rawTags],
      );
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

    const result = await pool.query<{ slug: string; title: string }>(
      `
        update events
        set status = 'live', updated_at = now()
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

    return event;
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      return approveLocalEventForAdmin(eventId, session);
    }

    throw error;
  }
}

export async function updateMerchantVerificationForAdmin(
  merchantId: string,
  status: "pending" | "approved" | "rejected",
  session: Session | null,
) {
  const pool = getPostgresPool();

  if (!pool) throw databaseUnavailableError();

  const profile = await requireAdminProfile(session);
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
      set verification_status = $2, updated_at = now()
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
      status === "approved" ? "Merchant approved" : status === "rejected" ? "Merchant needs review" : "Merchant pending",
      status === "approved"
        ? `${merchant.business_name} is approved to host Click events.`
        : `${merchant.business_name} is now marked ${status}.`,
      "/merchant",
    ],
  );

  await sendWorkflowEmail({
    to: merchant.owner_email,
    subject:
      status === "approved"
        ? `${merchant.business_name} is approved on Click`
        : `${merchant.business_name} merchant status: ${status}`,
    text: [
      `Hi ${merchant.owner_name},`,
      status === "approved"
        ? `${merchant.business_name} is approved to create and manage events on Click.`
        : `${merchant.business_name} is now marked ${status}.`,
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/merchant`,
    ].join("\n\n"),
  });

  return {
    id: merchant.id,
    verificationStatus: merchant.verification_status,
  };
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
      confirmed_attendees: string;
      suburb: string | null;
      location_name: string | null;
      latitude: string | null;
      longitude: string | null;
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
        event.suburb,
        event.location_name,
        event.latitude::text,
        event.longitude::text,
        count(attendee.id) filter (where attendee.status in ('confirmed', 'pending_payment')) as confirmed_attendees
      from events event
      left join event_attendees attendee on attendee.event_id = event.id
      group by event.id
      order by event.created_at desc
      limit 200
    `);

    return result.rows.map((event): AdminEventRow => {
      const lat = event.latitude ? Number(event.latitude) : null;
      const lng = event.longitude ? Number(event.longitude) : null;
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
        region: regionForEvent({ lat, lng, suburb: event.suburb }),
        suburb: event.suburb,
        locationName: event.location_name,
      };
    });
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("Falling back to static admin events.", error);
    }

    return getFallbackAdminEvents();
  }
}

const fallbackAdminMembers: AdminMemberRow[] = [
  {
    id: "seed-maya",
    displayName: "Maya Chen",
    email: "maya@click.local",
    role: "attendee",
    suburb: "Barangaroo",
    intents: ["friendship", "exploring"],
    bookmarks: 4,
    registrations: 2,
    events: [
      { slug: "sunset-rooftop", title: "Sunset rooftop sketch jam" },
      { slug: "harbour-pottery", title: "Harbourside pottery hour" },
    ],
    emailVerified: true,
    photoVerified: true,
    joinedAt: "2025-08-12T03:18:00.000Z",
    suspendedAt: null,
    suspendedReason: null,
  },
  {
    id: "seed-leo",
    displayName: "Leo Park",
    email: "leo@click.local",
    role: "attendee",
    suburb: "Surry Hills",
    intents: ["dating", "friendship"],
    bookmarks: 7,
    registrations: 3,
    events: [
      { slug: "sunset-rooftop", title: "Sunset rooftop sketch jam" },
    ],
    emailVerified: true,
    photoVerified: false,
    joinedAt: "2025-09-04T12:02:00.000Z",
    suspendedAt: null,
    suspendedReason: null,
  },
  {
    id: "seed-anika",
    displayName: "Anika Bose",
    email: "anika@click.local",
    role: "attendee",
    suburb: "Newtown",
    intents: ["friendship", "networking"],
    bookmarks: 5,
    registrations: 4,
    events: [
      { slug: "harbour-pottery", title: "Harbourside pottery hour" },
    ],
    emailVerified: true,
    photoVerified: true,
    joinedAt: "2025-09-19T22:45:00.000Z",
    suspendedAt: null,
    suspendedReason: null,
  },
  {
    id: "seed-host-zara",
    displayName: "Zara Diallo",
    email: "zara@kindredkitchens.com",
    role: "merchant",
    suburb: "Redfern",
    intents: ["networking"],
    bookmarks: 1,
    registrations: 0,
    events: [],
    emailVerified: true,
    photoVerified: true,
    joinedAt: "2025-07-30T01:10:00.000Z",
    suspendedAt: null,
    suspendedReason: null,
  },
  {
    id: "seed-admin",
    displayName: "Click Admin",
    email: "admin@click.local",
    role: "admin",
    suburb: "CBD",
    intents: ["networking"],
    bookmarks: 0,
    registrations: 0,
    events: [],
    emailVerified: true,
    photoVerified: true,
    joinedAt: "2025-06-01T00:00:00.000Z",
    suspendedAt: null,
    suspendedReason: null,
  },
];

const fallbackAdminMerchants: AdminMerchantRow[] = [
  {
    id: "seed-kindred",
    businessName: "Kindred Kitchens",
    contactEmail: "zara@kindredkitchens.com",
    verificationStatus: "approved",
    websiteUrl: "https://kindredkitchens.com",
    abn: "51 824 753 556",
    ownerName: "Zara Diallo",
    ownerEmail: "zara@kindredkitchens.com",
    eventsHosted: 3,
    createdAt: "2025-07-30T01:10:00.000Z",
  },
  {
    id: "seed-yoga",
    businessName: "Open Air Yoga Co.",
    contactEmail: "hello@openairyoga.co",
    verificationStatus: "pending",
    websiteUrl: "https://openairyoga.co",
    abn: null,
    ownerName: "Priya Shah",
    ownerEmail: "priya@openairyoga.co",
    eventsHosted: 1,
    createdAt: "2026-04-22T00:00:00.000Z",
  },
];

function fallbackAdminTags(): AdminTagRow[] {
  return clickEvents
    .flatMap((event) =>
      event.tags.map((tag) => ({
        id: `seed-${tag}`,
        label: tag
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" "),
        slug: tag,
        tagType: "interest",
        categoryName: event.category,
        usageCount: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
      })),
    )
    .filter((tag, index, all) => all.findIndex((item) => item.slug === tag.slug) === index)
    .slice(0, 40);
}

const fallbackAdminAudit: AdminAuditRow[] = [
  {
    id: "log-1",
    action: "approve_event",
    entityTable: "events",
    actorName: "Click Admin",
    metadata: { title: "Sunset rooftop sketch jam", slug: "sunset-rooftop" },
    createdAt: "2026-05-12T08:14:00.000Z",
  },
  {
    id: "log-2",
    action: "verify_merchant",
    entityTable: "merchant_profiles",
    actorName: "Click Admin",
    metadata: { business: "Kindred Kitchens" },
    createdAt: "2026-05-09T01:42:00.000Z",
  },
  {
    id: "log-3",
    action: "archive_tag",
    entityTable: "tags",
    actorName: "Click Admin",
    metadata: { slug: "running-club-old" },
    createdAt: "2026-05-04T22:11:00.000Z",
  },
];

function fallbackAdminMetrics(eventCount: number, pendingCount: number): AdminMetrics {
  return {
    totalMembers: fallbackAdminMembers.length,
    newMembersThisWeek: 1,
    totalMerchants: fallbackAdminMerchants.length,
    pendingMerchants: fallbackAdminMerchants.filter((m) => m.verificationStatus === "pending").length,
    totalEvents: eventCount,
    pendingEvents: pendingCount,
    confirmedRsvps: fallbackAdminMembers.reduce((sum, m) => sum + m.registrations, 0),
    mutualClicks: 12,
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
        coalesce(count(distinct attendee.id) filter (where attendee.status in ('confirmed', 'waitlisted')), 0) as registrations,
        coalesce(
          jsonb_agg(distinct jsonb_build_object('slug', event.slug, 'title', event.title))
            filter (where attendee.status in ('confirmed', 'waitlisted') and event.id is not null),
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
        merchant.created_at
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
    }));
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("Falling back to static admin merchants.", error);
    }
    return fallbackAdminMerchants;
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
    }>(`
      select
        (select count(*) from profiles) as members,
        (select count(*) from events) as events,
        (select count(*) from merchant_profiles) as merchants,
        (select count(*) from tags) as tags,
        (select count(*) from audit_logs) as audit
    `);

    const row = result.rows[0];
    return {
      members: Number(row?.members ?? 0),
      events: Number(row?.events ?? 0),
      merchants: Number(row?.merchants ?? 0),
      tags: Number(row?.tags ?? 0),
      audit: Number(row?.audit ?? 0),
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
        count(distinct attendee_count.id) filter (where attendee_count.status in ('confirmed', 'pending_payment')) as confirmed_attendees,
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
    const upcomingEvents = clickEvents.slice(0, 2);

    return {
      userName,
      upcomingEvents,
      savedEvents: clickEvents.slice(2, 4),
      stats: {
        upcoming: upcomingEvents.length,
        saved: upcomingEvents.length,
        clicks: 0,
        radar: "Offline",
      },
    };
  }

  try {
    const profile = await ensureProfileForSession(session);

    const [upcomingResult, savedResult, clickResult] = await Promise.all([
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
    const savedEvents = savedResult.rows.map(eventFromRow);

    return {
      userName: profile.display_name,
      upcomingEvents,
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
      console.warn("Falling back to static dashboard data.", error);
    }

    const upcomingEvents = clickEvents.slice(0, 2);

    return {
      userName,
      upcomingEvents,
      savedEvents: clickEvents.slice(2, 4),
      stats: {
        upcoming: upcomingEvents.length,
        saved: upcomingEvents.length,
        clicks: 0,
        radar: "Offline",
      },
    };
  }
}

export async function getProfileStatus(session: Session | null): Promise<ProfileStatus> {
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
    };
  }

  try {
    const profile = await ensureProfileForSession(session);
    const [statusResult, bookmarksResult, registrationsResult, merchant] = await Promise.all([
      pool.query<{ suburb: string | null; bio: string | null }>(
        `select suburb, bio from profiles where id = $1::uuid`,
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
      pool.query<{ slug: string }>(
        `
          select event.slug
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
    const onboardingComplete = !!(row?.suburb && row?.bio);

    return {
      exists: true,
      role: profile.role,
      onboardingComplete,
      merchantProfile: merchant,
      bookmarkedEventIds: bookmarksResult.rows.map((entry) => entry.slug),
      registeredEventIds: registrationsResult.rows.map((entry) => entry.slug),
    };
  } catch {
    return {
      exists: !!email,
      role: "attendee",
      onboardingComplete: false,
      merchantProfile: null,
      bookmarkedEventIds: [],
      registeredEventIds: [],
    };
  }
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
    await pool.query(
      `
        with picked_tags as (
          insert into tags (label, slug, tag_type, admin_managed)
          select initcap(tag), regexp_replace(tag, '[^a-z0-9]+', '-', 'g'), 'interest', false
          from unnest($2::text[]) as tag
          on conflict (slug) do update set label = excluded.label
          returning id
        )
        insert into user_tags (profile_id, tag_id, source)
        select $1::uuid, picked_tags.id, 'user'
        from picked_tags
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
      returning id::text, business_name, contact_email::text, verification_status
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
const BUSINESS_TYPES = ["sole_trader", "company", "partnership", "trust"] as const;
const AU_POSTCODE_RE = /^[0-9]{4}$/;
// Accepts +61412345678, 0412345678, or with spacing — we strip to digits before checking.
const AU_PHONE_RE = /^(?:\+?61|0)\d{9}$/;

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
 */
export async function getMerchantCategoryOptions(): Promise<MerchantCategoryOption[]> {
  const pool = getPostgresPool();
  if (!pool) return [];
  const result = await pool.query<{ id: string; name: string; slug: string }>(
    `select id::text, name, slug from tag_categories order by name asc`,
  );
  return result.rows;
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

  const abnError = validateRequiredAbn(input.abn);
  if (abnError) throw validationError(abnError);
  const abn = normalizeAbn(input.abn);

  const acnError = validateOptionalAcn(input.acn);
  if (acnError) throw validationError(acnError);
  const acn = normalizeAcn(input.acn);

  if (!BUSINESS_TYPES.includes(input.businessType)) {
    throw validationError("Pick a business type.");
  }

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

  const categoryIds = Array.from(new Set(input.eventCategoryIds.filter(Boolean)));
  if (categoryIds.length === 0) {
    throw validationError("Pick at least one event category.");
  }

  const profile = await ensureProfileForSession(session);

  const client = await pool.connect();
  try {
    await client.query("begin");

    const upsert = await client.query<MerchantProfileRow>(
      `
        insert into merchant_profiles (
          profile_id, business_name, trading_name, abn, acn, business_type,
          phone, contact_email, website_url,
          address_street, address_suburb, address_state, address_postcode,
          submitted_at
        )
        values (
          $1::uuid, $2, nullif($3, ''), $4, nullif($5, ''), $6,
          $7, $8, nullif($9, ''),
          $10, $11, $12, $13,
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
          address_street = excluded.address_street,
          address_suburb = excluded.address_suburb,
          address_state = excluded.address_state,
          address_postcode = excluded.address_postcode,
          submitted_at = coalesce(merchant_profiles.submitted_at, now()),
          updated_at = now()
        returning id::text, business_name, contact_email::text, verification_status
      `,
      [
        profile.id,
        businessName,
        tradingName,
        abn,
        acn,
        input.businessType,
        phoneDigits,
        contactEmail,
        input.websiteUrl.trim(),
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

    // Verify required docs uploaded — ABN cert + insurance per spec §1 Step 3.
    const docCheck = await client.query<{ document_type: string }>(
      `select document_type from merchant_documents where profile_id = $1::uuid`,
      [profile.id],
    );
    const docTypes = new Set(docCheck.rows.map((r) => r.document_type));
    if (!docTypes.has("abn_certificate")) {
      throw validationError("Upload your ABN certificate before submitting.");
    }
    if (!docTypes.has("public_liability_insurance")) {
      throw validationError("Upload your public liability insurance before submitting.");
    }

    // Back-fill merchant_profile_id on any docs uploaded before this commit.
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
    }>(
      `
        select id::text, display_name
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

    const sourceEventResult = input.sourceEventId
      ? await client.query<{ id: string }>(
          `select id::text from events where slug = $1 limit 1`,
          [input.sourceEventId],
        )
      : null;
    const sourceEventId = sourceEventResult?.rows[0]?.id ?? null;

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
        const preferredResult = await client.query<{
          id: string;
          slug: string;
          title: string;
        }>(
          `
            select id::text, slug, title
            from events
            where id = $1::uuid
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
            left join event_tags event_tag on event_tag.event_id = event.id
            left join user_tags user_tag
              on user_tag.tag_id = event_tag.tag_id
             and user_tag.profile_id in ($1::uuid, $2::uuid)
            where event.status in ('live', 'featured', 'waitlist')
              and event.starts_at > now()
            group by event.id
            order by count(user_tag.tag_id) desc, event.starts_at asc
            limit 1
          `,
          [profile.id, clickedProfile.id],
        );
        suggestedEvent = suggestedResult.rows[0] ?? null;
      }

      await client.query(
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
        `,
        [profile.id, clickedProfile.id, suggestedEvent?.id ?? null],
      );

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

      await client.query(
        `
          insert into notifications (profile_id, title, body, action_url)
          values
            ($1::uuid, 'Mutual Click found', $3, $5),
            ($2::uuid, 'Mutual Click found', $4, $5)
        `,
        [
          profile.id,
          clickedProfile.id,
          suggestedEvent
            ? `You and ${clickedProfile.display_name} both clicked. Try ${suggestedEvent.title}.`
            : `You and ${clickedProfile.display_name} both clicked. Click will suggest an event soon.`,
          suggestedEvent
            ? `You and ${profile.display_name} both clicked. Try ${suggestedEvent.title}.`
            : `You and ${profile.display_name} both clicked. Click will suggest an event soon.`,
          suggestedEvent ? `/events/${suggestedEvent.slug}` : "/dashboard",
        ],
      );
    }

    await client.query("commit");

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

export async function cancelRegistration(eventId: string, session: Session | null) {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const client = await pool.connect();
  let promotion:
    | {
        email: string;
        displayName: string;
        eventTitle: string;
        eventSlug: string;
        offeredUntil: Date;
      }
    | null = null;

  try {
    await client.query("begin");

    const result = await client.query<{
      event_id: string;
      title: string;
      slug: string;
      previous_status: string;
    }>(
      `
        with target as (
          select
            attendee.id,
            attendee.event_id,
            attendee.status,
            event.title,
            event.slug
          from event_attendees attendee
          join events event on event.id = attendee.event_id
          where event.slug = $1
            and attendee.profile_id = $2::uuid
            and attendee.status in ('confirmed', 'waitlisted')
          for update of attendee
        )
        update event_attendees attendee
        set status = 'cancelled', updated_at = now()
        from target
        where attendee.id = target.id
        returning
          target.event_id::text,
          target.title,
          target.slug,
          target.status::text as previous_status
      `,
      [eventId, profile.id],
    );

    if (result.rows.length === 0) {
      const error = new Error("You are not currently registered for that event.");
      error.name = "NotFoundError";
      throw error;
    }

    const cancelled = result.rows[0];

    if (cancelled.previous_status === "waitlisted") {
      await client.query(
        `
          delete from event_waitlists
          where event_id = $1::uuid and profile_id = $2::uuid
        `,
        [cancelled.event_id, profile.id],
      );
    }

    if (cancelled.previous_status === "confirmed") {
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
          order by waitlist.created_at asc
          limit 1
          for update of waitlist skip locked
        `,
        [cancelled.event_id],
      );

      const nextInLine = waitlistResult.rows[0];
      if (nextInLine) {
        const offerResult = await client.query<{ offered_until: Date }>(
          `
            update event_waitlists
            set offered_until = now() + interval '15 minutes'
            where id = $1::uuid
            returning offered_until
          `,
          [nextInLine.waitlist_id],
        );

        const offeredUntil = offerResult.rows[0].offered_until;

        await client.query(
          `
            insert into notifications (profile_id, title, body, action_url)
            values ($1::uuid, $2, $3, $4)
          `,
          [
            nextInLine.profile_id,
            "Spot available",
            `A spot opened for ${cancelled.title}. Confirm within 15 minutes.`,
            `/events/${cancelled.slug}`,
          ],
        );

        promotion = {
          email: nextInLine.email,
          displayName: nextInLine.display_name,
          eventTitle: cancelled.title,
          eventSlug: cancelled.slug,
          offeredUntil,
        };
      }
    }

    await client.query("commit");

    if (promotion) {
      await sendWorkflowEmail({
        to: promotion.email,
        subject: `A spot opened for ${promotion.eventTitle}`,
        text: [
          `Hi ${promotion.displayName},`,
          `A spot opened for ${promotion.eventTitle}.`,
          `Your offer is held until ${promotion.offeredUntil.toLocaleString("en-AU", {
            timeZone: "Australia/Sydney",
          })}.`,
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/events/${promotion.eventSlug}`,
        ].join("\n\n"),
      });
    }

    return {
      eventTitle: result.rows[0].title,
      promotedWaitlist: !!promotion,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
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
    email: string;
    displayName: string;
  }[] = [];

  try {
    await client.query("begin");

    const eventResult = await client.query<{
      id: string;
      slug: string;
      title: string;
      status: string;
    }>(
      `
        select id::text, slug, title, status::text
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
      return { eventTitle: event.title, notified: 0, alreadyCancelled: true };
    }

    const attendeeResult = await client.query<{
      profile_id: string;
      display_name: string;
      email: string;
    }>(
      `
        select
          attendee.profile_id::text,
          attendee_profile.display_name,
          attendee_profile.email::text as email
        from event_attendees attendee
        join profiles attendee_profile on attendee_profile.id = attendee.profile_id
        where attendee.event_id = $1::uuid
          and attendee.status in ('confirmed', 'waitlisted', 'pending_payment')
      `,
      [event.id],
    );

    affectedProfiles = attendeeResult.rows.map((row) => ({
      email: row.email,
      displayName: row.display_name,
    }));

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

    await Promise.all(
      affectedProfiles.map((attendee) =>
        sendWorkflowEmail({
          to: attendee.email,
          subject: `${event.title} has been cancelled`,
          text: [
            `Hi ${attendee.displayName},`,
            `${event.title} has been cancelled by the host.`,
            "Any payment/refund handling will follow the merchant policy for this event.",
          ].join("\n\n"),
        }),
      ),
    );

    return {
      eventTitle: event.title,
      notified: affectedProfiles.length,
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
  priceCents: number;
  currency: string;
  profileEmail: string;
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
      confirmed_attendees: string;
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
          (
            select count(*)
            from event_attendees attendee
            where attendee.event_id = event.id
              and attendee.status in ('confirmed', 'pending_payment')
          ) as confirmed_attendees
        from events event
        where event.slug = $1
        for update of event
      `,
      [eventSlug],
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

    const paymentResult = await client.query<{ id: string }>(
      `
        insert into payment_transactions (event_id, profile_id, merchant_profile_id, amount_cents, currency, status)
        values ($1::uuid, $2::uuid, $3::uuid, $4, $5, 'pending')
        returning id::text
      `,
      [event.id, profile.id, event.merchant_profile_id, event.price_cents, event.currency],
    );
    const paymentTransactionId = paymentResult.rows[0].id;

    await client.query(
      `
        insert into event_attendees (event_id, profile_id, status, payment_transaction_id)
        values ($1::uuid, $2::uuid, 'pending_payment', $3::uuid)
        on conflict (event_id, profile_id) do update
        set status = 'pending_payment', payment_transaction_id = excluded.payment_transaction_id, updated_at = now()
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
      currency: event.currency,
      profileEmail: profile.email,
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

  await pool.query(
    `
      update payment_transactions
      set stripe_payment_intent_id = $2, updated_at = now()
      where id = $1::uuid
    `,
    [paymentTransactionId, stripePaymentIntentId],
  );
}

export async function markPaymentSucceeded(paymentTransactionId: string) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();

  const client = await pool.connect();
  try {
    await client.query("begin");

    const paymentResult = await client.query<{
      id: string;
      event_id: string;
      profile_id: string;
      status: string;
      event_title: string;
      event_slug: string;
      display_name: string;
      profile_email: string;
    }>(
      `
        update payment_transactions
        set status = 'paid', updated_at = now()
        where id = $1::uuid and status <> 'paid'
        returning
          id::text,
          event_id::text,
          profile_id::text,
          status::text,
          (select title from events where id = payment_transactions.event_id) as event_title,
          (select slug from events where id = payment_transactions.event_id) as event_slug,
          (select display_name from profiles where id = payment_transactions.profile_id) as display_name,
          (select email::text from profiles where id = payment_transactions.profile_id) as profile_email
      `,
      [paymentTransactionId],
    );
    const payment = paymentResult.rows[0];
    if (!payment) {
      // Already paid (webhook retry) — exit cleanly.
      await client.query("rollback");
      return;
    }

    await client.query(
      `
        update event_attendees
        set status = 'confirmed', updated_at = now()
        where event_id = $1::uuid and profile_id = $2::uuid
      `,
      [payment.event_id, payment.profile_id],
    );

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

    await client.query("commit");

    await sendWorkflowEmail({
      to: payment.profile_email,
      subject: `You are booked for ${payment.event_title}`,
      text: [
        `Hi ${payment.display_name},`,
        `Your payment is confirmed and your RSVP is booked for ${payment.event_title}.`,
        "You can view the event details from your Click dashboard.",
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/events/${payment.event_slug}`,
      ].join("\n\n"),
    });
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
};

export type OwnProfile = PublicProfile & {
  email: string;
  role: string;
};

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
      }>(
        `
          select id::text, display_name, email::text, role::text, city, suburb, bio, photo_url, age,
                 connection_intents::text[] as connection_intents
          from profiles
          where id = $1::uuid
        `,
        [profile.id],
      ),
      pool.query<{ slug: string; label: string }>(
        `
          select tag.slug, tag.label
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
      interests: tagsResult.rows.map((t) => ({ slug: t.slug, label: t.label })),
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
      }>(
        `
          select id::text, display_name, city, suburb, bio, photo_url, age,
                 connection_intents::text[] as connection_intents
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
      suburb: row.suburb,
      bio: row.bio,
      photoUrl: row.photo_url,
      age: row.age,
      intents: row.connection_intents ?? [],
      interests: tagsResult.rows.map((t) => ({ slug: t.slug, label: t.label })),
      attendedCount: Number(attendedResult.rows[0]?.count ?? 0),
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
};

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

  if (updates.length === 0) return;

  await pool.query(
    `update profiles set ${updates.join(", ")}, updated_at = now() where id = $1::uuid`,
    params,
  );
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

export async function getUnreadNotificationCount(session: Session | null): Promise<number> {
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

export type SuggestedPerson = {
  id: string;
  displayName: string;
  suburb: string | null;
  photoUrl: string | null;
  age: number | null;
  sharedInterests: string[];
  intents: string[];
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
    }>(
      `
        select p.id::text, p.display_name, p.suburb, p.photo_url, p.age,
               coalesce(
                 array_agg(distinct shared_tag.label)
                   filter (where shared_tag.label is not null),
                 '{}'
               ) as shared,
               p.connection_intents::text[] as intents
        from profiles p
        left join user_tags shared_user_tag on shared_user_tag.profile_id = p.id
        left join tags shared_tag on shared_tag.id = shared_user_tag.tag_id
          and shared_tag.id in (
            select tag_id from user_tags where profile_id = $1::uuid
          )
        where p.id <> $1::uuid
          and p.role = 'attendee'
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

    return result.rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      suburb: row.suburb,
      photoUrl: row.photo_url,
      age: row.age,
      sharedInterests: row.shared ?? [],
      intents: row.intents ?? [],
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
      created_at: Date;
    }>(
      `
        select
          case when m.profile_a_id = $1::uuid then m.profile_b_id::text else m.profile_a_id::text end as other_id,
          other.display_name as other_name,
          other.photo_url as other_photo,
          event.slug as event_slug,
          event.title as event_title,
          m.created_at
        from mutual_clicks m
        join profiles other on other.id = (
          case when m.profile_a_id = $1::uuid then m.profile_b_id else m.profile_a_id end
        )
        left join events event on event.id = m.suggested_event_id
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
      createdAt: row.created_at.toISOString(),
    }));
  } catch {
    return [];
  }
}

// Conversation / messaging helpers were removed when /messages was retired —
// the platform's no-chat principle is enforced by deleting the surface, not
// by hiding it. Mutual Click coordination uses the Proposal UI (no free text).

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
  };

  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!pool || !email) return empty;

  try {
    const profile = await ensureProfileForSession(session);
    const merchant = await getMerchantProfile(pool, profile.id);
    if (!merchant) return empty;

    const [aggResult, recentResult] = await Promise.all([
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
    };
  } catch {
    return empty;
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

export type SystemSettings = {
  maintenanceMode: boolean;
  commissionRateBps: number;
  marketingBanner: string;
};

export async function getSystemSettings(): Promise<SystemSettings> {
  const fallback: SystemSettings = {
    maintenanceMode: false,
    commissionRateBps: 290,
    marketingBanner: "",
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
      marketingBanner: String(map.get("marketing_banner") ?? "").trim(),
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
  if (typeof input.commissionRateBps === "number" && Number.isFinite(input.commissionRateBps)) {
    writes.push({
      key: "commission_rate_bps",
      value: JSON.stringify(Math.max(0, Math.min(5000, Math.round(input.commissionRateBps)))),
    });
  }
  if (typeof input.marketingBanner === "string") {
    writes.push({
      key: "marketing_banner",
      value: JSON.stringify(input.marketingBanner.slice(0, 200)),
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

export type EventAttendeePreviewRow = {
  profileId: string;
  displayName: string;
  photoUrl: string | null;
  suburb: string | null;
};

export async function getEventAttendeePreview(
  eventSlug: string,
  limit = 8,
): Promise<{ items: EventAttendeePreviewRow[]; totalConfirmed: number }> {
  const pool = getPostgresPool();
  if (!pool) return { items: [], totalConfirmed: 0 };

  try {
    const [previewResult, countResult] = await Promise.all([
      pool.query<{
        profile_id: string;
        display_name: string;
        photo_url: string | null;
        suburb: string | null;
      }>(
        `
          select profile.id::text as profile_id,
                 profile.display_name,
                 profile.photo_url,
                 profile.suburb
          from event_attendees attendee
          join events event on event.id = attendee.event_id
          join profiles profile on profile.id = attendee.profile_id
          where event.slug = $1
            and attendee.status = 'confirmed'
          order by attendee.created_at asc
          limit $2
        `,
        [eventSlug, limit],
      ),
      pool.query<{ count: string }>(
        `
          select count(*)::text as count
          from event_attendees attendee
          join events event on event.id = attendee.event_id
          where event.slug = $1 and attendee.status = 'confirmed'
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
