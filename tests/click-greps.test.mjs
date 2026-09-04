import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// The C6 ship gate has a line that reads "All C4 greps return clean". Until now
// there was nothing to run: the six greps lived as a shell block inside a markdown
// file, so "clean" was a claim rather than a result, and two of the six pointed at
// directories this repo does not have and therefore checked nothing at all.
//
// scripts/click-greps.mjs is that block, made runnable (npm run greps). This test
// exists so it also runs on every `npm test` - a check nobody remembers to invoke
// is the state the greps were already in.

const root = process.cwd();
const script = path.join(root, "scripts/click-greps.mjs");

test("every C4 static grep returns clean", () => {
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
  assert.equal(
    result.status,
    0,
    `the C4 greps found something. Fix the copy, or add the hit to that check's ` +
      `\`allow\` list with a reason:\n\n${result.stdout}${result.stderr}`,
  );
});

test("the grep runner still covers all six of the runbook's checks", () => {
  // A grep that silently stops scanning is worse than no grep, and both of the
  // failure modes this repo already hit are silent ones: a scope that resolves to
  // nothing (the two missing directories), and an exemption broad enough to forgive
  // the violation it was written for. So the runner is pinned on its shape too.
  const src = readFileSync(script, "utf8");
  const ids = [...src.matchAll(/^\s*id: (?:(\d+)|"([^"]+)")/gm)].map((m) => m[1] ?? m[2]);
  assert.deepEqual(
    ids,
    ["1", "2", "3", "4", "5", "6"],
    "the runbook lists six greps. 6 was split into copy (6a) / comments (6b) while the " +
      "em-dash sweep was outstanding; that debt is cleared, so it is one check again.",
  );
  // Every exemption carries its reason. An allowlist entry without a `why` is a
  // disabled check that looks like a passing one.
  const allows = [...src.matchAll(/\{\s*re:[\s\S]*?\},\n/g)].map((m) => m[0]);
  for (const entry of allows) {
    assert.match(entry, /why:/, `an exemption with no stated reason:\n${entry}`);
  }
  // The two re-pointed scopes must name real files, or greps 3 and 5 go back to
  // checking nothing. The script itself resolves these; this pins that they exist.
  assert.match(src, /"src\/components\/click-with-someone-user-card\.tsx"/);
  assert.match(src, /"src\/components\/coordination-drawer\.tsx"/);
});
