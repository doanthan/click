import "server-only";

import type { Session } from "next-auth";
import { isAdminEmail } from "./admin-emails";
import { HOST_EVENT_TYPES } from "./host-event-types";
import { waitlistAreaFor, type WaitlistArea } from "./launch-waitlist";
import { getPostgresPool } from "./postgres";

/**
 * The host waitlist on the homepage ("For hosts", HostWaitlistForm). Table and
 * rules: database/081_host_waitlist.sql.
 *
 * The same privacy rule as the attendee /waitlist (src/lib/launch-waitlist.ts):
 * the page must not say whether an address is already on the list. A repeat
 * request gets the same success screen, the email goes out only on the first,
 * after the response, and nothing about the stored row is echoed back.
 */

export type HostWaitlistInput = {
  email: string;
  businessName: string;
  contactName: string | null;
  phone: string | null;
  place: string | null;
  eventTypes: string[];
  website: string | null;
};

const EVENT_TYPE_KEYS = new Set(HOST_EVENT_TYPES.map((type) => type.key));
const EVENT_TYPE_LABEL = new Map(HOST_EVENT_TYPES.map((type) => [type.key, type.label]));

/** One line of free text: trimmed, inner whitespace collapsed, "" as null. */
export function cleanLine(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().replace(/\s+/g, " ");
  return value ? value : null;
}

/**
 * A phone number as digits with an optional leading +, or null when it isn't
 * one. Spaces, dashes, dots and brackets are dropped, so "(02) 9555 0100" and
 * "+61 412 345 678" both pass. The table's check is the same pattern.
 */
export function cleanPhone(raw: string): string | null {
  const compact = raw.replace(/[\s().-]/g, "");
  return /^\+?\d{8,15}$/.test(compact) ? compact : null;
}

/** The ticked category keys we know, deduped, in canonical order. Anything else is dropped. */
export function cleanEventTypes(raw: unknown[]): string[] {
  const picked = new Set(raw.filter((value): value is string => typeof value === "string"));
  return HOST_EVENT_TYPES.map((type) => type.key).filter((key) => picked.has(key) && EVENT_TYPE_KEYS.has(key));
}

export function eventTypeLabel(key: string): string {
  return EVENT_TYPE_LABEL.get(key) ?? key;
}

const INSTAGRAM_HANDLE_RE = /^@([A-Za-z0-9._]{1,30})$/;
const BARE_DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;

/**
 * Where the admin view may link a typed website or handle, or null to show it
 * as plain text. Only http(s) ever becomes an href - the value is a stranger's
 * free text, and a javascript: URL in an admin's console is the obvious attack.
 */
export function websiteHref(website: string): string | null {
  const value = website.trim();
  const handle = value.match(INSTAGRAM_HANDLE_RE);
  if (handle) return `https://www.instagram.com/${handle[1]}`;
  const candidate = /^https?:\/\//i.test(value) ? value : BARE_DOMAIN_RE.test(value) ? `https://${value}` : null;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * A mailto: link for a stored address. The email check (cleanWaitlistEmail)
 * lets ? # % through, so they are encoded here: a typed "you@x.co?bcc=..." must
 * stay part of the address, never become a header on an admin's reply.
 */
export function mailtoHref(email: string): string {
  return `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}`;
}

function namedError(name: string, message: string) {
  const error = new Error(message);
  error.name = name;
  return error;
}

/**
 * Add a host, or find them if the address is already there. Returns whether
 * this call created the row - the caller sends the confirmation email on that,
 * and must not tell the browser.
 *
 * A repeat request changes nothing. Anyone can type anyone's address into a
 * public form, so the first answer stands.
 */
export async function joinHostWaitlist(input: HostWaitlistInput): Promise<{ isNew: boolean }> {
  const pool = getPostgresPool();
  if (!pool) throw namedError("DatabaseUnavailableError", "Database unavailable.");

  const result = await pool.query<{ is_new: boolean }>(
    `
      insert into host_waitlist
        (email, business_name, contact_name, phone, place, area, event_types, website)
      values ($1, $2, $3, $4, $5, $6, $7::text[], $8)
      on conflict (email) do update set email = host_waitlist.email
      returning (xmax = 0) as is_new
    `,
    [
      input.email,
      input.businessName,
      input.contactName,
      input.phone,
      input.place,
      input.place ? waitlistAreaFor(input.place) : null,
      input.eventTypes,
      input.website,
    ],
  );
  return { isNew: result.rows[0].is_new };
}

export type HostWaitlistEntry = {
  id: string;
  email: string;
  businessName: string;
  contactName: string | null;
  phone: string | null;
  place: string | null;
  area: WaitlistArea | null;
  eventTypes: string[];
  website: string | null;
  createdAt: string;
};

/**
 * Everyone on the host list, first come first served. A bulk read of email
 * addresses and phone numbers, so the admin check lives here as well as in the
 * page and the export route.
 */
export async function getHostWaitlistForAdmin(session: Session | null): Promise<HostWaitlistEntry[]> {
  if (!isAdminEmail(session?.user?.email)) {
    throw namedError("ForbiddenError", "Admin access is required.");
  }
  const pool = getPostgresPool();
  if (!pool) throw namedError("DatabaseUnavailableError", "Database unavailable.");

  const result = await pool.query<{
    id: string;
    email: string;
    business_name: string;
    contact_name: string | null;
    phone: string | null;
    place: string | null;
    area: WaitlistArea | null;
    event_types: string[];
    website: string | null;
    created_at: Date;
  }>(
    `
      select id::text, email::text, business_name, contact_name, phone, place, area,
             event_types, website, created_at
      from host_waitlist
      order by created_at asc
    `,
  );

  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    businessName: row.business_name,
    contactName: row.contact_name,
    phone: row.phone,
    place: row.place,
    area: row.area,
    eventTypes: row.event_types,
    website: row.website,
    createdAt: row.created_at.toISOString(),
  }));
}
