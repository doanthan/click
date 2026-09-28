import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// Bug board, booking cluster: #51, #162, #216, #226, #227, #228, #232, #237,
// #280, #289. Static checks in this repo's style - the repository is SQL, and
// there is no local Postgres to run it against.

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const repo = read("src/lib/event-repository.ts");

// The body of a top-level function: from its declaration to the next one.
function body(signature) {
  const start = repo.indexOf(signature);
  assert.ok(start > -1, `expected ${signature} to exist`);
  const next = repo.slice(start + signature.length).search(/\n(export )?(async )?function /);
  return next === -1 ? repo.slice(start) : repo.slice(start, start + signature.length + next);
}

test("every path that frees a seat offers all of them to the waitlist (#226/#227)", () => {
  const fill = body("async function offerFreeSeatsToWaitlist(");
  // Loops the one-seat promoter until it finds no room or nobody waiting.
  assert.match(fill, /const promoted = await promoteNextWaitlister\(/);
  assert.match(fill, /if \(!promoted\) break;/);

  for (const release of [
    "export async function cancelRegistration(",
    "export async function cancelGuestSeatForPurchaser(",
    "export async function settleRefundedBooking(",
    "export async function markPaymentFailed(",
    "export async function expireWaitlistOffers(",
    "export async function expirePaymentHolds(",
  ]) {
    const fn = body(release);
    assert.match(fn, /offerFreeSeatsToWaitlist\(/, `${release} must offer every freed seat`);
    assert.doesNotMatch(
      fn,
      /await promoteNextWaitlister\(/,
      `${release} still offers a single seat - a refunded party or lapsed hold leaves the rest open`,
    );
    // Every offer made is mailed - the leaving-waitlister branch of
    // cancelRegistration used to make one that never reached the mail loop.
    assert.match(fn, /logWaitlistPromotedEmail\(pool, promo/, `${release} must email each offer`);
  }

  // The only direct caller left is the fill loop itself.
  const calls = repo.match(/await promoteNextWaitlister\(/g) ?? [];
  assert.equal(calls.length, 1, "promoteNextWaitlister must only be called by offerFreeSeatsToWaitlist");
});

test("a waitlister confirmed by an RSVP or a payment leaves the queue (#162)", () => {
  const register = body("export async function registerForEvent(");
  assert.match(
    register,
    /rsvpChanged && status === "confirmed" && existingRsvp\?\.status === "waitlisted"[\s\S]{0,200}update event_waitlists\s+set accepted_at = now\(\)/,
  );

  const settled = body("export async function markPaymentSucceeded(");
  const flipped = settled.slice(settled.indexOf("if (attendeeFlipped) {"));
  assert.match(flipped.slice(0, 900), /update event_waitlists\s+set accepted_at = now\(\)/);

  // The host's cancellation email counted every open queue row, so someone who
  // paid their way off the waitlist was still "waiting".
  const waitlistCountAt = repo.indexOf("as waitlist_count,");
  assert.ok(waitlistCountAt > -1);
  const waitlistCount = repo.slice(waitlistCountAt - 400, waitlistCountAt);
  assert.match(waitlistCount, /from event_waitlists w\s+join event_attendees wa/);
  assert.match(waitlistCount, /wa\.status = 'waitlisted'/);
});

test("a waitlisted viewer can take a seat that is open right now (#227)", () => {
  const page = read("src/app/events/[slug]/page.tsx");
  assert.match(
    page,
    /const seatOpenForWaitlister = isWaitlisted && !waitlistOfferExpiresAt && !isWaitlistMode;/,
  );
  // Falls through to the ordinary RSVP / pay dialog instead of "Leave waitlist" alone.
  assert.match(page, /\) : isRegistered \|\| \(isWaitlisted && !seatOpenForWaitlister\) \? \(/);
  assert.match(
    page,
    /\{seatOpenForWaitlister \? \(\s*<EventRegistrationButton eventId=\{event\.id\} initiallyRegistered isWaitlist \/>/,
  );

  const modal = read("src/components/event-detail-modal.tsx");
  assert.match(modal, /isWaitlisted && !data\.waitlistOfferExpiresAt && !isWaitlistMode/);
  assert.match(modal, /isRegistered \|\| \(isWaitlisted && !seatOpenForWaitlister\)/);
});

test("the host's seats-left figure is the canonical one (#226)", () => {
  const detail = body("export async function getMerchantEventDetail(");
  assert.match(detail, /select cap\.available from event_capacity_v cap where cap\.event_id = event\.id/);
  assert.match(detail, /w\.offered_until > now\(\)/);

  const page = read("src/app/merchant/events/[eventId]/page.tsx");
  assert.match(page, /<Metric label="Seats left" value=\{event\.seatsAvailable\.toString\(\)\} \/>/);
  assert.doesNotMatch(page, /event\.capacity - confirmedSeats/);
  assert.match(page, /event\.offeredSeats > 0/);
});

test("only the seat's own payment counts as already paid (#237)", () => {
  const hold = body("export async function createPaymentHold(");
  const guard = hold.slice(hold.indexOf("const paidTxn"), hold.indexOf("if (paidTxn.rows[0])"));
  assert.match(guard, /a\.payment_transaction_id = pt\.id/);
  assert.match(guard, /a\.status <> 'cancelled'/);
});

test("an event with no end time still clashes for its 2-hour block (#51)", () => {
  const detail = body("export async function getEventBySlug(");
  const clash = detail.slice(detail.indexOf("const clashResult"));
  assert.match(clash, /from \$\{seatRowsSql\} attendee/);
  assert.match(clash, /\(\$3\)::timestamptz \+ interval '2 hours'/);
  assert.match(clash, /other_event\.starts_at \+ interval '2 hours'/);

  // The Discover quick-view books free events in one tap, so it has to say it too.
  const modal = read("src/components/event-detail-modal.tsx");
  assert.match(modal, /data\.viewerClashEventTitle && !isRegistered/);
});

test("the Discover quick-view books a paid seat with +1s (#216/#232)", () => {
  const modal = read("src/components/event-detail-modal.tsx");
  assert.match(modal, /<EventPaymentButton[\s\S]{0,300}allowGuests/);
  assert.match(modal, /bookingFeePerSeatCents=\{bookingFeeCents\}/);
  // Guest names are typed in here now, so a stray scrim tap must not eat them.
  assert.match(modal, /closeOnScrim=\{!booksPaidSeatHere\}/);

  // Same fee formula as createPaymentHold, which is what Stripe charges.
  const route = read("src/app/api/events/[eventId]/route.ts");
  assert.match(route, /Math\.round\(\(event\.priceCents \* bookingFeeBps\) \/ 10_000\)/);
  assert.match(repo, /Math\.round\(\(event\.price_cents \* bookingFeeBps\) \/ 10_000\)/);
  assert.match(route, /event: \{ \.\.\.payload, bookingFeeCents \}/);
});

test("the paid booking dialog says each thing once (#280)", () => {
  const page = read("src/app/events/[slug]/page.tsx");
  assert.doesNotMatch(page, /hold is released and the seat returns to the pool/);
  assert.doesNotMatch(page, /We&apos;ll hold your seat through Stripe checkout/);
  assert.match(page, /Your seat is held while you pay\./);
});

test("a +1 can be named or renamed after booking (#228)", () => {
  assert.ok(existsSync(path.join(root, "src/app/api/guest-seats/[guestSpotId]/name/route.ts")));
  const route = read("src/app/api/guest-seats/[guestSpotId]/name/route.ts");
  assert.match(route, /nameGuestSeatForPurchaser\(/);
  assert.match(route, /status: 401/);

  const fn = body("export async function nameGuestSeatForPurchaser(");
  // Only the purchaser's own seat, only on a confirmed booking, only before the night.
  assert.match(fn, /gs\.purchaser_profile_id = \$2::uuid/);
  assert.match(fn, /booking\.status = 'confirmed'/);
  assert.match(fn, /row\.starts_at\.getTime\(\) <= Date\.now\(\)/);
  assert.match(fn, /row\.status === "claimed"/);
  // A new person goes through checkout's rules and gets a fresh link.
  assert.match(fn, /validateGuestDetails\(/);
  assert.match(fn, /filterSuppressedEmails\(/);
  assert.match(fn, /claim_token = gen_random_uuid\(\)/);
  assert.match(fn, /announceNamedGuests\(pool/);

  const seats = read("src/components/my-guest-seats.tsx");
  assert.match(seats, /\/api\/guest-seats\/\$\{encodeURIComponent\(seat\.guestSpotId\)\}\/name/);
});

test("the +1's email carries the time and a link to the event (#289)", () => {
  const announce = body("async function announceNamedGuests(");
  for (const template of ["guest-invite", "guest-spot-existing-user"]) {
    const html = read(`emails/${template}.html`);
    assert.match(html, /\{\{eventStartTime\}\}/, `${template} must say when it starts`);
    // Every variable the template uses is one the sender passes, so none of
    // them reach an inbox as a raw {{placeholder}}.
    const branchAt = announce.indexOf(`template: "${template}"`);
    assert.ok(branchAt > -1, `announceNamedGuests no longer sends ${template}`);
    const branch = announce.slice(branchAt);
    const varsEnd = branch.indexOf("},\n      });");
    assert.ok(varsEnd > -1, `could not find the end of ${template}'s vars`);
    const vars = branch.slice(0, varsEnd);
    for (const [, name] of html.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) {
      assert.match(vars, new RegExp(`\\b${name}\\b`), `${template} uses {{${name}}} but it is never passed`);
    }
  }
  assert.match(read("emails/guest-invite.html"), /href="\{\{eventUrl\}\}"/);
  assert.match(body("export async function processGuestSpotsForSession("), /announceNamedGuests\(/);
});
