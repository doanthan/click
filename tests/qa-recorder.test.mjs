import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("the QA recorder is mounted only behind the test-switcher gate", () => {
  const layout = readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
  const drawer = readFileSync(
    path.join(root, "src/components/qa-testing-drawer.tsx"),
    "utf8",
  );

  assert.match(layout, /qaSwitcherUnlocked \? \([\s\S]{0,120}<QaTestingDrawer/);
  assert.match(drawer, /setQaRecorderContext\(\{ email: normalizedEmail, label: actorLabel \}\)/);
  assert.match(drawer, /setQaRecorderContext\(null\)/, "unmounting the gate must stop QA capture");
});

test("the QA timeline survives persona redirects without becoming permanent browser data", () => {
  const capture = readFileSync(path.join(root, "src/lib/support-capture.ts"), "utf8");

  assert.match(capture, /sessionStorage\.getItem\(QA_STORAGE_KEY\)/);
  assert.match(capture, /sessionStorage\.setItem\(/);
  assert.doesNotMatch(capture, /localStorage\./);
  assert.match(capture, /MAX_QA_ACTIVITY = 250/, "the session timeline must stay bounded");
});

test("the QA recorder captures outcomes but excludes typed values and transport secrets", () => {
  const capture = readFileSync(path.join(root, "src/lib/support-capture.ts"), "utf8");
  const drawer = readFileSync(
    path.join(root, "src/components/qa-testing-drawer.tsx"),
    "utf8",
  );

  assert.match(capture, /SENSITIVE_QUERY_KEYS/);
  assert.match(capture, /url\.searchParams\.set\(key, "\[REDACTED\]"\)/);
  assert.match(capture, /method !== "GET" && method !== "HEAD"/);
  assert.match(capture, /window\.addEventListener\("error"/);
  assert.match(capture, /window\.addEventListener\("unhandledrejection"/);
  assert.match(drawer, /document\.addEventListener\("click", onClick, true\)/);
  assert.match(drawer, /document\.addEventListener\("submit", onSubmit, true\)/);
  assert.match(
    drawer,
    /\[role="dialog"\]\[aria-labelledby="qa-recorder-title"\]/,
    "the portalled recorder dialog must not record its own controls",
  );
  assert.match(
    drawer,
    /Input values, cookies, request headers, and response bodies are not recorded/,
  );
  assert.doesNotMatch(
    drawer,
    /FormData\(form\)|new FormData/,
    "the activity timeline must never inspect submitted field values",
  );
});

test("every recorded event carries a tester-facing explanation", () => {
  const capture = readFileSync(path.join(root, "src/lib/support-capture.ts"), "utf8");
  const drawer = readFileSync(
    path.join(root, "src/components/qa-testing-drawer.tsx"),
    "utf8",
  );

  assert.match(capture, /function explainHttpStatus\(status: number\)/);
  assert.match(capture, /explanation: failed/);
  assert.match(drawer, />\s*Why this happened\s*</);
  assert.match(drawer, /Copy report/);
  assert.match(drawer, /Export JSON/);
  assert.match(drawer, /Add a checkpoint/);
});
