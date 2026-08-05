import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hook = readFileSync(path.join(root, "src/lib/use-form-draft.ts"), "utf8");

test("an untouched form never writes a draft", () => {
  // The write effect fires as soon as `hydrated` flips, which happens on EVERY
  // mount - including one where the read found nothing. Without a pristine
  // guard it persisted the form's own defaults, and the next mount read them
  // back and told a user who had typed nothing "picked up where you left off -
  // the answers you had already typed are still here". Reproducible on all four
  // forms using this hook: open, reload, read the note.
  assert.match(
    hook,
    /const \[pristine\] = useState\(/,
    "useFormDraft must snapshot the first-render values to detect an untouched form",
  );
  assert.match(
    hook,
    /if \(!restored && pristine === serialised\) return;/,
    "the write effect must bail out while the values still match the first render",
  );
});

test("a restored draft keeps being written through", () => {
  // The pristine guard must not outlive the restore: values applied FROM
  // storage are not the user's defaults, and if the guard blocked them a
  // restored draft would stop being updated as the user carried on editing.
  assert.match(
    hook,
    /\[hydrated, restored, pristine, key, version, values, pick\]/,
    "the write effect must re-run when `restored` flips, or the exemption never lands",
  );
});

test("both writers of the event-create slot stamp the same envelope", () => {
  // The create wizard reads this slot through useFormDraft, which drops any
  // payload whose `v` does not match. "Duplicate event" writes the same slot by
  // hand, so if it ever goes back to writing a bare values object every
  // duplicate is silently discarded and the merchant lands on an empty wizard
  // with no error to explain it. Nothing at runtime would say so, hence a test.
  const duplicate = readFileSync(
    path.join(root, "src/components/merchant-event-duplicate-button.tsx"),
    "utf8",
  );
  assert.match(
    duplicate,
    /JSON\.stringify\(\{\s*v:\s*EVENT_CREATE_DRAFT_VERSION,\s*values:/,
    "the duplicate button must seed the { v, values } envelope useFormDraft reads",
  );
  const wizard = readFileSync(
    path.join(root, "src/components/event-create-wizard.tsx"),
    "utf8",
  );
  assert.match(
    wizard,
    /version:\s*EVENT_CREATE_DRAFT_VERSION/,
    "the wizard must read the slot at the same version the duplicate button writes",
  );
});

test("clearing a draft still blocks only the post-save re-renders", () => {
  // Guard ordering matters: the just-cleared window is checked BEFORE the
  // pristine check, so clear() cannot be undone by a form whose values happen
  // to have returned to their defaults.
  const clearedIdx = hook.indexOf("clearedAtRef.current === serialised");
  const pristineIdx = hook.indexOf("pristine === serialised");
  assert.ok(clearedIdx > 0 && pristineIdx > 0, "both guards must exist");
  assert.ok(clearedIdx < pristineIdx, "the cleared-window guard must run first");
});
