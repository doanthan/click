// The pre-launch /waitlist ("Request an invite"), in this suite's style: static
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

const action = code(read("src/app/waitlist/actions.ts"));
const lib = code(read("src/lib/launch-waitlist.ts"));
const form = code(read("src/components/waitlist-form.tsx"));
const page = code(read("src/app/waitlist/page.tsx"));

test("a repeat address is answered exactly like a new one", () => {
  // The browser gets the area of what was typed and the person's own link -
  // never whether the row was new, and never the stored row's area.
  assert.match(action, /return \{ status: "done", area, shareUrl \};/);
  assert.match(action, /const area = waitlistAreaFor\(place\);/);
  assert.doesNotMatch(action, /status: "done"[^}]*isNew/);
  // The email goes on the first request only, after the response.
  assert.match(action, /if \(isNew\) \{\s*after\(\(\) =>\s*logEmailEvent\(\{\s*template: "launch-waitlist-joined"/);
});

test("a repeat request can't rewrite someone else's row", () => {
  // Anyone can type anyone's address: the conflict branch only re-reads.
  assert.match(lib, /on conflict \(email\) do update set email = launch_waitlist\.email/);
  assert.match(lib, /\(xmax = 0\) as is_new/);
});

test("the action is rate limited before it writes, and drops the bot trap silently", () => {
  assert.ok(action.indexOf("checkRateLimit(") < action.indexOf("joinLaunchWaitlist("));
  assert.match(action, /scope: "launch-waitlist"/);
  // Same field name on both sides, and the trap answers before any limit or write.
  assert.match(form, /name="leave_blank"/);
  assert.match(action, /text\(formData, "leave_blank"\)/);
  assert.ok(action.indexOf('"leave_blank"') < action.indexOf("checkRateLimit("));
});

test("the admin read checks the admin itself", () => {
  assert.match(lib, /if \(!isAdminEmail\(session\?\.user\?\.email\)\) \{\s*throw namedError\("ForbiddenError"/);
  assert.match(lib, /order by referrals desc, w\.created_at asc/);
  const route = code(read("src/app/api/admin/launch-waitlist/route.ts"));
  assert.match(route, /isAdminEmail\(session\.user\.email\)/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(code(read("src/app/admin/launch-waitlist/page.tsx")), /await requireAdminPage\(\)/);
});

test("the table is kept off the public Supabase API", () => {
  const migration = read("database/072_launch_waitlist.sql");
  assert.match(migration, /alter table launch_waitlist enable row level security;/);
  assert.match(migration, /email\s+citext not null unique/);
});

test("the email is wired the documented way", () => {
  const email = read("src/lib/email.ts");
  assert.match(email, /\| "launch-waitlist-joined"/);
  assert.match(email, /"launch-waitlist-joined": \(\) => "You're on the list for Click"/);
  assert.ok(existsSync(path.join(root, "emails/launch-waitlist-joined.html")));
  assert.match(read("CLAUDE.md"), /\| `launch-waitlist-joined` \| `requestInvite`/);
});

test("the page is the chromeless Landing, with its footer and short share links", () => {
  assert.match(read("src/components/chrome-gate.tsx"), /"\/waitlist",/);
  assert.match(page, /<SiteFooter \/>/);
  assert.match(page, /<WaitlistForm refCode=\{refCode\} \/>/);
  assert.match(
    read("next.config.ts"),
    /\{ source: "\/i\/:code", destination: "\/waitlist\?ref=:code", permanent: false \}/,
  );
  // The share card keeps the root image: openGraph would otherwise replace it.
  assert.match(page, /images: openGraph\?\.images/);
});

test("copy follows the language canon", () => {
  const files = [
    "src/app/waitlist/page.tsx",
    "src/app/waitlist/actions.ts",
    "src/components/waitlist-form.tsx",
    "src/lib/launch-waitlist.ts",
    "emails/launch-waitlist-joined.html",
    "database/072_launch_waitlist.sql",
  ];
  for (const file of files) {
    assert.doesNotMatch(read(file), /—/, `${file} has an em-dash`);
  }
  // The acquisition CTA is "Request an invite", never "Join the waitlist".
  assert.match(form, />\s*Request an invite\s*</);
  assert.doesNotMatch(form, /Join (the )?waitlist/i);
});
