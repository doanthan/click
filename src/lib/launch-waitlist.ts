import "server-only";

import { randomInt } from "node:crypto";
import type { Session } from "next-auth";
import { isAdminEmail } from "./admin-emails";
import { getPostgresPool } from "./postgres";
import { placeForSuburb } from "./postcode";

/**
 * The pre-launch waitlist behind /waitlist ("Request an invite"). Table and
 * rules: database/072_launch_waitlist.sql.
 *
 * Two privacy rules shape everything here:
 *  - The page must not say whether an address was already on the list. A
 *    repeat request gets the same success screen as a first one, the email goes
 *    out only on the first (and after the response, so its cost can't be timed
 *    either), and nothing about the stored row is echoed back except the
 *    person's own share code.
 *  - A share code says nothing about who owns it. It is random, never a name.
 */

export type WaitlistArea = "pilot" | "outside" | "unknown";

// No 0/o or 1/i/l: the code gets read off a phone screen and retyped.
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 8;
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

export function newReferralCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** A ?ref= value we will look up, or null. Anything else is ignored, never an error. */
export function cleanReferralCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toLowerCase();
  return CODE_RE.test(code) ? code : null;
}

// The sign-in form's shape check (login/actions.ts): one @, a dot in the domain.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanWaitlistEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

/**
 * Pilot or not, from whatever was typed: "2042", "Newtown", "Newtown NSW 2042",
 * "Surry Hills, Sydney". A postcode anywhere in it is the most exact thing on
 * offer; otherwise the name before any comma, less a trailing state. The test
 * itself is onboarding's (placeForSuburb), so the two can never disagree about
 * where the pilot ends.
 */
export function waitlistAreaFor(place: string): WaitlistArea {
  const postcode = place.match(/\b\d{4}\b/)?.[0];
  const name = place
    .split(",")[0]
    .replace(/\s+(nsw|vic|qld|wa|sa|tas|act|nt)$/i, "")
    .trim();
  return placeForSuburb(postcode ?? name).area;
}

// The www host on purpose: the bare apex only 307s to it, a hop every shared
// link would otherwise pay (see getAppUrl in stripe.ts).
function siteOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000").replace(
    "://letsclick.app",
    "://www.letsclick.app",
  );
}

/** Absolute links for the success screen and the email. /i/<code> is a next.config redirect. */
export function waitlistLinks(referralCode: string) {
  const origin = siteOrigin();
  return { shareUrl: `${origin}/i/${referralCode}`, howItWorksUrl: `${origin}/how-it-works` };
}

function namedError(name: string, message: string) {
  const error = new Error(message);
  error.name = name;
  return error;
}

function isReferralCodeCollision(error: unknown) {
  const pg = error as { code?: string; constraint?: string } | null;
  return pg?.code === "23505" && pg.constraint === "launch_waitlist_referral_code_key";
}

/**
 * Add an address, or find it if it is already there. Returns the person's share
 * code either way, plus whether this call created the row - the caller sends
 * the confirmation email on that, and must not tell the browser.
 *
 * A repeat request changes nothing: not the place, not who referred them. Anyone
 * can type anyone's address into a public form, so the first answer stands.
 */
export async function joinLaunchWaitlist(input: {
  email: string;
  place: string;
  ref: string | null;
}): Promise<{ referralCode: string; isNew: boolean }> {
  const pool = getPostgresPool();
  if (!pool) throw namedError("DatabaseUnavailableError", "Database unavailable.");

  const area = waitlistAreaFor(input.place);
  for (let attempt = 1; ; attempt += 1) {
    try {
      const result = await pool.query<{ referral_code: string; is_new: boolean }>(
        `
          insert into launch_waitlist (email, place, area, referral_code, referred_by)
          values ($1, $2, $3, $4, (select id from launch_waitlist where referral_code = $5))
          on conflict (email) do update set email = launch_waitlist.email
          returning referral_code, (xmax = 0) as is_new
        `,
        [input.email, input.place, area, newReferralCode(), input.ref],
      );
      return { referralCode: result.rows[0].referral_code, isNew: result.rows[0].is_new };
    } catch (error) {
      // 31^8 codes, so a clash is rare - but it would surface as a failed
      // request, so roll a fresh code rather than show an error.
      if (attempt < 3 && isReferralCodeCollision(error)) continue;
      throw error;
    }
  }
}

export type LaunchWaitlistEntry = {
  id: string;
  email: string;
  place: string;
  area: WaitlistArea;
  /** How many people joined on this person's link. */
  referrals: number;
  /** The address whose link this person came in on, if any. */
  referredBy: string | null;
  createdAt: string;
};

/**
 * Everyone on the list in invite order: most people brought in first, then
 * first come, first served. That order IS the "every one moves you up" promise,
 * so the admin page and the CSV both use it.
 *
 * A bulk read of email addresses, so the admin check lives here as well as in
 * the page and the export route.
 */
export async function getLaunchWaitlistForAdmin(
  session: Session | null,
): Promise<LaunchWaitlistEntry[]> {
  if (!isAdminEmail(session?.user?.email)) {
    throw namedError("ForbiddenError", "Admin access is required.");
  }
  const pool = getPostgresPool();
  if (!pool) throw namedError("DatabaseUnavailableError", "Database unavailable.");

  const result = await pool.query<{
    id: string;
    email: string;
    place: string;
    area: WaitlistArea;
    referrals: number;
    referred_by: string | null;
    created_at: Date;
  }>(
    `
      select
        w.id::text,
        w.email::text,
        w.place,
        w.area,
        (select count(*)::int from launch_waitlist r where r.referred_by = w.id) as referrals,
        referrer.email::text as referred_by,
        w.created_at
      from launch_waitlist w
      left join launch_waitlist referrer on referrer.id = w.referred_by
      order by referrals desc, w.created_at asc
    `,
  );

  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    place: row.place,
    area: row.area,
    referrals: row.referrals,
    referredBy: row.referred_by,
    createdAt: row.created_at.toISOString(),
  }));
}
