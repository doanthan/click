// Who the app says you are. Source assertions - the chrome is a server
// component behind auth(), so it cannot be imported into node:test (same
// pattern as host-journey.test.mjs). Each one pins the clause that would have
// to be deleted to bring the bug back.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file) => readFileSync(path.join(process.cwd(), file), "utf8");

test("the account menu greets people by the name they gave, not their email handle", () => {
  // Bug board #279/#285: a magic-link session is named after the email's local
  // part (src/auth.ts, nameFromEmail), so the menu read "Signed in as Ckpokego1"
  // for someone who had told us her name is Poppy.
  const chrome = read("src/components/site-chrome.tsx");
  assert.match(
    chrome,
    /const userLabel =\s*profileStatus\?\.displayName \?\? session\?\.user\?\.name \?\? session\?\.user\?\.email \?\? "Account";/,
  );

  const repo = read("src/lib/event-repository.ts");
  const status = repo.slice(
    repo.indexOf("async function getProfileStatusUncached"),
    repo.indexOf("export function assertProfileStatusUsable"),
  );
  assert.match(status, /displayName: profile\.display_name\?\.trim\(\) \|\| null,/);
});

test("an onboarding draft can only be read back by the account that wrote it", () => {
  // Bug board #112: one browser, two accounts, and the second was handed the
  // first one's name and postcode - the draft key used to be global.
  const form = read("src/components/onboarding-form.tsx");
  assert.match(form, /const storageKey = scopedKey\(useAccountScope\(\), STORAGE_KEY\);/);
  assert.doesNotMatch(form, /localStorage\.(get|set|remove)Item\(STORAGE_KEY/);
  // The scope is the signed-in email, and the provider remounts when the
  // session changes, so no form keeps rendering the previous account's key.
  assert.match(
    read("src/app/layout.tsx"),
    /<AccountScopeProvider key=\{session\?\.sessionVersion \?\? session\?\.user\?\.email \?\? "anon"\} scope=\{session\?\.user\?\.email\}>/,
  );
});
