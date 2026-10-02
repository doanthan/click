// Invariants for the host (merchant) journey.
//
// Two kinds of test in here, and the split is deliberate:
//   - Pure modules (event-duration, datetime) are imported and exercised.
//   - Everything else is a SOURCE assertion, because the code under test sits
//     behind Next's server runtime (next/server, auth(), a pg pool) and cannot
//     be imported into a bare node:test process. Same pattern as
//     release-config.test.mjs. A source assertion is weaker than a real call,
//     so each one pins the specific clause that would have to be deleted to
//     reintroduce the bug, not merely that some code exists.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DURATION_OPTIONS,
  nearestDurationValue,
} from "../src/lib/event-duration.ts";
import { formatEventStartLocal, parseEventStart } from "../src/lib/datetime.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

/* ---------------- duration options ---------------- */

test("a stored duration always resolves to an option the dropdown actually has", () => {
  // A <select> handed a value with no matching <option> renders BLANK, which
  // reads as "no duration set" - and saving that form would then write the
  // first option instead of what the event really runs for.
  for (const minutes of [0, -5, 1, 45, 120, 200, 9999, Number.NaN]) {
    const value = nearestDurationValue(minutes);
    assert.ok(
      DURATION_OPTIONS.some((o) => o.value === value),
      `${minutes} resolved to ${value}, which is not an option`,
    );
  }
});

test("nearestDurationValue snaps to the closest option, not the first", () => {
  assert.equal(nearestDurationValue(120), "120");
  assert.equal(nearestDurationValue(100), "90");
  assert.equal(nearestDurationValue(105), "90"); // tie goes to the earlier option
  assert.equal(nearestDurationValue(1000), "480");
});

test("an unusable duration falls back to two hours, not to zero", () => {
  assert.equal(nearestDurationValue(0), "120");
  assert.equal(nearestDurationValue(Number.NaN), "120");
});

/* ---------------- datetime-local round trip ---------------- */

test("formatEventStartLocal round-trips through parseEventStart", () => {
  // The merchant event editor pre-fills a start time that parseEventStart reads
  // back. If these two disagree, simply opening the form and saving it without
  // touching the field MOVES the event - by ten or eleven hours, in Sydney.
  for (const wall of [
    "2026-06-08T09:00", // AEST
    "2026-01-15T19:30", // AEDT, the other side of the DST boundary
    "2026-04-05T02:30", // inside the DST changeover morning
    "2026-12-31T23:59",
  ]) {
    const instant = parseEventStart(wall);
    assert.equal(
      formatEventStartLocal(instant),
      wall,
      `${wall} did not survive the round trip`,
    );
  }
});

test("formatEventStartLocal never emits hour 24, which datetime-local rejects", () => {
  const midnight = parseEventStart("2026-06-08T00:00");
  assert.match(formatEventStartLocal(midnight), /T00:\d\d$/);
});

test("formatEventStartLocal returns empty for an unusable value", () => {
  assert.equal(formatEventStartLocal("not a date"), "");
  assert.equal(formatEventStartLocal(new Date(Number.NaN)), "");
});

/* ---------------- event terms are gated on nobody being affected ---------------- */

test("an event's terms can only change while it is unlisted and unbooked", () => {
  const repo = read("src/lib/event-repository.ts");

  // The gate itself. Both halves are load-bearing: !isPublished keeps a live
  // listing's terms fixed even at zero bookings, !hasAttendees keeps them fixed
  // for anyone already holding a seat.
  assert.match(
    repo,
    /const termsEditable = !isPublished && !hasAttendees;/,
    "termsEditable must require BOTH not-published and no-attendees",
  );

  // Every terms column is coalesce'd against a value that is null unless
  // termsEditable, so a published or booked event writes its own value back.
  for (const column of [
    "category = coalesce\\(\\$10, category\\)",
    "starts_at = coalesce\\(\\$11::timestamptz, starts_at\\)",
    "ends_at = coalesce\\(\\$12::timestamptz, ends_at\\)",
    "capacity = coalesce\\(\\$13::int, capacity\\)",
    "price_cents = coalesce\\(\\$14::int, price_cents\\)",
  ]) {
    assert.match(repo, new RegExp(column), `${column} must be coalesce-guarded`);
  }

  // And each of those parameters is null unless termsEditable.
  for (const guard of [
    /nextCapacity =\s*\n?\s*termsEditable &&/,
    /nextPriceCents =\s*\n?\s*termsEditable &&/,
    /nextCategory =\s*\n?\s*termsEditable &&/,
    /if \(termsEditable && input\.startsAt !== undefined\)/,
  ]) {
    assert.match(repo, guard, `a terms value escaped the termsEditable gate: ${guard}`);
  }
});

test("the details route hands the terms straight to the repository gate", () => {
  // The route must NOT do its own gating - one gate, in one place. What it must
  // do is pass the fields through so the gate can see them.
  const route = read("src/app/api/merchant/events/[eventId]/details/route.ts");
  for (const field of ["category", "startsAt", "durationMinutes", "capacity", "priceCents"]) {
    assert.ok(route.includes(field), `${field} must reach updateMerchantEventDetails`);
  }
});

test("the host event header links to the client editor with a server-safe anchor", () => {
  const page = read("src/app/merchant/events/[eventId]/page.tsx");
  const editor = read("src/components/merchant-event-edit-form.tsx");
  const shared = read("src/lib/merchant-event-edit.ts");

  assert.doesNotMatch(
    page,
    /import \{[^}]*MERCHANT_EVENT_EDIT_SECTION_ID[^}]*\} from "@\/components\/merchant-event-edit-form"/,
    "a server component must not import the anchor value from a client module",
  );
  assert.match(
    page,
    /import \{ MERCHANT_EVENT_EDIT_SECTION_ID \} from "@\/lib\/merchant-event-edit"/,
  );
  assert.match(
    page,
    /<a\s+href=\{`#\$\{MERCHANT_EVENT_EDIT_SECTION_ID\}`\}\s+className=\{ckBtn\("secondary", "md"\)\}/,
    "hash-only navigation must use a native anchor so hashchange opens the editor",
  );
  assert.match(editor, /id=\{MERCHANT_EVENT_EDIT_SECTION_ID\}/);
  assert.match(shared, /MERCHANT_EVENT_EDIT_SECTION_ID = "edit-event"/);
});

/* ---------------- merchant self-service must not touch verified identity ---------------- */

test("merchant self-service cannot rewrite what an admin verified", () => {
  const route = read("src/app/api/merchant/profile/route.ts");
  const repo = read("src/lib/event-repository.ts");

  // Approving a merchant flips auto_approve_events to true, so letting an
  // approved host rewrite their own business name or ABN turns one approval
  // into a different business carrying the same trust.
  //
  // Checks that the field is never READ OFF THE BODY, rather than that the
  // string never appears - the route's own comment names these fields to
  // explain why they are excluded, and that comment is worth keeping.
  const forbidden = ["business_name", "businessName", "abn", "acn", "trading_name", "tradingName"];
  for (const field of forbidden) {
    assert.ok(
      !new RegExp(`body\\??\\.?\\??\\[?["']?${field}`).test(route),
      `${field} must not be read from the request body in api/merchant/profile`,
    );
  }

  // The update statement writes only the contactable columns.
  const update = repo.slice(
    repo.indexOf("export async function updateMerchantContactDetails"),
    repo.indexOf("/** The self-editable fields, for pre-filling the Settings form. */"),
  );
  assert.ok(update.length > 0, "updateMerchantContactDetails must exist");
  assert.match(update, /set contact_email = coalesce/, "the update must be column-scoped");
  for (const column of ["business_name", "abn", "acn", "address_state", "address_postcode"]) {
    assert.ok(
      !new RegExp(`${column}\\s*=`).test(update),
      `${column} must not be assignable through merchant self-service`,
    );
  }
});

/* ---------------- Stripe's return path cannot become an open redirect ---------------- */

test("the Connect return path is restricted to merchant-portal paths", () => {
  const route = read("src/app/api/merchant/stripe/connect/route.ts");
  const fn = route.slice(
    route.indexOf("export function safeMerchantReturnTo"),
    route.indexOf("// Creates (once) the merchant's Stripe Connect account"),
  );
  assert.ok(fn.length > 0, "safeMerchantReturnTo must exist");
  assert.match(fn, /startsWith\("\/merchant"\)/, "only /merchant paths may ride");
  assert.match(fn, /startsWith\("\/\/"\)/, "protocol-relative URLs must be refused");
  assert.match(fn, /DEFAULT_RETURN_TO/, "an invalid value must fall back, never pass through");
});

/* ---------------- the partial-submit retry arm must outlive a step change ---------------- */

test("the recurring-submit retry arm lives on the provider, not the step shell", () => {
  const wizard = read("src/components/event-create-wizard.tsx");

  // WizardShell REMOUNTS on every step route (its own comments say so), so an
  // arm held in its state was destroyed the moment a host followed a Review
  // "Edit" link - and Submit then re-created every occurrence that had already
  // published. On a paid event that is a duplicate live listing per date.
  assert.ok(
    !/const \[retryDates, setRetryDates\] = useState/.test(wizard),
    "the retry arm must not be WizardShell state",
  );
  assert.match(wizard, /function useRetryArm\(\)/, "the arm needs its own hook");
  assert.match(wizard, /retryArm,\s*\n\s*armRetry,/, "the arm must ride on the wizard context");

  // And it must be dropped whenever the schedule it belongs to changes.
  assert.match(
    wizard,
    /if \(retryArm && retryArm\.scheduleKey !== scheduleKey\) armRetry\(null\);/,
    "an arm from a different schedule must be discarded",
  );
});

test("every exit from the Media step refuses while uploads are in flight", () => {
  const wizard = read("src/components/event-create-wizard.tsx");
  // MediaSection mirrors only FINISHED uploads into values.images, so leaving
  // the step mid-upload loses them silently. goNext and the stepper already
  // refused; Back and Exit did not.
  const guards = wizard.match(/Hang on - your photos are still uploading\./g) ?? [];
  assert.ok(
    guards.length >= 3,
    `expected goNext, goBack and Exit to guard uploads, found ${guards.length}`,
  );
  assert.match(
    wizard,
    /function goBack\(\) \{\s*(?:\/\/[^\n]*\n\s*)*if \(uploading\)/,
    "goBack must check `uploading` before it navigates",
  );
});

/* ---------------- the door list must be the whole door ---------------- */

test("the bookings door list counts +1 seats, not just ticket-holders", () => {
  const repo = read("src/lib/event-repository.ts");
  const query = repo.slice(
    repo.indexOf("export async function getMerchantAllAttendees"),
    repo.indexOf("export async function getMerchantAllAttendees") + 6000,
  );
  assert.match(query, /union all/, "the two seat kinds must be unioned");
  assert.match(query, /merchant_event_guests_v/, "+1 seats come from the guest view");
  assert.match(query, /'guest' as kind/, "each row must say which kind of seat it is");
  assert.match(query, /'ticket' as kind/, "each row must say which kind of seat it is");

  // The cap is applied to the MERGED, ordered set - otherwise a truncated list
  // would be 500 ticket-holders and no guests.
  assert.match(
    query,
    /select \* from seats\s*\n\s*order by event_starts_at desc, rsvp_at desc\s*\n\s*limit \$\{MERCHANT_DOOR_LIST_CAP\}/,
    "the limit must come after the union and the ordering",
  );

  // And the truncation has to be visible rather than silent: the Bookings tab
  // counts each event from these rows.
  const tab = read("src/components/merchant-bookings-tab.tsx");
  assert.match(
    tab,
    /attendees\.length >= MERCHANT_DOOR_LIST_CAP/,
    "a count taken from a truncated list must say so",
  );
});

test("the Bookings tab has no all-events attendee table", () => {
  // Bug board #316: "remove all attendees table. it should only be shown in the
  // specific event pages". Who is coming, and check-in, live on the event page.
  const tab = read("src/components/merchant-bookings-tab.tsx");
  assert.doesNotMatch(tab, /MerchantAttendeesPanel|All attendees/);
  assert.equal(existsSync(path.join(root, "src/components/merchant-attendees-panel.tsx")), false);
  const eventPage = read("src/app/merchant/events/[eventId]/page.tsx");
  assert.match(eventPage, /<AttendeeCheckInToggle/);
  assert.match(eventPage, /<GuestCheckInToggle/);
});

test("check-in routes to the table that matches the seat kind", () => {
  // The event page's toggles, one per seat kind.
  const toggles = read("src/components/check-in-toggle.tsx");
  const guest = toggles.slice(toggles.indexOf("export function GuestCheckInToggle"), toggles.indexOf("export function AttendeeCheckInToggle"));
  const ticket = toggles.slice(toggles.indexOf("export function AttendeeCheckInToggle"));
  assert.match(guest, /toggleGuestCheckInAction\(form\)/, "+1 seats write guest_spots.attended");
  assert.match(ticket, /toggleAttendeeCheckInAction\(form\)/, "tickets write event_attendees.checked_in_at");
});

/* ---------------- one status derivation for the whole portal ---------------- */

test("every host surface derives event status from one helper", () => {
  const ds = read("src/components/merchant-ds.tsx");
  assert.match(ds, /export function merchantEventDisplayStatus/);
  // Cancelled and Rejected outrank Ended: "not on" is what a host reads first.
  const fn = ds.slice(
    ds.indexOf("export function merchantEventDisplayStatus"),
    ds.indexOf("/** The words StatusPill would print for a status key. */"),
  );
  assert.ok(
    fn.indexOf('"cancelled"') < fn.indexOf('"ended"'),
    "Cancelled must be checked before Ended",
  );
  assert.ok(
    fn.indexOf('"rejected"') < fn.indexOf('"ended"'),
    "Rejected must be checked before Ended",
  );

  // The dashboard card printed the raw column, so a sold-out or finished event
  // read "Live" on the first screen a host opens.
  for (const file of [
    "src/components/merchant-dashboard-tab.tsx",
    "src/components/merchant-events-panel.tsx",
    "src/components/merchant-calendar.tsx",
  ]) {
    assert.match(
      read(file),
      /merchantEventDisplayStatus/,
      `${file} must use the shared derivation`,
    );
  }
});

/* ---------------- copy that the code has to be able to keep ---------------- */

test("no em-dashes or en-dashes anywhere on the host surfaces", () => {
  // Binding house rule: hyphens " - ", never em- or en-dashes, in copy,
  // comments and docs alike.
  const files = [
    "src/components/event-create-wizard.tsx",
    "src/components/merchant-signup-wizard.tsx",
    "src/components/merchant-dashboard-tab.tsx",
    "src/components/merchant-settings-tab.tsx",
    "src/components/merchant-calendar.tsx",
    "src/components/merchant-events-panel.tsx",
    "src/components/merchant-bookings-tab.tsx",
    "src/components/merchant-finances-tab.tsx",
    "src/components/check-in-toggle.tsx",
    "src/components/merchant-business-details-form.tsx",
    "src/components/merchant-event-edit-form.tsx",
    "src/app/merchant/events/[eventId]/page.tsx",
    "src/app/merchant-pending/page.tsx",
    "src/lib/abn.ts",
    "src/lib/datetime.ts",
    "src/lib/event-duration.ts",
  ];
  for (const file of files) {
    const source = read(file);
    assert.ok(!source.includes("\u2014"), `${file} contains an em-dash`);
    assert.ok(!source.includes("\u2013"), `${file} contains an en-dash`);
  }
});

test("the ABN error does not hand a live applicant a number to paste", () => {
  const abn = read("src/lib/abn.ts");
  const message = abn.slice(abn.indexOf("That's 11 digits"), abn.indexOf("That's 11 digits") + 200);
  assert.ok(
    !/\d{2} \d{3} \d{3} \d{3}/.test(message),
    "a checksum failure must not include a sample ABN - some applicants will paste it",
  );
});

test("the host-facing fee rate is read from config, never typed into copy", () => {
  // This card is the first thing a newly-approved host reads about money. It
  // used to say hosting was "free during the Sydney pilot" while
  // PLATFORM_FEE_BPS charged 2.9% on every paid ticket.
  const dash = read("src/components/merchant-dashboard-tab.tsx");
  assert.match(dash, /getPlatformFeeBps\(\)/, "the rate must be read, not written");
  assert.ok(
    !/free\s*<\/b>\s*\{?"?\s*during the Sydney pilot/.test(dash),
    "the pilot fee-waiver claim must not come back",
  );
});

test("no host surface names a payout schedule the code does not set", () => {
  // Nothing in the repo sets payout_schedule on the connected account, so the
  // cadence is whatever Stripe defaults to for the host's country.
  const setters = ["src/lib/stripe-connect.ts", "src/lib/stripe-sync.ts"];
  for (const file of setters) {
    assert.ok(
      !/payout_schedule|schedule:\s*\{\s*interval/.test(read(file)),
      `${file} appears to set a payout schedule - if it now does, the copy may claim one`,
    );
  }
  for (const file of [
    "src/components/merchant-dashboard-tab.tsx",
    "src/app/merchant/onboarding/payouts/page.tsx",
    "src/components/merchant-finances-tab.tsx",
  ]) {
    const source = read(file);
    assert.ok(
      !/pay out monthly|payouts after each event|after each event wraps/i.test(source),
      `${file} promises a payout cadence nothing sets`,
    );
  }
});

test("host application acceptance records the legal versions in effect", () => {
  const migration = read("database/060_host_agreement_acceptance.sql");
  const repo = read("src/lib/event-repository.ts");
  const versions = read("src/lib/legal-versions.ts");

  for (const column of [
    "host_agreement_accepted_at",
    "host_terms_version",
    "refund_policy_version",
  ]) {
    assert.match(migration, new RegExp(column));
    assert.match(repo, new RegExp(column));
  }
  assert.match(repo, /HOST_TERMS_VERSION/);
  assert.match(repo, /REFUND_POLICY_VERSION/);
  assert.match(versions, /2026-06-18/);
});

test("a newly approved host can start a free event without visiting payouts", () => {
  const welcome = read("src/app/merchant/onboarding/welcome/page.tsx");
  assert.match(welcome, /FinishOnboardingButton/);
  assert.match(welcome, /href="\/merchant\/events\/create"/);
  assert.match(welcome, /label="Create a free event →"/);
  assert.match(welcome, /href="\/merchant\/onboarding\/payouts"/);
});

test("event matching details are optional and keep a server fallback", () => {
  const wizard = read("src/components/event-create-wizard.tsx");
  const basicsValidation = wizard.slice(
    wizard.indexOf("if (step === 0)"),
    wizard.indexOf("if (step === 1)"),
  );
  assert.doesNotMatch(basicsValidation, /relationshipGoal/);
  assert.match(wizard, /Help Click match this event/);
  assert.match(wizard, /Category suggestions appear first/);

  const repo = read("src/lib/event-repository.ts");
  assert.match(repo, /input\.relationshipGoal\.trim\(\) \|\| "Help people meet through a shared plan\."/);
});

/* ---------------- trusted hosts, payouts and what they are told ---------------- */

const fnBody = (source, start) => {
  const at = source.indexOf(start);
  assert.ok(at > -1, `${start} not found`);
  return source.slice(at, source.indexOf("\nexport ", at + 1));
};

test("a resubmitted paid event waits for payouts like a new one does", () => {
  // It used to be `autoApprove ? "live" : "pending"`: a trusted host with no
  // Stripe account put a paid event live and every buyer hit a checkout error.
  const resubmit = fnBody(read("src/lib/event-repository.ts"), "export async function resubmitRejectedEvent");
  assert.doesNotMatch(resubmit, /const newStatus = autoApprove \? "live" : "pending";/);
  assert.match(
    resubmit,
    /merchant\.charges_enabled === true && merchant\.payouts_enabled === true/,
  );
  // The price is the row's, read inside the UPDATE - the rejected-event editor
  // can change it right before resubmitting.
  assert.match(
    resubmit,
    /when \$3::boolean and \(events\.price_cents <= 0 or \$4::boolean\) then 'live'::event_status/,
  );
  assert.match(resubmit, /heldForPayouts: autoApprove && event\.status === "pending"/);
  assert.match(
    read("src/components/merchant-event-resubmit-button.tsx"),
    /payload\.heldForPayouts\s*\?\s*"Resubmitted - it goes live as soon as your payout setup is finished\."/,
  );
});

test("the event-created email matches the status the event landed in", () => {
  // Bug board #180: every host was told "in review, a moderator will look",
  // including a trusted host whose event was already live.
  const create = fnBody(read("src/lib/event-repository.ts"), "export async function createEventForMerchant");
  assert.match(create, /if \(eventStatus === "live"\) \{\s*await logEventApprovedEmail\(pool, slug\);/);
  assert.match(
    create,
    /template: autoApprove \? "event-awaiting-payouts-merchant" : "event-created-merchant"/,
  );

  // The new template is wired everywhere a template has to be.
  const email = read("src/lib/email.ts");
  assert.match(email, /\| "event-awaiting-payouts-merchant"/);
  assert.match(email, /"event-awaiting-payouts-merchant": \(v\) =>/);
  assert.match(read("scripts/send-test-emails.mjs"), /"event-awaiting-payouts-merchant":/);
  const html = read("emails/event-awaiting-payouts-merchant.html");
  assert.match(html, /href="\{\{payoutsUrl\}\}"/);
  assert.doesNotMatch(html, /moderat|in review/i, "a held event is not in review");
  assert.ok(!html.includes("—"), "the template contains an em-dash");
});

test("finishing Stripe's form counts as done, whatever is only eventually due", () => {
  // Bug board #269: a host back from Stripe was told to "Continue on Stripe"
  // because requirements that are not due yet still counted as outstanding.
  const connect = read("src/lib/stripe-connect.ts");
  assert.match(
    connect,
    /entry\.awaiting_action_from === "user" &&\s*entry\.minimum_deadline\?\.status !== "eventually_due"/,
  );
});

test("a held event says what it is waiting on, on every host surface", () => {
  // Bug board #268/#270: "my events are pending?" - Pending read as "an admin
  // is reviewing it" when the only thing it waited on was payouts.
  const repo = read("src/lib/event-repository.ts");
  const held = repo.slice(repo.indexOf("function isHeldForPayouts"), repo.indexOf("export type MerchantAttendeeRow"));
  for (const clause of [
    /event\.status === "pending"/,
    /event\.price_cents > 0/,
    /merchant\.auto_approve_events === true/,
    /merchant\.verification_status === "approved"/,
    /!\(merchant\.charges_enabled === true && merchant\.payouts_enabled === true\)/,
  ]) {
    assert.match(held, clause);
  }
  // Both readers carry it: the list/dashboard/calendar and the event page.
  assert.equal((repo.match(/heldForPayouts: isHeldForPayouts\(merchant, row\)/g) ?? []).length, 2);

  const ds = read("src/components/merchant-ds.tsx");
  assert.match(ds, /awaiting_payouts: \{ tone: "amber", label: "Waiting on payouts" \}/);
  assert.match(ds, /if \(event\.status === "Pending" && event\.heldForPayouts\) return "awaiting_payouts";/);

  const page = read("src/app/merchant/events/[eventId]/page.tsx");
  assert.match(page, /event\.heldForPayouts \? "Waiting on payouts" : event\.status/);
  assert.match(page, /\/merchant\/onboarding\/payouts\?returnTo=/);
});

test("the wordmark goes to the dashboard of the view you are in", () => {
  // Bug board #290: a host browsing as an attendee was put back in the host
  // portal every time they used the logo to get to their dashboard.
  const chrome = read("src/components/site-chrome.tsx");
  assert.doesNotMatch(chrome, /isApprovedHost \? "\/merchant" : "\/dashboard"/);
  assert.match(chrome, /<HeaderLogoLink portals=\{logoPortals\} \/>/);
  const logo = read("src/components/header-nav.tsx");
  assert.match(logo, /pathname\.startsWith\("\/merchant"\) && portals\.includes\("merchant"\)/);
  assert.match(logo, /: "\/dashboard";/);
});
