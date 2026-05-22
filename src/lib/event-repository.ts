import type { Session } from "next-auth";
import { mkdir, readFile, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { clickEvents, type EventItem, type EventStatus } from "./click-data";
import { sendTransactionalEmail } from "./email";
import { getPostgresPool } from "./postgres";

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
};

export type MerchantSignupInput = {
  businessName: string;
  contactEmail: string;
  websiteUrl: string;
  abn: string;
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
  price: string;
  capacity: number;
  description: string;
  relationshipGoal: string;
  tags: string;
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
  emailVerified: boolean;
  photoVerified: boolean;
  joinedAt: string;
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
    distanceKm: distanceKmFromSydney(sydneyReference.lat, sydneyReference.lng),
    lat: sydneyReference.lat,
    lng: sydneyReference.lng,
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

async function getFallbackAdminEvents() {
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
  checkedInAt: string | null;
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
    checked_in_at: Date | null;
  }>(
    `
      select
        attendee.id::text as attendee_id,
        attendee_profile.display_name,
        attendee_profile.email::text as email,
        attendee.status::text,
        attendee.created_at,
        attendee.checked_in_at
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
      checkedInAt: entry.checked_in_at ? entry.checked_in_at.toISOString() : null,
    })),
  };
}

export async function toggleAttendeeCheckIn(
  attendeeId: string,
  checkedIn: boolean,
  session: Session | null,
) {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);
  const merchant = await getMerchantProfile(pool, profile.id);
  if (!merchant) {
    const error = new Error("Merchant profile is required to check in attendees.");
    error.name = "MerchantSignupRequiredError";
    throw error;
  }

  const result = await pool.query<{ checked_in_at: Date | null }>(
    `
      update event_attendees attendee
      set checked_in_at = $3,
          updated_at = now()
      from events event
      where attendee.id = $1::uuid
        and event.id = attendee.event_id
        and event.merchant_profile_id = $2::uuid
      returning attendee.checked_in_at
    `,
    [attendeeId, merchant.id, checkedIn ? new Date() : null],
  );

  if (result.rowCount === 0) {
    const error = new Error("Attendee not found or not part of your event.");
    error.name = "NotFoundError";
    throw error;
  }

  return {
    attendeeId,
    checkedInAt: result.rows[0]?.checked_in_at?.toISOString() ?? null,
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

export type EventDetail = EventItem & {
  priceCents: number;
  address: string | null;
  endsAt: string | null;
  viewerRsvpStatus: "confirmed" | "waitlisted" | "pending_payment" | "cancelled" | null;
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
    if (!row) return null;

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
            count(attendee.id) filter (where attendee.status in ('confirmed', 'pending_payment')) as confirmed_attendees
          from events event
          left join event_attendees attendee on attendee.event_id = event.id
          where event.slug = $1
          group by event.id
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
          $18
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
        parsePriceCents(input.price),
        capacity,
        imageForCategory(category),
        "Community event listing",
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
        count(attendee.id) filter (where attendee.status in ('confirmed', 'pending_payment')) as confirmed_attendees
      from events event
      left join event_attendees attendee on attendee.event_id = event.id
      group by event.id
      order by event.created_at desc
      limit 40
    `);

    return result.rows.map((event): AdminEventRow => ({
      id: event.slug,
      title: event.title,
      category: event.category,
      status: eventStatusFromDb(event.status),
      booking: bookingFromDb(event.booking_model),
      host: event.host_name,
      attendees: Number(event.confirmed_attendees),
      capacity: event.capacity,
      startsAt: event.starts_at.toISOString(),
    }));
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
    emailVerified: true,
    photoVerified: true,
    joinedAt: "2025-08-12T03:18:00.000Z",
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
    emailVerified: true,
    photoVerified: false,
    joinedAt: "2025-09-04T12:02:00.000Z",
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
    emailVerified: true,
    photoVerified: true,
    joinedAt: "2025-09-19T22:45:00.000Z",
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
    emailVerified: true,
    photoVerified: true,
    joinedAt: "2025-07-30T01:10:00.000Z",
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
    emailVerified: true,
    photoVerified: true,
    joinedAt: "2025-06-01T00:00:00.000Z",
  },
];

const fallbackAdminMerchants: AdminMerchantRow[] = [
  {
    id: "seed-kindred",
    businessName: "Kindred Kitchens",
    contactEmail: "zara@kindredkitchens.com",
    verificationStatus: "approved",
    websiteUrl: "https://kindredkitchens.com",
    abn: "88 211 339 220",
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
      email_verified_at: Date | null;
      photo_verified_at: Date | null;
      created_at: Date;
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
        profile.email_verified_at,
        profile.photo_verified_at,
        profile.created_at
      from profiles profile
      left join bookmarks bookmark on bookmark.profile_id = profile.id
      left join event_attendees attendee on attendee.profile_id = profile.id
      group by profile.id
      order by profile.created_at desc
      limit 100
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
      emailVerified: !!row.email_verified_at,
      photoVerified: !!row.photo_verified_at,
      joinedAt: row.created_at.toISOString(),
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

export type AdminAnalyticsPoint = {
  bucket: string; // ISO date (yyyy-mm-dd)
  members: number;
  rsvps: number;
  revenueCents: number;
  events: number;
};

export type AdminAnalytics = {
  series: AdminAnalyticsPoint[];
  totals: {
    revenueCents: number;
    rsvps: number;
    newMembers: number;
    events: number;
  };
  topCategories: Array<{ category: string; count: number }>;
};

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  const pool = getPostgresPool();
  if (!pool) {
    return {
      series: [],
      totals: { revenueCents: 0, rsvps: 0, newMembers: 0, events: 0 },
      topCategories: [],
    };
  }

  try {
    const [memberSeries, rsvpSeries, revenueSeries, eventSeries, categoryResult] = await Promise.all([
      pool.query<{ bucket: string; total: string }>(
        `
          select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as bucket,
                 count(*)::text as total
          from profiles
          where created_at >= now() - interval '30 days'
          group by 1
          order by 1
        `,
      ),
      pool.query<{ bucket: string; total: string }>(
        `
          select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as bucket,
                 count(*)::text as total
          from event_attendees
          where created_at >= now() - interval '30 days'
            and status in ('confirmed', 'waitlisted')
          group by 1
          order by 1
        `,
      ),
      pool.query<{ bucket: string; total: string }>(
        `
          select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as bucket,
                 coalesce(sum(amount_cents), 0)::text as total
          from payment_transactions
          where created_at >= now() - interval '30 days'
            and status = 'paid'
          group by 1
          order by 1
        `,
      ),
      pool.query<{ bucket: string; total: string }>(
        `
          select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as bucket,
                 count(*)::text as total
          from events
          where created_at >= now() - interval '30 days'
          group by 1
          order by 1
        `,
      ),
      pool.query<{ category: string; total: string }>(
        `
          select category, count(*)::text as total
          from events
          group by category
          order by count(*) desc
          limit 6
        `,
      ),
    ]);

    const days: string[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const memberMap = new Map(memberSeries.rows.map((row) => [row.bucket, Number(row.total)]));
    const rsvpMap = new Map(rsvpSeries.rows.map((row) => [row.bucket, Number(row.total)]));
    const revenueMap = new Map(revenueSeries.rows.map((row) => [row.bucket, Number(row.total)]));
    const eventMap = new Map(eventSeries.rows.map((row) => [row.bucket, Number(row.total)]));

    const series: AdminAnalyticsPoint[] = days.map((bucket) => ({
      bucket,
      members: memberMap.get(bucket) ?? 0,
      rsvps: rsvpMap.get(bucket) ?? 0,
      revenueCents: revenueMap.get(bucket) ?? 0,
      events: eventMap.get(bucket) ?? 0,
    }));

    const totals = series.reduce(
      (acc, point) => ({
        revenueCents: acc.revenueCents + point.revenueCents,
        rsvps: acc.rsvps + point.rsvps,
        newMembers: acc.newMembers + point.members,
        events: acc.events + point.events,
      }),
      { revenueCents: 0, rsvps: 0, newMembers: 0, events: 0 },
    );

    return {
      series,
      totals,
      topCategories: categoryResult.rows.map((row) => ({
        category: row.category,
        count: Number(row.total),
      })),
    };
  } catch {
    return {
      series: [],
      totals: { revenueCents: 0, rsvps: 0, newMembers: 0, events: 0 },
      topCategories: [],
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

export type PeopleSuggestion = {
  profileId: string;
  displayName: string;
  suburb: string | null;
  bio: string | null;
  intents: string[];
  sharedTags: string[];
  sharedEventIds: string[];
  hasClicked: boolean;
  isMutual: boolean;
};

export async function getPeopleSuggestions(
  session: Session | null,
): Promise<PeopleSuggestion[]> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!pool || !email) return [];

  try {
    const profile = await ensureProfileForSession(session);

    const result = await pool.query<{
      id: string;
      display_name: string;
      suburb: string | null;
      bio: string | null;
      connection_intents: string[] | null;
      shared_tags: string[] | null;
      shared_events: string[] | null;
      already_clicked: boolean;
      is_mutual: boolean;
    }>(
      `
        with my_tags as (
          select tag_id from user_tags where profile_id = $1::uuid
        ),
        my_events as (
          select event_id from event_attendees
          where profile_id = $1::uuid and status in ('confirmed', 'waitlisted')
        )
        select
          other.id::text,
          other.display_name,
          other.suburb,
          other.bio,
          other.connection_intents::text[] as connection_intents,
          coalesce(array_agg(distinct shared_tag.label) filter (where shared_tag.id is not null), '{}') as shared_tags,
          coalesce(array_agg(distinct shared_event.slug) filter (where shared_event.id is not null), '{}') as shared_events,
          exists (
            select 1 from user_clicks
            where clicker_profile_id = $1::uuid
              and clicked_profile_id = other.id
          ) as already_clicked,
          exists (
            select 1 from mutual_clicks
            where (profile_a_id = least($1::uuid, other.id) and profile_b_id = greatest($1::uuid, other.id))
          ) as is_mutual
        from profiles other
        left join user_tags other_tag on other_tag.profile_id = other.id
          and other_tag.tag_id in (select tag_id from my_tags)
        left join tags shared_tag on shared_tag.id = other_tag.tag_id
        left join event_attendees other_attendee on other_attendee.profile_id = other.id
          and other_attendee.status in ('confirmed', 'waitlisted')
          and other_attendee.event_id in (select event_id from my_events)
        left join events shared_event on shared_event.id = other_attendee.event_id
        where other.id <> $1::uuid
          and other.role <> 'admin'
        group by other.id
        having count(distinct other_tag.tag_id) > 0
            or count(distinct other_attendee.event_id) > 0
        order by
          count(distinct other_attendee.event_id) desc,
          count(distinct other_tag.tag_id) desc,
          other.display_name asc
        limit 24
      `,
      [profile.id],
    );

    return result.rows.map((row) => ({
      profileId: row.id,
      displayName: row.display_name,
      suburb: row.suburb,
      bio: row.bio,
      intents: row.connection_intents ?? [],
      sharedTags: row.shared_tags ?? [],
      sharedEventIds: row.shared_events ?? [],
      hasClicked: row.already_clicked,
      isMutual: row.is_mutual,
    }));
  } catch {
    return [];
  }
}

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  actionUrl: string | null;
  channel: "in_app" | "email";
  read: boolean;
  createdAt: string;
};

export async function getNotifications(
  session: Session | null,
): Promise<NotificationRow[]> {
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
      channel: "in_app" | "email";
      read_at: Date | null;
      created_at: Date;
    }>(
      `
        select id::text, title, body, action_url, channel::text as channel, read_at, created_at
        from notifications
        where profile_id = $1::uuid
        order by created_at desc
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
      read: row.read_at !== null,
      createdAt: row.created_at.toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function markNotificationsRead(
  ids: string[],
  session: Session | null,
) {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();
  if (ids.length === 0) return { updated: 0 };

  const profile = await ensureProfileForSession(session);
  const result = await pool.query<{ id: string }>(
    `
      update notifications
      set read_at = now()
      where profile_id = $1::uuid
        and id = any($2::uuid[])
        and read_at is null
      returning id::text
    `,
    [profile.id, ids],
  );

  return { updated: result.rowCount ?? 0, ids: result.rows.map((row) => row.id) };
}

export type PublicProfile = {
  id: string;
  displayName: string;
  suburb: string | null;
  bio: string | null;
  city: string;
  intents: string[];
  tags: string[];
  attendedEvents: EventItem[];
  isOwn: boolean;
};

export async function getPublicProfile(
  identifier: string,
  session: Session | null,
): Promise<PublicProfile | null> {
  const pool = getPostgresPool();
  if (!pool) return null;

  const idLooksLikeUuid = /^[0-9a-f-]{36}$/i.test(identifier);
  const idLooksLikeEmail = identifier.includes("@");

  let viewerProfileId: string | null = null;
  if (session?.user) {
    try {
      const viewer = await ensureProfileForSession(session);
      viewerProfileId = viewer.id;
    } catch {
      viewerProfileId = null;
    }
  }

  try {
    const profileResult = await pool.query<{
      id: string;
      display_name: string;
      suburb: string | null;
      bio: string | null;
      city: string;
      connection_intents: string[] | null;
    }>(
      `
        select
          id::text,
          display_name,
          suburb,
          bio,
          city,
          connection_intents
        from profiles
        where ${
          idLooksLikeUuid
            ? "id = $1::uuid"
            : idLooksLikeEmail
              ? "email = $1::citext"
              : "lower(replace(display_name, ' ', '-')) = lower($1)"
        }
        limit 1
      `,
      [identifier],
    );

    const row = profileResult.rows[0];
    if (!row) return null;

    const [tagResult, attendedResult] = await Promise.all([
      pool.query<{ label: string }>(
        `
          select tag.label
          from user_tags user_tag
          join tags tag on tag.id = user_tag.tag_id
          where user_tag.profile_id = $1::uuid
          order by tag.label
        `,
        [row.id],
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
            and own_attendee.status = 'confirmed'
          group by event.id
          order by event.starts_at desc
          limit 8
        `,
        [row.id],
      ),
    ]);

    return {
      id: row.id,
      displayName: row.display_name,
      suburb: row.suburb,
      bio: row.bio,
      city: row.city,
      intents: row.connection_intents ?? [],
      tags: tagResult.rows.map((entry) => entry.label),
      attendedEvents: attendedResult.rows.map(eventFromRow),
      isOwn: viewerProfileId === row.id,
    };
  } catch {
    return null;
  }
}

export type ProfileSettingsRow = {
  displayName: string;
  email: string;
  suburb: string;
  bio: string;
  age: string;
  intents: Array<"dating" | "friendship" | "networking" | "exploring">;
  tags: string[];
};

export async function getProfileForSettings(
  session: Session | null,
): Promise<ProfileSettingsRow | null> {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);
  if (!pool || !email) return null;

  try {
    const profile = await ensureProfileForSession(session);
    const [profileResult, tagResult] = await Promise.all([
      pool.query<{
        display_name: string;
        email: string;
        suburb: string | null;
        bio: string | null;
        age: number | null;
        connection_intents: string[] | null;
      }>(
        `
          select display_name, email::text, suburb, bio, age, connection_intents
          from profiles
          where id = $1::uuid
        `,
        [profile.id],
      ),
      pool.query<{ slug: string }>(
        `
          select tag.slug
          from user_tags user_tag
          join tags tag on tag.id = user_tag.tag_id
          where user_tag.profile_id = $1::uuid
        `,
        [profile.id],
      ),
    ]);

    const row = profileResult.rows[0];
    if (!row) return null;

    return {
      displayName: row.display_name ?? "",
      email: row.email,
      suburb: row.suburb ?? "",
      bio: row.bio ?? "",
      age: row.age == null ? "" : String(row.age),
      intents: (row.connection_intents ?? []) as ProfileSettingsRow["intents"],
      tags: tagResult.rows.map((entry) => entry.slug),
    };
  } catch {
    return null;
  }
}

export async function saveOnboarding(input: OnboardingInput, session: Session | null) {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const displayName = input.displayName.trim();
  const suburb = input.suburb.trim();
  const bio = input.bio.trim();

  if (!displayName || !suburb || !bio) {
    const error = new Error("Name, suburb, and a short bio are required.");
    error.name = "ValidationError";
    throw error;
  }

  const ageValue = input.age.trim() ? Number.parseInt(input.age.trim(), 10) : null;
  if (ageValue !== null && (!Number.isFinite(ageValue) || ageValue < 18 || ageValue > 120)) {
    const error = new Error("Age must be 18 or older.");
    error.name = "ValidationError";
    throw error;
  }

  const allowedIntents = ["dating", "friendship", "networking", "exploring"];
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
        updated_at = now()
      where id = $1::uuid
    `,
    [profile.id, displayName, suburb, ageValue, bio, intents.length ? intents : ["friendship"]],
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
    [profile.id, businessName, contactEmail, input.websiteUrl.trim(), input.abn.trim()],
  );

  if (profile.role === "attendee") {
    await pool.query(
      `update profiles set role = 'merchant', updated_at = now() where id = $1::uuid`,
      [profile.id],
    );
  }

  return result.rows[0];
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
          count(attendee.id) filter (where attendee.status in ('confirmed', 'pending_payment')) as confirmed_attendees
        from events event
        left join event_attendees attendee on attendee.event_id = event.id
        where event.slug = $1
        group by event.id
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
