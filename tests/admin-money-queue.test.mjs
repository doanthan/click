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
