import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");

// Source-shape assertions for the pre-launch booking fixes of 2026-09-28, in
// the style of admin-money-queue.test.mjs.

function functionBody(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start > -1, `expected ${signature}`);
  const end = source.indexOf("\nexport ", start + 1);
  return source.slice(start, end === -1 ? undefined : end);
}

test("a stale checkout.session.expired frees only the seat on its own transaction", () => {
  const body = functionBody(
    read("src/lib/event-repository.ts"),
    "export async function markPaymentFailed(",
  );
  // createPaymentHold re-points the buyer's one attendee row at each new
  // transaction, so event + person alone also matches a NEWER hold the buyer is
  // paying for right now - which they then lose: charged, force-refunded.
  const release = body.slice(body.indexOf("update event_attendees"));
  assert.match(
    release,
    /status = 'pending_payment'\s+and payment_transaction_id = \$3::uuid/,
    "the seat release must be scoped to the failed transaction",
  );
  assert.match(release, /\[payment\.event_id, payment\.profile_id, payment\.id\]/);
});

test("a refund Stripe refused is not announced as on its way", () => {
  const button = read("src/components/event-registration-button.tsx");
  assert.match(button, /payload\.refund\?\.failed === true/, "the cancel flow must read refund.failed");
  assert.match(button, /params\.set\("refunded", refundDelayed \? "delayed" : "1"\)/);

  const page = read("src/app/events/[slug]/page.tsx");
  const notice = page.slice(page.indexOf("const notice = search?.canceled"));
  const delayed = notice.indexOf('search?.refunded === "delayed"');
  const promise = notice.indexOf("Your refund will appear in 3 to 5 business days.");
  assert.ok(delayed > -1, "the cancel notice must handle refunded=delayed");
  assert.ok(delayed < promise, "the delayed branch must win over the 3 to 5 day promise");
});

test("/admin says so when its numbers are not live", () => {
  const repo = read("src/lib/event-repository.ts");

  const money = functionBody(repo, "export async function countAdminMoneyAlerts(");
  assert.match(money, /unavailable: true/, "the money-alert fallback must be flagged");
  assert.doesNotMatch(money, /CLICK_DB_DEBUG/, "a failed money-alert read must always be logged");

  const metrics = functionBody(repo, "export async function getAdminMetrics(");
  assert.doesNotMatch(metrics, /CLICK_DB_DEBUG/, "a failed metrics read must always be logged");
  const fallbackStart = repo.indexOf("function fallbackAdminMetrics(");
  const fallback = repo.slice(fallbackStart, repo.indexOf("\n}\n", fallbackStart));
  assert.match(fallback, /unavailable: true/, "the metrics fallback must be flagged");

  assert.match(read("src/app/admin/page.tsx"), /metrics\.unavailable \|\| money\.unavailable/);
});

test("the refund policy promises the one set of timeframes the app applies", () => {
  const policy = read("src/app/refund-policy/page.tsx");
  assert.doesNotMatch(
    policy,
    /own cancellation terms|different terms/i,
    "nothing stores per-host refund terms, so the policy must not promise them",
  );
  // quoteCancellationRefund: 48h+ full, 24 to 48h half, under 24h nothing.
  const code = read("src/lib/refund-policy.ts");
  assert.match(code, /hoursUntilStart >= 48/);
  assert.match(code, /hoursUntilStart >= 24/);
  assert.match(policy, /48 hours or more before the event starts/);
  assert.match(policy, /Between 24 and 48 hours/);
  assert.match(policy, /Less than 24 hours/);

  // Hosts record REFUND_POLICY_VERSION when they apply; it must name the date
  // the page shows.
  assert.match(policy, /lastUpdated=\{REFUND_POLICY_LAST_UPDATED_LABEL\}/);
  const versions = read("src/lib/legal-versions.ts");
  const version = versions.match(/REFUND_POLICY_VERSION = "(\d{4})-(\d{2})-(\d{2})"/);
  const label = versions.match(/REFUND_POLICY_LAST_UPDATED_LABEL = "(\d{1,2}) ([A-Za-z]+) (\d{4})"/);
  assert.ok(version && label, "expected both refund policy version constants");
  const month = new Date(`${label[2]} 1, 2000`).getMonth() + 1;
  assert.deepEqual(
    [Number(version[1]), Number(version[2]), Number(version[3])],
    [Number(label[3]), month, Number(label[1])],
  );
});
