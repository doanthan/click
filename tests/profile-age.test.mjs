// Bug board #339: "Show my age". Off hides the age on a profile, except from a
// romantically compatible viewer (HOTFIX 2026-10-12 H1). Behaviour was checked on
// PGlite against the real repository, before and after migration 074; these
// pin the clauses that would have to be deleted to bring the old exposure back.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file) => readFileSync(path.join(process.cwd(), file), "utf8");
const repo = read("src/lib/event-repository.ts");
const fnBody = (start) => {
  const at = repo.indexOf(start);
  assert.ok(at > -1, `${start} not found`);
  return repo.slice(at, repo.indexOf("\nexport ", at + 1));
};
const failSoft = /coalesce\(\(to_jsonb\(\w+\) ->> 'show_age'\)::boolean, true\)/;

test("074 adds show_age, defaulting to shown", () => {
  const sql = read("database/074_profile_show_age.sql");
  assert.match(sql, /alter table profiles add column if not exists show_age boolean not null default true;/);
});

test("every read of show_age works before 074 has run", () => {
  assert.match(fnBody("export async function getPublicProfileById("), failSoft);
  assert.match(fnBody("export async function getOwnProfile("), failSoft);
  // The crowd-age line leaves a hidden age out of the room's decade.
  const preview = fnBody("export async function getEventAttendeePreview(");
  assert.match(preview, /case when coalesce\(\(to_jsonb\(profile\) ->> 'show_age'\)::boolean, true\)\s*then coalesce\(extract\(year from age\(profile\.birth_date\)\)::int, profile\.age\)\s*end as age/);
});

test("the Privacy toggle saves show_age and explains a missing column", () => {
  const update = fnBody("export async function updateAccountSetting(");
  assert.match(update, /showAge: "show_age",/);
  assert.match(update, /=== "42703"/);
  const page = read("src/app/account-settings/page.tsx");
  assert.match(page, /settingKey="showAge"/);
});

test("a hidden age shows only to a romantically compatible viewer, and never leaves the server", () => {
  // The exception is the one dating rule (HOTFIX 2026-10-12 H1), computed per
  // viewer in SQL - no longer "both have dating on".
  const details = read("src/components/profile-details.tsx");
  assert.match(details, /return profile\.showAge \|\| profile\.datingCompatible \? profile\.age : null;/);
  assert.match(details, /Omit<PublicProfile, "datingCompatible" \| "showAge">/);
  assert.match(
    fnBody("export async function getPublicProfileById("),
    /is_romantically_compatible\(\s*\(select viewer\.id from profiles viewer where viewer\.email = \$2\),\s*profiles\.id\s*\) as dating_compatible/,
  );
  // The page and the pop-up both gate it; the owner always sees their own.
  assert.match(
    read("src/app/profile/[userId]/page.tsx"),
    /const visibleAge = isOwnProfile \? profile\.age : visibleAgeFor\(profile\);/,
  );
  assert.match(
    read("src/app/profile/[userId]/actions.ts"),
    /age: own\?\.id === profile\.id \? profile\.age : visibleAgeFor\(profile\)/,
  );
});
