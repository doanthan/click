// HOTFIX 2026-10-12 H1 (Cindy): the dating fail-safe. Until the dating build,
// nobody is dating-visible and no dating signal renders. Behaviour - blank gender
// on either side, non-binary and prefer-not-to-say, two men who prefer women,
// set_romantic_visible refusing a blank gender, the check constraint - was run
// on PGlite with every migration applied; these pin the clauses that would have
// to be deleted to bring the old exposure back.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file) => readFileSync(path.join(process.cwd(), file), "utf8");
// Comments removed, so a test is never satisfied by the comment explaining a rule.
// `code` also drops SQL's -- comments (the repository embeds SQL); TSX keeps them,
// because there -- is CSS's var(--token).
const codeTs = (src) => src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const code = (src) => codeTs(src).replace(/--[^\n]*/g, "");
const repo = read("src/lib/event-repository.ts");
const repoCode = code(repo);
const fnBody = (start) => {
  const at = repo.indexOf(start);
  assert.ok(at > -1, `${start} not found`);
  return code(repo.slice(at, repo.indexOf("\nexport ", at + 1)));
};
const sql = code(read("database/075_dating_fail_safe.sql"));
const sqlFn = (name) => {
  const at = sql.indexOf(`create or replace function ${name}(`);
  assert.ok(at > -1, `${name} not in 075`);
  return sql.slice(at, sql.indexOf("$$;", at));
};

test("075 switches everyone off and makes off the default", () => {
  assert.match(sql, /alter table profiles alter column dating_visible set default false;/);
  assert.match(sql, /update profiles set dating_visible = false where dating_visible;/);
});

test("075 holds every writer to gender + preference + birth date, not only the function", () => {
  assert.match(
    sql,
    /check \(\s*not dating_visible\s*or \(nullif\(btrim\(gender\), ''\) is not null\s*and dating_preference is not null\s*and birth_date is not null\)\s*\)/,
  );
});

test("set_romantic_visible refuses to switch on without gender, preference or birth date", () => {
  const fn = sqlFn("set_romantic_visible");
  assert.match(fn, /if nullif\(btrim\(v_profile\.gender\), ''\) is null then\s*raise exception 'gender_required';/);
  assert.match(fn, /if v_profile\.dating_preference is null then\s*raise exception 'dating_preference_required';/);
  assert.match(fn, /if v_profile\.birth_date is null then\s*raise exception 'date_of_birth_required';/);
});

test("is_romantically_compatible fails every blank value BEFORE any comparison", () => {
  const fn = sqlFn("is_romantically_compatible");
  const blankGender = fn.indexOf("if v_a_gender is null or v_b_gender is null then return false;");
  const blankPref = fn.indexOf("if v_a.dating_preference is null or v_b.dating_preference is null then return false;");
  const blankDob = fn.indexOf("if v_a.birth_date is null or v_b.birth_date is null then return false;");
  const firstCompare = fn.indexOf("<> 'male'");
  for (const [name, at] of Object.entries({ blankGender, blankPref, blankDob })) {
    assert.ok(at > -1, `${name} fail missing`);
    assert.ok(at < firstCompare, `${name} must come before the gender comparisons (a NULL there passes)`);
  }
  // Both directions, both visible, both holding the dating intent.
  assert.match(fn, /if not \(v_a\.dating_visible and v_b\.dating_visible\) then return false;/);
  assert.match(fn, /'dating' = any\(v_a\.connection_intents\)/);
  assert.match(fn, /'dating' = any\(v_b\.connection_intents\)/);
  assert.match(fn, /if v_b\.dating_preference = 'women' and v_a_gender <> 'female' then return false;/);
});

test("one rule, one function: no surface re-implements 'both have dating on'", () => {
  assert.doesNotMatch(repoCode, /dating_visible and other\.dating_visible/);
  assert.doesNotMatch(repoCode, /viewer_dating_visible/);
  assert.doesNotMatch(repoCode, /profile\.dating_visible\s+and 'dating'/, "the singles count");
  // The label, the pill and the singles count all call it.
  assert.match(repoCode, /is_romantically_compatible\(\$1::uuid, p\.id\) as dating_compatible/, "daily picks label");
  assert.match(repoCode, /is_romantically_compatible\(\$1::uuid, other\.id\) as dating_compatible/, "who-was-there label");
  assert.match(repoCode, /is_romantically_compatible\(\$3::uuid, profile\.id\) as dating_minded/, "singles going");
  assert.match(repoCode, /is_romantically_compatible\(me\.id, other\.id\) as both_dating/, "reveal pill");
  assert.match(repoCode, /is_romantically_compatible\(\$1::uuid, other\.id\) as both_dating/, "Your clicks pill");
  const details = codeTs(read("src/components/profile-details.tsx"));
  assert.doesNotMatch(details, /datingVisible/);
  assert.match(details, /intent !== "dating" \|\| profile\.datingCompatible/);
});

test("no client path can turn dating on, and the toggle is gone", () => {
  assert.doesNotMatch(fnBody("export async function saveOnboarding("), /dating_visible/);
  assert.doesNotMatch(fnBody("export async function updateOwnProfile("), /dating_visible/);
  assert.doesNotMatch(codeTs(read("src/app/api/onboarding/route.ts")), /datingVisible/);
  assert.doesNotMatch(codeTs(read("src/app/profile/edit/actions.ts")), /dating_visible|datingVisible/);
  const onboarding = codeTs(read("src/components/onboarding-form.tsx"));
  assert.doesNotMatch(onboarding, /datingVisible|Show I'm open to dating/);
  const edit = codeTs(read("src/components/profile-edit-form.tsx"));
  assert.doesNotMatch(edit, /datingVisible|name="dating_visible"|Dating mode/);
});

test("a click carries the dating intent only for a compatible pair, and so does the mutual", () => {
  const send = repoCode.slice(repoCode.indexOf("const senderResult = await client.query<"));
  assert.match(send, /select is_romantically_compatible\(\$1::uuid, \$2::uuid\) as ok/);
  assert.match(send, /\.find\(\(intent\) => intent !== "dating" \|\| datingCompatible\)/);
  assert.match(
    send,
    /reciprocalClick\.intent_mode === "dating" && !datingCompatible\s*\?\s*"friendship"\s*:\s*reciprocalClick\.intent_mode/,
  );
  assert.doesNotMatch(send, /const senderIntent = sender\?\.connection_intents\?\.\[0\]/);
});
