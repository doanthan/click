import assert from "node:assert/strict";
import test from "node:test";

// The real shipping helper, not a copy. Node strips the type annotations on
// import (Node >= 22.18 / >= 23.6); the repo runs Node 24. src/lib/qa-admin-grant.ts
// is dependency-free for exactly this reason - the same trick tests/admin-emails.test.mjs
// uses, and the reason the ADMIN_EMAILS half of the check lives in the caller.
import { mintQaAdminGrant, readQaAdminGrant } from "../src/lib/qa-admin-grant.ts";
import { isAdminEmail } from "../src/lib/admin-emails.ts";

// Why this file exists: the cookie this token goes into is the whole security
// boundary in front of the QA persona switcher, which will mint an
// admin@click.local session for anyone holding it. A grant that a browser could
// forge would be an unauthenticated admin console on a public domain.
const SECRET = "test-auth-secret-long-enough-to-sign";
const OTHER_SECRET = "a-different-secret-of-usable-length";

test("a grant round-trips back to the address it was issued to", () => {
  const cookie = mintQaAdminGrant("admin@example.com", SECRET);
  assert.equal(readQaAdminGrant(cookie, SECRET), "admin@example.com");
});

test("the address is normalised so the ADMIN_EMAILS check sees what it expects", () => {
  // isAdminEmail lowercases before comparing, but the signature is over the
  // exact bytes - minting "Admin@Example.com" and reading back a differently
  // cased string would verify against a different HMAC and fail.
  const cookie = mintQaAdminGrant("  Admin@Example.COM ", SECRET);
  assert.equal(readQaAdminGrant(cookie, SECRET), "admin@example.com");
});

test("swapping the address in a valid grant invalidates it", () => {
  // The attack this stops: an admin's own cookie, edited in devtools to name a
  // different address, or a tester's cookie edited to name an admin's.
  const cookie = mintQaAdminGrant("admin@example.com", SECRET);
  const forged = cookie.replace("admin@example.com", "attacker@example.com");
  assert.notEqual(forged, cookie);
  assert.equal(readQaAdminGrant(forged, SECRET), null);
});

test("a tampered signature is rejected, including one of the right length", () => {
  const cookie = mintQaAdminGrant("admin@example.com", SECRET);
  const split = cookie.lastIndexOf(":");
  const signature = cookie.slice(split + 1);

  // Same length, one nibble different - the case timingSafeEqual exists for.
  const flipped = (signature[0] === "0" ? "1" : "0") + signature.slice(1);
  assert.equal(readQaAdminGrant(`${cookie.slice(0, split)}:${flipped}`, SECRET), null);

  // Truncated: timingSafeEqual THROWS on a length mismatch, so the length has
  // to be compared first or this is a 500 instead of a closed gate.
  assert.equal(
    readQaAdminGrant(`${cookie.slice(0, split)}:${signature.slice(0, 8)}`, SECRET),
    null,
  );
});

test("a grant signed with another secret is rejected", () => {
  // Rotating AUTH_SECRET must revoke every grant already handed out.
  const cookie = mintQaAdminGrant("admin@example.com", OTHER_SECRET);
  assert.equal(readQaAdminGrant(cookie, SECRET), null);
});

test("an unusable secret refuses to sign AND refuses to verify", () => {
  // A deployment with AUTH_SECRET missing or set to a placeholder must fail
  // closed at both ends - never sign everything with "" and then happily
  // verify it.
  for (const secret of [undefined, "", "   ", "too-short"]) {
    assert.equal(mintQaAdminGrant("admin@example.com", secret), "");
  }
  const cookie = mintQaAdminGrant("admin@example.com", SECRET);
  for (const secret of [undefined, "", "   ", "too-short"]) {
    assert.equal(readQaAdminGrant(cookie, secret), null);
  }
});

test("nothing that isn't a grant is read as one", () => {
  // The same cookie also carries the TEST_SWITCHER_KEY path's value, which is
  // the raw key. It must never be mistaken for a grant, and vice versa.
  for (const value of [
    "",
    "admin:",
    "admin:admin@example.com",
    "admin:admin@example.com:",
    ":admin@example.com:deadbeef",
    "a-perfectly-long-test-switcher-key",
    "admin@example.com",
  ]) {
    assert.equal(readQaAdminGrant(value, SECRET), null, `${value || "(empty)"} must not verify`);
  }
});

test("an empty address is never granted", () => {
  for (const email of ["", "   "]) {
    assert.equal(mintQaAdminGrant(email, SECRET), "");
  }
});

// The composition src/lib/test-switcher.ts runs on every gated request, against
// the REAL isAdminEmail rather than a stand-in. A signature only proves the
// grant was issued by this deployment; whether it still counts is a question
// about ADMIN_EMAILS right now.
function grantHolds(cookieValue, secret) {
  const email = readQaAdminGrant(cookieValue, secret);
  return !!email && isAdminEmail(email);
}

test("dropping an address from ADMIN_EMAILS revokes the grant it already issued", () => {
  const previous = process.env.ADMIN_EMAILS;
  try {
    process.env.ADMIN_EMAILS = "ops@example.com, admin@example.com";
    const cookie = mintQaAdminGrant("admin@example.com", SECRET);
    assert.equal(grantHolds(cookie, SECRET), true);

    // The cookie in the browser has not changed and its signature is still
    // valid - the environment is what withdrew the power. No deploy, nothing to
    // clear in the tester's browser, same shape as clearing TEST_SWITCHER_KEY.
    process.env.ADMIN_EMAILS = "ops@example.com";
    assert.equal(readQaAdminGrant(cookie, SECRET), "admin@example.com");
    assert.equal(grantHolds(cookie, SECRET), false);

    // And an unset variable grants nobody anything.
    delete process.env.ADMIN_EMAILS;
    assert.equal(grantHolds(cookie, SECRET), false);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = previous;
  }
});
