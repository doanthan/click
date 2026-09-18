import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");

// Source-shape assertions, in the style of release-config.test.mjs: these pin
// decisions whose cost only shows up against a LIVE Stripe key, where a test
// that actually exercised the path would move real money.

test("a refund retry must not settle the booking a second time", () => {
  const repo = read("src/lib/event-repository.ts");
  const start = repo.indexOf("export async function retryRefundFailureAsAdmin");
  assert.ok(start > -1, "expected retryRefundFailureAsAdmin to exist");
  const end = repo.indexOf("\nexport async function", start + 1);
  const body = repo.slice(start, end === -1 ? undefined : end);

  // Every writer of a refund_failures row (cancelRegistration,
  // cancelGuestSeatForPurchaser, cancelMerchantEvent, and the
  // settled-after-cancellation branch of markPaymentSucceeded) had ALREADY
  // cancelled the seat and emailed the attendee before the Stripe call that
  // then failed. issueRefund's settleBooking path cancels the seat, releases it
  // to the waitlist and sends a cancellation email - so passing it here would
  // cancel an already-cancelled seat and send a second cancellation to someone
  // who is only waiting on money.
  assert.doesNotMatch(
    body,
    /settleBooking/,
    "retryRefundFailureAsAdmin must not pass settleBooking - the seat was already cancelled by whoever wrote the failure row",
  );

  // It must still send the refund receipt the original failure ate, with the
  // seat left alone.
  assert.match(
    body,
    /settleRefundedBooking\(\{[\s\S]*?releaseSeat:\s*false[\s\S]*?notify:\s*true/,
    "the retry must confirm the refund to the attendee with releaseSeat false",
  );
});

test("clearing a refund failure by hand is never recorded as a completed refund", () => {
  const repo = read("src/lib/event-repository.ts");
  const start = repo.indexOf("export async function dismissRefundFailureAsAdmin");
  assert.ok(start > -1, "expected dismissRefundFailureAsAdmin to exist");
  const end = repo.indexOf("\nexport async function", start + 1);
  const body = repo.slice(start, end === -1 ? undefined : end);

  // stripe-sync.ts auto-resolves rows with `resolution = 'pending'` when it
  // observes the money actually move. Writing 'resolved' here would make an
  // operator's judgement call indistinguishable from a refund Stripe confirmed.
  assert.match(body, /resolution = 'dismissed'/, "a manual clear must be 'dismissed'");
  assert.doesNotMatch(
    body,
    /resolution = 'resolved'/,
    "a manual clear must never be written as 'resolved'",
  );
});

test("admin power is revoked by the email list, not just by profiles.role", () => {
  const repo = read("src/lib/event-repository.ts");
  const start = repo.indexOf("async function requireAdminProfile");
  assert.ok(start > -1, "expected requireAdminProfile to exist");
  const body = repo.slice(start, start + 700);

  // profiles.role is sticky - ensureProfileForSessionUncached promotes to
  // 'admin' but its upsert never demotes ("when profiles.role = 'admin' then
  // profiles.role"). Guarding on role alone means removing someone from
  // ADMIN_EMAILS locks them out of the console shell while leaving every admin
  // server action and the role-guarded API routes open to them.
  assert.match(
    body,
    /isAdminEmail\(/,
    "requireAdminProfile must consult the configured admin list, not only profiles.role",
  );
});

test("there is exactly one implementation of who counts as an admin", () => {
  const auth = read("src/auth.ts");
  const repo = read("src/lib/event-repository.ts");

  // Both used to parse ADMIN_EMAILS themselves and disagreed on the empty case:
  // auth.ts fell back to nobody in production, event-repository.ts fell back to
  // the fixed address admin@click.local with no environment guard.
  assert.match(
    auth,
    /export \{ isAdminEmail \} from "@\/lib\/admin-emails"/,
    "src/auth.ts must re-export isAdminEmail rather than define its own",
  );
  assert.doesNotMatch(
    repo,
    /process\.env\.ADMIN_EMAILS/,
    "event-repository.ts must not parse ADMIN_EMAILS itself",
  );
});

test("the sidebar counts money waiting on a person, not the size of the ledger", () => {
  const repo = read("src/lib/event-repository.ts");
  const start = repo.indexOf("export async function getAdminSidebarCounts");
  assert.ok(start > -1, "expected getAdminSidebarCounts to exist");
  const end = repo.indexOf("\nexport async function", start + 1);
  const body = repo.slice(start, end === -1 ? undefined : end);

  assert.match(body, /refund_failures where resolution = 'pending'/);
  assert.match(body, /payment_disputes where is_open/);
});

test("disputes are mirrored to a table, not only appended to the audit log", () => {
  const sync = read("src/lib/stripe-sync.ts");
  const start = sync.indexOf("export async function recordDisputeAudit");
  assert.ok(start > -1, "expected recordDisputeAudit to exist");
  const body = sync.slice(start);

  // audit_logs answers "what happened"; it cannot answer "what is open and what
  // is due first", which is the only question that matters before a Stripe
  // evidence deadline passes.
  assert.match(body, /insert into payment_disputes/);
  assert.match(body, /on conflict \(stripe_dispute_id\) do update/);
  assert.match(
    body,
    /evidence_details\?\.due_by/,
    "the evidence deadline is the whole point of surfacing a dispute",
  );
  assert.match(body, /writeAuditLog\(/, "the immutable audit row must still be written");
});

test("a deleted account is opted out explicitly, never by an empty prefs object", () => {
  const repo = read("src/lib/event-repository.ts");
  const start = repo.indexOf("export async function anonymiseMemberAsAdmin");
  assert.ok(start > -1, "expected anonymiseMemberAsAdmin to exist");
  const end = repo.indexOf("\nexport async function", start + 1);
  const body = repo.slice(start, end === -1 ? undefined : end);

  // The senders read this as
  // `coalesce((notification_prefs->>'eventReminders')::boolean, true)` - an
  // empty object means opted IN, so '{}' here would keep queueing mail at a
  // deleted account's placeholder address.
  assert.match(body, /"eventReminders":false/);
  assert.match(body, /"mutualClick":false/);
  assert.doesNotMatch(
    body,
    /notification_prefs = '\{\}'::jsonb/,
    "an empty notification_prefs reads as opted in, not opted out",
  );

  // The photo lives in a PUBLIC bucket keyed by profile id: clearing photo_url
  // alone leaves it fetchable by anyone holding the URL.
  assert.match(body, /deleteAvatarObject\(/, "the avatar object itself must be removed");
});

test("a deleted account stops being a person on every public surface", () => {
  const repo = read("src/lib/event-repository.ts");

  // The profile page. The scrub deliberately keeps the row so bookings and
  // payments stay linked, which means /profile/<uuid> would otherwise still
  // render - a tombstone at a URL someone may still hold.
  const publicStart = repo.indexOf("export async function getPublicProfileById");
  assert.ok(publicStart > -1, "expected getPublicProfileById to exist");
  const publicEnd = repo.indexOf("\nexport async function", publicStart + 1);
  const publicBody = repo.slice(publicStart, publicEnd === -1 ? undefined : publicEnd);
  assert.match(
    publicBody,
    /and deleted_at is null/,
    "the public profile projection must exclude de-identified accounts",
  );

  // The who's-going list is the one public surface that renders a person by
  // NAME and links to that profile, so a miss here is a dead link beside a
  // tombstone rather than a silently absent face.
  const previewStart = repo.indexOf("export async function getEventAttendeePreview");
  assert.ok(previewStart > -1, "expected getEventAttendeePreview to exist");
  const previewEnd = repo.indexOf("\nexport async function", previewStart + 1);
  const previewBody = repo.slice(previewStart, previewEnd === -1 ? undefined : previewEnd);
  assert.match(previewBody, /and profile\.deleted_at is null/);

  // And the scrub itself clears the attendee-list opt-out every other
  // who's-going query already honours, so surfaces this test does not name
  // still drop the account.
  const scrubStart = repo.indexOf("export async function anonymiseMemberAsAdmin");
  const scrubEnd = repo.indexOf("\nexport async function", scrubStart + 1);
  const scrubBody = repo.slice(scrubStart, scrubEnd === -1 ? undefined : scrubEnd);
  assert.match(scrubBody, /default_attend_visibility = false/);
  assert.match(scrubBody, /social_visible = false/);
});

test("a refund taken in the Stripe dashboard releases the seat", () => {
  const route = read("src/app/api/webhooks/stripe/route.ts");
  const start = route.indexOf('case "charge.refunded"');
  assert.ok(start > -1, "expected a charge.refunded case");
  const end = route.indexOf("case ", start + 10);
  const body = route.slice(start, end === -1 ? undefined : end);

  // syncTransactionFromStripe only enriches the ledger. Without this call an
  // operator refunding from the Stripe dashboard moved the money while the
  // attendee kept a confirmed seat, blocked the waitlist and heard nothing -
  // and /admin/transactions was the only path that behaved.
  assert.match(
    body,
    /settleRefundedBooking\(\{/,
    "charge.refunded must settle the booking, not just sync the ledger",
  );

  // Full refunds only. A partial refund is a cancellation tier or a goodwill
  // adjustment; that attendee is still going and must keep their seat.
  assert.match(
    body,
    /synced\.status === "refunded"/,
    "the settle must be gated on a FULL refund",
  );

  // Every other refund path fires charge.refunded too, and all four of them
  // already message the attendee. A bare `notify: true` here would hand them
  // a second refund receipt behind their own.
  assert.match(
    body,
    /notify:\s*"if-released"/,
    'charge.refunded must use notify: "if-released", never a bare true',
  );
});

test('settleRefundedBooking\'s "if-released" only emails when it freed the seat', () => {
  const repo = read("src/lib/event-repository.ts");
  const start = repo.indexOf("export async function settleRefundedBooking");
  assert.ok(start > -1, "expected settleRefundedBooking to exist");
  const end = repo.indexOf("\nexport async function", start + 1);
  const body = repo.slice(start, end === -1 ? undefined : end);

  // The seat release was already idempotent - it updates only rows still in
  // 'confirmed'/'pending_payment' and promotes the queue only when that
  // matched. The email was the one side effect NOT under that test, so
  // webhook re-entry behind an admin refund would double-send.
  assert.match(
    body,
    /seatWasReleased = true/,
    "the seat release must record whether THIS call freed the seat",
  );
  assert.match(
    body,
    /input\.notify === "if-released" \? seatWasReleased : input\.notify/,
    'the email must follow seatWasReleased when notify is "if-released"',
  );

  // The two callers that pass releaseSeat:false (a retried refund failure and
  // the settled-after-cancellation branch) want the receipt with no seat work
  // at all, so a plain boolean must still send unconditionally.
  assert.match(
    body,
    /notify: boolean \| "if-released"/,
    "notify must stay a plain boolean for the callers that always send",
  );
});

test("syncTransactionFromStripe reports what the webhook needs to gate on", () => {
  const sync = read("src/lib/stripe-sync.ts");
  const start = sync.indexOf("export async function syncTransactionFromStripe");
  assert.ok(start > -1, "expected syncTransactionFromStripe to exist");
  const end = sync.indexOf("\n// ---", start + 1);
  const body = sync.slice(start, end === -1 ? undefined : end);

  // Narrowing this back to { updated, refundsUpserted } would silently turn
  // the charge.refunded settle into dead code - synced.status would be
  // undefined and the guard would never fire.
  for (const field of ["paymentTransactionId", "status", "refundedAmountCents"]) {
    assert.match(
      body,
      new RegExp(`${field}:`),
      `the return must carry ${field} so charge.refunded can settle the booking`,
    );
  }

  // Both early returns have to carry the widened shape or TypeScript is the
  // only thing standing between a miss and a runtime undefined.
  const earlyReturns = body.match(/return \{\s*updated: false/g) ?? [];
  assert.equal(
    earlyReturns.length,
    2,
    "expected both early returns to still use the object form",
  );
});

test("a refund still settling counts as refunded, exactly as issueRefund counts it", () => {
  const sync = read("src/lib/stripe-sync.ts");

  // issueRefund sums the local payment_refunds rows over ('succeeded','pending')
  // to set refunded_amount_cents. If the Stripe-side summary disagrees, the two
  // halves of the same refund tell the ledger different stories the moment a
  // refund is not instantaneous:
  //   - a PARTIAL pending refund sums to 0 here, derives 'paid', and the 055
  //     terminal-status trigger refuses the write - so every charge.refunded
  //     delivery 500s and Stripe retries until the refund settles;
  //   - a FULL pending refund clears the trigger (charge.refunded is already
  //     true) and writes refunded_amount_cents = 0, which is the number that
  //     then goes out in the attendee's "refunded $0.00" email.
  assert.match(
    sync,
    /and status in \('succeeded', 'pending'\)/,
    "issueRefund's local sum is the contract the Stripe-side summary matches",
  );

  const start = sync.indexOf("function summariseRefunds");
  assert.ok(start > -1, "expected summariseRefunds to exist");
  const body = sync.slice(start, sync.indexOf("\n}", start));
  assert.match(
    body,
    /r\.status === "succeeded" \|\| r\.status === "pending"/,
    "summariseRefunds must count pending refunds the way issueRefund does",
  );

  // 'failed' and 'canceled' must still fall out - dropping them is what lets a
  // sync walk a transaction back to 'paid' after a refund bounces.
  assert.doesNotMatch(body, /"failed"|"canceled"/);
});

test("releasing a seat always releases the +1 seats riding on the same hold", () => {
  const repo = read("src/lib/event-repository.ts");

  // Four paths release a held seat. Every one of them has to drop the guest
  // seats bought on the same payment transaction; markPaymentFailed - the
  // checkout.session.expired path - was the one that did not, and left its
  // 'unnamed' guest_spots behind for good.
  const start = repo.indexOf("export async function markPaymentFailed");
  assert.ok(start > -1, "expected markPaymentFailed to exist");
  const body = repo.slice(start, repo.indexOf("\n// ---", start));
  assert.match(
    body,
    /cancelGuestSeatsForTransaction\(client, payment\.id\)/,
    "markPaymentFailed must cancel the guest seats on the failed transaction",
  );
  // Same statement, same rule as every other release path: a cancelled seat
  // does not keep a hold deadline.
  assert.match(body, /set status = 'cancelled', hold_expires_at = null/);
});

test("giving up a live hold closes the Stripe Session, not just our side of it", () => {
  const repo = read("src/lib/event-repository.ts");
  const start = repo.indexOf("export async function cancelRegistration");
  assert.ok(start > -1, "expected cancelRegistration to exist");
  const body = repo.slice(start, repo.indexOf("\nexport ", start + 1));

  // The hold release only ever closed our side. The Session kept the original
  // 31-minute expires_at, so a buyer who backed out with the checkout modal
  // still open could pay against a booking already torn down - handled
  // correctly by markPaymentSucceeded's auto-refund, but a charge that
  // immediately reverses still costs us Stripe's non-refundable processing fee
  // and puts a charge plus a refund on the buyer's statement.
  assert.match(body, /pt\.stripe_checkout_session_id as txn_checkout_session_id/);
  assert.match(body, /abandonedCheckoutSessionId = row\.txn_checkout_session_id/);
  assert.match(body, /checkout\.sessions\.expire\(abandonedCheckoutSessionId\)/);

  // It has to run AFTER the commit - a Stripe round trip inside the
  // transaction holds a pool connection open across the network.
  const commit = body.indexOf('await client.query("commit")');
  assert.ok(
    body.indexOf("checkout.sessions.expire") > commit,
    "the expire call must run post-commit",
  );
});

test("bulk-cancel refunds are bounded by the size of the pool", () => {
  const repo = read("src/lib/event-repository.ts");
  const pool = read("src/lib/postgres.ts");

  // The pool the limiter exists to respect. If someone raises `max`, the
  // default concurrency is what they should be thinking about.
  assert.match(pool, /max: 5,/);
  assert.match(pool, /export async function mapWithConcurrency/);
  assert.match(
    pool,
    /limit = 4,/,
    "the default must stay under the pool's max so a fan-out leaves a connection for the rest of the request",
  );

  const start = repo.indexOf("async function cancelEvent(");
  assert.ok(start > -1, "expected cancelEvent to exist");
  const body = repo.slice(start, repo.indexOf("\nexport ", start + 1));

  // Every arm of this fan-out takes a pool connection - issueRefund, the
  // refund_failures insert, logBookingEvent, logEmailEvent - and the list is as
  // long as the event was popular. Unbounded, a sold-out cancel starves its own
  // refunds on a 5-second acquire timeout, and the catch below files each one
  // as a refund failure: a self-inflicted outage that reads like Stripe
  // refusing the money.
  assert.match(body, /await mapWithConcurrency\(\s*affectedProfiles,/);
  assert.doesNotMatch(
    body,
    /await Promise\.all\(\s*affectedProfiles\.map/,
    "the refund fan-out must not go back to an unbounded Promise.all",
  );
});

test("a cancel route gets long enough to finish issuing its refunds", () => {
  // Being killed mid-fan-out is the one failure cancelEvent cannot retry: past
  // the commit the event IS cancelled and an unknown number of refunds have
  // gone out, which is why it throws PartialCancellationError rather than
  // inviting a second cancel.
  for (const route of [
    "src/app/api/merchant/events/[eventId]/cancel/route.ts",
    "src/app/api/admin/events/[eventId]/cancel/route.ts",
  ]) {
    assert.match(read(route), /export const maxDuration = 300;/, `${route} needs a maxDuration`);
  }
});

test("a host is told when Stripe stops their events selling", () => {
  const repo = read("src/lib/event-repository.ts");
  const start = repo.indexOf("async function announceChargeCapabilityChange");
  assert.ok(start > -1, "expected announceChargeCapabilityChange to exist");
  const body = repo.slice(start, repo.indexOf("\nexport ", start + 1));

  // createPaymentHold already refuses every buyer once charges_enabled goes
  // false, so no money can go astray - but the host is the only person who can
  // clear it with Stripe, and until this existed nobody told them. Their events
  // stayed on Discover looking bookable and converted nobody.
  assert.match(body, /price_cents > 0/, "only paid events are affected");
  assert.match(body, /if \(affectedCount === 0\) return;/);
  assert.match(body, /insert into notifications/);
  assert.match(
    body,
    /if \(chargesEnabled\) return;/,
    "the restore edge posts the in-app notice and stops - a second email trains hosts to ignore the first",
  );
  assert.match(body, /template: "payments-paused-merchant"/);

  // The edge, not the level. This sync runs on every account.updated Stripe
  // sends, so writing false over false must stay silent.
  const sync = repo.indexOf("export async function updateMerchantConnectStatus");
  const syncBody = repo.slice(sync, repo.indexOf("\nexport ", sync + 1));
  assert.match(syncBody, /with before as \(/, "the pre-image needs a CTE - returning only sees the new row");
  assert.match(syncBody, /b\.charges_enabled as was_charges_enabled/);
  assert.match(syncBody, /if \(row\.was_charges_enabled !== status\.chargesEnabled\)/);

  // A courtesy email must never turn a capability sync into a Stripe retry.
  assert.match(syncBody, /catch \(error\) \{[\s\S]*?console\.warn\(/);
});

test("the dispute audit follows the money, not just the argument", () => {
  const webhook = read("src/app/api/webhooks/stripe/route.ts");
  // A dispute can sit 'under_review' for weeks with the charge and the fee
  // already withdrawn. Without these two, /admin/audit shows the dispute
  // opening and closing but never the moment the money left or came back.
  assert.match(webhook, /case "charge\.dispute\.funds_withdrawn":/);
  assert.match(webhook, /case "charge\.dispute\.funds_reinstated":/);
});
