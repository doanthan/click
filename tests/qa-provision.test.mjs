import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("QA seed events are never written as an ON CONFLICT upsert", () => {
  // prevent_merchant_event_overlap is a BEFORE INSERT trigger, so it runs BEFORE
  // the conflict is resolved, with new.id freshly defaulted - it sees the row
  // already sitting on that slug as a different event of the same merchant
  // covering the same two hours and raises "merchant has an overlapping live
  // event". An `insert into events ... on conflict (slug) do update` therefore
  // succeeds exactly once and throws on every provision after it. That is not a
  // recoverable error either: the switcher renders in the root layout, ABOVE
  // app/error.tsx, so the throw escapes to Next's bare "This page couldn't load"
  // page and every persona switch dies there until someone resets the QA data.
  const provision = readFileSync(path.join(root, "src/lib/qa-provision.ts"), "utf8");
  assert.ok(provision.includes("insert into events"), "expected the events insert to be found");
  assert.doesNotMatch(
    provision,
    /on conflict\s*\(\s*slug\s*\)/i,
    "qa-provision.ts must update-then-insert events, never upsert them by slug",
  );
});

test("a failed QA seed event cannot abort the persona switch", () => {
  // A host persona that hand-created an event over the seed slot trips the same
  // overlap guard legitimately. The personas are the point of the switcher and
  // the demo catalogue is garnish, so each seed event writes inside its own
  // savepoint - otherwise one unwritable demo event 500s every role change.
  const provision = readFileSync(path.join(root, "src/lib/qa-provision.ts"), "utf8");
  assert.match(provision, /savepoint qa_seed_event/, "seed events need their own savepoint");
  assert.match(
    provision,
    /rollback to savepoint qa_seed_event/,
    "a failed seed event must roll back to its savepoint, not abort the transaction",
  );
});
