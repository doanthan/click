// HOTFIX 2026-10-12 H4.1 (Cindy): an admin viewing a real member can look,
// never act. Acting is allowed only on a test account. The predicate is
// exercised for real; the rest pins the clauses that would have to be deleted
// to bring act-as back - including the proxy matcher, because the proxy is the
// one place every write passes through (next docs: a matcher change can
// silently remove a Server Function's coverage).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// The real helper - Node strips the types on import.
import { isViewOnlySession } from "../src/lib/account-switch-policy.ts";

const read = (file) => readFileSync(path.join(process.cwd(), file), "utf8");
const code = (src) => src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const actor = { email: "admin@example.com", name: null, image: null };

test("view only unless the switch said the target is a test account - fail closed", () => {
  assert.equal(isViewOnlySession(null), false, "signed out");
  assert.equal(isViewOnlySession({}), false, "your own session");
  assert.equal(isViewOnlySession({ impersonation: { actor, expiresAt: 1, readOnly: true } }), true, "real member");
  assert.equal(isViewOnlySession({ impersonation: { actor, expiresAt: 1, readOnly: false } }), false, "test account");
  assert.equal(isViewOnlySession({ impersonation: { actor, expiresAt: 1 } }), true, "a pre-hotfix claim");
});

test("the proxy refuses every write from a view-only session, with exactly two exits", () => {
  const proxy = code(read("src/proxy.ts"));
  assert.match(proxy, /const VIEW_ONLY_SAFE_METHODS = new Set\(\["GET", "HEAD", "OPTIONS"\]\);/);
  assert.match(proxy, /return pathname === "\/account-switch" \|\| pathname\.startsWith\("\/api\/auth\/"\);/);
  assert.match(
    proxy,
    /isViewOnlySession\(session\) &&\s*!VIEW_ONLY_SAFE_METHODS\.has\(nextRequest\.method\) &&\s*!isViewOnlyExit\(pathname\)\s*\)\s*\{\s*return Response\.json\([\s\S]*?\{ status: 403/,
  );
  // Server Actions reach the proxy as POSTs to the page that uses them, so the
  // matcher may skip static files and nothing else.
  assert.match(
    proxy,
    /matcher: \[\s*"\/\(\(\?!_next\/static\|_next\/image\|favicon\.ico\|\.\*\\\\\.\(\?:svg\|png\|jpg\|jpeg\|gif\|webp\)\$\)\.\*\)",\s*\]/,
  );
});

test("the switch decides view only from the target, and records it", () => {
  const sw = code(read("src/lib/admin-account-switch.ts"));
  assert.match(sw, /coalesce\(\(to_jsonb\(profiles\) ->> 'is_test'\)::boolean, email::text ilike '%@click\.local'\) as is_test/);
  assert.match(sw, /impersonation: \{ actor, expiresAt, readOnly: !user\.is_test \}/);
  assert.match(sw, /viewOnly: backToSelf \? undefined : !user\.is_test/, "the audit row says which");
});

test("a pre-hotfix act-as session on a real member ends at the first request", () => {
  const auth = code(read("src/auth.ts"));
  assert.match(
    auth,
    /token\.impersonation &&\s*token\.impersonation\.readOnly === undefined &&\s*!token\.email\?\.trim\(\)\.toLowerCase\(\)\.endsWith\("@click\.local"\)\s*\)\s*\{\s*return null;/,
  );
});

test("viewing someone never stamps them active", () => {
  const repo = read("src/lib/event-repository.ts");
  const at = repo.indexOf("async function ensureProfileForSessionUncached(");
  const fn = code(repo.slice(at, repo.indexOf("\nexport ", at)));
  const viewing = fn.indexOf("if (session?.impersonation) {");
  const upsert = fn.indexOf("insert into profiles");
  assert.ok(viewing > -1 && viewing < upsert, "the viewing branch returns before the upsert that stamps last_active_at");
  assert.match(fn.slice(viewing, upsert), /select id::text, role::text as role, email::text, display_name from profiles where email = \$1/);
});

test("the page shows it: controls disabled, banner says view only, Return reachable", () => {
  const layout = code(read("src/app/layout.tsx"));
  assert.match(layout, /const viewOnly = isViewOnlySession\(session\);/);
  assert.match(layout, /<ViewOnlyFieldset viewOnly=\{viewOnly\}>\{children\}<\/ViewOnlyFieldset>/);
  const fieldset = code(read("src/components/view-only-fieldset.tsx"));
  assert.match(fieldset, /if \(!viewOnly \|\| pathname === "\/account-switch"\) return <>\{children\}<\/>;/);
  assert.match(fieldset, /<fieldset disabled className="contents">/);
  const banner = code(read("src/components/account-viewing-banner.tsx"));
  assert.match(banner, /\{viewOnly \? " - view only" : ""\}/);
  assert.match(banner, /<Link href="\/account-switch" className="ck-btn ck-btn--secondary ck-btn--sm whitespace-nowrap">Return or switch account<\/Link>/);
  const page = code(read("src/app/account-switch/page.tsx"));
  assert.match(page, /\{session\?\.impersonation \? \(/);
  assert.match(page, /<AccountSwitchButton name="intent" value="return"/);
});
