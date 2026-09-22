import assert from "node:assert/strict";
import test from "node:test";
import { withoutSessionRefreshCookies } from "../src/lib/session-refresh.ts";

test("proxy cannot restore the old account over a switch or sign-out", () => {
  for (const name of ["authjs.session-token", "__Secure-authjs.session-token"]) {
    const headers = new Headers();
    headers.append("set-cookie", `${name}=old-user; Path=/; HttpOnly`);
    headers.append("set-cookie", `${name}.0=old-chunk; Path=/; HttpOnly`);
    headers.append("set-cookie", `${name}.1=; Max-Age=0; Path=/`);
    headers.set("location", "/admin");
    withoutSessionRefreshCookies(headers);
    assert.deepEqual(headers.getSetCookie(), []);
    assert.equal(headers.get("location"), "/admin");
  }
});

test("proxy preserves unrelated cookies including their expiry commas", () => {
  const headers = new Headers();
  const retained = [
    "sb-session=refresh; Path=/; HttpOnly",
    "click_qa_persona=grant; Expires=Wed, 23 Sep 2026 10:00:00 GMT; HttpOnly",
    "authjs.csrf-token=csrf; Path=/; HttpOnly",
  ];
  for (const cookie of retained) headers.append("set-cookie", cookie);
  headers.append("set-cookie", "authjs.session-token=old-user; Path=/");
  withoutSessionRefreshCookies(headers);
  assert.deepEqual(headers.getSetCookie(), retained);
});
