/**
 * The QA persona switcher's second key: being an admin.
 *
 * WHY A TOKEN AND NOT "read the session"
 *   The switcher signs you in AS a persona, so the moment an admin picks
 *   "Customer" their session is maya@click.local and they are not an admin any
 *   more. A gate that asks "is the CURRENT session an admin" therefore hides
 *   the switcher immediately after its first use, stranding them one magic-link
 *   round trip from getting back. The unlock has to outlive the session that
 *   granted it, which means it lives in the same cookie the key path uses.
 *
 * WHY IT IS SIGNED
 *   That cookie is the whole security boundary - `test-login` will mint an
 *   admin@click.local session for anyone holding it. So the admin grant cannot
 *   be a flag a browser can simply set; it carries an HMAC over the granting
 *   address, keyed by AUTH_SECRET, which the server re-verifies on every gated
 *   request.
 *
 * REVOCATION stays the same shape as the key path. The email travels in the
 * clear inside the token precisely so the caller can re-check it against
 * ADMIN_EMAILS on every request: dropping someone from that variable kills
 * their unlock on the next request, with no deploy and nothing to clear in
 * their browser. Rotating AUTH_SECRET revokes every grant at once.
 *
 * Dependency-free on purpose - node --test imports this file directly
 * (tests/qa-admin-grant.test.mjs), and it cannot resolve extensionless TS
 * specifiers. Same reason src/lib/admin-emails.ts is its own leaf. The
 * ADMIN_EMAILS half of the check therefore lives in the caller, not here.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const GRANT_PREFIX = "admin:";

// AUTH_SECRET is required for email sign-in (src/lib/auth-magic-link.ts), so on
// any environment that can log a human in there is a real secret here. The floor
// exists so a placeholder value fails closed instead of signing grants with
// something guessable.
const MIN_SECRET_LENGTH = 16;

function sign(email: string, secret: string) {
  // Namespaced so a signature can never be replayed from another feature that
  // happens to HMAC an email with the same secret.
  return createHmac("sha256", secret).update(`qa-switcher-admin:${email}`).digest("hex");
}

function usableSecret(secret: string | undefined) {
  const trimmed = secret?.trim() ?? "";
  return trimmed.length >= MIN_SECRET_LENGTH ? trimmed : "";
}

/** The cookie value that unlocks the switcher for `email`, or "" if it can't be signed. */
export function mintQaAdminGrant(email: string, secret: string | undefined): string {
  const usable = usableSecret(secret);
  const normalized = email.trim().toLowerCase();
  if (!usable || !normalized) return "";
  return `${GRANT_PREFIX}${normalized}:${sign(normalized, usable)}`;
}

/**
 * The address a grant cookie was issued to, or null if it isn't a valid grant.
 *
 * Returning the email rather than a boolean is the point: the caller still has
 * to ask whether that address is an admin *now*.
 */
export function readQaAdminGrant(cookieValue: string, secret: string | undefined): string | null {
  const usable = usableSecret(secret);
  if (!usable || !cookieValue.startsWith(GRANT_PREFIX)) return null;

  const body = cookieValue.slice(GRANT_PREFIX.length);
  const split = body.lastIndexOf(":");
  if (split <= 0) return null;

  const email = body.slice(0, split);
  const signature = body.slice(split + 1);
  const expected = sign(email, usable);
  // timingSafeEqual throws on a length mismatch; the length is not the secret.
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"))) {
    return null;
  }
  return email;
}
