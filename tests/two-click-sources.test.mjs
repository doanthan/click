// CHANGE BRIEF 2026-09-30 "Two click sources" - the §4 tests, in this suite's
// style: static assertions that the shipped source still carries each rule, plus the
// one pure helper exercised directly. They pin what the SQL SAYS, not what it does
// on real rows - nothing in `npm test` has a database to run it against.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// The real helper - Node strips the types on import.
import {
  DAILY_PICK_COUNT,
  dashboardPickIndex,
} from "../src/lib/clicks/daily-picks.ts";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
// Comments out, so a rule about code or copy is not satisfied (or tripped) by the
// comment explaining it.
const code = (src) =>
  src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const slice = (src, start, end) => {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  assert.ok(a > -1 && b > a, `failed to slice ${start}`);
  return src.slice(a, b);
};

const repo = read("src/lib/event-repository.ts");
const people = read("src/app/people/page.tsx");
const dashboard = read("src/app/dashboard/page.tsx");
const card = read("src/components/click-with-someone-user-card.tsx");
const postEventCard = read("src/components/post-event-click-card.tsx");
const modal = read("src/components/profile-modal.tsx");
const send = slice(repo, "async function sendClickInner(", "export async function createUserClickForSession(");
const pool = slice(repo, "export async function getSuggestedPeople(", "function strongestPickSignal(");
const ensure = slice(repo, "async function ensureDailyPicks(", "export async function getDailyPicks(");
const dailyRead = slice(repo, "export async function getDailyPicks(", "export async function generateDailyPicksForAll(");
const job = slice(repo, "export async function generateDailyPicksForAll(", "export type MutualClickEntry = {");

test("1. the Click page lists today's picks, each with a click and View profile", () => {
  assert.match(people, /getDailyPicks\(session\)/);
  assert.match(code(people), /\{picks\.map\(\(person, i\) => \(/);
  assert.match(code(people), /<ClickWithSomeoneUserCard person=\{person\} \/>/);
  // The card behind every pick: the send and the View profile ghost, paired.
  assert.match(code(card), /click with \{firstName\}/);
  assert.match(code(card), /View profile/);
  // The brief's heading, the set's real size in it, and the lock line with its rules.
  assert.match(people, /`\$\{picks\.length\} people you might click with today`/);
  assert.match(people, /Three new people, every day\./);
  assert.match(people, /picks\.length === DAILY_PICK_COUNT \?/);
  assert.equal(DAILY_PICK_COUNT, 3);
  assert.match(code(people), /Clicking is anonymous - we&apos;ll only show you if it&apos;s mutual\./);
  assert.match(code(people), /How clicking works/);
  // §2.1: the post-event-only framing is not on this page.
  for (const banned of [/after an event you both went to/i, /See who else is going/i]) {
    assert.doesNotMatch(code(people), banned);
    assert.doesNotMatch(code(dashboard), banned);
  }
});

test("2. the dashboard shows one of the same picks and moves on every 3 hours", () => {
  assert.match(dashboard, /getDailyPicks\(session\)/);
  assert.match(dashboard, /const pickIndex = dashboardPickIndex\(hourOfDay, picks\.length\);/);
  assert.match(code(dashboard), /<ClickWithSomeoneUserCard key=\{pick\.id\} person=\{pick\} \/>/);
  assert.doesNotMatch(dashboard, /sixHourIndex|getSuggestedPeople\(/);
  // The Sydney hour, the greeting's clock (bug board #286), not the server's.
  assert.match(dashboard, /const hourOfDay = Number\(sydneyHour\.format\(new Date\(\)\)\);/);

  // pick[floor(hoursSinceMidnight / 3) % 3]: advance the clock 3 hours, next pick.
  assert.deepEqual(
    [0, 1, 2, 3, 5, 6, 8, 9, 12, 15, 18, 21, 23].map((hour) => dashboardPickIndex(hour, 3)),
    [0, 0, 0, 1, 1, 2, 2, 0, 1, 2, 0, 1, 1],
  );
  for (let hour = 0; hour + 3 < 24; hour += 1) {
    assert.equal(dashboardPickIndex(hour + 3, 3), (dashboardPickIndex(hour, 3) + 1) % 3, `hour ${hour}`);
  }
  // A thin day still rotates through what it has, and an empty one shows nothing.
  assert.deepEqual([0, 3, 6, 9].map((hour) => dashboardPickIndex(hour, 2)), [0, 1, 0, 1]);
  assert.equal(dashboardPickIndex(14, 1), 0);
  assert.equal(dashboardPickIndex(14, 0), null);
});

test("3. the dashboard and the Click page share one click state - one person, one click", () => {
  // Both read the same rows; neither filters a clicked pick out, so a tap on the
  // dashboard shows as "clicked" on the Click page rather than vanishing.
  assert.doesNotMatch(code(dashboard), /alreadyClicked/);
  assert.doesNotMatch(code(people), /alreadyClicked/);
  assert.match(card, /const sent = flipped \|\| person\.alreadyClicked;/);
  // The state is the viewer's live click from EITHER source.
  const clicked = dailyRead.slice(
    dailyRead.indexOf("select 1 from clicks c"),
    dailyRead.indexOf(") as already_clicked,"),
  );
  assert.ok(clicked.length > 0, "failed to slice the already_clicked expression");
  assert.match(clicked, /c\.sender_id = \$1::uuid\s*and c\.receiver_id = p\.id\s*and c\.status = 'pending'/);
  assert.doesNotMatch(clicked, /event_id/);
  // A second tap from the other surface is the duplicate no-op, not a second row.
  assert.match(send, /where sender_id = \$1::uuid and receiver_id = \$2::uuid\s*and status = 'pending'\s*limit 1/);
  assert.match(send, /const isDuplicate = existing\.rows\.length > 0 \|\| liveMutual\.rows\.length > 0;/);
});

test("4. View profile opens the profile with the click only from the click surfaces", () => {
  // The two click surfaces open the modal, with their OWN control as its footer.
  for (const [name, src] of [["daily picks card", card], ["who was there", postEventCard]]) {
    assert.match(src, /import \{ ProfileModal, opensInPlace \} from "\.\/profile-modal";/, name);
    assert.match(src, /footer=\{control\(true\)\}/, name);
    // Tapping it inside the modal submits the card's own form, then closes.
    assert.match(src, /formRef\.current\?\.requestSubmit\(\);\s*\n\s*setProfileOpen\(false\);/, name);
    assert.match(src, /onClick=\{openProfile\}/, name);
  }
  // The modal sends nothing of its own - it renders the footer it is handed.
  assert.doesNotMatch(modal, /clickPersonAction|clickCoAttendeeAction|createUserClickForSession/);
  assert.match(code(modal), /\{footer\}/);
  // From the event page's attendee list, Your clicks and the profile page itself:
  // read-only - never the modal, never a send.
  for (const file of [
    "src/components/event-attendee-preview.tsx",
    "src/components/clicks-list.tsx",
    "src/app/profile/[userId]/page.tsx",
  ]) {
    const src = read(file);
    assert.doesNotMatch(src, /ProfileModal|clickPersonAction|clickCoAttendeeAction/, file);
  }
  // Your clicks on the Click page links the page, not the modal.
  const yourClicks = slice(people, "function YourClickRow(", "\n}\n");
  assert.doesNotMatch(yourClicks, /onOpenProfile|ProfileModal/);
  // And the modal's read never ships the owner's dating toggle to the browser.
  const loader = slice(
    read("src/app/profile/[userId]/actions.ts"),
    "export async function loadProfilePreviewAction(",
    "\n}\n",
  );
  assert.doesNotMatch(loader, /datingVisible:/);
  assert.match(loader, /intents: visibleIntentsFor\(profile, own\?\.datingVisible === true\),/);
});

test("5. an explore click and a who-was-there click form one mutual, and the reveal is true for both", () => {
  // The send pairs across sources (the C4.8 test in click-coordination holds the
  // detail); the mutual carries the night the two of them share if either click
  // came from one, which is the line the reveal prints.
  assert.match(send, /const sharedEventId = eventId \?\? reciprocalClick\.event_id;/);
  assert.match(send, /source_event_id, source\)/);
  const reveal = read("src/components/mutual-reveal.tsx");
  assert.match(reveal, /\{entry\.sourceEventTitle \? \(/);
  // S3's "You were both at [Event] on [Day]": the day is that same night's, on
  // Sydney's clock (formatted on the server, never in the browser's zone).
  assert.match(
    reveal,
    /You were both at \{entry\.sourceEventTitle\}\s*\{entry\.sourceEventDay \? ` on \$\{entry\.sourceEventDay\}` : null\}\./,
  );
  assert.match(repo, /source_event\.title as source_event_title,\s*source_event\.starts_at as source_event_starts_at,/);
  assert.match(repo, /const SOURCE_EVENT_WEEKDAY = new Intl\.DateTimeFormat\("en-AU", \{\s*weekday: "long",\s*timeZone: APP_TIME_ZONE,\s*\}\);/);
  assert.match(
    repo,
    /sourceEventDay:\s*row\.source_event_title && row\.source_event_starts_at\s*\? SOURCE_EVENT_WEEKDAY\.format\(new Date\(row\.source_event_starts_at\)\)\s*: null,/,
  );
  // Two explore clicks leave no event: the intent pill and shared tags carry it.
  assert.match(reveal, /\{entry\.intentLine\}/);
  assert.match(reveal, /entry\.sharedTags\.map/);
});

test("6. the daily pick pool excludes everyone the brief lists", () => {
  // Already clicked (either source), a live mutual, a block either way, visibility
  // off or paused or banned, "not feeling it" (declined), a recently released pair.
  for (const [rule, re] of [
    ["already clicked", /and not exists \(\s*select 1 from clicks uc\s*where uc\.sender_id = \$1::uuid\s*and uc\.receiver_id = p\.id\s*and uc\.status = 'pending'/],
    ["live mutual", /select 1 from mutual_clicks mc\s*where mc\.status = 'active'/],
    ["blocked", /select 1 from user_blocks b/],
    ["visibility off", /and p\.social_visible = true/],
    ["paused", /and \(p\.paused_until is null or p\.paused_until <= now\(\)\)/],
    ["banned", /and p\.is_banned = false/],
    ["declined", /select 1 from pair_suppressions ps\s*where ps\.expires_at > now\(\)/],
    ["released", /where rc\.status = 'released'/],
  ]) {
    assert.match(pool, re, rule);
  }
  // The pool itself reads only the viewer's OWN clicks. The one place an incoming
  // click counts is the bounded click-back slot below, never the pool's order.
  assert.doesNotMatch(pool, /receiver_id = \$1::uuid/);
  // Picks come only from that pool, three a day, written once under a per-viewer lock.
  assert.match(ensure, /const candidates = await getSuggestedPeople\(viewerId\);/);
  assert.match(ensure, /pg_advisory_xact_lock\(hashtext\(\$1\)::bigint\)`, \[\s*`daily-picks:\$\{viewerId\}`/);
  assert.match(ensure, /where not exists \(\s*select 1 from daily_picks\s*where profile_id = \$1::uuid and pool_date = \$\{DAILY_PICK_DAY_SQL\}/);
  // The job emits no notification of any kind.
  for (const src of [ensure, job]) {
    assert.doesNotMatch(src, /insert into notifications|logEmailEvent\(|sendTransactionalEmail\(/);
  }
  // And it runs, on the cron guard every other cron has, in the Sydney morning.
  const route = read("src/app/api/cron/daily-picks/route.ts");
  assert.match(route, /Bearer \$\{secret\}/);
  assert.match(route, /generateDailyPicksForAll\(\)/);
  const crons = JSON.parse(read("vercel.json")).crons;
  assert.ok(crons.some((c) => c.path === "/api/cron/daily-picks" && c.schedule === "0 19 * * *"));
});

test("6b. a live click at you earns its sender ONE unmarked daily pick, once", () => {
  // Doan, 2026-09-30 (click-mechanic Loom): after Ava clicks Mia, Mia meets Ava's
  // card on her Click page or dashboard so she can click back.
  const clickBack = slice(repo, "async function clickBackPick(", "async function ensureDailyPicks(");
  // Live clicks aimed at the viewer, closest to lapsing first...
  assert.match(clickBack, /where c\.receiver_id = \$1::uuid\s*and c\.status = 'pending'\s*and c\.expires_at > now\(\)/);
  assert.match(clickBack, /order by c\.expires_at asc/);
  // ...once per click: not if the viewer has been picked them since it went out.
  assert.match(
    clickBack,
    /dp\.picked_profile_id = c\.sender_id\s*and dp\.pool_date >= \(c\.created_at at time zone '\$\{APP_TIME_ZONE\}'\)::date/,
  );
  // ...through every gate the pool has, and tagged on the server only.
  assert.match(clickBack, /await getSuggestedPeople\(viewerId, senders\)/);
  assert.match(clickBack, /reason: "click_back"/);
  // The pool narrows to those people without losing a gate.
  assert.match(pool, /and \(\$2::uuid\[\] is null or p\.id = any\(\$2::uuid\[\]\)\)/);
  // At most one of the three, never twice (it is filtered out of the ranked rest).
  assert.match(ensure, /const clickBack = await clickBackPick\(pool, viewerId\);/);
  assert.match(ensure, /\.filter\(\(pick\) => pick\.id !== clickBack\?\.id\)/);
  assert.match(ensure, /\(clickBack \? \[clickBack, \.\.\.ranked\] : ranked\)\.slice\(0, DAILY_PICK_COUNT\)/);
  // No position tells: the read orders the day's set by its random ids.
  assert.match(dailyRead, /order by dp\.created_at, dp\.id/);
  assert.doesNotMatch(clickBack, /insert into notifications|logEmailEvent\(|sendTransactionalEmail\(/);
});

test("7. GET /api/people/daily never reveals whether a pick clicked the caller", () => {
  const route = read("src/app/api/people/daily/route.ts");
  assert.match(route, /const picks = await getDailyPicks\(session\);/);
  assert.match(route, /if \(!session\?\.user\?\.email\)/);
  assert.match(route, /private, no-store/);
  // The payload type: the card's facts and the caller's own state, nothing else.
  const type = code(slice(repo, "export type DailyPick = {", "\n};"));
  assert.doesNotMatch(type, /\breason\b|\bscore\b|\brank\b|clickedYou|theyClicked|incoming/i);
  // The read looks at the caller's clicks OUT only - never one aimed at them.
  assert.doesNotMatch(dailyRead, /receiver_id = \$1::uuid|c\.sender_id = p\.id/);
  // ...and never selects why the person was picked.
  assert.doesNotMatch(dailyRead, /dp\.reason|reason as/);
});

test("the send gates each source (brief §3.5) and the API answers 403 / 409", () => {
  // explore: only today's picks, refused with the same neutral string as any
  // receiver-state refusal.
  const explore = send.slice(send.indexOf('surface = "discovery";'));
  assert.match(explore, /select 1 from daily_picks\s*where profile_id = \$1::uuid\s*and pool_date = \$\{DAILY_PICK_DAY_SQL\}\s*and picked_profile_id = \$2::uuid/);
  assert.match(explore, /throw notEligibleError\("Receiver is not one of the sender's daily picks for today\."\);/);
  // post_event: attendance refuses neutrally (403), a closed window says so (409).
  assert.match(send, /throw notEligibleError\(\s*pairResult\.rows\[0\]\?\.ok/);
  const notEligible = slice(repo, "function notEligibleError(", "\n}\n");
  assert.match(notEligible, /httpStatus = 403;/);
  const windowClosed = send.slice(send.indexOf("That event is wrapped up now"));
  assert.match(windowClosed.slice(0, windowClosed.indexOf("throw error;")), /httpStatus = 409;/);
  // The source is the caller's to name, and the shape is checked before anything.
  assert.match(send, /if \(\(input\.source === "post_event"\) !== Boolean\(input\.sourceEventId\)\) \{/);
  const route = read("src/app/api/clicks/route.ts");
  assert.match(route, /if \(body\.source !== "explore" && body\.source !== "post_event"\) \{/);
  assert.match(route, /const status = \(error as Error & \{ httpStatus\?: number \}\)\.httpStatus \?\? 400;/);
  // Both product surfaces name their source.
  assert.match(read("src/app/people/actions.ts"), /source: "explore"/);
  assert.match(read("src/app/dashboard/actions.ts"), /source: "post_event"/);
});

test("Event Detail and its attendee list carry no click button", () => {
  // The brief's grep, pointed at this repo's files: the event detail modal and the
  // "Who's going" list may say "click with" in prose (the DS teaser line), but never
  // hold a control that sends one.
  for (const file of ["src/components/event-detail-modal.tsx", "src/components/event-attendee-preview.tsx"]) {
    const src = read(file);
    assert.doesNotMatch(
      src,
      /ClickWithSomeoneUserCard|PostEventClickCard|ProfileModal|clickPersonAction|clickCoAttendeeAction/,
      file,
    );
    assert.doesNotMatch(code(src), /click with \{/, `${file} renders a click button`);
  }
  // The event page's one click surface is the who-was-there card after the event
  // ends - the post-event source itself, kept there by decision (2026-09-30) so the
  // per-event clicks stay reachable once the dashboard has stopped asking.
  const eventPage = read("src/app/events/[slug]/page.tsx");
  assert.doesNotMatch(eventPage, /ClickWithSomeoneUserCard|ProfileModal|clickPersonAction/);
  assert.equal((eventPage.match(/<PostEventClickCard\b/g) ?? []).length, 1);
});

test("§2.6: no refresh time, no count left, no countdown to tomorrow", () => {
  for (const [name, src] of [["people", people], ["dashboard", dashboard], ["card", card]]) {
    assert.doesNotMatch(
      code(src),
      /refreshes in|left today|new picks at|picks at \d|until tomorrow|tomorrow's picks|next picks/i,
      name,
    );
  }
});
