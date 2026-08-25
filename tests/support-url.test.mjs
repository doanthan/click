import assert from "node:assert/strict";
import test from "node:test";

import { keepOwnOriginUrl } from "../src/lib/support-url.ts";

const HOST = "letsclick.app";

test("a report from our own site keeps its full clickable URL", () => {
  assert.equal(
    keepOwnOriginUrl("https://letsclick.app/events/winter-supper?ref=email", HOST),
    "https://letsclick.app/events/winter-supper?ref=email",
  );
});

test("a URL pointing somewhere else keeps only the path", () => {
  // The triage board renders column A as =HYPERLINK(value, value), so an
  // attacker-supplied host would be a link off our own board, clicked by an
  // operator holding an admin session.
  assert.equal(
    keepOwnOriginUrl("https://attacker.example/pay-now?x=1", HOST),
    "/pay-now?x=1",
  );
  // A lookalike host is the case that matters most.
  assert.equal(keepOwnOriginUrl("https://letsclick.app.evil.example/login", HOST), "/login");
});

test("non-http schemes never survive as a destination", () => {
  for (const hostile of ["javascript:alert(1)", "data:text/html,<script>x</script>"]) {
    const out = keepOwnOriginUrl(hostile, HOST);
    assert.ok(
      out === null || (!out.startsWith("javascript:") && !out.startsWith("data:")),
      `${hostile} must not survive, got ${out}`,
    );
  }
});

test("relative paths pass through - they were never a destination", () => {
  assert.equal(keepOwnOriginUrl("/discover", HOST), "/discover");
  assert.equal(keepOwnOriginUrl("/events/x?tab=who", HOST), "/events/x?tab=who");
});

test("empty and unknown-host inputs degrade rather than throw", () => {
  assert.equal(keepOwnOriginUrl(null, HOST), null);
  assert.equal(keepOwnOriginUrl("", HOST), null);
  assert.equal(keepOwnOriginUrl(undefined, HOST), null);
  // No host known (shouldn't happen, but must not hand back an external link).
  assert.equal(keepOwnOriginUrl("https://attacker.example/x", null), "/x");
});
