import type { Session } from "next-auth";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { clickEvents, type EventItem, type EventStatus } from "./click-data";
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

const localStorePath = path.join(process.cwd(), ".data", "click-events.json");
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
        count(distinct attendee.id) filter (where attendee.status = 'confirmed') as confirmed_attendees,
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
        title: string;
        capacity: number;
        status: string;
        confirmed_attendees: string;
      }>(
        `
          select
            event.id::text,
            event.title,
            event.capacity,
            event.status::text,
            count(attendee.id) filter (where attendee.status = 'confirmed') as confirmed_attendees
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
      const status =
        event.status === "waitlist" || confirmedCount >= event.capacity
          ? "waitlisted"
          : "confirmed";

      await client.query(
        `
          insert into event_attendees (event_id, profile_id, status)
          values ($1::uuid, $2::uuid, $3::rsvp_status)
          on conflict (event_id, profile_id) do update
          set status = excluded.status, updated_at = now()
        `,
        [event.id, profile.id, status],
      );

      await client.query(
        `
          insert into notifications (profile_id, title, body, action_url)
          values ($1::uuid, $2, $3, $4)
        `,
        [
          profile.id,
          status === "confirmed" ? "RSVP confirmed" : "Waitlist joined",
          `${event.title} is now ${status} for ${profile.display_name}.`,
          "/dashboard",
        ],
      );

      await client.query("commit");

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
        count(attendee.id) filter (where attendee.status = 'confirmed') as confirmed_attendees
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
        count(distinct attendee_count.id) filter (where attendee_count.status = 'confirmed') as confirmed_attendees,
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

    const [upcomingResult, savedResult] = await Promise.all([
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
        clicks: 0,
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

export async function cancelRegistration(eventId: string, session: Session | null) {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const profile = await ensureProfileForSession(session);

  const result = await pool.query<{ event_id: string; title: string }>(
    `
      update event_attendees
      set status = 'cancelled', updated_at = now()
      from events event
      where event_attendees.event_id = event.id
        and event.slug = $1
        and event_attendees.profile_id = $2::uuid
        and event_attendees.status in ('confirmed', 'waitlisted')
      returning event_attendees.event_id::text, event.title
    `,
    [eventId, profile.id],
  );

  if (result.rows.length === 0) {
    const error = new Error("You are not currently registered for that event.");
    error.name = "NotFoundError";
    throw error;
  }

  return { eventTitle: result.rows[0].title };
}
