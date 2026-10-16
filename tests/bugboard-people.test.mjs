// Bug board PEOPLE rows (#190, #224, #225, #230/#231, #234, #255, #257, #266,
// #271). Source assertions, like click-mechanic.test.mjs: the only database this
// repo can reach is production, so each test pins the clause that would have to be
// deleted to bring the bug back.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file) => readFileSync(path.join(process.cwd(), file), "utf8");

const repo = read("src/lib/event-repository.ts");
const slice = (start, end) => {
  const a = repo.indexOf(start);
  const b = repo.indexOf(end, a + start.length);
  assert.ok(a > -1 && b > a, `failed to slice ${start}`);
  return repo.slice(a, b);
};
const sendClickInner = slice("async function sendClickInner(", "export async function createUserClickForSession(");
// JSX/TS with comments removed, so a test about copy is not satisfied by the
// comment explaining why the copy went.
const code = (src) => src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/^[ \t]*\/\/.*$/gm, "");

// #190, tightened by build prompt 1 (01 §2): "has a photo" is profiles.photo_status
// = 'ok' - the stored photo was checked to load publicly and is not a placeholder,
// stock or default image. A URL alone never passes, anywhere.
test("#190: a sender without a passing photo is refused, after every receiver check", () => {
  const gate = sendClickInner.indexOf('if (sender?.photo_status !== "ok")');
  assert.ok(gate > -1, "R_PHOTO must test the sender's photo_status");
  assert.match(sendClickInner, /"Add a profile photo before you can click with anyone\."/);
  // A failed photo is named as failed, never as missing.
  assert.match(sendClickInner, /sender\?\.photo_status === "failed"/);
  // 21_CLICK_MECHANIC §6.1 check-ordering: sender-own state only after receiver
  // eligibility (the post-event attendance check is the last of it), and before the cap.
  assert.ok(gate > sendClickInner.indexOf("const pairResult"), "R_PHOTO ran before receiver eligibility");
  assert.ok(gate < sendClickInner.indexOf("// Cap check inside the transaction"), "R_PHOTO must precede R_CAP");
  assert.doesNotMatch(sendClickInner, /resolveAvatarImage/);
});

test("#190: a receiver without a passing photo is a neutral refusal, from the row the send already reads", () => {
  assert.match(sendClickInner, /paused_until::text, default_attend_visibility, photo_status, is_test,/);
  assert.match(
    sendClickInner,
    /if \(clickedProfile\.photo_status !== "ok"\) \{\s*\n\s*throw notEligibleError\("Receiver has no passing profile photo\."\);/,
  );
});

test("#190: every roster that offers someone to click with requires a passing photo", () => {
  const photo = /and other\.photo_status = 'ok'/;
  const prompts = slice("export async function getPostEventClickPrompts(", "export async function getPostEventClickPromptForEvent(");
  const forEvent = slice("export async function getPostEventClickPromptForEvent(", "export async function answerPostEventWindowForSession(");
  const push = slice("export async function notifyPostEventClickPrompts(", "\n}\n");
  assert.match(prompts, photo);
  assert.match(forEvent, photo);
  assert.match(push, photo, "the push must not fire for a night whose roster is empty");
  const pool = slice("export async function getSuggestedPeople(", "export type MutualClickEntry");
  assert.match(pool, /and p\.photo_status = 'ok'/);
  // The URL tests are gone - a URL is not a face (the 2026-10-12 402 outage).
  for (const [name, src] of [["prompts", prompts], ["forEvent", forEvent], ["push", push], ["pool", pool]]) {
    assert.doesNotMatch(src, /photo_url is not null|photo_url <> ''|nullif\(btrim\(other\.photo_url\)|resolveAvatarImage/, name);
  }
});

test("#190/#255: /people warns a viewer without a passing photo up front and describes its pool honestly", () => {
  const people = read("src/app/people/page.tsx");
  assert.match(people, /const viewerHasPhoto = profileStatus\.photoStatus === "ok";/);
  assert.match(people, /\{viewerHasPhoto \? null : \(/);
  // A failed photo says it failed (01 §2: never a silent silhouette).
  assert.match(code(people), /Your photo didn't work/);
  // getSuggestedPeople never filtered on overlap, so the empty state may not claim it.
  assert.doesNotMatch(code(people), /real overlap/);
  assert.match(code(people), /Suggestions come from members with a photo and a finished profile/);
});

test("#329: the dashboard asks a viewer without a passing photo for one instead of offering a pick", () => {
  const dashboard = read("src/app/dashboard/page.tsx");
  assert.match(dashboard, /const viewerHasPhoto = profileStatus\.photoStatus === "ok";/);
  // The photo state comes BEFORE the pick, so a pick never renders without one.
  const photoBranch = dashboard.indexOf("{!viewerHasPhoto ? (");
  const pickBranch = dashboard.indexOf(") : pick ? (");
  assert.ok(photoBranch > -1 && pickBranch > photoBranch, "photo check must gate the pick");
  assert.match(dashboard.slice(photoBranch, pickBranch), /actionHref="\/profile\/edit"/);
  assert.match(dashboard.slice(photoBranch, pickBranch), /Your photo didn't work - upload it again\./);
});

test("#266/#230/#231: the People Card flips on the tap - no spinner, no confetti", () => {
  const card = read("src/components/click-with-someone-user-card.tsx");
  assert.doesNotMatch(code(card), /fireBrandConfetti|CLICK_PUFF|brand-confetti/);
  assert.match(card, /const flipped = submitting \|\| state\?\.ok === true;/);
  assert.match(card, /const sent = flipped \|\| person\.alreadyClicked;/);
  assert.doesNotMatch(card, /loading=\{submitting\}/, "Stage 1: no spinner on the send");
  // One footprint: the landing never replays the pill's entrance, and a retry does
  // not carry the previous refusal under its fresh "clicked".
  assert.match(card, /className: flipped \? "rise-soft" : ""/);
  assert.match(card, /\{mutualId \|\| submitting \? null : <Status state=\{state\} \/>\}/);
  // The sent-click burst is gone at the source too.
  assert.doesNotMatch(read("src/components/brand-confetti.ts"), /export const CLICK_PUFF/);
});

test("#234: a post-event click flips on the tap, and a refusal still explains itself", () => {
  const card = read("src/components/post-event-click-card.tsx");
  const row = card.slice(card.indexOf("function CoAttendeeRow("));
  assert.match(row, /const sent = submitting \|\| state\?\.ok === true \|\| person\.alreadyClicked;/);
  assert.doesNotMatch(row, /loading=\{submitting\}/);
  // The refusal line is the People Card's footer now (bug board #293/#297).
  assert.match(row, /footer=\{\s*state\?\.message && !mutualId && !submitting \? \(/);
  assert.match(
    row,
    /if \(state\?\.ok\) announceClickSent\(person\.id\);/,
    "the reveal host still hears about the send - and who it went to",
  );
});

test("#266: the mutual reveal is the celebration - a soft pop, never particles", () => {
  const reveal = read("src/components/mutual-reveal.tsx");
  assert.match(reveal, /className="ck-coord-pop grid h-\[74px\] w-\[74px\]/);
  assert.doesNotMatch(code(reveal), /confetti/i);
  // Scale, never fade (COORDINATION_MODAL_SYSTEM §5): the disc is visible on frame one.
  const css = read("src/app/globals.css");
  const pop = css.slice(css.indexOf("@keyframes ck-coord-pop"), css.indexOf(".ck-coord-pop {"));
  assert.ok(pop.length > 0, "the pop keyframes exist");
  assert.doesNotMatch(pop, /opacity/);
});

test("#225: a pair already seated together reach both-going when the mutual forms", () => {
  const fresh = sendClickInner.slice(sendClickInner.indexOf("if (freshMutualId) {"));
  assert.match(
    fresh,
    /afterResponse\(\(\) => detectConfirmedTogetherForPair\(pool, profile\.id, otherId\)\);/,
    "after the response, or the mutual path grows a latency tell",
  );
  const helper = slice("async function detectConfirmedTogetherForPair(", "\n}\n");
  assert.equal((helper.match(/event_participants_v/g) ?? []).length, 2, "both seats, canonical roster");
  assert.match(helper, /if \(eventId\) await detectConfirmedTogether\(pool, eventId, profileId\);/);
});

test("#224/#225: the seated-together night outranks a suggestion nobody accepted", () => {
  const mapper = slice("export async function getProposalsForSession(", "export async function getMutualRevealState(");
  assert.match(
    mapper,
    /\(!row\.event_slug \|\| \(row\.coord_state === "confirmed_together" && row\.status === "pending"\)\)/,
  );
  assert.match(mapper, /suggestedEventSlug: independentPlan \? row\.both_going_slug : row\.event_slug,/);
  // The SUGGESTED event's flags never describe an independent plan - its night has
  // its own started flag, off the both_going lateral (S11/S12 read it once the doors open).
  assert.match(
    mapper,
    /suggestedEventStarted: independentPlan\s*\?\s*Boolean\(row\.both_going_started\)\s*:\s*Boolean\(row\.event_started\),/,
  );
  // The list row mirrors the drawer's projectStep, which already reads the win state
  // off coord_state.
  const list = read("src/components/clicks-list.tsx");
  assert.match(list, /if \(e\.status === "confirmed" \|\| e\.coordState === "confirmed_together"\) \{/);
});

test("#271/#257: a profile has no click button and no standing safety essay", () => {
  const safety = read("src/components/profile-safety-controls.tsx");
  assert.doesNotMatch(code(safety), /Muting stops notifications/);
  // The consequence that matters is still told where it lands: the block confirm.
  assert.match(safety, /description=\{`\$\{BLOCK_CONSEQUENCE\}/);
  const profile = read("src/app/profile/[userId]/page.tsx");
  assert.doesNotMatch(profile, /clickPersonAction|ClickWithSomeoneUserCard|createUserClickForSession/);
});
