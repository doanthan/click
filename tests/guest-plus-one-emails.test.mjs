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
