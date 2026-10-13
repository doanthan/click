import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { releasableCents } from "../src/lib/payout-release.ts";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");

// Hosts are paid after their event: payouts are manual and the daily
// release-payouts cron pays out the balance minus what upcoming events hold.

test("everything goes out once no event holds it", () => {
  assert.equal(releasableCents({ availableCents: 10_000, pendingCents: 0, heldCents: 0 }), 10_000);
});

test("an upcoming event's money still in pending does not block an ended event's", () => {
  // $100 cleared from an event that ended, $50 still pending for one next week.
  // Subtracting the hold from `available` alone would wrongly release only $50.
  assert.equal(
    releasableCents({ availableCents: 10_000, pendingCents: 5_000, heldCents: 5_000 }),
    10_000,
  );
});

test("an upcoming event's money that has cleared stays put", () => {
  assert.equal(
    releasableCents({ availableCents: 15_000, pendingCents: 0, heldCents: 5_000 }),
    10_000,
  );
});

test("an ended event whose payment has not cleared waits for a later run", () => {
  assert.equal(releasableCents({ availableCents: 0, pendingCents: 10_000, heldCents: 0 }), 0);
});

test("never pays out when refunds or holds exceed the balance", () => {
  assert.equal(releasableCents({ availableCents: -2_000, pendingCents: 0, heldCents: 0 }), 0);
  assert.equal(releasableCents({ availableCents: 3_000, pendingCents: 0, heldCents: 5_000 }), 0);
});

test("the release cron is scheduled", () => {
  const config = JSON.parse(read("vercel.json"));
  assert.ok(
    config.crons.some((cron) => cron.path === "/api/cron/release-payouts"),
    "without the cron, manual payouts are never released and hosts are never paid",
  );
});

test("the hold covers cancelled events and stays inside Stripe's 90-day limit", () => {
  const sync = read("src/lib/stripe-sync.ts");
  const fn = sync.slice(sync.indexOf("export async function releaseHeldPayouts"));
  // A cancelled event's refunds may still need the money.
  assert.match(fn, /e\.status = 'cancelled'/);
  // Stripe requires manual-payout funds to go out within 90 days in Australia.
  assert.match(fn, /make_interval\(days => \$2\)/);
  assert.match(fn, /PAYOUT_MAX_HOLD_DAYS/);
  // Seed placeholders (acct_seed_*) are not real Stripe accounts.
  assert.match(fn, /isRealConnectAccountId\(accountId\)/);
  // An overlapping manual run must not pay a host twice.
  assert.match(fn, /idempotencyKey:/);
});
