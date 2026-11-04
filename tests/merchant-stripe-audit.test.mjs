import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  MIN_PAID_TICKET_CENTS,
  chargeSplitAfterRefunds,
  ticketPriceError,
  ticketSplit,
} from "../src/lib/ticket-price.ts";
import {
  hostRequirementPhrases,
  joinPhrases,
  onlyStripeIsReviewing,
  requirementInPlainWords,
} from "../src/lib/stripe-requirements.ts";
import { eventMoneyState, PAYOUT_RELEASE_DELAY_HOURS } from "../src/lib/payout-release.ts";
import {
  REQUIRED_STRIPE_WEBHOOK_EVENTS,
  missingWebhookEvents,
} from "../src/lib/stripe-webhook-events.ts";

// The merchant + Stripe audit fixes (context/MERCHANT_STRIPE_AUDIT_FOR_CINDY.md,
// fix numbers kept). Pure rules are exercised; money paths that would need a
// live Stripe key are pinned by source shape, in the style of
// release-config.test.mjs.

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const repo = read("src/lib/event-repository.ts");
const body = (source, start) => {
  const at = source.indexOf(start);
  assert.ok(at > -1, `${start} not found`);
  const next = source.indexOf("\nexport ", at + start.length);
  return source.slice(at, next === -1 ? undefined : next);
};

test("D3: paid tickets start at $10, free stays free", () => {
  assert.equal(MIN_PAID_TICKET_CENTS, 1000);
  assert.match(ticketPriceError(500), /Paid tickets start at \$10/);
  assert.equal(ticketPriceError(999) !== null, true);
  assert.equal(ticketPriceError(1000), null);
  assert.equal(ticketPriceError(0), null);
  // Enforced on the server for a new price, not just in the wizard.
  assert.match(body(repo, "export async function createEventForMerchant"), /ticketPriceError\(priceCents\)/);
  assert.match(
    body(repo, "export async function updateMerchantEventDetails"),
    /nextPriceCents !== event\.price_cents\s*\? ticketPriceError\(nextPriceCents\)/,
  );
});

test("fix 13: the wizard's split is checkout's arithmetic", () => {
  // D1: no booking fee - the guest pays the ticket price.
  assert.deepEqual(ticketSplit(1000, 290, 0), { guestPaysCents: 1000, hostKeepsCents: 971, clickKeepsCents: 29 });
  // With a booking fee on top: commission floors, booking fee rounds.
  assert.deepEqual(ticketSplit(1000, 290, 290), { guestPaysCents: 1029, hostKeepsCents: 971, clickKeepsCents: 58 });
  assert.deepEqual(ticketSplit(500, 290, 290), { guestPaysCents: 515, hostKeepsCents: 486, clickKeepsCents: 29 });
  assert.deepEqual(ticketSplit(0, 290, 290), { guestPaysCents: 0, hostKeepsCents: 0, clickKeepsCents: 0 });
  // The wizard gets both rates from the settings checkout charges with.
  const layout = read("src/app/merchant/events/create/layout.tsx");
  assert.match(layout, /const platformFeeBps = settings\.commissionRateBps;/);
  assert.match(layout, /const bookingFeeBps = settings\.bookingFeeBps;/);
});

test("fix 4: Stripe's requirements read as things a host can do", () => {
  assert.equal(requirementInPlainWords("individual.verification.document"), "a photo of your ID");
  assert.equal(requirementInPlainWords("external_account"), "your bank account");
  assert.equal(requirementInPlainWords("something.new.from.stripe"), "a few more details");
  const reqs = [
    { description: "external_account", awaiting: "user", status: "currently_due", errors: [] },
    { description: "individual.verification.document", awaiting: "user", status: "past_due", errors: [] },
    { description: "individual.dob.day", awaiting: "user", status: "eventually_due", errors: [] },
  ];
  // Soonest first, eventually_due left out (bug board #269).
  assert.deepEqual(hostRequirementPhrases(reqs), ["a photo of your ID", "your bank account"]);
  assert.equal(joinPhrases(["a", "b", "c"]), "a, b and c");
  assert.equal(
    onlyStripeIsReviewing([{ description: "x", awaiting: "stripe", status: "currently_due", errors: [] }]),
    true,
  );
  assert.equal(onlyStripeIsReviewing(reqs), false);
});

test("fix 4: the payouts page shows both capabilities and no dead end", () => {
  const page = read("src/app/merchant/onboarding/payouts/page.tsx");
  assert.match(page, /Taking payments/);
  assert.match(page, /Paying out to your bank/);
  // It used to branch on payouts alone and say "you're ready to take payments"
  // to a host whose charges were paused.
  assert.doesNotMatch(page, /you&apos;re ready to take payments/);
  assert.match(page, /const hostHasToAct = !connected \|\| toDo\.length > 0 \|\| \(!detailsSubmitted && !ready\);/);
  assert.match(page, /if \(params\.stripe === "return" && returnTo && connected && !hostHasToAct\)/);
  // The same serialised sync the webhook runs.
  assert.match(page, /await syncConnectAccount\(accountId\)/);
});

test("fix 8: payouts_enabled means bank payouts, charges need transfers", () => {
  const connect = read("src/lib/stripe-connect.ts");
  const map = body(connect, "export function mapAccountStatus");
  assert.match(map, /merchant\?\.capabilities\?\.stripe_balance\?\.payouts\?\.status === "active"/);
  assert.doesNotMatch(map, /stripe_transfers\?\.status === "active";\s*\/\/[^\n]*\n\s*const payoutsEnabled/);
  assert.match(
    map,
    /card_payments\?\.status === "active" &&\s*recipient\?\.capabilities\?\.stripe_balance\?\.stripe_transfers\?\.status === "active"/,
  );
});

test("fix 3: one Stripe account per host", () => {
  const ensure = body(repo, "export async function ensureMerchantConnectAccount");
  assert.match(ensure, /const client = await pool\.connect\(\);/);
  assert.match(ensure, /for update of m/);
  // read, create decision and save on the one locked client - never pool.query
  assert.doesNotMatch(ensure, /pool\.query\(/);
  // The attempt (id + exact details) is committed BEFORE the transaction, so
  // a retry after a failed save sends the same body under the same key.
  assert.ok(
    ensure.indexOf("insert into stripe_connect_attempts") < ensure.indexOf('await client.query("begin")'),
    "the attempt must be saved before the lock transaction opens",
  );
  assert.match(ensure, /created = await create\(saved\.details, saved\.attempt_id\);/);
  const connect = read("src/lib/stripe-connect.ts");
  assert.match(connect, /const key = `click-connect-\$\{options\.merchantProfileId\}-\$\{options\.attemptId\}`;/);
  assert.match(connect, /refusal\.type === "StripeIdempotencyError"\) throw error;/);
  const migration = read("database/078_merchant_payout_readiness.sql");
  assert.match(migration, /create unique index if not exists merchant_profiles_stripe_connect_account_id_key/);
});

test("fix 3b + 9: one publish rule, and it needs manual payouts confirmed", () => {
  assert.match(
    body(repo, "function merchantReadyForPaidEvents"),
    /merchant\.payouts_held_at !== null/,
  );
  assert.match(repo, /function merchantReadySql\(alias: string\) \{\s*return `\(\$\{alias\}\.charges_enabled and \$\{alias\}\.payouts_enabled and \$\{alias\}\.payouts_held_at is not null\)`;/);
  // Every publish path asks it.
  assert.match(body(repo, "export async function createEventForMerchant"), /merchantReadyForPaidEvents\(merchantProfile\)/);
  assert.match(body(repo, "export async function resubmitRejectedEvent"), /merchantReadyForPaidEvents\(merchant\)/);
  assert.match(body(repo, "export async function approveEventForAdmin"), /merchantReadySql\("m"\)/);
  assert.match(repo, /async function publishEventsHeldForPayouts[\s\S]*?\$\{merchantReadySql\("m"\)\}/);
  // A failed hold at creation is reported, not swallowed.
  const connect = read("src/lib/stripe-connect.ts");
  assert.match(connect, /const payoutsHeld = await holdPayouts\(account\.id\)\.then\(/);
});

test("fix 7: the payout run is locked, holds disputes, skips suspended hosts, alerts admins", () => {
  const sync = read("src/lib/stripe-sync.ts");
  const release = body(sync, "export async function releaseHeldPayouts");
  // Exclusive and waiting: overlapping runs serialise, and a host refund
  // (withPayoutRunShield, SHARED) can never straddle a run.
  assert.match(release, /pg_advisory_xact_lock\(hashtext\(\$1\)::bigint\)`, \[PAYOUT_RUN_LOCK\]/);
  assert.match(sync, /pg_try_advisory_xact_lock_shared\(hashtext\(\$1\)::bigint\)/);
  // Held money read per host, AFTER that host's balance, with recent pending
  // rows and open or lost-but-unreleased disputes counted.
  const held = sync.slice(sync.indexOf("async function heldForMerchant"));
  assert.match(held, /pt\.status = 'pending' and pt\.created_at > now\(\) - interval '2 hours'/);
  assert.match(held, /d\.is_open or \(d\.status = 'lost' and d\.reserve_released_at is null\)/);
  const under = sync.slice(sync.indexOf("async function releaseHeldPayoutsUnderLock"));
  assert.ok(
    under.indexOf("stripe.balance.retrieve(") < under.indexOf("heldForMerchant(db, accountId)"),
    "the hold must be read after the balance",
  );
  assert.match(under, /if \(host\.verification_status === "suspended"\) \{/);
  assert.match(under, /await markMerchantPayoutsHeld\(accountId\);/);
  assert.match(under, /savepoint release_host/);
  assert.match(under, /if \(failed\.length > 0\) \{\s*await notifyAdminsOfPayoutProblem\(/);
});

test("fix 25: the per-event money timeline follows the release rule", () => {
  const ends = new Date("2026-12-06T22:00:00Z");
  const booked = new Date("2026-11-20T00:00:00Z");
  const before = eventMoneyState({ endsAt: ends, cancelled: false, newestBookingAt: booked, now: new Date("2026-12-07T00:00:00Z") });
  assert.equal(before.state, "held");
  assert.equal(before.releaseAt.getTime(), ends.getTime() + PAYOUT_RELEASE_DELAY_HOURS * 3_600_000);
  assert.equal(
    eventMoneyState({ endsAt: ends, cancelled: false, newestBookingAt: booked, now: new Date("2026-12-10T00:00:00Z") }).state,
    "released",
  );
  // The 80-day cap wins when the newest booking is old enough.
  const farEvent = new Date("2027-06-01T00:00:00Z");
  const capped = eventMoneyState({ endsAt: farEvent, cancelled: false, newestBookingAt: booked, now: new Date("2027-03-01T00:00:00Z") });
  assert.equal(capped.state, "released");
  // A cancelled event is held for refunds - until the cap, not for ever.
  const cancelled = eventMoneyState({ endsAt: ends, cancelled: true, newestBookingAt: booked, now: new Date("2026-12-10T00:00:00Z") });
  assert.equal(cancelled.state, "held_for_refunds");
  assert.equal(eventMoneyState({ endsAt: ends, cancelled: true, newestBookingAt: booked, now: new Date("2027-03-01T00:00:00Z") }).state, "released");
});

test("fix 24: a row's split is what was kept after refunds", () => {
  assert.deepEqual(
    chargeSplitAfterRefunds({ amountCents: 1029, applicationFeeCents: 58, bookingFeeCents: 29, refundedCents: 0 }),
    { ticketCents: 1000, bookingFeeCents: 29, commissionCents: 29, netCents: 971 },
  );
  assert.deepEqual(
    chargeSplitAfterRefunds({ amountCents: 2000, applicationFeeCents: 58, bookingFeeCents: 0, refundedCents: 2000 }),
    { ticketCents: 0, bookingFeeCents: 0, commissionCents: 0, netCents: 0 },
  );
  const half = chargeSplitAfterRefunds({ amountCents: 2000, applicationFeeCents: 58, bookingFeeCents: 0, refundedCents: 1000 });
  assert.equal(half.ticketCents - half.commissionCents, half.netCents);
  assert.equal(half.ticketCents, 1000);
});

test("Codex review: lock holders never need a second pooled connection", () => {
  const sync = read("src/lib/stripe-sync.ts");
  const save = body(sync, "export async function savePayoutFromStripe");
  assert.match(save, /await upsertPayout\(payout, stripeAccountId, client\);/);
  const connectSync = body(sync, "export async function syncConnectAccount");
  assert.match(connectSync, /updateMerchantConnectStatus\(accountId, status, client\)/);
  assert.match(connectSync, /markMerchantPayoutsHeld\(accountId, client\)/);
});

test("Codex review: an edit sends an approved-but-held event back to review", () => {
  const edit = body(repo, "export async function updateMerchantEventDetails");
  assert.match(edit, /review_approved_at = case\s*when status = 'pending' and not \$15::boolean then null/);
  assert.match(edit, /merchant\.auto_approve_events === true,\s*\],/);
});

test("Codex review: a part refund must leave something, or it would release the seat", () => {
  const route = read("src/app/api/merchant/transactions/[id]/refund/route.ts");
  assert.match(route, /if \(raw >= remainingCents\) \{/);
  assert.match(route, /withPayoutRunShield\(async \(\) => \{\s*const \{ hostProfileId, remainingCents \} = await getRefundableBookingForMerchant/);
});

test("fix 2: every event the webhook acts on is one launch:check requires", () => {
  const route = read("src/app/api/webhooks/stripe/route.ts");
  for (const event of REQUIRED_STRIPE_WEBHOOK_EVENTS) {
    if (event === "account.updated") {
      assert.match(route, /type === "account\.updated"/);
    } else {
      assert.ok(route.includes(`case "${event}":`), `route has no case for ${event}`);
    }
  }
  assert.deepEqual(missingWebhookEvents(["*"]), []);
  assert.ok(missingWebhookEvents(["checkout.session.completed"]).includes("payout.paid"));
  assert.match(read("scripts/release-check.mjs"), /missingWebhookEvents\(/);
});

test("fix 26 + 27: payout emails once, payout status re-read under a lock", () => {
  const sync = read("src/lib/stripe-sync.ts");
  const save = body(sync, "export async function savePayoutFromStripe");
  assert.match(save, /pg_advisory_xact_lock/);
  assert.match(save, /stripe\.payouts\.retrieve\(/);
  assert.match(save, /await notifyMerchantOfPayout\(stripeAccountId, stripePayoutId\);/);
  const notify = body(repo, "export async function notifyMerchantOfPayout");
  assert.match(notify, /p\.sent_notified_at is null/);
  assert.match(notify, /p\.failed_notified_at is null/);

  // Every {{var}} in the two templates is one the code passes.
  // `name: value` or the `name,` shorthand, at the vars object's indent.
  const vars = new Set([...notify.matchAll(/^\s{8}(\w+)[:,]/gm)].map((m) => m[1]));
  for (const file of ["emails/payout-sent-merchant.html", "emails/payout-failed-merchant.html"]) {
    const html = read(file);
    assert.ok(!html.includes("—"), `${file} contains an em-dash`);
    for (const [, name] of html.matchAll(/\{\{(\w+)\}\}/g)) {
      assert.ok(vars.has(name), `${file} uses {{${name}}}, which notifyMerchantOfPayout never sets`);
    }
  }
  const email = read("src/lib/email.ts");
  for (const template of ["payout-sent-merchant", "payout-failed-merchant"]) {
    assert.match(email, new RegExp(`\\| "${template}"`));
    assert.match(email, new RegExp(`"${template}": \\(v\\) =>`));
  }
});

test("D4: an admin can approve a paid event before the host's payouts are ready", () => {
  const approve = body(repo, "export async function approveEventForAdmin");
  assert.doesNotMatch(approve, /Approve it once their payouts are active/);
  assert.match(approve, /void logEventAwaitingPayoutsEmail\(pool, heldEvent\.slug\);/);
  // Withdrawn by a rejection, and the admin queue stops asking twice.
  assert.match(body(repo, "export async function rejectEventForAdmin"), /review_approved_at = null,/);
  assert.match(repo, /from events where status = 'pending' and review_approved_at is null\) as events/);
  const queue = read("src/components/admin-event-queue.tsx");
  assert.match(queue, /disabled=\{isBusy \|\| !event\.approvable \|\| event\.approvedAwaitingPayouts\}/);
});

test("fix 31: a host refund is gated on ownership and on the money still being held", () => {
  const route = read("src/app/api/merchant/transactions/[id]/refund/route.ts");
  assert.ok(
    route.indexOf("getRefundableBookingForMerchant(") < route.indexOf("issueRefund("),
    "ownership is checked before Stripe is called",
  );
  assert.match(route, /settleBooking: mode === "cancel",/);
  const gate = body(repo, "export async function getRefundableBookingForMerchant");
  assert.match(gate, /pt\.merchant_profile_id = \$2::uuid\s*and e\.merchant_profile_id = \$2::uuid/);
  assert.match(gate, /make_interval\(hours => \$3\)/);
  assert.match(gate, /merchant\.verification_status !== "approved"/);
});

test("fix 30: the door list CSV defuses spreadsheet formulas and carries no emails", () => {
  const route = read("src/app/api/merchant/events/[eventId]/door-list/route.ts");
  assert.match(route, /\/\^\[=\+\\-@\\t\\r\]\/\.test\(value\)/);
  assert.doesNotMatch(route, /\.email\b/);
  assert.match(route, /getMerchantEventDetail\(eventId, session\)/);
});

test("fix 32: a paused host's paid event leaves the catalogue", () => {
  const explore = body(repo, "async function getEventsForExploreUncached");
  assert.match(explore, /event\.price_cents > 0\s*and merchant\.id is not null\s*and merchant\.charges_enabled is not true/);
  assert.match(read("src/app/events/[slug]/page.tsx"), /event\.ticketsPaused \? \(/);
});
