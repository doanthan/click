// The homepage host waitlist ("For hosts"), in this suite's style: static
// assertions that the shipped source still carries each rule. They pin what the
// code SAYS - nothing in `npm test` has a database to run it against.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
// Comments out, so a rule is not satisfied (or tripped) by the comment explaining it.
const code = (src) =>
  src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const action = code(read("src/app/host-waitlist/actions.ts"));
const lib = code(read("src/lib/host-waitlist.ts"));
const form = code(read("src/components/host-waitlist-form.tsx"));
const home = code(read("src/app/page.tsx"));
const migration = read("database/081_host_waitlist.sql");

test("a repeat address is answered exactly like a new one", () => {
  // The browser gets the area of what was typed this time - never whether the
  // row was new, and never the stored row's area.
  assert.match(action, /return \{ status: "done", area \};/);
  assert.match(action, /const area = place \? waitlistAreaFor\(place\) : null;/);
  assert.doesNotMatch(action, /status: "done"[^}]*isNew/);
  // The email goes on the first request only, after the response.
  assert.match(action, /if \(isNew\) \{\s*after\(\(\) =>\s*logEmailEvent\(\{\s*template: "host-waitlist-joined"/);
  // The success screen promises no email, since a repeat gets none.
  assert.doesNotMatch(form, /inbox/i);
});

test("a repeat request can't rewrite someone else's row", () => {
  // Anyone can type anyone's address: the conflict branch only re-reads.
  assert.match(lib, /on conflict \(email\) do update set email = host_waitlist\.email/);
  assert.match(lib, /returning \(xmax = 0\) as is_new/);
});

test("the email carries none of the form's free text", () => {
  // Anyone can aim this form at anyone's inbox, so nothing they typed rides along.
  const call = action.match(/logEmailEvent\(\{[\s\S]*?\n\s{8}\}\),/)?.[0];
  assert.ok(call, "could not find the logEmailEvent call");
  for (const field of ["businessName", "contactName", "phone", "website", "place"]) {
    assert.doesNotMatch(call, new RegExp(`\\b${field}\\b`), `${field} reaches the email`);
  }
  const html = read("emails/host-waitlist-joined.html");
  const vars = [...html.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(vars)].sort(), ["areaLine", "discoverUrl", "supportEmail"]);
});

test("the action is rate limited before it writes, and drops the bot trap silently", () => {
  assert.ok(action.indexOf("checkRateLimit(") < action.indexOf("joinHostWaitlist("));
  // The limiter's own query sits inside the try, so a database outage comes
  // back as the form's error message rather than a thrown action.
  assert.ok(action.indexOf("try {") < action.indexOf("checkRateLimit("));
  assert.match(action, /scope: "host-waitlist"/);
  assert.match(form, /name="leave_blank"/);
  assert.match(action, /text\(formData, "leave_blank"\)/);
  assert.ok(action.indexOf('"leave_blank"') < action.indexOf("checkRateLimit("));
});

test("only the business name and email are required", () => {
  assert.match(action, /if \(!businessName\) fieldErrors\.businessName =/);
  assert.match(action, /if \(!email\) fieldErrors\.email =/);
  // A phone is checked only when one was typed.
  assert.match(action, /if \(rawPhone && !phone\) fieldErrors\.phone =/);
  assert.match(migration, /business_name text not null/);
  for (const column of ["contact_name", "phone", "place", "area", "website"]) {
    assert.match(migration, new RegExp(`\\n  ${column}\\s+text check \\(${column} is null or`), `${column} should be optional`);
  }
});

test("event types are the canonical categories, never Dating, never free text", () => {
  const types = code(read("src/lib/host-event-types.ts"));
  assert.match(types, /import \{ CATEGORIES \} from "@\/components\/ds";/);
  assert.match(types, /CATEGORIES\.filter\(\(category\) => !category\.gated\)/);
  // The server keeps only keys it knows, whatever the browser posts.
  assert.match(action, /eventTypes: cleanEventTypes\(formData\.getAll\("eventTypes"\)\)/);
  assert.match(lib, /picked\.has\(key\) && EVENT_TYPE_KEYS\.has\(key\)/);
  // The chips are the DS selectable tag: aria-pressed, purple fill, 44px.
  assert.match(form, /aria-pressed=\{selected\}/);
  assert.match(form, /ck-tag ck-tag--select ck-tag--tap/);
});

test("a typed website only becomes a link when it is http(s)", () => {
  assert.match(lib, /url\.protocol === "https:" \|\| url\.protocol === "http:" \? url\.toString\(\) : null/);
  const admin = code(read("src/app/admin/host-waitlist/page.tsx"));
  assert.match(admin, /const href = websiteHref\(value\);/);
  assert.match(admin, /rel="noopener noreferrer nofollow"/);
  // The email check lets "?" through, so a raw mailto: would turn
  // "you@x.co?bcc=..." into a Bcc header on an admin's reply.
  assert.match(lib, /`mailto:\$\{encodeURIComponent\(email\)\.replace\(\/%40\/g, "@"\)\}`/);
  assert.doesNotMatch(admin, /mailto:\$\{/);
});

test("the admin read checks the admin itself, and the export is private", () => {
  assert.match(lib, /if \(!isAdminEmail\(session\?\.user\?\.email\)\) \{\s*throw namedError\("ForbiddenError"/);
  assert.match(lib, /order by created_at asc/);
  const route = code(read("src/app/api/admin/host-waitlist/route.ts"));
  assert.match(route, /isAdminEmail\(session\.user\.email\)/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(route, /toCsv\(/);
  assert.match(code(read("src/app/admin/host-waitlist/page.tsx")), /await requireAdminPage\(\)/);
  assert.match(read("src/components/admin-sidebar.tsx"), /href: "\/admin\/host-waitlist"/);
});

test("the table is kept off the public Supabase API", () => {
  assert.match(migration, /alter table host_waitlist enable row level security;/);
  assert.match(migration, /email\s+citext not null unique/);
  assert.match(migration, /^begin;/);
  assert.match(migration, /commit;\s*$/);
});

test("the email is wired the documented way", () => {
  const email = read("src/lib/email.ts");
  assert.match(email, /\| "host-waitlist-joined"/);
  assert.match(email, /"host-waitlist-joined": \(\) => "You're on the Click host waitlist"/);
  assert.ok(existsSync(path.join(root, "emails/host-waitlist-joined.html")));
  assert.match(read("CLAUDE.md"), /\| `host-waitlist-joined` \| `joinHostWaitlistAction`/);
  assert.match(read("scripts/send-test-emails.mjs"), /"host-waitlist-joined": "You're on the Click host waitlist"/);
});

test("the homepage carries the form beside the instant-access signup link", () => {
  assert.match(home, /<HostWaitlistForm \/>/);
  assert.match(home, /<section id="hosts"/);
  // Beside, not instead: the bookend still links the instant-access signup.
  assert.match(home, /href="\/merchant\/signup"/);
  assert.match(read(".claude/skills/repo-map/SKILL.md"), /`\/admin\/host-waitlist`/);
});

test("copy follows the language canon", () => {
  const files = [
    "src/app/page.tsx",
    "src/app/host-waitlist/actions.ts",
    "src/components/host-waitlist-form.tsx",
    "src/lib/host-waitlist.ts",
    "src/lib/host-event-types.ts",
    "src/app/admin/host-waitlist/page.tsx",
    "src/app/api/admin/host-waitlist/route.ts",
    "emails/host-waitlist-joined.html",
    "database/081_host_waitlist.sql",
  ];
  for (const file of files) {
    assert.doesNotMatch(read(file), /\u2014/, `${file} has an em-dash`);
  }
  // The words people read: the form and the email (code has .match() calls).
  for (const file of ["src/components/host-waitlist-form.tsx", "emails/host-waitlist-joined.html"]) {
    const src = read(file);
    assert.doesNotMatch(src, /\bmatch(es|ed)?\b/i, `${file} says "match"`);
    assert.doesNotMatch(src, /click on\b/i, `${file} says "click on"`);
    assert.doesNotMatch(src, /\bjust\b/i, `${file} says "just"`);
  }
});
