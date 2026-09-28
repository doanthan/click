import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// The real helper, not a copy - Node strips the types on import (see
// au-phone.test.mjs). It reads window.location at call time, so each test sets
// the one field it needs.
import { rsvpReturnPath } from "../src/lib/rsvp-resume.ts";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");

function withLocation(pathname, search, run) {
  const previous = globalThis.window;
  globalThis.window = { location: { pathname, search } };
  try {
    return run();
  } finally {
    globalThis.window = previous;
  }
}

test("the RSVP return path is the event, flagged to reopen its booking dialog", () => {
  // Tapped RSVP from a Discover card: the event page, not back to Discover.
  assert.equal(
    withLocation("/discover", "?category=food", () => rsvpReturnPath("pottery-night-abc")),
    "/events/pottery-night-abc?rsvp=1",
  );
  // Already on the event: its own query (a plan's ?planWith=) survives.
  assert.equal(
    withLocation("/events/pottery-night-abc", "?planWith=p1&return=%2Fproposals", () =>
      rsvpReturnPath("pottery-night-abc"),
    ),
    "/events/pottery-night-abc?planWith=p1&return=%2Fproposals&rsvp=1",
  );
  // Never doubled up.
  assert.equal(
    withLocation("/events/x", "?rsvp=1", () => rsvpReturnPath("x")),
    "/events/x?rsvp=1",
  );
});

test("an RSVP started signed out is picked back up after sign-up", () => {
  // Both booking buttons hand the login modal the event, not "wherever I was".
  for (const file of [
    "src/components/event-registration-button.tsx",
    "src/components/event-payment-button.tsx",
  ]) {
    assert.match(
      read(file),
      /response\.status === 401\) \{[\s\S]{0,200}openLoginModal\(\{ callbackUrl: rsvpReturnPath\(eventId\) \}\)/,
      `${file} must send a signed-out booker back to the event with ?rsvp=1`,
    );
  }

  // A signed-in booker with an unfinished profile goes through onboarding and
  // must come back to the same dialog.
  for (const route of [
    "src/app/api/events/[eventId]/register/route.ts",
    "src/app/api/events/[eventId]/checkout/route.ts",
  ]) {
    assert.match(
      read(route),
      /\/onboarding\?next=\$\{encodeURIComponent\(`\/events\/\$\{eventSlug\}\?rsvp=1`\)\}/,
      `${route} lost ?rsvp=1 on its onboarding redirect`,
    );
  }

  // Every booking dialog on the event page reopens - free, paid and waitlist.
  const page = read("src/app/events/[slug]/page.tsx");
  assert.match(page, /const resumeBooking = isAuthenticated && search\?\.rsvp === "1";/);
  const dialogs = page.match(/<EventBookingDialog\b/g) ?? [];
  const reopening = page.match(/<EventBookingDialog\b[^>]*?autoOpen=\{resumeBooking\}/g) ?? [];
  assert.ok(dialogs.length >= 3, "expected the free, paid and waitlist dialogs");
  assert.equal(reopening.length, dialogs.length, "a booking dialog does not reopen on ?rsvp=1");

  // Opened after hydration (ModalShell renders nothing on the server), and the
  // flag comes off the URL so a reload does not reopen it.
  const dialog = read("src/components/event-booking-dialog.tsx");
  assert.match(dialog, /useSyncExternalStore\(subscribeNever, \(\) => true, \(\) => false\)/);
  assert.match(dialog, /const isOpen = open \|\| \(autoOpen && hydrated && !autoOpenDismissed\);/);
  assert.match(dialog, /url\.searchParams\.delete\("rsvp"\)/);
  assert.doesNotMatch(dialog, /useState\(autoOpen\)/, "an initially-open dialog would hydrate a portal");
});

test("the profile is saved when step 1 is done, not only on Finish", () => {
  const form = read("src/components/onboarding-form.tsx");

  // Stopping on an optional screen used to leave no profile at all, so the
  // visitor could not book and was sent back to step 1 on every login.
  assert.match(form, /if \(step === 0 && !\(await saveProfile\(\)\)\) return;/);
  assert.match(form, /async function handleSubmit\(\) \{[\s\S]*?if \(!\(await saveProfile\(\)\)\) return;/);

  // The first save finishes the profile, so the page has to be told the
  // visitor is still mid-flow or the next refresh redirects them out of it.
  assert.match(form, /url\.searchParams\.set\("resume", "1"\)/);
  const page = read("src/app/onboarding/page.tsx");
  assert.match(page, /if \(status\.onboardingComplete && params\?\.resume !== "1"\) \{\s*redirect\(next \?\? "\/dashboard"\);/);

  // The photo uploader refreshes on success. That is only safe because of the
  // marker above - if it ever stops refreshing, this can be revisited.
  assert.match(read("src/components/avatar-uploader.tsx"), /router\.refresh\(\)/);
});

test("someone who came for one event can go straight back after step 1", () => {
  const form = read("src/components/onboarding-form.tsx");
  assert.match(form, /next\?\.startsWith\("\/events\/"\)\s*\?\s*"Back to the event"/);
  assert.match(form, /next\?\.startsWith\("\/claim\/"\)\s*\?\s*"Back to your invite"/);
  // Enter and the main button both finish from step 1 - same save, same done
  // screen (the no-chat framing the spec requires on completion).
  assert.match(form, /void handleNext\(\{ finishNow: step === 0 && returnLabel !== null \}\)/);
  assert.match(form, /if \(finishNow \|\| step === STEPS\.length - 1\) \{\s*await handleSubmit\(\);/);
  assert.match(form, /continueLabel=\{returnLabel \?\? "Take me in"\}/);
  assert.match(form, /Personalise my profile first/);
});

test("a trusted host's paid event goes live when payouts do", () => {
  const repo = read("src/lib/event-repository.ts");

  const sync = repo.indexOf("export async function updateMerchantConnectStatus");
  assert.ok(sync > -1);
  const syncBody = repo.slice(sync, repo.indexOf("\nexport ", sync + 1));
  assert.match(
    syncBody,
    /if \(status\.chargesEnabled && status\.payoutsEnabled\) \{\s*try \{\s*await publishEventsHeldForPayouts\(pool, row\.merchant_profile_id\);/,
  );

  const start = repo.indexOf("async function publishEventsHeldForPayouts");
  assert.ok(start > -1, "publishEventsHeldForPayouts not found");
  const publish = repo.slice(start, repo.indexOf("\nexport ", start));
  // Only what createEventForMerchant parked for payouts, and only while the
  // host is still trusted, approved and fully connected.
  for (const guard of [
    /m\.verification_status = 'approved'/,
    /m\.auto_approve_events = true/,
    /m\.charges_enabled = true/,
    /m\.payouts_enabled = true/,
    /e\.status = 'pending'/,
    /e\.price_cents > 0/,
    /coalesce\(e\.ends_at, e\.starts_at\) >= now\(\)/,
  ]) {
    assert.match(publish, guard, `publishEventsHeldForPayouts lost ${guard}`);
  }
  // Traceable, and the host is told - after the response, never inside the
  // webhook's reply or the payouts page render.
  assert.match(publish, /insert into audit_logs[\s\S]*?'publish_event_payouts_ready'/);
  assert.match(publish, /afterResponse\(async \(\) => \{[\s\S]*?await logEventApprovedEmail\(pool, event\.slug\);/);

  // The create wizard tells that host the truth instead of "admin review".
  const wizard = read("src/components/event-create-wizard.tsx");
  assert.match(wizard, /const heldForPayouts = autoApproveEvents && !publishesImmediately;/);
  assert.match(wizard, /goes live as soon as your payout setup is finished/);
});
