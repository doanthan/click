// Sends one of EVERY transactional template in /emails to a single inbox, so
// you can eyeball the whole set and confirm Resend delivery actually works.
//
//   node scripts/send-test-emails.mjs --to=you@example.com
//   node scripts/send-test-emails.mjs --to=you@example.com --dry-run
//   node scripts/send-test-emails.mjs --to=you@example.com --only=signin-link
//   node scripts/send-test-emails.mjs --to=you@example.com --prefix="[TEST] "
//
// Reads RESEND_API_KEY / RESEND_FROM_EMAIL from .env.production.local (that is
// the only env file that carries the key) - override with --env=<file>.
//
// This deliberately does NOT go through logEmailEvent: a test blast has no
// business writing 28 rows into the live email_events audit trail. It renders
// the same .html files with the same {{var}} regex and posts straight to
// Resend, so a template that fails here fails in production too.
//
// The render is a copy of renderHtml() in src/lib/email.ts. It has to be -
// that module is TypeScript with path-aliased imports that plain node cannot
// resolve. Keep the two in step; they are four lines each.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const arg = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name) => process.argv.includes(`--${name}`);

const to = arg("to");
const only = arg("only");
const prefix = arg("prefix") ?? "";
const dryRun = flag("dry-run");
const envFile = arg("env") || ".env.production.local";

if (!to && !dryRun) {
  console.error("Missing --to=<email>. Add --dry-run to render without sending.");
  process.exit(1);
}

// Same precedence as scripts/release-check.mjs: real env wins over the file,
// last occurrence within the file wins.
function loadEnv(filename) {
  const absolute = path.resolve(root, filename);
  if (!existsSync(absolute)) return false;
  const preexisting = new Set(Object.keys(process.env));
  for (const line of readFileSync(absolute, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || preexisting.has(match[1])) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
  return true;
}

loadEnv(envFile);

// ---------- sample data ----------
//
// One flat dictionary covering every {{var}} across every template. Variable
// names are consistent across the set, so a single realistic Sydney booking
// fills all 28 without per-template fixtures.

const APP = "https://www.letsclick.app";

const VARS = {
  // people
  firstName: "Cindy",
  guestFirstName: "Cindy",
  purchaserFirstName: "Maya",
  attendeeFirstName: "Maya",
  merchantFirstName: "Noah",
  reporterName: "Maya T.",
  otherName: "Priya",
  eventHostName: "Marrickville Clay Studio",
  businessName: "Marrickville Clay Studio",

  // the event
  eventTitle: "Thursday Clay Club",
  eventLongDate: "Thursday 13 August 2026",
  eventLongDateClause: "on Thursday 13 August 2026",
  eventShortDate: "13 Aug",
  eventStartTime: "7:00 PM",
  eventEndTime: "9:00 PM",
  eventVenue: "Marrickville Clay Studio",
  eventAddress: "12 Sydenham Road, Marrickville NSW 2204",
  eventCity: "Marrickville",
  suburb: "Marrickville",
  eventCategory: "Arts",
  eventCapacityLabel: "Capacity 20",
  eventPriceLabel: "$28",
  eventSpotsFilledLabel: "12 of 20 spots filled",
  socialSignalLabel: "4 people you might click with are also going",
  attendeeIntentLabel: "Friends mode",
  attendeeCity: "Newtown",
  whoElseLabel: "12 going, 4 are first-timers",
  waitlistCountLabel: "3 on the waitlist",
  attendeeCount: "12",
  refundCount: "12",
  // Rendered server-side as a block of <tr>s; blank when there is nothing to
  // suggest, which is what production passes today.
  suggestedEvents: "",

  // waitlist
  offerWindowLabel: "30 minutes",
  offerExpiresLabel: "Thu, 7:42 PM",

  // money
  priceLabel: "$25.45",
  taxLabel: "$2.55",
  totalLabel: "$28.00",
  paymentMethodLabel: "Visa ending in 4242",
  receiptNumber: "CL-2026-08213",
  receiptDate: "5 August 2026",
  refundLabel: "A $28 refund is on its way to your Visa ending 4242",
  refundLine: "A $28 refund is on its way to your Visa ending 4242",
  revenueLabel: "$1,240",

  // merchant reporting
  monthLabel: "July",
  eventsCount: "6",
  attendeesCount: "84",
  topEventTitle: "Thursday Clay Club",
  topEventAttendees: "20",
  submittedDate: "5 August 2026",
  pilotArea: "Greater Sydney",

  // admin free text
  rejectionReason:
    "The venue photo does not show the space you have described. Swap it for a shot of the actual studio and resubmit.",
  cancellationReason: "The kiln failed and cannot be repaired before Thursday.",
  suspensionReason:
    "Two attendees reported the venue was locked at the listed start time. We have paused new bookings while we check in with you.",
  reason: "Inappropriate messages",
  details: "Sent repeated messages after being asked to stop.",
  reportId: "RPT-2026-0041",

  // auth
  verifyUrl: `${APP}/auth/email/verify?token=sample-token-not-a-real-link`,
  resetUrl: `${APP}/reset-password?token=sample-token-not-a-real-link`,
  expiryWindowLabel: "15 minutes",
  requestIpLabel: "an IP in Sydney, Australia",
  attemptedEmail: "cindy@letsclick.app",

  // links
  quizUrl: `${APP}/quiz/life`,
  discoverUrl: `${APP}/discover`,
  eventDetailsUrl: `${APP}/events/thursday-clay-club`,
  eventUrl: `${APP}/events/thursday-clay-club`,
  publicEventUrl: `${APP}/events/thursday-clay-club`,
  claimUrl: `${APP}/events/thursday-clay-club`,
  releaseUrl: `${APP}/confirmed-events`,
  removeUrl: `${APP}/confirmed-events`,
  cancelRsvpUrl: `${APP}/confirmed-events`,
  addToCalendarUrl: `${APP}/events/thursday-clay-club`,
  directionsUrl: "https://maps.google.com/?q=12+Sydenham+Road+Marrickville",
  eventDashboardUrl: `${APP}/merchant/events/sample`,
  attendeesUrl: `${APP}/merchant/events/sample`,
  editEventUrl: `${APP}/merchant/events/sample/edit`,
  merchantDashboardUrl: `${APP}/merchant`,
  createEventUrl: `${APP}/merchant/events/create`,
  resubmitUrl: `${APP}/merchant/signup/documents`,
  proposalsUrl: `${APP}/clicks`,
  downloadInvoiceUrl: `${APP}/receipts/CL-2026-08213`,
  refundPolicyUrl: `${APP}/refund-policy`,
  unsubscribeUrl: `${APP}/account-settings`,
  supportEmail: "hello@letsclick.app",

  // misc copy
  suggestionLine: "You both said yes to Thursday Clay Club - we suggested it as your first plan.",
};

// Mirrors the SUBJECTS map in src/lib/email.ts. Written as {{var}} templates so
// the same renderer fills them.
const SUBJECTS = {
  "account-welcome": "Welcome to Click - let's find your people",
  "rsvp-attendee": "You're in - {{eventTitle}}, {{eventShortDate}}",
  "rsvp-merchant": "New RSVP - {{attendeeFirstName}} is going to {{eventTitle}}",
  "rsvp-cancelled-attendee": "RSVP cancelled - {{eventTitle}}",
  "rsvp-cancelled-merchant": "{{attendeeFirstName}} can't make {{eventTitle}}",
  "event-reminder-attendee": "Tomorrow - {{eventTitle}}",
  "event-created-merchant": "Your event is in review - {{eventTitle}}",
  "event-approved-merchant": "{{eventTitle}} is live",
  "event-rejected-merchant": "{{eventTitle}} needs another pass",
  "event-cancelled-merchant": "{{eventTitle}} was cancelled by Click",
  "event-cancelled-attendee": "{{eventTitle}} has been cancelled",
  "merchant-application-received": "We've got your application - {{businessName}}",
  "merchant-waitlisted-merchant": "You're on the Click waitlist - {{suburb}} is coming soon",
  "merchant-verified-merchant": "{{businessName}} verified - post your first event",
  "merchant-rejected-merchant": "{{businessName}} application - one small change",
  "merchant-suspended-merchant": "{{businessName}} has been suspended on Click",
  "password-reset": "Reset your Click password",
  "signin-link": "Your Click sign-in link",
  "signup-link": "Finish creating your Click account",
  "signin-no-account": "No Click account on this address yet",
  "waitlist-joined-attendee": "You're on the waitlist - {{eventTitle}}",
  "waitlist-promoted-attendee": "A spot opened - {{eventTitle}}",
  "payment-receipt-attendee": "Receipt - {{eventTitle}} ({{totalLabel}})",
  "report-received-admin": "[Safety] New report - {{reason}}",
  "merchant-monthly-report":
    "Your {{monthLabel}} on Click - {{eventsCount}} events, {{revenueLabel}}",
  "mutual-click-attendee": "It's mutual - you clicked with {{otherName}}",
  "guest-invite": "{{purchaserFirstName}} saved you a spot",
  "guest-spot-existing-user": "{{purchaserFirstName}} saved you a spot at {{eventTitle}}",
  "guest-spot-cancelled": "Your spot at {{eventTitle}} is no longer held",
};

// Same regex as renderHtml() in src/lib/email.ts: unknown keys are LEFT IN so a
// missing variable is visible rather than silently blank.
const render = (text, vars) =>
  text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (full, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? "") : full,
  );

// ---------- run ----------

const emailsDir = path.resolve(root, "emails");
const templates = readdirSync(emailsDir)
  .filter((f) => f.endsWith(".html"))
  .map((f) => f.replace(/\.html$/, ""))
  .sort();

// A template with no subject (or a subject with no template) means someone
// added one half of the pair. Fail loudly rather than skip it.
const missingSubject = templates.filter((t) => !SUBJECTS[t]);
const missingTemplate = Object.keys(SUBJECTS).filter((t) => !templates.includes(t));
if (missingSubject.length || missingTemplate.length) {
  if (missingSubject.length) console.error("No subject for:", missingSubject.join(", "));
  if (missingTemplate.length) console.error("No .html for:", missingTemplate.join(", "));
  process.exit(1);
}

const selected = only ? templates.filter((t) => t === only) : templates;
if (!selected.length) {
  console.error(`--only=${only} matched nothing. Known: ${templates.join(", ")}`);
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM_EMAIL || "Click <hello@send.letsclick.app>";
const replyTo = process.env.RESEND_REPLY_TO_EMAIL || "hello@letsclick.app";

if (!dryRun && !apiKey) {
  console.error(`RESEND_API_KEY not found in ${envFile}. Use --dry-run to render only.`);
  process.exit(1);
}

console.log(
  dryRun
    ? `Rendering ${selected.length} templates (dry run, nothing sent)\n`
    : `Sending ${selected.length} templates to ${to}\n  from: ${from}\n  reply-to: ${replyTo}\n`,
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let sent = 0;
let failed = 0;
const unresolved = [];

for (const [index, template] of selected.entries()) {
  const raw = readFileSync(path.join(emailsDir, `${template}.html`), "utf8");
  const html = render(raw, VARS);
  const subject = prefix + render(SUBJECTS[template], VARS);

  // Anything still in {{braces}} is a variable the template wants and the
  // caller never passes - the exact bug this script exists to surface.
  const leftovers = [...new Set(html.match(/\{\{\s*[\w.-]+\s*\}\}/g) || [])];
  if (leftovers.length) unresolved.push(`${template}: ${leftovers.join(" ")}`);

  const label = `${String(index + 1).padStart(2, " ")}/${selected.length} ${template.padEnd(30)}`;

  if (dryRun) {
    console.log(`${label} ${String(html.length).padStart(6)} bytes  ${subject}`);
    continue;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, reply_to: replyTo, to, subject, html }),
  });

  if (response.ok) {
    sent += 1;
    console.log(`${label} sent      ${subject}`);
  } else {
    failed += 1;
    console.log(`${label} FAILED ${response.status}  ${(await response.text()).slice(0, 200)}`);
  }

  // Resend's default limit is 2 requests/second.
  await sleep(600);
}

if (unresolved.length) {
  console.log("\nUnreplaced variables (template wants them, sample data has none):");
  for (const line of unresolved) console.log(`  ${line}`);
}

if (!dryRun) console.log(`\n${sent} sent, ${failed} failed`);
process.exit(failed || unresolved.length ? 1 : 0);
