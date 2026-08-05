import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { getPostgresPool } from "@/lib/postgres";

// Exported so the sign-in email copy quotes the TTL it actually enforces.
export const TOKEN_TTL_MINUTES = 15;
const EMAIL_LIMIT_PER_HOUR = 5;
const IP_LIMIT_PER_HOUR = 30;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function ipHash(ip: string | null) {
  if (!ip) return null;
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for email authentication.");
  return createHash("sha256").update(`${secret}:${ip}`).digest("hex");
}

function requirePool() {
  const pool = getPostgresPool();
  if (!pool) {
    const error = new Error("Email authentication is temporarily unavailable.");
    error.name = "DatabaseUnavailableError";
    throw error;
  }
  return pool;
}

export async function issueMagicLink(input: {
  email: string;
  redirectTo: string;
  purpose: "login" | "signup";
  clientIp: string | null;
}) {
  const pool = requirePool();
  const hashedIp = ipHash(input.clientIp);
  const limit = await pool.query<{ email_count: number; ip_count: number }>(
    `
      select
        count(*) filter (where lower(email) = lower($1))::int as email_count,
        count(*) filter (where request_ip_hash = $2 and $2 is not null)::int as ip_count
      from auth_magic_links
      where created_at > now() - interval '1 hour'
    `,
    [input.email, hashedIp],
  );
  const counts = limit.rows[0] ?? { email_count: 0, ip_count: 0 };
  if (counts.email_count >= EMAIL_LIMIT_PER_HOUR || counts.ip_count >= IP_LIMIT_PER_HOUR) {
    const error = new Error("Too many sign-in emails requested. Try again in an hour.");
    error.name = "RateLimitError";
    throw error;
  }

  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `
      insert into auth_magic_links
        (token_hash, email, redirect_to, purpose, request_ip_hash, expires_at)
      values ($1, $2, $3, $4, $5, now() + ($6 * interval '1 minute'))
    `,
    [tokenHash(token), input.email, input.redirectTo, input.purpose, hashedIp, TOKEN_TTL_MINUTES],
  );
  return token;
}

export async function revokeMagicLink(token: string) {
  const pool = requirePool();
  await pool.query("delete from auth_magic_links where token_hash = $1", [tokenHash(token)]);
}

export async function getMagicLinkDestination(token: string) {
  if (!token || token.length > 256) return null;
  const pool = requirePool();
  const result = await pool.query<{ redirect_to: string }>(
    `
      select redirect_to
      from auth_magic_links
      where token_hash = $1 and consumed_at is null and expires_at > now()
    `,
    [tokenHash(token)],
  );
  return result.rows[0]?.redirect_to ?? null;
}

export async function consumeMagicLink(token: string) {
  if (!token || token.length > 256) return null;
  const pool = requirePool();
  const result = await pool.query<{ email: string }>(
    `
      update auth_magic_links
      set consumed_at = now()
      where token_hash = $1 and consumed_at is null and expires_at > now()
      returning email
    `,
    [tokenHash(token)],
  );
  return result.rows[0]?.email?.trim().toLowerCase() ?? null;
}
