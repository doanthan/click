import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// +1 emails (Cindy 2026-09-29): the invite names the night, and a +1 who claims
// gets their own confirmation. Static checks in this repo's style - there is no
// local Postgres to run the repository against.

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const repo = read("src/lib/event-repository.ts");

function body(signature) {
  const start = repo.indexOf(signature);
  assert.ok(start > -1, `expected ${signature} to exist`);
  const next = repo.slice(start + signature.length).search(/\n(export )?(async )?function /);
  return next === -1 ? repo.slice(start) : repo.slice(start, start + signature.length + next);
}

test("the +1 invite subject names the event", () => {
  const subject = read("src/lib/email.ts").match(/"guest-invite": \(v\) =>\s*`([^`]*)`/)?.[1];
  assert.ok(subject, "could not find the guest-invite subject");
  assert.match(subject, /\$\{v\.eventTitle/);
});

test("claiming a +1 seat sends the guest their own confirmation", () => {
  const claim = body("export async function claimGuestSpotForProfile(");
  const success = claim.indexOf('if (!row) return { ok: false, reason: "unavailable" };');
  assert.ok(success > -1, "could not find the claim's success path");
  assert.match(claim.slice(success), /logGuestSpotConfirmedEmail\(pool, row\.id, token\)/);

  const sender = body("function logGuestSpotConfirmedEmail(");
  assert.match(sender, /template: "guest-spot-confirmed"/);
  assert.match(sender, /afterResponse\(/);
  assert.match(sender, /escapeVars: true/);

  // Every placeholder the template uses is one the sender passes, so none of
  // them reach an inbox as a raw {{placeholder}}.
  const html = read("emails/guest-spot-confirmed.html");
  const vars = sender.slice(sender.indexOf("vars: {"));
  for (const [, name] of html.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) {
    assert.match(vars, new RegExp(`\\b${name}:`), `guest-spot-confirmed uses {{${name}}} but it is never passed`);
  }
  // DS: hyphens, never em- or en-dashes.
  assert.doesNotMatch(html, /—|–|&mdash;|&ndash;/);
});

test("every path that takes a claimed +1's seat away tells them", () => {
  // Only the one-seat cancel used to. The whole-booking cancel, an admin's full
  // refund and the event cancel flipped the +1's guest_spots row and said
  // nothing, so a friend who had been told they were in turned up for nothing.
  assert.match(body("async function claimedGuestsOn("), /where gs\.status = 'claimed'/);
  const notice = body("async function notifyReleasedGuests(");
  assert.match(notice, /"A spot changed"/);
  assert.match(notice, /template: "guest-spot-cancelled"/);
  assert.match(notice, /escapeVars: true/);

  const one = body("export async function cancelGuestSeatForPurchaser(");
  assert.match(one, /if \(claimed\) await notifyReleasedGuests\(pool, \[claimed\]\);/);

  // Read before the seats flip: after it, nobody on the booking is 'claimed'.
  for (const [fn, txn] of [
    ["export async function cancelRegistration(", "row.txn_id"],
    ["export async function settleRefundedBooking(", "input.paymentTransactionId"],
  ]) {
    const src = body(fn);
    const readAt = src.indexOf("releasedGuests = await claimedGuestsOn(client");
    const flipAt = src.indexOf(`await cancelGuestSeatsForTransaction(client, ${txn})`);
    assert.ok(readAt > -1 && flipAt > readAt, `${fn} reads the claimed +1s before cancelling their seats`);
    // The same §B5.6 teardown the one-seat cancel gives a released guest.
    assert.match(src, /severConfirmedTogetherForCancel\(client, guest\.profileId, row\.event_id\)/);
    assert.match(src, /await notifyReleasedGuests\(pool, releasedGuests\);/);
  }

  const eventCancel = body("async function cancelEvent(");
  const readAt = eventCancel.indexOf("await claimedGuestsOn(client, { eventId: event.id })");
  const flipAt = eventCancel.indexOf("update guest_spots set status = 'cancelled'");
  assert.ok(readAt > -1 && flipAt > readAt, "cancelEvent reads the claimed +1s before cancelling their seats");
  assert.match(eventCancel, /\.\.\.releasedGuests\.map\(\(guest\) => guest\.profileId\)/);
  assert.match(eventCancel, /vars: cancelledEmailVars\(guest\.firstName \|\| "there", "You were not charged\."\)/);
});
