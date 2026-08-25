import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("every configured cron points to a route", () => {
  const config = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8"));
  for (const cron of config.crons) {
    assert.ok(
      existsSync(path.join(root, "src/app", cron.path, "route.ts")),
      `missing ${cron.path}`,
    );
  }
});

test("dead BSC cleanup cron stays removed", () => {
  const config = readFileSync(path.join(root, "vercel.json"), "utf8");
  assert.doesNotMatch(config, /api\/bsc\/cleanup/);
});

test("production metadata endpoints exist", () => {
  for (const file of ["robots.ts", "sitemap.ts", "manifest.ts", "opengraph-image.tsx"]) {
    assert.ok(existsSync(path.join(root, "src/app", file)), `missing ${file}`);
  }
});

test("internal routes are blocked centrally", () => {
  const proxy = readFileSync(path.join(root, "src/proxy.ts"), "utf8");
  assert.match(proxy, /isInternalRoute/);
  assert.match(proxy, /status: 404/);
});

test("the stripe webhook handles both payload styles on one route", () => {
  const route = readFileSync(
    path.join(root, "src/app/api/webhooks/stripe/route.ts"),
    "utf8",
  );
  // Thin (v2) notifications must be verified with the second destination's own
  // secret — constructEvent throws on them by design.
  assert.match(route, /isThinEventNotification/);
  assert.match(route, /parseEventNotification\(rawBody, signature, secretV2\)/);
  assert.match(route, /getStripeWebhookSecretV2/);
  // v2.core.account_person.* and v2.core.account_link.returned carry a person /
  // link id, not an acct_. Retrieving one 404s and Stripe retries the 500, so
  // the loose prefix match must not come back.
  assert.doesNotMatch(route, /startsWith\("v2\.core\.account"\)/);
  assert.match(route, /startsWith\("v2\.core\.account\."\)/);
  assert.match(route, /startsWith\("v2\.core\.account\["\)/);
});

test("paid reconciliation cannot resurrect a cancelled or refunded booking", () => {
  const repository = readFileSync(
    path.join(root, "src/lib/event-repository.ts"),
    "utf8",
  );
  assert.match(
    repository,
    /payment\.status === "refunded" \|\| payment\.status === "partially_refunded"/,
  );
  assert.match(
    repository,
    /set status = 'confirmed'[\s\S]*status = 'pending_payment'[\s\S]*hold_expires_at > now\(\)/,
  );
  assert.match(repository, /!isBookableEventStatus\(payment\.event_status\)/);
  assert.match(repository, /newSettlementHasNoSeat/);

  const registrationButton = readFileSync(
    path.join(root, "src/components/event-registration-button.tsx"),
    "utf8",
  );
  assert.match(registrationButton, /window\.location\.replace\(/);

  const migration = readFileSync(
    path.join(root, "database/055_terminal_payment_states.sql"),
    "utf8",
  );
  assert.match(migration, /old\.status = 'refunded'/);
  assert.match(migration, /payment_transactions_terminal_status_guard/);
});

test("checkout reuses an active hold and only books published event states", () => {
  const repository = readFileSync(
    path.join(root, "src/lib/event-repository.ts"),
    "utf8",
  );
  assert.match(repository, /const BOOKABLE_EVENT_STATUSES/);
  assert.match(repository, /const activeHoldResult/);
  assert.match(repository, /payment\.status = 'pending'/);
  assert.match(repository, /holdExpiresAt: activeHold\.hold_expires_at/);

  const checkout = readFileSync(
    path.join(root, "src/app/api/events/[eventId]/checkout/route.ts"),
    "utf8",
  );
  // The key stays scoped to the payment transaction, so a double-click or a
  // lost response still replays one Session instead of creating two. It now
  // ALSO carries a digest of the submitted guests: when corrected guest details
  // force the route to expire and rebuild the Session, a transaction-only key
  // would make Stripe replay its cached response and hand back the very Session
  // we just expired - typo'd invite address and all.
  assert.match(checkout, /idempotencyKey: `click-checkout-\$\{hold\.paymentTransactionId\}-\$\{createHash\(/);
  assert.match(checkout, /\.update\(submittedGuests\)/);
  assert.match(checkout, /expires_at: Math\.floor\(hold\.holdExpiresAt\.getTime\(\) \/ 1000\)/);
  assert.match(checkout, /if \(hold && !hold\.reused\)/);

  const registration = readFileSync(
    path.join(root, "src/app/api/events/[eventId]/register/route.ts"),
    "utf8",
  );
  assert.match(registration, /error\.name === "ValidationError"/);
});

test("cancelled events do not count as upcoming merchant work", () => {
  const dashboard = readFileSync(
    path.join(root, "src/components/merchant-dashboard-tab.tsx"),
    "utf8",
  );
  assert.match(dashboard, /event\.status !== "Cancelled"/);
  assert.match(dashboard, /event\.status !== "Rejected"/);
});

test("event cancellation retries resume unfinished refunds safely", () => {
  const repository = readFileSync(
    path.join(root, "src/lib/event-repository.ts"),
    "utf8",
  );
  assert.match(repository, /attendee\.status = 'cancelled'[\s\S]*pt\.status in \('paid', 'partially_refunded'\)/);
  assert.match(repository, /const alreadyCancelled = event\.status === "cancelled"/);
  assert.doesNotMatch(
    repository,
    /if \(event\.status === "cancelled"\)[\s\S]{0,180}return/,
  );

  const stripeSync = readFileSync(path.join(root, "src/lib/stripe-sync.ts"), "utf8");
  assert.match(stripeSync, /idempotencyKey:[\s\S]*"click-refund"/);
  assert.match(stripeSync, /update refund_failures[\s\S]*resolution = 'resolved'/);
});

test("media blocklists can never contain the live storage host", () => {
  // This test used to assert the OPPOSITE - that vkpwhxixnynfccfheuut.supabase.co
  // was blocklisted - which is how the bug survived review. That host is the
  // project's CURRENT Supabase Storage bucket, so blocklisting it meant every
  // event photo and avatar uploaded in production was written to storage and
  // then silently discarded on read, replaced by stock art / initials.
  for (const file of ["src/lib/avatar-images.ts", "src/lib/event-images.ts"]) {
    const resolver = readFileSync(path.join(root, file), "utf8");
    assert.match(
      resolver,
      /unavailableHosts\(/,
      `${file} must build its blocklist through unavailableHosts()`,
    );
    assert.doesNotMatch(
      resolver,
      /["'][a-z0-9-]+\.supabase\.co["']/,
      `${file} hardcodes a Supabase host - route it through unavailableHosts() instead`,
    );
  }

  // The guard itself: it is only meaningful if it compares against the bucket we
  // actually upload to.
  const guard = readFileSync(path.join(root, "src/lib/unavailable-hosts.ts"), "utf8");
  assert.match(guard, /NEXT_PUBLIC_SUPABASE_URL/);

  const designSystem = readFileSync(path.join(root, "src/components/ds.tsx"), "utf8");
  assert.match(designSystem, /resolveAvatarImage\(src\)/);
});

test("merchants can create free events without finishing Stripe Connect", () => {
  // Onboarding offers "Skip for now - you can keep going and run free events".
  // A blanket charges_enabled gate on the create flow dead-ended everyone who
  // took that offer, so the gate lives downstream instead: pending status at
  // creation, a paid-only publication gate at approval, PayoutsNotReadyError at
  // checkout.
  const layout = readFileSync(
    path.join(root, "src/app/merchant/events/create/layout.tsx"),
    "utf8",
  );
  assert.doesNotMatch(
    layout,
    /if \(!status\.merchantProfile\.charges_enabled\)/,
    "the create-event wizard must not block wholesale on charges_enabled",
  );

  const repository = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
  assert.doesNotMatch(
    repository,
    /Connect Stripe payouts before creating events/,
    "createEventForMerchant must not reject free events for missing payouts",
  );
  // The downstream gates that make the above safe must still be in place - but
  // scoped to events that TAKE MONEY. The gate used to apply to every event, so
  // an approved host who skipped payout setup (the "theo" persona: "Approved,
  // skipped payout setup. Can publish free events") had every FREE event parked
  // in the admin queue while onboarding told them they were ready to go.
  assert.match(
    repository,
    /const needsStripe = priceCents > 0/,
    "the Stripe publish gate must apply only to events that charge",
  );
  assert.match(
    repository,
    /const eventStatus = autoApprove && \(!needsStripe \|\| stripeReady\) \? "live" : "pending"/,
    "a free event from an approved, auto-approved host must publish without Connect",
  );
  assert.match(repository, /This is a paid event, but the host hasn't finished Stripe Connect/);
});

test("a deep link survives signup and onboarding", () => {
  // Signing up from an event page used to drop the event: the modal replaced the
  // callback with a bare /post-login, and /post-login dropped ?next= again when
  // it sent a brand-new attendee to /onboarding. The RSVP never happened.
  const modal = readFileSync(path.join(root, "src/components/login-modal.tsx"), "utf8");
  assert.match(modal, /ATTENDEE_SIGNUP_CALLBACK_URL\}\?next=\$\{encodeURIComponent\(callbackUrl\)/);

  const postLogin = readFileSync(path.join(root, "src/app/post-login/page.tsx"), "utf8");
  assert.match(postLogin, /\/onboarding\?next=\$\{encodeURIComponent\(explicitNext\)/);

  const onboardingPage = readFileSync(path.join(root, "src/app/onboarding/page.tsx"), "utf8");
  assert.match(onboardingPage, /safeNext/);
  assert.match(onboardingPage, /next=\{next\}/);

  const onboardingForm = readFileSync(
    path.join(root, "src/components/onboarding-form.tsx"),
    "utf8",
  );
  assert.match(onboardingForm, /router\.push\(next \?\? "\/dashboard"\)/);

  // safeNext is the one place the protocol-relative case is handled.
  const safeNextSource = readFileSync(path.join(root, "src/lib/safe-next.ts"), "utf8");
  assert.match(safeNextSource, /value\.startsWith\("\/\/"\)/);
});

test("the 18+ gate is enforced on the server, not just in the form", () => {
  // Click is 18+. Birth date used to be OPTIONAL in saveOnboarding, so POSTing
  // straight at /api/onboarding minted a finished profile with birth_date null
  // and an age nobody ever checked. The form's own check is a convenience.
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");

  assert.match(
    repo,
    /if \(!rawBirthDate\) \{\s*throw validationError/,
    "saveOnboarding must reject a missing birth date",
  );
  assert.match(
    repo,
    /derivedAge < 18/,
    "saveOnboarding must reject an under-18 birth date",
  );

  // A profile that never supplied one has never passed the gate, so it is not
  // onboarded - keep this in step with assertBookingEligible below.
  assert.match(
    repo,
    /const onboardingComplete = !!row\?\.suburb && !!row\?\.birth_date/,
    "onboardingComplete must require a birth date",
  );

  const route = readFileSync(path.join(root, "src/app/api/onboarding/route.ts"), "utf8");
  assert.doesNotMatch(
    route,
    /age: payload\.age/,
    "age must be derived from the birth date server-side, never accepted from the client",
  );
});

test("booking an event requires a finished profile on every path", () => {
  // /onboarding is a form, and a form is not a gate - the app chrome used to
  // render over the top of it, so a fresh signup could tap through to Discover
  // and book with no postcode and no birth date. Both booking entry points have
  // to check, or checkout becomes the way around the free-RSVP check.
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");

  assert.match(
    repo,
    /async function assertBookingEligible\(pool: Pool, profileId: string\)/,
    "the booking eligibility guard must exist",
  );
  assert.match(repo, /error\.name = "OnboardingRequiredError"/);

  for (const entryPoint of [
    /export async function registerForEvent[\s\S]{0,400}?assertBookingEligible/,
    /export async function createPaymentHold[\s\S]{0,900}?assertBookingEligible/,
  ]) {
    assert.match(repo, entryPoint, "every booking entry point must call the guard");
  }

  // And the chrome that made the form escapable stays off the onboarding route.
  const gate = readFileSync(path.join(root, "src/components/chrome-gate.tsx"), "utf8");
  assert.match(gate, /"\/onboarding"/);
  const layout = readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
  assert.match(layout, /<ChromeGate>[\s\S]{0,400}<SiteHeader(?:\s+[^>]*)?\s*\/>/);
});

test("email logged while the provider was unconfigured is retryable", () => {
  const email = readFileSync(path.join(root, "src/lib/email.ts"), "utf8");
  assert.match(
    email,
    /delivery_status in \('pending', 'failed', 'skipped'\)/,
    "'skipped' means delivery was never attempted - it must be swept once a key exists",
  );
});

test("write APIs authenticate before parsing or validating request bodies", () => {
  for (const file of [
    "src/app/api/events/route.ts",
    "src/app/api/clicks/route.ts",
  ]) {
    const source = readFileSync(path.join(root, file), "utf8");
    const authBoundary = source.indexOf("if (!session?.user?.email)");
    const bodyParsing = Math.min(
      ...[source.indexOf("request.formData()"), source.indexOf("request.json()")].filter(
        (position) => position >= 0,
      ),
    );
    assert.ok(authBoundary >= 0, `${file} is missing an explicit auth boundary`);
    assert.ok(authBoundary < bodyParsing, `${file} parses the body before authentication`);
  }
});

test("public media uploads prefer R2 over the Supabase fallback", () => {
  const storage = readFileSync(
    path.join(root, "src/lib/public-media-storage.ts"),
    "utf8",
  );
  assert.match(storage, /region: "auto"/);
  assert.match(storage, /R2_BUCKET_NAME/);
  assert.match(storage, /new PutObjectCommand/);

  for (const file of [
    "src/lib/avatar-storage.ts",
    "src/lib/event-image-storage.ts",
    "src/lib/gallery-storage.ts",
  ]) {
    const source = readFileSync(path.join(root, file), "utf8");
    assert.match(source, /isR2PublicMediaConfigured\(\)/, `${file} does not prefer R2`);
  }
});

test("every email template has an .html file, a subject, and vice versa", () => {
  // Adding half of a template pair is silent at runtime: logEmailEvent catches
  // the missing-file error and warn-logs it, so the email just never arrives.
  const email = readFileSync(path.join(root, "src/lib/email.ts"), "utf8");

  const union = email.match(/export type EmailTemplate =([\s\S]*?);/)?.[1];
  assert.ok(union, "could not find the EmailTemplate union");
  const declared = [...union.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
  assert.ok(declared.length > 20, `parsed only ${declared.length} templates`);

  const subjects = email.match(/const SUBJECTS[\s\S]*?\n};/)?.[0];
  assert.ok(subjects, "could not find the SUBJECTS map");

  for (const template of declared) {
    assert.ok(
      existsSync(path.join(root, "emails", `${template}.html`)),
      `${template} is in the union but emails/${template}.html does not exist`,
    );
    assert.ok(
      subjects.includes(`"${template}":`),
      `${template} is in the union but has no subject in SUBJECTS`,
    );
  }

  const files = readdirSync(path.join(root, "emails"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => f.replace(/\.html$/, ""));
  for (const file of files) {
    assert.ok(
      declared.includes(file),
      `emails/${file}.html exists but ${file} is not in the EmailTemplate union`,
    );
  }
});

test("an unknown sign-in address is indistinguishable from a known one", () => {
  // This branch used to return { sent: true } early, before issueMagicLink:
  // no token, no email, and - because the rate limiter counts auth_magic_links
  // rows - no rate limiting either. So a known address started throwing
  // RateLimitError on the 6th post within an hour while an unknown one never
  // did, which is a user-enumeration oracle. Both paths must issue a token.
  const actions = readFileSync(path.join(root, "src/app/login/actions.ts"), "utf8");

  // Anchor on the call site, not the import - between the account lookup and
  // the token issue there must be no early return.
  const beforeIssue = actions.slice(0, actions.indexOf("issueMagicLink({"));
  const afterLookup = beforeIssue.slice(beforeIssue.lastIndexOf("profileExistsByEmail"));
  assert.doesNotMatch(
    afterLookup,
    /return\s*\{/,
    "the no-account branch returns before issueMagicLink - that restores the oracle",
  );

  assert.match(actions, /purpose: tokenPurpose/, "both paths must issue a token");
  assert.match(actions, /"signin-no-account"/);
});

test("the QA persona switcher cannot be reached without the unlock key", () => {
  // The switcher hands out admin and merchant sessions on a public domain, so
  // the TEST_SWITCHER_KEY cookie is the whole security boundary. Three things
  // must hold, and the third is the one that is easy to lose in a refactor.
  const auth = readFileSync(path.join(root, "src/auth.ts"), "utf8");
  const actions = readFileSync(path.join(root, "src/app/login/actions.ts"), "utf8");
  const layout = readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
  const chrome = readFileSync(path.join(root, "src/components/site-chrome.tsx"), "utf8");
  const accountMenu = readFileSync(
    path.join(root, "src/components/header-role-switcher.tsx"),
    "utf8",
  );
  const gate = readFileSync(path.join(root, "src/lib/test-switcher.ts"), "utf8");

  // 1. Registering the provider is NOT the gate: authorize() must re-check the
  //    cookie, or anyone can POST /api/auth/callback/test-login with
  //    email=admin@click.local and get an admin session.
  const authorizeBody = auth.slice(
    auth.indexOf('id: "test-login"'),
    auth.indexOf('id: "test-login"') + 900,
  );
  assert.match(
    authorizeBody,
    /isTestSwitcherUnlocked/,
    "test-login authorize() must verify the unlock cookie itself",
  );
  assert.match(authorizeBody, /@click\.local/, "test-login must stay in the seed namespace");

  // 2. Every server action behind the switcher checks the same gate.
  for (const action of [
    "signOutOfTestAccount",
    "signInAsTestAccount",
    "startTestJourney",
    "resetTestAccounts",
  ]) {
    const body = actions.slice(actions.indexOf(`export async function ${action}`));
    assert.match(
      body.slice(0, 400),
      /assertTestSwitcherUnlocked/,
      `${action} must assert the QA switcher is unlocked`,
    );
  }

  // 3. A short key is treated as unconfigured rather than quietly guarding the
  //    admin console with a handful of characters.
  assert.match(gate, /MIN_KEY_LENGTH\s*=\s*(2[4-9]|[3-9]\d)/);
  assert.match(gate, /timingSafeEqual/, "key comparison must be timing-safe");
  assert.match(
    gate,
    /catch\s*\{[^}]*return false/s,
    "an unreadable cookie jar must fail closed",
  );

  // 4. Signed-in sessions receive the gated switcher inside the account menu.
  // The floating control remains only for the signed-out test state, otherwise
  // choosing "Not signed in" would leave the tester with no way back in.
  assert.match(layout, /<SiteHeader qaSwitcherUnlocked=\{qaSwitcherUnlocked\}/);
  assert.match(chrome, /canSwitchAccounts=\{qaSwitcherUnlocked\}/);
  assert.match(accountMenu, /canSwitchAccounts[\s\S]*Switch account[\s\S]*TestAccountRows/);
  assert.match(layout, /qaSwitcherUnlocked && !session\?\.user \? \(/);
});

test("the release gate permits only the seeded QA admin beside a real operator", () => {
  const releaseGate = readFileSync(path.join(root, "scripts/release-check.mjs"), "utf8");

  assert.match(
    releaseGate,
    /email !== "admin@click\.local"/,
    "the seeded admin persona must not make an otherwise valid production config fail",
  );
  assert.match(
    releaseGate,
    /ADMIN_EMAILS must include at least one real monitored inbox/,
    "the QA persona must never be the only configured production admin",
  );
  assert.match(
    releaseGate,
    /SAFETY_INBOX_EMAIL must use a real monitored inbox/,
    "the safety inbox has no QA exception",
  );
});

test("an admin unlocks the QA switcher with their session, not a bare flag", () => {
  // Admins run the UAT, so being in ADMIN_EMAILS is the second way into the
  // switcher - they already hold every power it hands out. That makes the grant
  // cookie exactly as dangerous as the key cookie, so it carries the same two
  // properties: it cannot be forged, and it can be revoked from the environment
  // without touching the browser holding it.
  const gate = readFileSync(path.join(root, "src/lib/test-switcher.ts"), "utf8");
  const unlock = readFileSync(path.join(root, "src/app/qa-unlock/route.ts"), "utf8");
  const grant = readFileSync(path.join(root, "src/lib/qa-admin-grant.ts"), "utf8");

  // Signed, and compared in constant time - a cookie a browser can simply set
  // would be an unauthenticated admin console on a public domain.
  assert.match(grant, /createHmac\(/, "the admin grant must be signed");
  assert.match(grant, /timingSafeEqual/, "grant comparison must be timing-safe");

  // Revocation. The gate re-asks ADMIN_EMAILS on every request rather than
  // trusting that the holder was an admin when the cookie was issued, so
  // dropping an address locks them out on their next request.
  const holds = gate.slice(gate.indexOf("function adminGrantHolds"));
  assert.match(
    holds.slice(0, 500),
    /readQaAdminGrant[\s\S]*adminMayUnlock\(/,
    "a valid signature is not enough - the address must still be allowed to unlock",
  );

  // A QA PERSONA MAY NEVER MINT AN UNLOCK, even though admin@click.local has
  // to be in ADMIN_EMAILS for the Admin persona to reach the console. Without
  // this, a tester holding TEST_SWITCHER_KEY switches to that persona, mints
  // an admin grant from it, and now holds an unlock that clearing the key does
  // not revoke - grants are revoked through ADMIN_EMAILS instead. Enforced at
  // BOTH ends so a grant issued before the rule is inert, not grandfathered.
  const mayUnlock = gate.slice(gate.indexOf("function adminMayUnlock"));
  assert.match(
    mayUnlock.slice(0, 300),
    /@click\.local[\s\S]*return false/,
    "the QA namespace must be refused an admin grant",
  );
  assert.match(
    gate,
    /function mintAdminUnlockCookie[\s\S]{0,200}adminMayUnlock\(/,
    "minting must apply the same rule the gate applies",
  );

  // The switcher survives its own use: picking a persona replaces the admin
  // session, so a gate that read the CURRENT session would vanish after one
  // switch. Nothing in the gate may call auth().
  assert.doesNotMatch(
    gate,
    /\bauth\(\)/,
    "the unlock must outlive the admin session that granted it",
  );

  // Issuing one requires a live admin session, and every other shape still
  // 404s rather than confirming QA mode exists here.
  const noKeyBranch = unlock.slice(unlock.indexOf("const session = await auth()"));
  assert.match(
    noKeyBranch.slice(0, 600),
    /mintAdminUnlockCookie\(email\)[\s\S]*if \(!grant\) return notFound\(\)/,
    "the keyless branch must 404 for anyone who may not be granted an unlock",
  );

  // Where they find it: an admin who has never unlocked it has nothing on
  // screen saying the switcher exists, so /admin/system carries the switch.
  const systemPage = readFileSync(path.join(root, "src/app/admin/system/page.tsx"), "utf8");
  assert.match(systemPage, /<AdminQaAccess/, "admins need a signposted way in");
});

test("QA provisioning can only ever touch the @click.local namespace", () => {
  // The switcher now writes to whatever database it is pointed at, including
  // production. The blast radius is the seed namespace and nothing else, so
  // every persona address and every DELETE must be scoped to it.
  const personas = readFileSync(path.join(root, "src/lib/qa-personas.ts"), "utf8");
  const provision = readFileSync(path.join(root, "src/lib/qa-provision.ts"), "utf8");

  const emails = [...personas.matchAll(/email:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(emails.length >= 5, "expected the persona list to be found");
  for (const email of emails) {
    assert.ok(email.endsWith("@click.local"), `${email} escapes the seed namespace`);
  }

  // Each DELETE is scoped either to click.local or to the QA event slug list.
  const deletes = [...provision.matchAll(/delete from [\s\S]{0,220}?`/g)].map((m) => m[0]);
  assert.ok(deletes.length >= 3, "expected the delete statements to be found");
  for (const statement of deletes) {
    assert.ok(
      /click\.local/.test(statement) || /QA_EVENTS|slug = any/.test(statement),
      `unscoped delete in qa-provision.ts:\n${statement}`,
    );
  }
});


test("the public profile projection exposes interest tags only", () => {
  // user_tags carries three kinds of tag. Life-quiz answers land there as
  // tag_type 'life' - "Recently single", "New parent", "Career pivot" - and
  // getPublicProfileById used to select the lot, so answers collected to tune
  // suggestions rendered as public chips to anyone with the URL, signed out
  // included. getOwnProfile filters, so the owner never saw them on their own
  // profile and could not discover the disclosure. Keep the filter in the SQL:
  // this function IS the public projection.
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
  const fn = repo.slice(repo.indexOf("export async function getPublicProfileById"));
  const body = fn.slice(0, fn.indexOf("\nexport "));

  assert.match(
    body,
    /join tags tag on tag\.id = ut\.tag_id\s+where ut\.profile_id = \$1::uuid\s+and tag\.tag_type = 'interest'/,
    "getPublicProfileById must filter user_tags down to tag_type 'interest'",
  );
});

test("a paid booking always records the PaymentIntent that can refund it", () => {
  // stripe_payment_intent_id is the ONLY key syncTransactionFromStripe matches
  // on, so without it stripe_charge_id can never backfill and issueRefund
  // dead-ends at "no captured charge to refund yet" - unrefundable by any path,
  // including the admin console's "Sync from Stripe". Stripe creates the PI
  // lazily, so the webhook is usually the first place it exists.
  const webhook = readFileSync(
    path.join(root, "src/app/api/webhooks/stripe/route.ts"),
    "utf8",
  );
  const completed = webhook.slice(webhook.indexOf('case "checkout.session.completed"'));
  const branch = completed.slice(0, completed.indexOf("case \"checkout.session.expired\""));
  assert.match(
    branch,
    /attachPaymentIntent\(/,
    "the checkout.session.completed branch must attach the PaymentIntent",
  );

  // The cron backstop must attach BEFORE markPaymentSucceeded's short-circuit,
  // or it skips exactly the rows a webhook already confirmed - the ones that
  // need repairing.
  const sync = readFileSync(path.join(root, "src/lib/stripe-sync.ts"), "utf8");
  const reconcile = sync.slice(sync.indexOf("export async function reconcilePendingPayments"));
  const scoped = reconcile.slice(0, reconcile.indexOf("\nexport "));
  assert.ok(
    scoped.indexOf("attachPaymentIntent(") < scoped.indexOf("markPaymentSucceeded("),
    "reconcilePendingPayments must attach the PI before the confirmed short-circuit",
  );
});

test("the bug queue is readable only by an operator, but anyone may report", () => {
  // A support ticket carries the reporter's name and their free-text account of
  // what broke. GET used to answer any anonymous caller, and PATCH let anyone
  // close, reword or reopen someone else's ticket. Reporting stays open on
  // purpose so a broken signed-out surface can still be reported.
  const list = readFileSync(path.join(root, "src/app/api/support/ticket/route.ts"), "utf8");
  const get = list.slice(list.indexOf("export async function GET"));
  assert.match(get, /canTriageSupportTickets\(\)/, "GET must gate on an operator");

  const post = list.slice(
    list.indexOf("export async function POST"),
    list.indexOf("export async function GET"),
  );
  assert.doesNotMatch(
    post,
    /canTriageSupportTickets\(\)/,
    "reporting must stay open to everyone",
  );

  const patch = readFileSync(
    path.join(root, "src/app/api/support/ticket/[ticketRef]/route.ts"),
    "utf8",
  );
  assert.match(patch, /canTriageSupportTickets\(\)/, "PATCH must gate on an operator");

  // The gate itself: admins, or a browser holding the QA unlock. Local dev stays
  // open so nothing changes while developing.
  const access = readFileSync(path.join(root, "src/lib/support-access.ts"), "utf8");
  assert.match(access, /isTestSwitcherUnlocked\(\)/);
  assert.match(access, /isAdminEmail\(/);
});

test("a guarded deep link survives sign-in", () => {
  // Every consumer of ?callbackUrl runs it through a guard that requires a
  // leading "/" and rejects "//". The middleware used to send request.nextUrl
  // .href - absolute - so the guard rejected it and silently substituted
  // /post-login. Every deep link into a guarded route was dropped at sign-in:
  // a host tapping "View bookings" in an RSVP email landed on /merchant.
  const proxy = readFileSync(path.join(root, "src/proxy.ts"), "utf8");
  assert.match(
    proxy,
    /callbackUrl",\s*\n?\s*request\.nextUrl\.pathname \+ request\.nextUrl\.search/,
    "the middleware must send a path-relative callbackUrl",
  );
  assert.doesNotMatch(proxy, /callbackUrl", request\.nextUrl\.href/);

  for (const file of ["src/app/login/page.tsx", "src/app/register/page.tsx"]) {
    const page = readFileSync(path.join(root, file), "utf8");
    assert.match(page, /startsWith\("\/"\)/, `${file} must still reject absolute callbacks`);
  }
});

test("the event JSON and .ics routes gate exactly what the page gates", () => {
  // The page 404s a pending/rejected/cancelled event and hides the venue until
  // you RSVP. Both sibling routes served the same record with neither gate, so
  // the whole thing was one curl away from being decorative.
  for (const file of [
    "src/app/api/events/[eventId]/route.ts",
    "src/app/api/events/[eventId]/ics/route.ts",
  ]) {
    const route = readFileSync(path.join(root, file), "utf8");
    assert.match(route, /PUBLIC_EVENT_STATUSES\.has\(event\.status\)/, `${file} status gate`);
    assert.match(route, /viewerCanSeeVenue\(/, `${file} venue gate`);
  }

  // One definition, shared - not a copy per call site.
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
  assert.match(repo, /export const PUBLIC_EVENT_STATUSES/);
  const page = readFileSync(path.join(root, "src/app/events/[slug]/page.tsx"), "utf8");
  assert.doesNotMatch(
    page,
    /const PUBLIC_EVENT_STATUSES = new Set/,
    "the page must import the shared set, not redeclare it",
  );
});

test("the pilot boundary has exactly one definition", () => {
  // The wizard's notice and the server's waitlist branch used different postcode
  // lists, so a host in Camden or Penrith saw no out-of-pilot warning, was told
  // "in the queue within 1 business day", and was then emailed "Click isn't live
  // in your suburb". Two contradictory messages about the same submission.
  const geo = readFileSync(path.join(root, "src/lib/geo.ts"), "utf8");
  assert.match(geo, /export function isWithinSydneyPilot/);

  const wizard = readFileSync(path.join(root, "src/components/merchant-signup-wizard.tsx"), "utf8");
  assert.match(wizard, /isWithinSydneyPilot\(/);
  assert.doesNotMatch(
    wizard,
    /const SYDNEY_POSTCODE_RANGES/,
    "the wizard must not carry its own copy of the ranges",
  );

  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
  assert.match(repo, /const isWithinPilotArea = isWithinSydneyPilot/);
});

test("a refund releases the seat and tells the attendee", () => {
  // issueRefund only ever moved money. An admin refund left the buyer confirmed
  // on the roster, holding a seat the waitlist never got, still on the reminder
  // list, and never notified.
  const sync = readFileSync(path.join(root, "src/lib/stripe-sync.ts"), "utf8");
  assert.match(sync, /settleRefundedBooking\(/);
  assert.match(
    sync,
    /input\.settleBooking && newStatus === "refunded"/,
    "seat release is for FULL refunds only",
  );

  // Opt-in, because cancelRegistration already cancels the seat AND promotes the
  // queue before calling issueRefund - doing it twice would promote two people
  // into one freed seat.
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
  const cancelRegistration = repo.slice(
    repo.indexOf("export async function cancelRegistration"),
    repo.indexOf("export async function cancelRegistration") + 12000,
  );
  assert.doesNotMatch(
    cancelRegistration,
    /settleBooking: true/,
    "the attendee-cancel path must not double-release the seat",
  );

  const refundRoute = readFileSync(
    path.join(root, "src/app/api/admin/transactions/[id]/refund/route.ts"),
    "utf8",
  );
  assert.match(refundRoute, /settleBooking: true/, "the admin console refund must settle");
});

test("moving real money needs a second tap", () => {
  // The amount box opens pre-filled with the full refundable balance against a
  // LIVE key. Every other destructive admin action is behind ConfirmDialog.
  const table = readFileSync(path.join(root, "src/components/admin-transactions-table.tsx"), "utf8");
  assert.match(table, /ConfirmDialog/);
  assert.match(table, /onClick=\{requestRefund\}/, "the button must stage, not submit");
  assert.doesNotMatch(table, /onClick=\{submit\}/);
});

test("the host's RSVP notification links somewhere that exists", () => {
  // /merchant/events/[eventId] resolves its param as a SLUG, so the UUID this
  // used to send 404'd - both CTAs in the host's primary notification were dead.
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
  assert.doesNotMatch(
    repo,
    /merchant\/events\/\$\{row\.event_id\}/,
    "merchant event links must use the slug, never the UUID",
  );
});

test("a lapsed plan can be re-planned, and a re-suggestion is not born expired", () => {
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
  // expireClickLifecycles parks a still-ACTIVE mutual at coord_state 'dormant',
  // and the drawer renders those as the open "suggest a plan" step - so the
  // guard has to accept them or every suggestion that step invites fails.
  assert.match(
    repo,
    /mutual\.coord_state !== "open" && mutual\.coord_state !== "dormant"/,
  );
  // Re-pointing an accepted-but-dead plan must reset the clock: an accepted row
  // is exempt from clock-expiry, so its deadline is routinely already past, and
  // flipping status back to 'pending' without moving expires_at re-projected the
  // pair straight to "This plan wound down".
  const proposeAlt = repo.slice(
    repo.indexOf("export async function proposeAlternativeForProposal"),
    repo.indexOf("export async function proposeAlternativeForProposal") + 9000,
  );
  assert.match(proposeAlt, /expires_at = now\(\) \+ interval/);
});

test("a mutual with nothing to suggest does not fake a plan", () => {
  // Creating the proposal with a null event advanced coord_state to 'proposed',
  // which asks the other person "you in?" about a plan that does not exist and
  // renders no Confirm button, because there is no event to confirm.
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
  assert.match(repo, /if \(suggestedEvent\) \{/);
  assert.doesNotMatch(repo, /\[mutualClickId, suggestedEvent\?\.id \?\? null, profile\.id\]/);
});

test("the host funnel's only email path reports its own failures", () => {
  // signInWithEmail redirects to /merchant/signup?error=<code> on a failed send
  // (RateLimited trips at 5/hour). The page read only ?emailSent, so it
  // re-rendered byte-identical - a dead button on the entry point to the whole
  // merchant funnel.
  const page = readFileSync(path.join(root, "src/app/merchant/signup/page.tsx"), "utf8");
  assert.match(page, /authErrorMessage\(params\?\.error\)/);
  assert.match(page, /errorMessage=\{errorMessage\}/);

  // One error table, so a code can't be handled on one surface and not another.
  const copy = readFileSync(path.join(root, "src/lib/auth-error-copy.ts"), "utf8");
  for (const code of ["RateLimited", "EmailUnavailable"]) {
    assert.match(copy, new RegExp(code), `${code} needs copy`);
  }
});

test("the host landing page states no metric it cannot compute", () => {
  // "7 days · Avg. time to first booking" and "94% · Show-up rate" were invented
  // figures presented as measured platform performance to businesses making a
  // commercial decision, on a platform with no public traffic.
  const page = readFileSync(path.join(root, "src/app/merchant/signup/page.tsx"), "utf8");
  // Scope to the RENDERED tiles. The comment above them deliberately quotes the
  // claims that were removed, so a whole-file grep would match its own
  // documentation and never fail for the reason that matters.
  const tiles = page.slice(page.indexOf("<dl className="), page.indexOf("</dl>"));
  for (const claim of ["Avg. time to first booking", "Show-up rate", "94%"]) {
    assert.doesNotMatch(
      tiles,
      new RegExp(claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `"${claim}" is not a number this platform can compute`,
    );
  }
  // The fee is percentage-only: calculateApplicationFee has no fixed component
  // and booking_fee_bps defaults to 0, so "+ 30c" overstated it.
  assert.doesNotMatch(tiles, /2\.9% \+ 30/);
});

test("the signup wizard collects the business type Stripe onboarding needs", () => {
  // Every merchant was created with identity.entity_type "company", so an AU
  // sole trader was asked for a registered company name and ACN they don't have
  // and could never finish onboarding - or run a paid event.
  const wizard = readFileSync(path.join(root, "src/components/merchant-signup-wizard.tsx"), "utf8");
  assert.match(wizard, /BusinessTypePicker/);
  assert.match(wizard, /sole_trader/);
  assert.match(wizard, /businessType: state\.businessType \|\| null/);

  const connect = readFileSync(path.join(root, "src/lib/stripe-connect.ts"), "utf8");
  assert.match(connect, /businessType === "sole_trader" \? "individual" : "company"/);

  // A partial edit that omits the field must not wipe a good value.
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
  assert.match(
    repo,
    /business_type = coalesce\(excluded\.business_type, merchant_profiles\.business_type\)/,
  );
});

test("a rejected merchant's resubmission reaches the admin queue", () => {
  // The notification + confirmation were gated on `is_new`, so a resubmission
  // pinged nobody - while /merchant-pending promised "back into the admin queue
  // and we'll email you the outcome".
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
  assert.match(repo, /const wasRejected = priorStatus\.rows\[0\]\?\.verification_status === "rejected"/);
  assert.match(repo, /if \(upsert\.rows\[0\]\.is_new \|\| resubmitted\)/);
});

test("removing every event photo actually removes the cover", () => {
  // `array_length(NULL, 1) >= 1` is NULL, never true, so the cover survived
  // every removal: the grid said "Photos (0/5)" and "Saved.", then the old photo
  // came back on reload with no way out of the loop.
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
  assert.match(repo, /image_url = case when \$7::boolean then \(\$8::text\[\]\)\[1\] else image_url end/);
});

test("a buyer who pays for a dead event is told, not 404'd", () => {
  const page = readFileSync(path.join(root, "src/app/events/[slug]/page.tsx"), "utf8");
  assert.match(page, /getUnfulfilledPaymentNotice\(/);
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
  assert.match(repo, /export async function getUnfulfilledPaymentNotice/);
});

test("a multi-seat checkout can be resumed", () => {
  // createPaymentHold rejects a mismatched party size, so the solo "Reserve &
  // pay" CTA errored for the full 31-minute hold with no control to resume the
  // real 3-seat checkout.
  const button = readFileSync(path.join(root, "src/components/event-payment-button.tsx"), "utf8");
  assert.match(button, /resumeSeatCount/);
  const page = readFileSync(path.join(root, "src/app/events/[slug]/page.tsx"), "utf8");
  assert.match(page, /resumeSeatCount=\{event\.heldSeatCount\}/);
});

test("post-event and onboarding surfaces stop swallowing outcomes", () => {
  // The dashboard's click action caught every error and returned nothing, so a
  // closed window or a spent cap made the button do visibly nothing.
  const actions = readFileSync(path.join(root, "src/app/dashboard/actions.ts"), "utf8");
  assert.match(actions, /Promise<ClickResult>/);
  assert.doesNotMatch(actions, /\/\/ Swallow;/);

  // The onboarding draft restored every field EXCEPT the interests the user had
  // just tapped, and collapsed the history stack so Back had nothing to walk.
  const form = readFileSync(path.join(root, "src/components/onboarding-form.tsx"), "utf8");
  assert.match(form, /setTags\(new Set\(draft\.tags\)\)/);
  assert.match(form, /for \(let i = 1; i <= draft\.step; i \+= 1\)/);
});

test("a life-quiz answer can never collide with a seeded interest tag", () => {
  // `creative` is an admin-managed interest tag in 002_seed.sql. The quiz linked
  // the user to THAT row, so an interest they never picked appeared on their
  // profile - and the retake's delete is guarded on tag_type='life', so it could
  // never be removed.
  const sections = readFileSync(path.join(root, "src/lib/life-quiz-sections.ts"), "utf8");
  assert.doesNotMatch(sections, /slug: "creative"/);
  assert.match(sections, /slug: "creative-hands-on"/);
});

test("retiring a checkout session cannot cancel the seat the buyer is paying for", () => {
  // The corrected-guest path expires Session A and builds Session B against the
  // SAME payment transaction. Stripe then fires checkout.session.expired for A
  // while the buyer is entering their card on B. Two things have to hold or that
  // stale event fails a live transaction and cancels a seat someone is paying
  // for - they get charged, force-refunded, and end up with nothing.
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");

  // 1. The replacement Session must actually be stored. `is null` alone made the
  //    rebuild a no-op, leaving every reconcile path judging the transaction by
  //    the Session the buyer had abandoned.
  const attach = repo.slice(
    repo.indexOf("export async function attachCheckoutSession"),
    repo.indexOf("export async function attachCheckoutSession") + 1200,
  );
  assert.match(
    attach,
    /stripe_checkout_session_id is null or stripe_checkout_session_id <> \$2/,
    "a deliberate session replacement must overwrite, not silently no-op",
  );

  // 2. A failure that names a session must be ignored unless that session is
  //    still the transaction's current one.
  const failed = repo.slice(
    repo.indexOf("export async function markPaymentFailed"),
    repo.indexOf("export async function markPaymentFailed") + 2000,
  );
  assert.match(failed, /stripeCheckoutSessionId\?: string \| null/);
  assert.match(
    failed,
    /stripe_checkout_session_id = \$2::text/,
    "a stale session's expiry must not fail the current transaction",
  );

  // 3. The webhook has the session id in hand, so it must pass it. Without this
  //    the guard above is never armed on the one path that needs it.
  const webhook = readFileSync(
    path.join(root, "src/app/api/webhooks/stripe/route.ts"),
    "utf8",
  );
  assert.match(webhook, /markPaymentFailed\(id, session\.id\)/);

  // 4. payment_intent.canceled is terminal, so it stays unconditional.
  assert.match(webhook, /markPaymentFailed\(id\);/);

  // 5. payment_intent.payment_failed must NOT fail the transaction. It fires on
  //    every declined card while the Checkout Session is still OPEN for retry,
  //    and it carries no Session id to arm the guard above - so handling it
  //    cancelled the pending_payment seat mid-retry, and the successful retry
  //    settled against nothing: charged, force-refunded, "Booking unavailable".
  //
  //    This assertion used to demand the opposite. It read the two bundled
  //    cases as one "payment_intent.* branch" and required the unconditional
  //    call, which is how the defect passed a green suite.
  const failedCase = webhook.slice(
    webhook.indexOf('case "payment_intent.payment_failed"'),
    webhook.indexOf(
      'case "',
      webhook.indexOf('case "payment_intent.payment_failed"') + 10,
    ),
  );
  assert.ok(failedCase.length > 0, "payment_intent.payment_failed case not found");
  // Match the CALL, not the name: the comment in that case explains the defect
  // and necessarily says "markPaymentFailed" out loud.
  assert.doesNotMatch(
    failedCase,
    /markPaymentFailed\s*\(/,
    "a declined card must not cancel the seat the buyer is retrying against",
  );

  // 6. The replaced Session is expired only AFTER the replacement is attached.
  //    Expire first and the transaction still names the old id, so the stale
  //    checkout.session.expired passes the guard and kills a live seat - the
  //    guard is defeated by statement order alone.
  const checkout = readFileSync(
    path.join(root, "src/app/api/events/[eventId]/checkout/route.ts"),
    "utf8",
  );
  const attachAt = checkout.indexOf("await attachCheckoutSession(");
  const expireAt = checkout.indexOf("sessions.expire(staleSessionId)");
  assert.ok(attachAt > -1, "attachCheckoutSession call not found");
  assert.ok(expireAt > -1, "the staged expire of the replaced session not found");
  assert.ok(
    expireAt > attachAt,
    "the replaced session must be expired only after the new one is attached",
  );
});

test("every admin page enforces admin access on its own segment", () => {
  // src/app/admin/layout.tsx is not a boundary: a layout renders once per
  // segment entry, and an RSC request carrying a crafted Next-Router-State-Tree
  // resumes at the first mismatched segment, so a nested admin page can execute
  // without the layout ever running. The header is shape-checked, not
  // authenticated, and anyone can mint a session via the open magic-link
  // signup. Admin WRITES were always safe (requireAdminProfile); this closes
  // read exposure - KYC signed URLs, every member's email, the live ledger.
  const dir = path.join(root, "src/app/admin");
  const pages = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "page.tsx") pages.push(full);
    }
  };
  walk(dir);

  assert.ok(pages.length >= 14, `expected the admin console, found ${pages.length} pages`);
  for (const page of pages) {
    const src = readFileSync(page, "utf8");
    assert.match(
      src,
      /requireAdminPage\(\)|await auth\(\)/,
      `${path.relative(root, page)} relies on the layout for authorization`,
    );
  }
});

test("a banned or suspended account cannot book, pay, or join a waitlist", () => {
  // is_banned / suspended_at only ever filtered the click and matching queries,
  // so someone removed for harassing an attendee could still sign in and buy a
  // seat at the same event as the person who reported them.
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
  const gate = repo.slice(
    repo.indexOf("async function assertBookingEligible"),
    repo.indexOf("async function assertBookingEligible") + 1600,
  );
  assert.match(gate, /select suburb, birth_date, is_banned, suspended_at/);
  // The ban half moved into a shared predicate so the guest +1 claim - the
  // fourth seat-acquiring route - can decide it identically off the row it
  // already reads. The gate must still route through it, and the predicate must
  // still be the thing that carries the refusal.
  assert.match(gate, /assertNotBannedFromSeats\(row\)/);
  const banRule = repo.slice(
    repo.indexOf("function assertNotBannedFromSeats"),
    repo.indexOf("async function assertBookingEligible"),
  );
  assert.match(banRule, /row\?\.is_banned/);
  assert.match(banRule, /row\?\.suspended_at/);
  assert.match(banRule, /error\.name = "ForbiddenError"/);

  // The gate is only worth having in one place if every booking path routes
  // through it. Two entry points cover all three: the waitlist branch lives
  // inside registerForEvent, so a waitlist join is gated by the same call.
  for (const entry of ["registerForEvent", "createPaymentHold"]) {
    const start = repo.indexOf(`export async function ${entry}`);
    assert.ok(start > -1, `${entry} not found`);
    assert.match(
      repo.slice(start, start + 900),
      /await assertBookingEligible\(/,
      `${entry} must go through the shared eligibility gate`,
    );
  }

  // Both entry routes must translate the refusal, or it surfaces as a 500 that
  // reads like Click is broken rather than "this account cannot book".
  for (const route of [
    "src/app/api/events/[eventId]/checkout/route.ts",
    "src/app/api/events/[eventId]/register/route.ts",
  ]) {
    const source = readFileSync(path.join(root, route), "utf8");
    assert.match(
      source,
      /error\.name === "ForbiddenError"[\s\S]{0,120}status: 403/,
      `${route} must answer a banned account with 403`,
    );
  }
});

test("a suspended host cannot take money through the direct event URL", () => {
  // Suspension hid the host's events from Discover and revoked event
  // auto-approval, but getEventBySlug never checked it - so an admin who had
  // just suspended a host for cause could still watch them charge anyone
  // holding the link.
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
  const start = repo.indexOf("export async function createPaymentHold");
  assert.ok(start > -1, "createPaymentHold not found");
  const hold = repo.slice(start, start + 9000);

  assert.match(
    hold,
    /merchant\.verification_status as merchant_verification_status/,
    "the hold query must load the host's verification status",
  );
  assert.match(
    hold,
    /event\.merchant_verification_status === "suspended"/,
    "a suspended host's paid event must refuse the hold",
  );
});

test("a host cannot cancel - and refund - an event that already happened", () => {
  // The events list has always refused to offer Cancel on a past event, but
  // the event detail page read an ended event as "Live" and kept the button
  // live beside it. Cancelling refunds every paid booking in full, so a host
  // tidying up last week's sold-out night could hand back the takings with no
  // undo. The rule now sits in cancelEvent, where both surfaces route.
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
  const start = repo.indexOf("async function cancelEvent(");
  assert.ok(start > -1, "cancelEvent not found");
  const cancel = repo.slice(start, start + 9000);

  assert.match(
    cancel,
    /actor\.kind === "merchant" && !alreadyCancelled/,
    "the ended-event guard must apply to merchants and exempt the refund-retry path",
  );
  assert.match(
    cancel,
    /endedAt\.getTime\(\) < Date\.now\(\)/,
    "the guard must compare the event's end against now",
  );

  // A UI-only guard is not a guard, but the affordance still has to go: an
  // enabled button that always 403s is its own bug.
  const page = readFileSync(
    path.join(root, "src/app/merchant/events/[eventId]/page.tsx"),
    "utf8",
  );
  assert.match(
    page,
    /const hasEnded = new Date\(event\.endsAt \?\? event\.startsAt\)/,
    "the detail page must derive hasEnded the same way the events list does",
  );
  // Allows a wrapper element between the guard and the button - the row puts
  // the destructive action in its own basis-full box below sm so it cannot
  // share a wrapped line with a constructive one. What is pinned is that the
  // cancel button is INSIDE the hasEnded branch, not the exact markup around it.
  assert.match(
    page,
    /hasEnded \? null : \((?:(?!\?)[\s\S]){0,400}?<MerchantEventCancelButton/,
    "an ended event must not render the cancel button",
  );
});

test("the Finances tiles report settled money, not gross charges", () => {
  // Two separate lies in one row: "Total - all time" summed EVERY
  // payment_transactions row, so abandoned checkouts ('failed') and refunds
  // inflated it permanently; and "Paid out - to your bank" sat on the gross
  // buyer charge, which is never what Stripe deposits - the commission and the
  // booking fee come off as the application fee first.
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
  const start = repo.indexOf("export async function getMerchantFinancesSummary");
  assert.ok(start > -1, "getMerchantFinancesSummary not found");
  const summary = repo.slice(start, start + 6000);

  assert.match(
    summary,
    /status in \('paid', 'partially_refunded'\)/,
    "revenue must count settled rows only - never 'pending' or 'failed'",
  );
  assert.doesNotMatch(
    summary,
    /coalesce\(sum\(amount_cents\), 0\)::text as total/,
    "the unfiltered all-status sum must not come back",
  );
  // A refund reverses the transfer and the fee proportionally, but the
  // charge-time columns are never rewritten - so both have to be pro-rated by
  // the share of the charge that survived.
  assert.match(
    summary,
    /kept_share/,
    "fee and net must be pro-rated by the unrefunded share of each charge",
  );

  const tab = readFileSync(path.join(root, "src/components/merchant-finances-tab.tsx"), "utf8");
  assert.doesNotMatch(
    tab,
    /note="to your bank"/,
    "a gross charge must never be labelled as reaching the host's bank",
  );
  // The row has to reconcile: collected - Click's fee = what lands.
  for (const label of ["Collected", "Click fee", "Your net"]) {
    assert.match(tab, new RegExp(`label="${label}"`), `missing the ${label} tile`);
  }
});

test("portal headcounts include paid +1 guest seats", () => {
  // getMerchantEvents counted event_attendees rows only. A paid +1 holds a seat
  // but has no attendee row, so the dashboard, the events list, the calendar
  // and the fill rate all under-reported - while the event DETAIL page counted
  // seats properly and disagreed with all four.
  const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
  const start = repo.indexOf("export async function getMerchantEvents");
  assert.ok(start > -1, "getMerchantEvents not found");
  const events = repo.slice(start, start + 4000);

  assert.match(events, /from guest_spots gs/, "the query must count guest seats");
  assert.match(
    events,
    /confirmed: Number\(row\.confirmed\) \+ Number\(row\.guest_seats\)/,
    "confirmed must be SEATS, so no portal surface can forget to add the +1s",
  );
});
