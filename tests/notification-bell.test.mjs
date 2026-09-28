import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// The header bell renders in the root layout, and a layout does not re-render on
// client-side navigation. When its count came only from that render, a mutual
// click formed after the last full page load never reached the badge - reported
// as "the person I clicked never got a notification" while the row sat unread in
// the database the whole time. These pin the three pieces of the fix.

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("the bell re-asks for its count on navigation and when the tab comes back", () => {
  const bell = read("src/components/header-notifications-bell.tsx");
  assert.match(bell, /fetch\("\/api\/notifications\/unread-count"/);
  assert.match(bell, /usePathname\(\)/);
  assert.match(bell, /\}, \[pathname\]\);/, "the refresh effect must re-run on every navigation");
  assert.match(bell, /addEventListener\("focus", refresh\)/);
  assert.match(bell, /addEventListener\("visibilitychange", refresh\)/);
  // Newest count wins, by the database clock - not "last response to arrive",
  // or a fetch that started before Mark all as read would resurrect the badge.
  assert.match(bell, /fetched\.countedAt > countedAt \? fetched\.count : renderedCount/);
});

test("the count route is private, signed-in only, and stamped by the database clock", () => {
  const route = read("src/app/api/notifications/unread-count/route.ts");
  assert.match(route, /status: 401/);
  assert.equal(route.match(/"private, no-store"/g)?.length, 2, "both branches must be uncacheable");
  const repository = read("src/lib/event-repository.ts");
  assert.match(repository, /\(extract\(epoch from now\(\)\) \* 1000\)::float8 as counted_at/);
  assert.match(read("src/components/site-chrome.tsx"), /countedAt=\{unread\.countedAt\}/);
});
