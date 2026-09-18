import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");

// Source-shape assertions, same reasoning as admin-money-queue.test.mjs: every
// path pinned here only misbehaves against a real Stripe key, where a test that
// exercised it would move real money.

function issueRefundBody() {
  const src = read("src/lib/stripe-sync.ts");
  const start = src.indexOf("export async function issueRefund");
  assert.ok(start > -1, "expected issueRefund to exist");
  const end = src.indexOf("\nexport async function", start + 1);
  return src.slice(start, end === -1 ? undefined : end);
}

test("the refund idempotency key is money only - never the reason", () => {
  const body = issueRefundBody();

  const key = body.match(/idempotencyKey:\s*\[([\s\S]*?)\]/);
  assert.ok(key, "expected issueRefund to pass an idempotencyKey to Stripe");

  // The reason is free text chosen per click, and the two callers disagree:
  // retryRefundFailureAsAdmin sends none, the ledger drawer sends one. Two
  // attempts at the SAME refund therefore hashed to different keys and Stripe
  // issued both. Only the money identifies a refund.
  assert.doesNotMatch(
    key[1],
    /reason/,
    "input.reason must not be part of the idempotency key - it makes one refund hash two ways",
  );

  for (const part of ["txn.id", "refunded_amount_cents", "requestedAmount"]) {
    assert.ok(
      key[1].includes(part),
      `the idempotency key must still carry ${part}`,
    );
  }
});

test("issueRefund reconciles with Stripe before it quotes a refundable balance", () => {
  const body = issueRefundBody();

  const syncAt = body.indexOf("syncTransactionFromStripe");
  const remainingAt = body.indexOf("const remaining =");
  const stripeCallAt = body.indexOf("stripe.refunds.create");

  assert.ok(syncAt > -1, "issueRefund must sync from Stripe");
  assert.ok(remainingAt > -1, "issueRefund must compute a remaining balance");
  assert.ok(stripeCallAt > -1, "issueRefund must call Stripe");

  // If a previous attempt reached Stripe but died before its local write, the
  // cached refunded_amount_cents is behind - so both the balance we validate
  // against AND the idempotency key are computed from a stale number, and a
  // retry for a different amount pays the attendee twice.
  assert.ok(
    syncAt < remainingAt,
    "the Stripe sync must run BEFORE the refundable balance is computed",
  );
  assert.ok(
    syncAt < stripeCallAt,
    "the Stripe sync must run BEFORE the refund is created",
  );
});

test("a queued refund failure is never closed by an unrelated refund", () => {
  const src = read("src/lib/stripe-sync.ts");

  // The old shape compared one queue row's amount against the charge's
  // CUMULATIVE refunded total, so a later discretionary refund silently closed
  // an earlier debt whose money never moved.
  assert.doesNotMatch(
    src,
    /resolution = 'pending'[\s\S]{0,120}?amount_cents <= \$\d/,
    "refund_failures must not be auto-resolved by comparing one row to the cumulative refunded total",
  );

  assert.match(
    src,
    /async function resolveCoveredRefundFailures/,
    "both auto-resolve sites must go through the shared helper",
  );

  const start = src.indexOf("async function resolveCoveredRefundFailures");
  const end = src.indexOf("\nfunction ", start + 1);
  const helper = src.slice(start, end === -1 ? undefined : end);

  // A debt is settled only if the money that moved covers everything already
  // credited against this charge plus the row itself.
  assert.match(
    helper,
    /resolution = 'resolved'/,
    "the helper must be the thing that writes 'resolved'",
  );
  assert.match(
    helper,
    /running_total/,
    "the helper must attribute refunds cumulatively, oldest debt first",
  );
});

test("a refund Stripe later reverses is not left on the books as paid back", () => {
  const route = read("src/app/api/webhooks/stripe/route.ts");

  // charge.refunded does NOT fire again when a pending refund is rejected by
  // the bank, so without these cases the ledger kept the money as returned
  // forever and the attendee was never told otherwise.
  for (const type of ["charge.refund.updated", "refund.updated", "refund.failed"]) {
    assert.ok(
      route.includes(`case "${type}"`),
      `the webhook must handle ${type}`,
    );
  }

  assert.match(
    route,
    /recordRefundReversal\(/,
    "a reversed refund must land in the operator queue, not just re-sync the ledger",
  );

  // Re-confirming someone who was already told their booking ended - possibly
  // after their seat went to the waitlist - is worse than a queue entry.
  const start = route.indexOf('case "charge.refund.updated"');
  const end = route.indexOf('case "charge.dispute.created"', start);
  const branch = route.slice(start, end === -1 ? undefined : end);
  assert.doesNotMatch(
    branch,
    /settleRefundedBooking|releaseSeat/,
    "a reversed refund must not silently un-cancel the attendee's seat",
  );
});

test("the terminal-status trigger can follow a failed refund back down", () => {
  const migration = read("database/066_failed_refund_walkback.sql");

  // 055 pinned 'refunded' as terminal on the premise that refunds are
  // irreversible. True of a succeeded refund, false of a pending one - and the
  // new webhook branch derives 'paid' again, which 055 raised on.
  assert.match(
    migration,
    /new\.refunded_amount_cents < old\.refunded_amount_cents/,
    "the escape hatch must require the cached refunded total to actually drop",
  );

  // A stale replay carries the old refunded amount, so it still hits the raise.
  assert.match(
    migration,
    /raise exception 'refunded payment transactions are terminal'/,
    "the original terminal guard must still be in place",
  );

  // The guard now reads refunded_amount_cents, so it has to fire when that
  // column moves - not only when status is in the SET list.
  assert.match(
    migration,
    /before update of status, refunded_amount_cents on payment_transactions/,
    "the trigger must fire on refunded_amount_cents too, or the guard is skipped",
  );
});

test("revenue is never summed as status = 'paid' alone", () => {
  const repo = read("src/lib/event-repository.ts");

  // `status = 'paid'` drops the WHOLE charge the moment any of it is refunded,
  // so a $1 refund erased $100 of revenue. Every money sum nets the refund
  // instead and includes partially_refunded.
  const offenders = [
    ...repo.matchAll(/sum\((?:pt\.)?amount_cents\)\s*\n?\s*filter \(where (?:pt\.)?status = 'paid'\)/g),
  ];
  assert.equal(
    offenders.length,
    0,
    "no revenue sum may filter on status = 'paid' without netting refunded_amount_cents",
  );

  const barePaid = [
    ...repo.matchAll(/sum\(amount_cents\), 0\)[\s\S]{0,200}?and status = 'paid'/g),
  ];
  assert.equal(
    barePaid.length,
    0,
    "no revenue subquery may restrict to status = 'paid' at face value",
  );
});

test("merchant event revenue is not multiplied by the attendee count", () => {
  const repo = read("src/lib/event-repository.ts");
  const start = repo.indexOf("export async function getAdminMerchantDetail");
  assert.ok(start > -1, "expected getAdminMerchantDetail to exist");
  const end = repo.indexOf("\nexport async function", start + 1);
  const body = repo.slice(start, end === -1 ? undefined : end);

  // Joining event_attendees AND payment_transactions to events pairs every
  // payment row with every attendee row. The counts survived on count(distinct);
  // the sums did not, so a 10-person event reported 10x its revenue.
  assert.doesNotMatch(
    body,
    /left join event_attendees[\s\S]{0,200}?left join payment_transactions pt on pt\.event_id = event\.id/,
    "payments must not be joined alongside attendees - that is a fan-out",
  );
  const lateralAt = body.indexOf("left join lateral (");
  assert.ok(
    lateralAt > -1,
    "per-event money must be aggregated in a lateral, which returns one row per event",
  );
  const lateral = body.slice(lateralAt, body.indexOf(") money on true", lateralAt));
  assert.match(
    lateral,
    /from payment_transactions pt\s*\n\s*where pt\.event_id = event\.id/,
    "the lateral must be the one that sums payment_transactions per event",
  );
});

test("the merchant queue floats pending applications instead of burying them", () => {
  const repo = read("src/lib/event-repository.ts");
  const start = repo.indexOf("export async function getAdminMerchants");
  assert.ok(start > -1, "expected getAdminMerchants to exist");
  const end = repo.indexOf("\nexport async function", start + 1);
  const body = repo.slice(start, end === -1 ? undefined : end);

  // It was `created_at desc limit 60` with no pagination and no search, so an
  // application still on 'pending' fell off the bottom and became unreviewable
  // while the sidebar badge went on counting it.
  assert.match(
    body,
    /order by\s*\n?\s*\(merchant\.verification_status = 'pending'\) desc/,
    "pending applications must sort first",
  );
  assert.match(
    body,
    /then merchant\.created_at end asc/,
    "among pending, the longest wait must come first",
  );
  assert.match(body, /ilike \$/, "the queue must be searchable server-side");
});

test("moderating a member does not depend on them being a recent signup", () => {
  const repo = read("src/lib/event-repository.ts");
  const start = repo.indexOf("export async function getAdminMembers");
  assert.ok(start > -1, "expected getAdminMembers to exist");
  const end = repo.indexOf("\nconst UUID_RE", start + 1);
  const body = repo.slice(start, end === -1 ? undefined : end);

  // Suspend, unsuspend and ban only exist inside a row of this list. While the
  // list was a fixed window of the newest signups with no server-side search,
  // anyone past it could not be moderated at all.
  assert.match(
    body,
    /profile\.display_name ilike|profile\.email::text ilike/,
    "getAdminMembers must accept a server-side search term",
  );
  assert.doesNotMatch(
    body,
    /limit 250\s*\n/,
    "the row cap must be a parameter, not hardcoded into the SQL",
  );
});

test("an approved venue change reaches the people who have to turn up", () => {
  const repo = read("src/lib/event-repository.ts");
  const start = repo.indexOf("export async function approveEventAddressChange");
  assert.ok(start > -1, "expected approveEventAddressChange to exist");
  const end = repo.indexOf("\n/**", start + 1);
  const body = repo.slice(start, end === -1 ? undefined : end);

  // The merchant got an in-app notification; the attendees - the only people
  // who have to be somewhere different - got nothing at all.
  assert.match(
    body,
    /notifyAttendeesOfAddressChange\(/,
    "approving an address change must fan out to the confirmed attendees",
  );

  // It was also the only admin mutation in the console with no audit row.
  assert.match(
    body,
    /action: "event\.address_change_approved"/,
    "approving an address change must be audited",
  );

  const rejectStart = repo.indexOf("export async function rejectEventAddressChange");
  const rejectEnd = repo.indexOf("\nexport async function", rejectStart + 1);
  const rejectBody = repo.slice(rejectStart, rejectEnd === -1 ? undefined : rejectEnd);
  assert.match(
    rejectBody,
    /action: "event\.address_change_rejected"/,
    "rejecting an address change must be audited - the request is discarded otherwise",
  );
  assert.match(
    rejectBody,
    /rejected_address/,
    "the audit row must carry the address that was refused",
  );
});

test("life-quiz tags cannot be silently retyped by opening the editor", () => {
  // The DB constraint allows four types. The admin UI allowed three and fell
  // back to 'interest' for anything else, so opening a life tag and pressing
  // Save re-applied exactly the corruption migration 057 exists to undo.
  const schema = read("database/001_schema.sql");
  assert.match(
    schema,
    /tag_type in \('interest', 'life', 'music', 'vibe'\)/,
    "this test's premise is the schema's four tag types",
  );

  const manager = read("src/components/admin-tag-manager.tsx");
  assert.match(
    manager,
    /const tagTypeOptions = \["interest", "life", "music", "vibe"\]/,
    "the tag editor must offer every type the schema allows",
  );

  const route = read("src/app/api/admin/tags/route.ts");
  assert.match(
    route,
    /allowedTagTypes = new Set\(\["interest", "life", "music", "vibe"\]\)/,
    "the tags API allowlist must match the schema constraint",
  );
});

test("saving a tag reports the usage it is about to overwrite", () => {
  const repo = read("src/lib/event-repository.ts");
  const start = repo.indexOf("export async function createTagForAdmin");
  assert.ok(start > -1, "expected createTagForAdmin to exist");
  const end = repo.indexOf("\n// Edit an existing tag", start + 1);
  const body = repo.slice(start, end === -1 ? undefined : end);

  // This upserts on slug, so "Save tag" for an existing slug rewrites that
  // tag's label, category and type in place. Reporting 0 told the admin they
  // had created something new.
  assert.match(body, /on conflict \(slug\) do update/, "premise: this is an upsert");
  assert.doesNotMatch(
    body,
    /usageCount: 0/,
    "an upsert must report the real usage count, not 0",
  );
  assert.match(
    body,
    /usageCount: Number\(usage\.rows\[0\]\?\.usage_count \?\? 0\)/,
    "the usage count must be read back from the tag that was actually written",
  );
});

test("audit_logs is indexed for every way the console reads it", () => {
  const migration = read("database/067_audit_logs_indexes.sql");

  // It shipped with a primary key and nothing else while being the
  // fastest-growing table in the app - every send_click writes a row.
  for (const index of [
    "audit_logs_created_at_idx",
    "audit_logs_action_created_at_idx",
    "audit_logs_entity_idx",
  ]) {
    assert.ok(migration.includes(index), `expected ${index} in the migration`);
  }

  const repo = read("src/lib/event-repository.ts");
  const start = repo.indexOf("export async function getAdminSidebarCounts");
  const end = repo.indexOf("\nexport async function", start + 1);
  const body = repo.slice(start, end === -1 ? undefined : end);

  // An unbounded count(*) over that table ran on EVERY admin page render, and
  // "rows ever written" was not a number an admin could act on.
  assert.doesNotMatch(
    body,
    /select count\(\*\) from audit_logs\) as audit/,
    "the audit badge must be a bounded recent-activity window, not the table size",
  );
  assert.match(
    body,
    /from audit_logs where created_at >= now\(\) - interval '24 hours'/,
    "the audit badge must count recent activity",
  );
});

test("the transactions ledger search reaches the whole window, not the loaded page", () => {
  const page = read("src/app/admin/transactions/page.tsx");
  assert.match(
    page,
    /search: search \? search : undefined/,
    "the ledger server action must forward the search term to listAdminTransactions",
  );

  const table = read("src/components/admin-transactions-table.tsx");
  assert.match(
    table,
    /loadPage\(\{[\s\S]{0,200}?search/,
    "the table must send the search term with its query",
  );
  // The old copy told the admin the search was in-memory only. It is not now.
  assert.doesNotMatch(
    table,
    /search only reads the rows loaded below/,
    "stale copy: search is server-side now",
  );
});
