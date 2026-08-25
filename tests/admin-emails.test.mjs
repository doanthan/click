import assert from "node:assert/strict";
import test from "node:test";

// The real shipping helper, not a copy - src/lib/admin-emails.ts is what
// src/auth.ts re-exports as isAdminEmail (used by the admin page guard and the
// two admin API routes that check it directly) AND what event-repository.ts
// calls from requireAdminProfile, the write boundary behind every admin server
// action. Node strips the type annotations on import (Node >= 22.18 / >= 23.6);
// the repo runs Node 24.
import { isAdminEmail } from "../src/lib/admin-emails.ts";

// Why this file exists: there were two implementations of "is this an admin"
// and they disagreed on the empty case. auth.ts fell back to nobody in
// production; event-repository.ts fell back to the fixed address
// admin@click.local with no environment guard, which would have handed a
// deployed console to a publicly-guessable address the moment ADMIN_EMAILS was
// dropped from the environment. These are the properties that must not drift
// back apart.

function withEnv(env, run) {
  const saved = { ADMIN_EMAILS: process.env.ADMIN_EMAILS, NODE_ENV: process.env.NODE_ENV };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("an unset ADMIN_EMAILS grants nobody anything outside development", () => {
  withEnv({ ADMIN_EMAILS: undefined, NODE_ENV: "production" }, () => {
    assert.equal(isAdminEmail("admin@click.local"), false);
    assert.equal(isAdminEmail("anyone@example.com"), false);
  });
});

test("an empty ADMIN_EMAILS grants nobody anything, including in development", () => {
  withEnv({ ADMIN_EMAILS: "", NODE_ENV: "development" }, () => {
    assert.equal(isAdminEmail("admin@click.local"), false);
  });
});

test("the local convenience default applies only in development", () => {
  withEnv({ ADMIN_EMAILS: undefined, NODE_ENV: "development" }, () => {
    assert.equal(isAdminEmail("admin@click.local"), true);
  });
});

test("matching ignores case and surrounding whitespace on both sides", () => {
  withEnv({ ADMIN_EMAILS: "  Ops@Click.App , second@click.app ", NODE_ENV: "production" }, () => {
    assert.equal(isAdminEmail("ops@click.app"), true);
    assert.equal(isAdminEmail("OPS@CLICK.APP"), true);
    assert.equal(isAdminEmail("  ops@click.app  "), true);
    assert.equal(isAdminEmail("second@click.app"), true);
  });
});

test("a near miss is not an admin", () => {
  withEnv({ ADMIN_EMAILS: "ops@click.app", NODE_ENV: "production" }, () => {
    assert.equal(isAdminEmail("ops@click.app.evil.com"), false);
    assert.equal(isAdminEmail("ops@click.ap"), false);
    assert.equal(isAdminEmail("xops@click.app"), false);
  });
});

test("absent input is never an admin", () => {
  withEnv({ ADMIN_EMAILS: "ops@click.app", NODE_ENV: "production" }, () => {
    assert.equal(isAdminEmail(null), false);
    assert.equal(isAdminEmail(undefined), false);
    assert.equal(isAdminEmail(""), false);
    assert.equal(isAdminEmail("   "), false);
  });
});

// The offboarding property, stated directly: this is the whole reason
// requireAdminProfile consults the list instead of trusting profiles.role,
// which the profile upsert promotes but never revokes.
test("dropping an address from the list revokes it immediately", () => {
  withEnv({ ADMIN_EMAILS: "keep@click.app,drop@click.app", NODE_ENV: "production" }, () => {
    assert.equal(isAdminEmail("drop@click.app"), true);
  });
  withEnv({ ADMIN_EMAILS: "keep@click.app", NODE_ENV: "production" }, () => {
    assert.equal(isAdminEmail("drop@click.app"), false);
    assert.equal(isAdminEmail("keep@click.app"), true);
  });
});
