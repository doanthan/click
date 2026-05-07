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

async function ensureProfileForSession(
  session: Session | null,
  role: ProfileRow["role"] = "attendee",
) {
  const pool = getPostgresPool();
  const email = getSessionEmail(session);

  if (!email) throw authError();
  if (!pool) throw databaseUnavailableError();

  const displayName = getSessionName(session);
  const desiredRole: ProfileRow["role"] = email === "admin@click.local" ? "admin" : role;

  const result = await pool.query<ProfileRow>(
    `
      insert into profiles (auth_subject, role, email, display_name, email_verified_at)
      values ($1, $2::user_role, $3, $4, now())
      on conflict (email) do update
      set
        display_name = excluded.display_name,
        role = case
          when profiles.role = 'admin' then profiles.role
          when excluded.role = 'admin' then excluded.role
          when excluded.role = 'merchant' then excluded.role
          else profiles.role
        end,
        updated_at = now()
      returning id::text, role::text as role, email::text, display_name
    `,
    [`auth:${email}`, desiredRole, email, displayName],
  );

  return result.rows[0];
}

async function requireAdminProfile(session: Session | null) {
  const profile = await ensureProfileForSession(session, "attendee");

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
    const profile = await ensureProfileForSession(session, "attendee");
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
    const profile = await ensureProfileForSession(session, "merchant");
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
          $5,
          $6,
          $7,
          'pending',
          'click_managed',
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17
        )
        returning slug, title
      `,
      [
        slug,
        title,
        description,
        profile.id,
        input.groupName.trim() || `${profile.display_name}'s Group`,
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
  const profile = await requireAdminProfile(session);

  if (!pool) throw databaseUnavailableError();

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
}

export async function getAdminEvents() {
  const pool = getPostgresPool();

  if (!pool) {
    return clickEvents.map((event) => ({
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

    return clickEvents.map((event) => ({
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
}

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
        saved: 8,
        clicks: 14,
        radar: "Live",
      },
    };
  }

  try {
    const profile = await ensureProfileForSession(session, "attendee");
    const result = await pool.query<EventRow>(
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
    );

    const upcomingEvents = result.rows.map(eventFromRow);

    return {
      userName: profile.display_name,
      upcomingEvents,
      savedEvents: clickEvents.slice(2, 4),
      stats: {
        upcoming: upcomingEvents.length,
        saved: 8,
        clicks: 14,
        radar: "Live",
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
        saved: 8,
        clicks: 14,
        radar: "Live",
      },
    };
  }
}
