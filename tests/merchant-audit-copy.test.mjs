// Host-portal copy and counts from the merchant + Stripe audit
// (context/MERCHANT_STRIPE_AUDIT_FOR_CINDY.md, fixes 10-12, 20-22, 28, 29, 35).
// Source assertions, like host-journey.test.mjs: these are server components
// behind auth() and a pg pool, so each test pins the clause that would have to
// come back to reintroduce the problem.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
// Rendered code only: comments may quote the copy that was removed.
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("fix 10: no application language where there is no application", () => {
  // Inside the Sydney pilot a new host is in on submit and their first event
  // is the review; outside it they join a waitlist.
  const page = stripComments(read("src/app/merchant/signup/page.tsx"));
  assert.doesNotMatch(page, /One application|Apply once/);
  assert.match(page, /we check your first event before it goes live/);
  assert.match(page, /elsewhere, join the waitlist/);

  const settings = stripComments(read("src/components/merchant-settings-tab.tsx"));
  assert.doesNotMatch(settings, /1 business day|merchant verification take/);
  assert.match(settings, /const eventsAreReviewed = merchant\?\.auto_approve_events !== true;/);

  const wizard = stripComments(read("src/components/merchant-signup-wizard.tsx"));
  assert.doesNotMatch(wizard, /back to the host application/);
});

test("fix 11: the sign-in sentence names only the configured providers", () => {
  const wizard = read("src/components/merchant-signup-wizard.tsx");
  const card = wizard.slice(
    wizard.indexOf("export function StepAuthCard"),
    wizard.indexOf("/* Every labelled control below"),
  );
  assert.doesNotMatch(card, /Sign in with Google, Facebook, or email/);
  // Same condition that renders the Facebook button.
  assert.match(card, /if \(metaConfigured\) methods\.push\("Facebook"\);/);
  assert.match(card, /\{metaConfigured \? \(\s*<form action=\{signInWithMeta\}/);
  assert.match(card, /if \(googleConfigured\) methods\.push\("Google"\);/);
  assert.match(card, /Sign in with \{methodsLabel\}/);
});

test("fix 12: a logged-out host reads the pitch before the sign-in", () => {
  const page = read("src/app/merchant/signup/page.tsx");
  const loggedOut = page.slice(page.indexOf("const errorMessage = "), page.indexOf("function HostPitch"));
  assert.ok(
    loggedOut.indexOf("<HostPitch />") > -1 &&
      loggedOut.indexOf("<HostPitch />") < loggedOut.indexOf("<StepAuthCard"),
    "the pitch must render before the auth card",
  );
  // The pitch opens the page, so it carries the h1.
  const pitch = page.slice(page.indexOf("function HostPitch"));
  assert.match(pitch, /<h1 className=/);

  // "Tell us about you" is the signed-in form's header only.
  const layout = read("src/app/merchant/signup/layout.tsx");
  const gate = layout.indexOf("{session?.user ? (");
  assert.ok(gate > -1, "the layout header must be gated on a session");
  assert.ok(gate < layout.indexOf("Tell us about"), "the header must sit inside the session gate");
});

test("fix 20: every per-event row carries its Sydney date", () => {
  const dash = read("src/components/merchant-dashboard-tab.tsx");
  assert.match(dash, /export function formatEventDay\(startsAt: string\)/);
  const formatter = dash.slice(dash.indexOf("const eventDayFormatter"), dash.indexOf("export function formatEventDay"));
  assert.match(formatter, /timeZone: "Australia\/Sydney"/);
  const perEvent = dash.slice(dash.indexOf("function SeatsBookedChart"), dash.indexOf("function SetupProgress"));
  assert.match(perEvent, /formatEventDay\(e\.startsAt\)/);

  const bookings = read("src/components/merchant-bookings-tab.tsx");
  assert.match(bookings, /formatEventDay\(list\[0\]\.eventStartsAt\)/);
});

test("fix 21: the first-run card sends hosts to the event page for the door", () => {
  const dash = stripComments(read("src/components/merchant-dashboard-tab.tsx"));
  assert.doesNotMatch(dash, /Open Bookings on the day|export a CSV/);
  assert.match(dash, /Open the event's page on the day to check people in at the door/);
});

test("fix 22: the dashboard never says Revenue - Finances owns it", () => {
  const dash = stripComments(read("src/components/merchant-dashboard-tab.tsx"));
  assert.doesNotMatch(dash, /revenue/i);
  assert.match(dash, /Booked value & seats by event month/);
});

test("fix 28: the Events badge counts upcoming events, not every event ever made", () => {
  const page = read("src/app/merchant/page.tsx");
  assert.doesNotMatch(page, /events: merchantEvents\.length/);
  assert.match(page, /isUpcomingMerchantEvent\(event, now\)/);
  const dash = read("src/components/merchant-dashboard-tab.tsx");
  const rule = dash.slice(dash.indexOf("export function isUpcomingMerchantEvent"), dash.indexOf("export function DashboardTab"));
  for (const clause of [/event\.status !== "Cancelled"/, /event\.status !== "Rejected"/, />= now/]) {
    assert.match(rule, clause);
  }
});

test("fix 29: tiles say seats, and pending events stay out of Upcoming and Fill rate", () => {
  const dash = read("src/components/merchant-dashboard-tab.tsx");
  assert.doesNotMatch(stripComments(dash), /Confirmed RSVPs/);
  assert.match(dash, /label="Seats booked"/);
  assert.match(dash, /const upcomingPublished = upcoming\.filter\(\(event\) => event\.status !== "Pending"\);/);
  assert.match(dash, /const upcomingCount = upcomingPublished\.length;/);
  assert.match(dash, /const upcomingCapacity = upcomingPublished\.reduce/);
  assert.match(dash, /const upcomingSeatsBooked = upcomingPublished\.reduce/);
});

test("fix 35: no Coming soon promo card on the launch portal", () => {
  const settings = read("src/components/merchant-settings-tab.tsx");
  assert.doesNotMatch(settings, /Coming soon|Promo codes|comp guest|<SectionLabel>Discounts/);
});

test("no em-dashes or en-dashes in the files these fixes touch", () => {
  for (const file of [
    "src/app/merchant/signup/page.tsx",
    "src/app/merchant/signup/layout.tsx",
    "src/app/merchant/page.tsx",
    "tests/merchant-audit-copy.test.mjs",
  ]) {
    const source = read(file);
    assert.ok(!source.includes("\u2014"), `${file} contains an em-dash`);
    assert.ok(!source.includes("\u2013"), `${file} contains an en-dash`);
  }
});
