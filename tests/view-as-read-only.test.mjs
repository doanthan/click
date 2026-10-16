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
    /isViewOnlySession\(session\) &&\s*!VIEW_ONLY_SAFE_METHODS\.has\(nextRequest\.method\) &&\s*!isViewOnlyExit\(pathname\)\s*\)\s*\{[\s\S]*?console\.warn\("\[view-as\] refused a write while viewing a real member"[\s\S]*?return Response\.json\([\s\S]*?\{ status: 403/,
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
  // The column (22A §4.5, migration 076), never the email domain: an unflagged
  // QA-namespace address is a real member to this switch, so it opens view only.
  assert.match(sw, /photo_url as image, is_test\s/);
  assert.doesNotMatch(sw, /ilike '%@click\.local'/);
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

test("every Server Action reachable on /account-switch is an exit or refuses a view-only session", () => {
  // The proxy leaves /account-switch open so a viewing admin can Return, and a
  // Server Action can be posted to any page whose module graph includes it -
  // this page's includes the shared layout's (the coordination drawer's
  // proposal actions, for one). So walk that graph: every "use server" module
  // in it is either a way out, or refuses a view-only session itself.
  const EXITS = new Set([
    "src/app/account-switch/actions.ts", // Return, or switch to another account
    // Sign in / sign out, and the QA tools - those act on QA personas behind
    // the QA unlock, never as the account being viewed.
    "src/app/login/actions.ts",
  ]);
  const seen = new Set();
  const serverModules = new Set();
  const resolveImport = (from, spec) => {
    const base = spec.startsWith("@/")
      ? path.join("src", spec.slice(2))
      : spec.startsWith(".") ? path.join(path.dirname(from), spec) : null;
    if (!base) return null;
    for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
      try {
        readFileSync(path.join(process.cwd(), base + ext));
        return path.normalize(base + ext);
      } catch {}
    }
    return null;
  };
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = read(file);
    if (/^\s*["']use server["']/.test(src)) {
      serverModules.add(file);
      return;
    }
    const specs = [
      ...src.matchAll(/^\s*(?:import|export)\s+(?!type\s)[^;]*?from\s+["']([^"']+)["']/gm),
      ...src.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g),
    ].map((m) => m[1]);
    for (const spec of specs) {
      const target = resolveImport(file, spec);
      if (target && /\.(ts|tsx)$/.test(target)) visit(target);
    }
  };
  const roots = ["layout", "template", "loading", "error", "not-found", "global-error"]
    .map((name) => `src/app/${name}.tsx`)
    .concat("src/app/account-switch/page.tsx");
  for (const root of roots) {
    visit(root);
  }

  assert.ok(serverModules.has("src/app/proposals/actions.ts"), "the walk reaches the drawer's actions");
  // Refused AND logged (03 §1): these refusals never pass the proxy's logger.
  assert.match(
    code(read("src/app/proposals/actions.ts")),
    /function refuseViewOnly\(session: Session\): ProposalActionState \{\s*console\.warn\("\[view-as\] refused a plan action while viewing a real member"/,
  );
  for (const file of serverModules) {
    if (EXITS.has(file)) continue;
    const chunks = code(read(file)).split(/^export async function /m).slice(1);
    assert.ok(chunks.length > 0, `${file} exports no actions`);
    for (const chunk of chunks) {
      const name = chunk.slice(0, chunk.indexOf("("));
      assert.match(chunk, /isViewOnlySession\(session\)/, `${file}: ${name} must refuse a view-only session`);
    }
  }
});
