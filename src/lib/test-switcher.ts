import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { isAdminEmail } from "@/lib/admin-emails";
import { mintQaAdminGrant, readQaAdminGrant } from "@/lib/qa-admin-grant";
import { isLocalDevelopment } from "@/lib/runtime-mode";

// The QA persona switcher used to be hard-gated to localhost. It now also runs
// on a deployed environment, but ONLY for a browser that has unlocked it. It
// hands out admin and merchant sessions, so an open switcher on letsclick.app
// would be an unauthenticated admin console - the unlock is the whole security
// boundary, not a convenience.
//
// TWO WAYS IN, one cookie:
//   * /qa-unlock?key=<TEST_SWITCHER_KEY> - for a tester who is not an admin.
//     The cookie value IS the key.
//   * /qa-unlock with no key, while signed in as an ADMIN_EMAILS address - the
//     cookie value is a signed grant (src/lib/qa-admin-grant.ts). Admins run
//     UAT and already hold every power the switcher hands out, so making them
//     wait on a shared secret being pasted into Vercel bought nothing.
//
// Both are re-verified against the environment on EVERY gated request, so
// revocation needs no deploy and no cookie clearing: clearing
// TEST_SWITCHER_KEY kills the key path, and removing someone from
// ADMIN_EMAILS kills their grant.
export const TEST_SWITCHER_COOKIE = "click_qa_persona";

// Long enough that guessing is not a strategy. A short key counts as "not
// configured" rather than quietly protecting the admin console with four
// characters someone set in a hurry.
const MIN_KEY_LENGTH = 24;

function configuredKey() {
  const key = process.env.TEST_SWITCHER_KEY?.trim() ?? "";
  return key.length >= MIN_KEY_LENGTH ? key : "";
}

export function isTestSwitcherConfigured() {
  return configuredKey().length > 0;
}

export function testSwitcherKeyMatches(candidate: string) {
  const key = configuredKey();
  if (!key || !candidate) return false;
  const expected = Buffer.from(key, "utf8");
  const actual = Buffer.from(candidate, "utf8");
  // timingSafeEqual throws on a length mismatch, so the lengths are compared
  // first - the length is not the secret, the bytes are.
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/**
 * May this address unlock the switcher by being an admin?
 *
 * ADMIN_EMAILS, MINUS the QA namespace - and that second half is the whole
 * point. Once `admin@click.local` is listed there (which it must be for the
 * Admin persona to reach the console), a tester who unlocked with
 * TEST_SWITCHER_KEY can switch to that persona and mint an admin grant from
 * it. That grant is revoked through ADMIN_EMAILS, not through the key, so
 * clearing TEST_SWITCHER_KEY would no longer lock them out - a key-scoped
 * tester would have quietly upgraded to an unlock you cannot take back
 * without also breaking the Admin persona.
 *
 * Refusing the namespace costs nothing: reaching a QA persona ALREADY required
 * an unlock, so a persona has never needed to mint one.
 */
function adminMayUnlock(email: string) {
  if (email.trim().toLowerCase().endsWith("@click.local")) return false;
  return isAdminEmail(email);
}

/**
 * The cookie value that unlocks the switcher for an admin, or "" if this
 * address may not have one or it cannot be signed.
 */
export function mintAdminUnlockCookie(email: string) {
  if (!adminMayUnlock(email)) return "";
  return mintQaAdminGrant(email, process.env.AUTH_SECRET);
}

/**
 * Does this cookie carry a signed grant for an address that is an admin RIGHT
 * NOW? Deliberately not "was an admin when the grant was issued" - ADMIN_EMAILS
 * is re-read here on every gated request, so removing an address revokes the
 * unlock it was granted without touching the browser holding it.
 */
function adminGrantHolds(cookieValue: string) {
  const email = readQaAdminGrant(cookieValue, process.env.AUTH_SECRET);
  // adminMayUnlock, not isAdminEmail - the namespace rule is enforced HERE as
  // well as at the mint, so a grant issued before that rule existed is inert
  // rather than grandfathered in.
  return !!email && adminMayUnlock(email);
}

/**
 * True when the QA persona switcher may be used by THIS request. Local dev
 * keeps working with no key set, exactly as before.
 */
export async function isTestSwitcherUnlocked() {
  if (isLocalDevelopment()) return true;
  try {
    const jar = await cookies();
    const cookie = jar.get(TEST_SWITCHER_COOKIE)?.value ?? "";
    // Both comparisons reject an empty cookie, and testSwitcherKeyMatches also
    // rejects everything when no key is configured - so a deployment with
    // neither TEST_SWITCHER_KEY nor ADMIN_EMAILS set is closed to everyone.
    return adminGrantHolds(cookie) || testSwitcherKeyMatches(cookie);
  } catch {
    // Called outside a request scope, so there is no cookie to read. Fail
    // closed: an unreadable gate is a shut gate.
    return false;
  }
}

export async function assertTestSwitcherUnlocked(feature: string): Promise<void> {
  if (!(await isTestSwitcherUnlocked())) {
    throw new Error(`${feature} is only available to an unlocked QA session.`);
  }
}
