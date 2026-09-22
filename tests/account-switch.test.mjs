import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { accountSwitchActor } from "../src/lib/account-switch-policy.ts";

const realRequire = createRequire(import.meta.url);
function load(file, mocks) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", source)(
    (name) => name in mocks ? mocks[name] : realRequire(name), loadedModule, loadedModule.exports,
  );
  return loadedModule.exports;
}
const actor = { email: "owner@example.com", name: "Owner", image: null };
const isAdmin = (email) => [actor.email, "other-admin@example.com", "admin@click.local"].includes(email);
const target = { id: "11111111-1111-4111-8111-111111111111", email: "maya@click.local", name: "Maya", image: null };
const adminSession = () => ({ user: actor, expires: new Date(Date.now() + 86400000).toISOString() });

test("anonymous, ordinary accounts and QA admins cannot enter real accounts", () => {
  for (const session of [null, {}, { user: { email: "member@example.com" } }, { user: { email: "admin@click.local" } }]) {
    assert.equal(accountSwitchActor(session, isAdmin), null);
  }
  assert.deepEqual(accountSwitchActor(adminSession(), isAdmin), actor);
});

test("switching through another admin retains the original actor and expiry", () => {
  const session = { user: { email: "other-admin@example.com" }, impersonation: { actor, expiresAt: 2000 } };
  assert.deepEqual(accountSwitchActor(session, isAdmin, 1000), actor);
  assert.equal(accountSwitchActor(session, isAdmin, 2000), null);
  assert.equal(accountSwitchActor(session, () => false, 1000), null);
});

function harness(session, options = {}) {
  const queries = [];
  let released = false;
  const client = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes("suspended_at")) return { rows: options.suspended ? [] : [{ id: "owner-id" }] };
      if (sql.includes("photo_url as image")) return { rows: options.missing ? [] : [values[0] === actor.email ? { ...actor, id: "owner-id" } : target] };
      if (sql.includes("insert into audit_logs") && options.auditFailure) throw new Error("audit unavailable");
      return { rows: [] };
    },
    release() { released = true; },
  };
  const service = load("../src/lib/admin-account-switch.ts", {
    "@/auth": { auth: async () => session, isAdminEmail: isAdmin },
    "@/lib/account-switch-policy": { accountSwitchActor },
    "@/lib/postgres": { getPostgresPool: () => ({ connect: async () => client, query: client.query }) },
  });
  return { service, queries, released: () => released };
}

test("provider authorization refuses forged target IDs and unprivileged callers before database access", async () => {
  for (const [session, id, returning] of [[null, target.id, false], [{ user: { email: "admin@click.local" } }, target.id, false], [adminSession(), "bad-id", false], [adminSession(), "", true]]) {
    const h = harness(session);
    assert.equal(await h.service.authorizeAccountSwitch(id, returning), null);
    assert.equal(h.queries.length, 0);
  }
});

test("a switch uses the existing account and records the real actor before committing", async () => {
  const h = harness(adminSession());
  const user = await h.service.authorizeAccountSwitch(target.id, false);
  assert.equal(user.email, target.email);
  assert.deepEqual(user.impersonation.actor, actor);
  assert.ok(user.impersonation.expiresAt <= Date.now() + 3600000);
  const audit = h.queries.find(q => q.sql.includes("insert into audit_logs"));
  assert.equal(audit.values[0], "owner-id");
  assert.equal(audit.values[1], "account_switch_start");
  assert.equal(audit.values[2], target.id);
  assert.equal(h.queries.at(-1).sql, "commit");
  assert.ok(h.released());
  assert.ok(h.queries.every(q => !/insert into profiles|update profiles|delete from/.test(q.sql)));
});

test("return ignores any supplied target and clears impersonation", async () => {
  const h = harness({ ...adminSession(), user: target, impersonation: { actor, expiresAt: Date.now() + 30000 } });
  const user = await h.service.authorizeAccountSwitch(target.id, true);
  assert.equal(user.email, actor.email);
  assert.equal(user.impersonation, undefined);
  assert.equal(h.queries.find(q => q.sql.includes("insert into audit_logs")).values[1], "account_switch_return");
});

test("subsequent switches never extend viewing access", async () => {
  const expiresAt = Date.now() + 30000;
  const h = harness({ ...adminSession(), user: target, impersonation: { actor, expiresAt } });
  const user = await h.service.authorizeAccountSwitch(target.id, false);
  assert.equal(user.impersonation.expiresAt, expiresAt);
});

test("missing target, suspended actor and audit failure cannot issue a session", async () => {
  for (const options of [{ missing: true }, { suspended: true }, { auditFailure: true }]) {
    const h = harness(adminSession(), options);
    if (options.auditFailure) await assert.rejects(h.service.authorizeAccountSwitch(target.id, false));
    else assert.equal(await h.service.authorizeAccountSwitch(target.id, false), null);
    assert.equal(h.queries.at(-1).sql, "rollback");
    assert.ok(h.released());
  }
});

test("Auth.js ignores client update claims, rejects expired viewing and creates a new session version", async () => {
  let config;
  const authorizeCalls = [];
  load("../src/auth.ts", {
    "next-auth": (options) => { config = options; return {}; },
    "next-auth/providers/credentials": (options) => options,
    "next-auth/providers/facebook": () => ({}),
    "next-auth/providers/google": () => ({}),
    "@/lib/admin-emails": { isAdminEmail: isAdmin, hasConfiguredAdmins: () => true },
    "@/lib/account-switch-policy": { accountSwitchActor },
    "@/lib/display-name": { nameFromEmail: () => "" },
    "@/lib/runtime-mode": { isLocalDevelopment: () => false },
    "@/lib/test-switcher": { isTestSwitcherConfigured: () => false },
    "@/lib/admin-account-switch": { authorizeAccountSwitch: async (...args) => { authorizeCalls.push(args); return null; } },
  });
  const token = { email: "member@example.com" };
  assert.deepEqual(config.callbacks.jwt({ token, trigger: "update", session: { impersonation: { actor, expiresAt: Date.now() + 99999 }, email: actor.email } }), token);
  assert.equal(config.callbacks.jwt({ token: { impersonation: { actor, expiresAt: Date.now() - 1 } } }), null);
  const signed = config.callbacks.jwt({ token: {}, user: { ...target, impersonation: { actor, expiresAt: Date.now() + 30000 } } });
  assert.ok(signed.sessionVersion);
  assert.deepEqual(signed.impersonation.actor, actor);
  const normal = config.callbacks.jwt({ token: signed, user: actor });
  assert.equal(normal.impersonation, undefined);
  const provider = config.providers.find(p => p.id === "admin-account-switch");
  await provider.authorize({ targetId: target.id, intent: "switch", actorEmail: actor.email });
  assert.deepEqual(authorizeCalls, [[target.id, false]]);
});
