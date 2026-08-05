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
  assert.match(
    checkout,
    /idempotencyKey: `click-checkout-\$\{hold\.paymentTransactionId\}`/,
  );
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
  // The downstream gates that make the above safe must still be in place.
  assert.match(repository, /const eventStatus = autoApprove && stripeReady \? "live" : "pending"/);
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

  // 4. The layout mounts it behind the unlock check, not the local-dev flag.
  assert.match(layout, /qaSwitcherUnlocked \? \(?\s*<TestAccountSwitcher/);
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
