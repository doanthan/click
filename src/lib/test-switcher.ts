import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { isLocalDevelopment } from "@/lib/runtime-mode";

// The QA persona switcher used to be hard-gated to localhost. It now also runs
// on a deployed environment, but ONLY for someone holding TEST_SWITCHER_KEY.
// It hands out admin and merchant sessions, so an open switcher on
// letsclick.app would be an unauthenticated admin console - the key is the
// whole security boundary, not a convenience.
//
// Unlock: /qa-unlock?key=<TEST_SWITCHER_KEY> stores the key in an httpOnly
// cookie. Every gate below re-reads both the cookie AND the env var, so
// removing TEST_SWITCHER_KEY in Vercel locks everyone out immediately - no
// deploy, no cookie clearing, no code change.
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
 * True when the QA persona switcher may be used by THIS request. Local dev
 * keeps working with no key set, exactly as before.
 */
export async function isTestSwitcherUnlocked() {
  if (isLocalDevelopment()) return true;
  if (!isTestSwitcherConfigured()) return false;
  try {
    const jar = await cookies();
    return testSwitcherKeyMatches(jar.get(TEST_SWITCHER_COOKIE)?.value ?? "");
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
